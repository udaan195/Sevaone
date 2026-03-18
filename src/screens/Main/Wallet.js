import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, Modal, Image, FlatList, Platform, ScrollView,
  SafeAreaView, StatusBar,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Surface, ActivityIndicator } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import Constants from 'expo-constants';
import { auth, db } from '../../api/firebaseConfig';
import {
  doc, onSnapshot, collection, addDoc, query,
  where, serverTimestamp, setDoc, getDoc, updateDoc, orderBy,
} from 'firebase/firestore';
import { useAppTheme } from '../../context/ThemeContext';

// ── Config ────────────────────────────────────────────────
const CLOUD_NAME    = Constants?.expoConfig?.extra?.cloudinaryCloudName    || 'dxuurwexl';
const UPLOAD_PRESET = Constants?.expoConfig?.extra?.cloudinaryUploadPreset || 'edusphere_uploads';
const UPI_ID        = Constants?.expoConfig?.extra?.walletUpiId            || '7518640453-2@axl';
const UPI_NAME      = Constants?.expoConfig?.extra?.walletUpiName          || 'SewaOne';

async function hashPin(pin) {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    String(pin).trim()
  );
}

const FILTERS = ['All', 'Credit', 'Debit'];

export default function WalletScreen() {
  const { theme, t } = useAppTheme();

  const [loading, setLoading]           = useState(true);
  const [isActivated, setIsActivated]   = useState(false);
  const [balance, setBalance]           = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [showBalance, setShowBalance]   = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');

  // Modals
  const [pinModal, setPinModal]           = useState(false);
  const [addModal, setAddModal]           = useState(false);
  const [changePinModal, setChangePinModal] = useState(false);
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [statModal, setStatModal]         = useState(false);

  // Add money
  const [pin, setPin]               = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [inputPin, setInputPin]     = useState('');
  const [amount, setAmount]         = useState('');
  const [utr, setUtr]               = useState('');
  const [proofImage, setProofImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Change PIN
  const [oldPin, setOldPin]           = useState('');
  const [newPin, setNewPin]           = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');

  // Withdraw
  const [withdrawAmt, setWithdrawAmt]   = useState('');
  const [withdrawUPI, setWithdrawUPI]   = useState('');
  const [withdrawNote, setWithdrawNote] = useState('');

  // PDF generating
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const uid = auth.currentUser?.uid;

  // ── Firestore listeners ──────────────────────────────────
  useEffect(() => {
    if (!uid) return;

    const unsubUser = onSnapshot(doc(db, 'users', uid), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setBalance(d.walletBalance || 0);
        if (d.walletPinHash) setIsActivated(true);
      }
      setLoading(false);
    });

    const unsubPending = onSnapshot(
      query(collection(db, 'wallet_requests'), where('userId', '==', uid), where('status', '==', 'pending')),
      snap => {
        let total = 0;
        snap.forEach(d => total += d.data().amount);
        setPendingAmount(total);
      }
    );

    // ✅ orderBy in Firestore — no client-side sort
    const unsubTx = onSnapshot(
      query(collection(db, 'transactions'), where('userId', '==', uid), orderBy('timestamp', 'desc')),
      snap => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    return () => { unsubUser(); unsubPending(); unsubTx(); };
  }, [uid]);

  // ── Filter logic ─────────────────────────────────────────
  const filteredTx = useMemo(() => {
    if (activeFilter === 'All')    return transactions;
    if (activeFilter === 'Credit') return transactions.filter(tx => tx.type === 'credit');
    return transactions.filter(tx => tx.type === 'debit');
  }, [transactions, activeFilter]);

  // ── Monthly summary ──────────────────────────────────────
  const monthlySummary = useMemo(() => {
    const now = new Date();
    const thisMonth = transactions.filter(tx => {
      try {
        const d = tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date(tx.timestamp);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } catch { return false; }
    });
    const credited = thisMonth.filter(tx => tx.type === 'credit').reduce((s, tx) => s + (tx.amount || 0), 0);
    const debited  = thisMonth.filter(tx => tx.type === 'debit' ).reduce((s, tx) => s + (tx.amount || 0), 0);
    return { credited, debited, count: thisMonth.length };
  }, [transactions]);

  const formatTime = ts => {
    if (!ts) return 'Processing...';
    try {
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch { return 'Recent'; }
  };

  // ── Cloudinary upload ────────────────────────────────────
  const uploadToCloudinary = async uri => {
    setIsUploading(true);
    const data = new FormData();
    data.append('file',           { uri, type: 'image/jpeg', name: 'wallet_proof.jpg' });
    data.append('upload_preset',  UPLOAD_PRESET);
    try {
      const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: 'POST', body: data });
      const json = await res.json();
      return json.secure_url;
    } catch { return null; }
    finally { setIsUploading(false); }
  };

  // ── Activate wallet ──────────────────────────────────────
  const handleActivate = async () => {
    if (pin.length !== 4 || pin !== confirmPin)
      return Alert.alert('Error', 'PIN match nahi ho raha ya 4 digits nahi hain.');
    setLoading(true);
    try {
      const hashed = await hashPin(pin);
      await setDoc(doc(db, 'users', uid), { walletPinHash: hashed }, { merge: true });
      Alert.alert('✅ Wallet Active!', 'Security PIN set ho gaya!');
    } catch { Alert.alert('Error', 'PIN setup fail. Try again.'); }
    finally { setLoading(false); }
  };

  // ── Verify PIN ───────────────────────────────────────────
  const verifyPinForBalance = async () => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      const inputHash = await hashPin(inputPin);
      if (snap.data()?.walletPinHash === inputHash) {
        setShowBalance(true);
        setPinModal(false);
        setInputPin('');
      } else {
        Alert.alert('Galat PIN', 'Dobara try karein.');
      }
    } catch { Alert.alert('Error', 'Verification failed.'); }
  };

  // ── Add money ────────────────────────────────────────────
  const submitAddMoney = async () => {
    if (!amount || !utr || !proofImage)
      return Alert.alert('Required', 'Amount, UTR aur Screenshot zaroori hain.');
    if (parseInt(amount) < 10)
      return Alert.alert('Error', 'Minimum ₹10 add kar sakte hain.');
    setLoading(true);
    try {
      const cloudUrl = await uploadToCloudinary(proofImage);
      if (!cloudUrl) throw new Error('Screenshot upload fail. Internet check karo.');

      await addDoc(collection(db, 'wallet_requests'), {
        userId: uid, amount: parseInt(amount),
        utr: utr.trim(), screenshot: cloudUrl,
        status: 'pending', timestamp: serverTimestamp(),
      });

      // Telegram notification
      const BOT   = Constants?.expoConfig?.extra?.telegramBotToken;
      const CHAT  = Constants?.expoConfig?.extra?.telegramChatId;
      if (BOT && CHAT) {
        const msg =
          `💰 *WALLET RECHARGE REQUEST*\n\n` +
          `👤 User: \`${uid?.substring(0,12)}...\`\n` +
          `💵 Amount: ₹${parseInt(amount)}\n` +
          `🔖 UTR: ${utr.trim()}\n` +
          `📸 Proof: [View](${cloudUrl})\n\n` +
          `👉 [Admin Panel](https://sewaone-admin.netlify.app/wallet-requests)`;
        fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'Markdown' }),
        }).catch(() => {});
      }

      setAddModal(false);
      setAmount(''); setUtr(''); setProofImage(null);
      Alert.alert('✅ Submitted!', '24 ghante mein approve hogi.');
    } catch (e) { Alert.alert('Error', e.message || 'Submission failed.'); }
    finally { setLoading(false); }
  };

  // ── Change PIN ───────────────────────────────────────────
  const handleChangePin = async () => {
    if (newPin.length !== 4 || newPin !== confirmNewPin)
      return Alert.alert('Error', 'Naya PIN mismatch ya 4 digits nahi.');
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.data()?.walletPinHash !== await hashPin(oldPin)) {
        Alert.alert('Error', 'Purana PIN galat hai.');
        return;
      }
      await updateDoc(doc(db, 'users', uid), { walletPinHash: await hashPin(newPin) });
      Alert.alert('✅', 'PIN update ho gaya!');
      setChangePinModal(false);
      setOldPin(''); setNewPin(''); setConfirmNewPin('');
    } catch { Alert.alert('Error', 'PIN update failed.'); }
    finally { setLoading(false); }
  };

  // ── Withdraw request ─────────────────────────────────────
  const submitWithdraw = async () => {
    if (!withdrawAmt || parseInt(withdrawAmt) < 10)
      return Alert.alert('Error', 'Minimum ₹10 withdraw kar sakte hain.');
    if (parseInt(withdrawAmt) > balance)
      return Alert.alert('Insufficient Balance', 'Balance kam hai.');
    if (!withdrawUPI.includes('@'))
      return Alert.alert('Error', 'Valid UPI ID daalo (e.g. name@bank).');
    setLoading(true);
    try {
      await addDoc(collection(db, 'wallet_requests'), {
        userId: uid, type: 'withdraw',
        amount: parseInt(withdrawAmt),
        upiId: withdrawUPI.trim(),
        note: withdrawNote.trim(),
        status: 'pending',
        timestamp: serverTimestamp(),
      });
      setWithdrawModal(false);
      setWithdrawAmt(''); setWithdrawUPI(''); setWithdrawNote('');
      Alert.alert('✅ Withdraw Request', 'Admin review karega aur 24-48 ghante mein process hoga.');
    } catch { Alert.alert('Error', 'Request fail. Try again.'); }
    finally { setLoading(false); }
  };

  // ── PDF Statement ────────────────────────────────────────
  const downloadStatement = async () => {
    setGeneratingPDF(true);
    try {
      const now = new Date();
      const rows = transactions.map(tx => {
        const d = tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date();
        return `<tr style="border-bottom:1px solid #eee">
          <td style="padding:8px">${d.toLocaleDateString('en-IN')}</td>
          <td style="padding:8px">${tx.remark || 'Wallet Operation'}</td>
          <td style="padding:8px;color:${tx.type==='credit'?'#10B981':'#EF4444'};font-weight:bold">
            ${tx.type==='credit'?'+':'-'}₹${tx.amount}
          </td>
          <td style="padding:8px">${tx.type?.toUpperCase()}</td>
        </tr>`;
      }).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>SewaOne Wallet Statement</title>
        <style>body{font-family:Arial,sans-serif;padding:24px;color:#1e293b}
        h1{color:#002855;border-bottom:2px solid #002855;padding-bottom:10px}
        table{width:100%;border-collapse:collapse}th{background:#002855;color:#fff;padding:10px;text-align:left}
        .summary{display:flex;gap:20px;margin:20px 0}
        .stat{background:#f8fafc;border-radius:10px;padding:14px;flex:1;border-left:4px solid}
        </style></head><body>
        <h1>🏦 SewaOne Wallet Statement</h1>
        <p>Generated: ${now.toLocaleString('en-IN')} | User: ${uid?.substring(0,12)}...</p>
        <div class="summary">
          <div class="stat" style="border-color:#002855"><div style="font-size:11px;color:#64748b">BALANCE</div><div style="font-size:22px;font-weight:900;color:#002855">₹${balance}</div></div>
          <div class="stat" style="border-color:#10B981"><div style="font-size:11px;color:#64748b">THIS MONTH CREDIT</div><div style="font-size:22px;font-weight:900;color:#10B981">₹${monthlySummary.credited}</div></div>
          <div class="stat" style="border-color:#EF4444"><div style="font-size:11px;color:#64748b">THIS MONTH DEBIT</div><div style="font-size:22px;font-weight:900;color:#EF4444">₹${monthlySummary.debited}</div></div>
        </div>
        <table><thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Type</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <p style="margin-top:30px;color:#94a3b8;font-size:11px">SewaOne — This is a computer-generated statement.</p>
        </body></html>`;

      const path = FileSystem.documentDirectory + `SewaOne_Statement_${Date.now()}.html`;
      await FileSystem.writeAsStringAsync(path, html);
      await Sharing.shareAsync(path, { mimeType: 'text/html', dialogTitle: 'Wallet Statement' });
    } catch { Alert.alert('Error', 'Statement generate nahi ho saka.'); }
    finally { setGeneratingPDF(false); }
  };

  const s = makeStyles(theme);
  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={theme.primary} />;

  // ── Setup Screen ─────────────────────────────────────────
  if (!isActivated) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: theme.bg }]}>
        <View style={[s.setupWrap, { backgroundColor: theme.bg }]}>
          <View style={[s.setupIcon, { backgroundColor: theme.primary + '20' }]}>
            <MaterialCommunityIcons name="shield-lock" size={56} color={theme.primary} />
          </View>
          <Text style={[s.setupTitle, { color: theme.primary }]}>Wallet Activate Karein</Text>
          <Text style={[s.setupSub, { color: theme.textMuted }]}>
            4-digit security PIN set karein — transactions ke liye zaroori hai
          </Text>
          <TextInput style={[s.pinInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
            placeholder="Set 4-Digit PIN" placeholderTextColor={theme.textMuted}
            secureTextEntry keyboardType="numeric" maxLength={4} onChangeText={setPin} />
          <TextInput style={[s.pinInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
            placeholder="Confirm PIN" placeholderTextColor={theme.textMuted}
            secureTextEntry keyboardType="numeric" maxLength={4} onChangeText={setConfirmPin} />
          <TouchableOpacity style={[s.activateBtn, { backgroundColor: theme.primary }]} onPress={handleActivate}>
            <MaterialCommunityIcons name="shield-check" size={18} color="#fff" />
            <Text style={s.activateBtnText}>Activate Wallet</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main Screen ──────────────────────────────────────────
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" />
      <FlatList
        data={filteredTx}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <>
            {/* Balance Card */}
            <View style={[s.balanceCard, { backgroundColor: '#002855' }]}>
              <Text style={s.balLabel}>WALLET BALANCE</Text>
              <View style={s.balRow}>
                <Text style={s.balAmt}>
                  {showBalance ? `₹${balance.toLocaleString('en-IN')}` : '₹ ••••••'}
                </Text>
                <TouchableOpacity
                  onPress={() => showBalance ? setShowBalance(false) : setPinModal(true)}
                  style={s.eyeBtn}
                >
                  <MaterialCommunityIcons name={showBalance ? 'eye-off' : 'eye'} size={26} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={s.upiRow}>
                <MaterialCommunityIcons name="bank" size={12} color="rgba(255,255,255,0.5)" />
                <Text style={s.upiText}>{UPI_ID}</Text>
              </View>
            </View>

            {/* Pending Alert */}
            {pendingAmount > 0 && (
              <View style={s.pendingBanner}>
                <MaterialCommunityIcons name="clock-outline" size={20} color="#92400E" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.pendingTitle}>₹{pendingAmount} Pending</Text>
                  <Text style={s.pendingSub}>Verification under process</Text>
                </View>
              </View>
            )}

            {/* Monthly Summary */}
            <TouchableOpacity
              style={[s.summaryCard, { backgroundColor: theme.card }]}
              onPress={() => setStatModal(true)}
              activeOpacity={0.85}
            >
              <View style={s.summaryLeft}>
                <MaterialCommunityIcons name="chart-bar" size={18} color="#3B82F6" />
                <Text style={[s.summaryTitle, { color: theme.text }]}>This Month</Text>
              </View>
              <View style={s.summaryStats}>
                <View style={s.summaryStat}>
                  <Text style={s.statUp}>+₹{monthlySummary.credited}</Text>
                  <Text style={[s.statLbl, { color: theme.textMuted }]}>Credit</Text>
                </View>
                <View style={[s.statDivider, { backgroundColor: theme.border }]} />
                <View style={s.summaryStat}>
                  <Text style={s.statDown}>-₹{monthlySummary.debited}</Text>
                  <Text style={[s.statLbl, { color: theme.textMuted }]}>Spent</Text>
                </View>
                <View style={[s.statDivider, { backgroundColor: theme.border }]} />
                <View style={s.summaryStat}>
                  <Text style={[s.statCount, { color: theme.text }]}>{monthlySummary.count}</Text>
                  <Text style={[s.statLbl, { color: theme.textMuted }]}>Txns</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={18} color={theme.border} />
            </TouchableOpacity>

            {/* Action Buttons */}
            <View style={s.actionGrid}>
              {[
                { icon:'plus-circle',   label:'Add Money',   color:'#3B82F6', onPress:() => setAddModal(true) },
                { icon:'arrow-up-circle', label:'Withdraw',  color:'#EF4444', onPress:() => setWithdrawModal(true) },
                { icon:'lock-reset',    label:'Change PIN',  color:'#8B5CF6', onPress:() => setChangePinModal(true) },
                { icon:'file-download', label:'Statement',   color:'#10B981', onPress:downloadStatement, loading:generatingPDF },
              ].map((a, i) => (
                <TouchableOpacity key={i} style={[s.actionBtn, { backgroundColor: theme.card }]} onPress={a.onPress} activeOpacity={0.8}>
                  {a.loading
                    ? <ActivityIndicator size="small" color={a.color} />
                    : <MaterialCommunityIcons name={a.icon} size={26} color={a.color} />
                  }
                  <Text style={[s.actionLabel, { color: theme.textMuted }]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Filter Tabs */}
            <View style={s.filterRow}>
              {FILTERS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[s.filterTab, activeFilter === f && s.filterTabActive]}
                  onPress={() => setActiveFilter(f)}
                >
                  <Text style={[s.filterText, activeFilter === f && s.filterTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <MaterialCommunityIcons name="receipt-text-outline" size={48} color={theme.border} />
            <Text style={[s.emptyText, { color: theme.textMuted }]}>
              {activeFilter === 'All' ? 'Koi transaction nahi' : `Koi ${activeFilter} transaction nahi`}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[s.txRow, { backgroundColor: theme.card }]}>
            <View style={[s.txIcon, { backgroundColor: item.type === 'credit' ? '#DCFCE7' : '#FEE2E2' }]}>
              <MaterialCommunityIcons
                name={item.type === 'credit' ? 'arrow-down-circle' : 'arrow-up-circle'}
                size={22}
                color={item.type === 'credit' ? '#10B981' : '#EF4444'}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[s.txRemark, { color: theme.text }]} numberOfLines={1}>
                {item.remark || 'Wallet Operation'}
              </Text>
              <Text style={[s.txTime, { color: theme.textMuted }]}>{formatTime(item.timestamp)}</Text>
            </View>
            <Text style={[s.txAmt, { color: item.type === 'credit' ? '#10B981' : '#EF4444' }]}>
              {item.type === 'credit' ? '+' : '-'}₹{item.amount}
            </Text>
          </View>
        )}
      />

      {/* ── Add Money Modal ── */}
      <Modal visible={addModal} transparent animationType="slide">
        <View style={m.overlay}>
          <View style={[m.sheet, { backgroundColor: theme.card }]}>
            <View style={m.handle} />
            <View style={m.headerRow}>
              <Text style={[m.title, { color: theme.primary }]}>Add Money</Text>
              <TouchableOpacity onPress={() => setAddModal(false)}>
                <MaterialCommunityIcons name="close" size={22} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={m.qrWrap}>
                <QRCode value={`upi://pay?pa=${UPI_ID}&pn=${UPI_NAME}&am=${amount || 0}&cu=INR`} size={160} />
                <Text style={[m.upiId, { color: theme.primary }]}>{UPI_ID}</Text>
                <Text style={[m.upiName, { color: theme.textMuted }]}>{UPI_NAME}</Text>
              </View>
              <TextInput style={[m.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                placeholder="Amount (₹)" placeholderTextColor={theme.textMuted}
                keyboardType="numeric" value={amount} onChangeText={setAmount} />
              <TextInput style={[m.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                placeholder="UTR / Reference Number (12 digits)" placeholderTextColor={theme.textMuted}
                keyboardType="numeric" maxLength={12} onChangeText={setUtr} />
              <TouchableOpacity
                style={[m.uploadBox, { borderColor: theme.border, backgroundColor: theme.surface }]}
                onPress={async () => {
                  const res = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.5 });
                  if (!res.canceled) setProofImage(res.assets[0].uri);
                }}
              >
                {proofImage ? (
                  <Image source={{ uri: proofImage }} style={m.preview} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="image-plus" size={28} color={theme.primary} />
                    <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 6, fontWeight: '600' }}>
                      Payment Screenshot Upload Karein
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.submitBtn, (isUploading || loading) && { opacity: 0.6 }]}
                onPress={submitAddMoney}
                disabled={isUploading || loading}
              >
                {(isUploading || loading)
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <MaterialCommunityIcons name="check-circle" size={18} color="#fff" />
                      <Text style={m.submitText}>SUBMIT PROOF</Text>
                    </>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Withdraw Modal ── */}
      <Modal visible={withdrawModal} transparent animationType="slide">
        <View style={m.overlay}>
          <View style={[m.sheet, { backgroundColor: theme.card }]}>
            <View style={m.handle} />
            <View style={m.headerRow}>
              <Text style={[m.title, { color: '#EF4444' }]}>Withdraw Request</Text>
              <TouchableOpacity onPress={() => setWithdrawModal(false)}>
                <MaterialCommunityIcons name="close" size={22} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={[m.balBadge, { backgroundColor: '#EBF5FB' }]}>
              <Text style={{ color: '#002855', fontWeight: '800', fontSize: 13 }}>
                Available: ₹{balance.toLocaleString('en-IN')}
              </Text>
            </View>
            <TextInput style={[m.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
              placeholder="Withdraw Amount (₹)" placeholderTextColor={theme.textMuted}
              keyboardType="numeric" value={withdrawAmt} onChangeText={setWithdrawAmt} />
            <TextInput style={[m.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
              placeholder="Your UPI ID (e.g. name@upi)" placeholderTextColor={theme.textMuted}
              autoCapitalize="none" value={withdrawUPI} onChangeText={setWithdrawUPI} />
            <TextInput style={[m.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
              placeholder="Note (optional)" placeholderTextColor={theme.textMuted}
              value={withdrawNote} onChangeText={setWithdrawNote} />
            <View style={[m.infoBox, { backgroundColor: '#FEF3C7' }]}>
              <MaterialCommunityIcons name="information" size={14} color="#92400E" />
              <Text style={{ fontSize: 11, color: '#92400E', flex: 1, marginLeft: 6 }}>
                Withdraw request admin review ke baad 24-48 ghante mein process hogi.
              </Text>
            </View>
            <TouchableOpacity style={[m.submitBtn, { backgroundColor: '#EF4444' }]} onPress={submitWithdraw} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <MaterialCommunityIcons name="arrow-up-circle" size={18} color="#fff" />
                    <Text style={m.submitText}>SUBMIT REQUEST</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Change PIN Modal ── */}
      <Modal visible={changePinModal} transparent animationType="slide">
        <View style={m.overlay}>
          <View style={[m.sheet, { backgroundColor: theme.card }]}>
            <View style={m.handle} />
            <Text style={[m.title, { color: theme.primary, textAlign: 'center', marginBottom: 16 }]}>Change Security PIN</Text>
            {[
              { ph: 'Current PIN', fn: setOldPin },
              { ph: 'New PIN', fn: setNewPin },
              { ph: 'Confirm New PIN', fn: setConfirmNewPin },
            ].map((inp, i) => (
              <TextInput key={i}
                style={[m.pinInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                placeholder={inp.ph} placeholderTextColor={theme.textMuted}
                secureTextEntry keyboardType="numeric" maxLength={4}
                onChangeText={inp.fn}
              />
            ))}
            <TouchableOpacity style={m.submitBtn} onPress={handleChangePin} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={m.submitText}>SAVE NEW PIN</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setChangePinModal(false)} style={m.cancelBtn}>
              <Text style={[m.cancelText, { color: theme.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── PIN Verify Modal ── */}
      <Modal visible={pinModal} transparent animationType="fade">
        <View style={[m.overlay, { justifyContent: 'center' }]}>
          <View style={[m.miniSheet, { backgroundColor: theme.card }]}>
            <MaterialCommunityIcons name="lock" size={36} color={theme.primary} style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={[m.title, { color: theme.primary, textAlign: 'center', marginBottom: 16 }]}>Enter PIN</Text>
            <TextInput
              style={[m.pinInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
              secureTextEntry keyboardType="numeric" maxLength={4}
              onChangeText={setInputPin} placeholder="••••" placeholderTextColor={theme.textMuted}
              autoFocus
            />
            <TouchableOpacity style={m.submitBtn} onPress={verifyPinForBalance}>
              <Text style={m.submitText}>VERIFY</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPinModal(false)} style={m.cancelBtn}>
              <Text style={[m.cancelText, { color: theme.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Monthly Stats Modal ── */}
      <Modal visible={statModal} transparent animationType="slide">
        <View style={m.overlay}>
          <View style={[m.sheet, { backgroundColor: theme.card }]}>
            <View style={m.handle} />
            <View style={m.headerRow}>
              <Text style={[m.title, { color: theme.primary }]}>Monthly Summary</Text>
              <TouchableOpacity onPress={() => setStatModal(false)}>
                <MaterialCommunityIcons name="close" size={22} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
            {[
              { label: 'Total Credit', val: `₹${monthlySummary.credited}`, color: '#10B981', icon: 'arrow-down-circle' },
              { label: 'Total Spent',  val: `₹${monthlySummary.debited}`,  color: '#EF4444', icon: 'arrow-up-circle'   },
              { label: 'Transactions', val: `${monthlySummary.count}`,      color: '#3B82F6', icon: 'swap-horizontal'   },
              { label: 'Net',          val: `₹${monthlySummary.credited - monthlySummary.debited}`, color: '#8B5CF6', icon: 'calculator' },
            ].map((row, i) => (
              <View key={i} style={[m.statRow, { backgroundColor: theme.surface }]}>
                <View style={[m.statIcon, { backgroundColor: row.color + '20' }]}>
                  <MaterialCommunityIcons name={row.icon} size={20} color={row.color} />
                </View>
                <Text style={[m.statLabel, { color: theme.textMuted }]}>{row.label}</Text>
                <Text style={[m.statVal, { color: row.color }]}>{row.val}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={[m.submitBtn, { backgroundColor: '#10B981', marginTop: 8 }]}
              onPress={() => { setStatModal(false); downloadStatement(); }}
            >
              <MaterialCommunityIcons name="file-download" size={18} color="#fff" />
              <Text style={m.submitText}>DOWNLOAD STATEMENT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(theme) {
  return StyleSheet.create({
    safe: { flex: 1 },

    // Setup
    setupWrap:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
    setupIcon:    { width: 100, height: 100, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    setupTitle:   { fontSize: 22, fontWeight: '900', marginBottom: 8 },
    setupSub:     { fontSize: 13, textAlign: 'center', marginBottom: 28, lineHeight: 20 },
    pinInput:     { width: '100%', padding: 15, borderRadius: 14, borderWidth: 1.5, textAlign: 'center', fontSize: 22, letterSpacing: 12, marginBottom: 14 },
    activateBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', padding: 17, borderRadius: 14, justifyContent: 'center', marginTop: 8 },
    activateBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },

    // Balance card
    balanceCard: { margin: 16, padding: 28, borderRadius: 24, elevation: 8 },
    balLabel:    { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
    balRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    balAmt:      { color: '#fff', fontSize: 34, fontWeight: '900' },
    eyeBtn:      { padding: 4 },
    upiRow:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14, opacity: 0.6 },
    upiText:     { color: '#fff', fontSize: 12, fontWeight: '600' },

    // Pending
    pendingBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 14, backgroundColor: '#FEF3C7', borderLeftWidth: 4, borderLeftColor: '#F59E0B' },
    pendingTitle:  { fontWeight: '800', color: '#92400E', fontSize: 13 },
    pendingSub:    { fontSize: 11, color: '#B45309', marginTop: 1 },

    // Summary card
    summaryCard:  { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: 16, elevation: 1 },
    summaryLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    summaryTitle: { fontWeight: '800', fontSize: 13 },
    summaryStats: { flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 8 },
    summaryStat:  { alignItems: 'center' },
    statDivider:  { width: 1, height: 24 },
    statUp:       { fontSize: 13, fontWeight: '800', color: '#10B981' },
    statDown:     { fontSize: 13, fontWeight: '800', color: '#EF4444' },
    statCount:    { fontSize: 13, fontWeight: '800' },
    statLbl:      { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', marginTop: 1 },

    // Action grid
    actionGrid:  { flexDirection: 'row', marginHorizontal: 16, gap: 10, marginBottom: 14 },
    actionBtn:   { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 16, elevation: 1, gap: 6 },
    actionLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },

    // Filter
    filterRow:    { flexDirection: 'row', marginHorizontal: 16, gap: 8, marginBottom: 14 },
    filterTab:    { flex: 1, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: theme.border, alignItems: 'center' },
    filterTabActive: { backgroundColor: '#002855', borderColor: '#002855' },
    filterText:   { fontSize: 12, fontWeight: '700', color: theme.textMuted },
    filterTextActive: { color: '#fff' },

    // Transaction
    txRow:  { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 16, elevation: 1 },
    txIcon: { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
    txRemark: { fontSize: 13, fontWeight: '700' },
    txTime:   { fontSize: 10, marginTop: 2 },
    txAmt:    { fontSize: 15, fontWeight: '900' },

    // Empty
    emptyWrap: { alignItems: 'center', paddingTop: 50, opacity: 0.5 },
    emptyText: { marginTop: 12, fontWeight: '700', fontSize: 14 },
  });
}

// Modal styles
const m = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet:      { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34, maxHeight: '92%' },
  miniSheet:  { borderRadius: 24, padding: 24, marginHorizontal: 30 },
  handle:     { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  headerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title:      { fontSize: 18, fontWeight: '900' },
  qrWrap:     { alignItems: 'center', marginBottom: 18, backgroundColor: '#fff', padding: 16, borderRadius: 18 },
  upiId:      { fontSize: 15, fontWeight: '900', marginTop: 10 },
  upiName:    { fontSize: 12, fontWeight: '600', marginTop: 2 },
  input:      { padding: 14, borderRadius: 14, marginBottom: 12, borderWidth: 1.5, fontSize: 14, fontWeight: '600' },
  pinInput:   { padding: 14, borderRadius: 14, marginBottom: 12, borderWidth: 1.5, textAlign: 'center', fontSize: 22, letterSpacing: 12 },
  uploadBox:  { height: 110, borderWidth: 2, borderStyle: 'dashed', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  preview:    { width: '100%', height: '100%', borderRadius: 14 },
  balBadge:   { padding: 12, borderRadius: 12, marginBottom: 14 },
  infoBox:    { flexDirection: 'row', alignItems: 'flex-start', padding: 10, borderRadius: 10, marginBottom: 14 },
  submitBtn:  { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#002855', padding: 16, borderRadius: 14, marginBottom: 8 },
  submitText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  cancelBtn:  { padding: 12, alignItems: 'center' },
  cancelText: { fontWeight: '700', fontSize: 13 },
  statRow:    { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 8, gap: 12 },
  statIcon:   { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  statLabel:  { flex: 1, fontSize: 13, fontWeight: '700' },
  statVal:    { fontSize: 16, fontWeight: '900' },
});
