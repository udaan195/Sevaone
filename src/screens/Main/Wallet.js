import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, Image, FlatList } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Surface, Button, ActivityIndicator } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import { auth, db } from '../../api/firebaseConfig';
import { doc, onSnapshot, collection, addDoc, query, where, serverTimestamp, setDoc, getDoc, updateDoc } from 'firebase/firestore';

export default function WalletScreen() {
  const [loading, setLoading] = useState(true);
  const [isActivated, setIsActivated] = useState(false);
  const [balance, setBalance] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [showBalance, setShowBalance] = useState(false);
  const [transactions, setTransactions] = useState([]);

  // Modals Visibility States
  const [showPinModal, setShowPinModal] = useState(false);
  const [addMoneyModal, setAddMoneyModal] = useState(false);
  const [changePinModal, setChangePinModal] = useState(false);
  
  // Input States
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [inputPin, setInputPin] = useState('');
  const [amount, setAmount] = useState('');
  const [utr, setUtr] = useState('');
  const [proofImage, setProofImage] = useState(null);

  // Change PIN States
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');

  const uid = auth.currentUser?.uid;

  // ✨ Cloudinary Configuration
  const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dxuurwexl/image/upload";
  const UPLOAD_PRESET = "edusphere_uploads";

  useEffect(() => {
    if (!uid) return;

    const unsubUser = onSnapshot(doc(db, "users", uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBalance(data.walletBalance || 0);
        if (data.walletPin) setIsActivated(true);
      }
      setLoading(false);
    });

    const qPending = query(collection(db, "wallet_requests"), where("userId", "==", uid), where("status", "==", "pending"));
    const unsubPending = onSnapshot(qPending, (snap) => {
      let totalP = 0;
      snap.forEach(d => totalP += d.data().amount);
      setPendingAmount(totalP);
    });

    const qTx = query(collection(db, "transactions"), where("userId", "==", uid));
    const unsubTx = onSnapshot(qTx, (snap) => {
      const txData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      txData.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setTransactions(txData);
    });

    return () => { unsubUser(); unsubPending(); unsubTx(); };
  }, [uid]);

  const formatTime = (ts) => {
    if (!ts) return "Processing...";
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return "Recent"; }
  };

  // --- 📸 Cloudinary Upload Helper ---
  const uploadToCloudinary = async (uri) => {
    const data = new FormData();
    data.append('file', {
      uri: uri,
      type: 'image/jpeg',
      name: 'wallet_recharge.jpg',
    });
    data.append('upload_preset', UPLOAD_PRESET);

    try {
      let res = await fetch(CLOUDINARY_URL, {
        method: 'POST',
        body: data,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      let json = await res.json();
      return json.secure_url;
    } catch (e) {
      console.error("Cloudinary Error:", e);
      return null;
    }
  };

  const handleActivate = async () => {
    if (pin.length !== 4 || pin !== confirmPin) return Alert.alert("Error", "PIN match nahi ho raha.");
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", uid), { walletPin: String(pin).trim() });
      Alert.alert("Success", "Security PIN Set! Aapka Joining Bonus wallet mein dikh jayega.");
    } catch (e) { 
      await setDoc(doc(db, "users", uid), { walletPin: String(pin).trim() }, { merge: true });
      Alert.alert("Success", "Security PIN Set!");
    }
    finally { setLoading(false); }
  };

  const verifyPinForBalance = async () => {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (String(userSnap.data().walletPin).trim() === String(inputPin).trim()) {
      setShowBalance(true);
      setShowPinModal(false);
      setInputPin('');
    } else { Alert.alert("Error", "Galat Transaction PIN!"); }
  };

  // --- ✨ UPDATED: Submit with Cloudinary ---
  const submitAddMoney = async () => {
    if (!amount || !utr || !proofImage) return Alert.alert("Required", "Please fill all details.");
    setLoading(true);
    try {
      // 1. First upload image to Cloudinary
      const cloudUrl = await uploadToCloudinary(proofImage);
      
      if (!cloudUrl) {
        throw new Error("Screenshot upload failed. Please try again.");
      }

      // 2. Save Request to Firestore with Cloud URL
      await addDoc(collection(db, "wallet_requests"), {
        userId: uid,
        amount: parseInt(amount),
        utr: utr.trim(),
        screenshot: cloudUrl, // Using the new Cloudinary link
        status: 'pending',
        timestamp: serverTimestamp()
      });

      setAddMoneyModal(false);
      setAmount(''); setUtr(''); setProofImage(null);
      Alert.alert("Success", "Deposit proof submitted to Admin!");
    } catch (e) { 
      Alert.alert("Error", e.message || "Submission Failed"); 
    }
    finally { setLoading(false); }
  };

  const handleChangePin = async () => {
    if (newPin.length !== 4 || newPin !== confirmNewPin) return Alert.alert("Error", "New PIN mismatch.");
    setLoading(true);
    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (String(oldPin).trim() === String(userSnap.data().walletPin).trim()) {
        await updateDoc(doc(db, "users", uid), { walletPin: String(newPin).trim() });
        Alert.alert("Success", "PIN updated!");
        setChangePinModal(false);
        setOldPin(''); setNewPin(''); setConfirmNewPin('');
      } else { Alert.alert("Error", "Old PIN incorrect."); }
    } catch (e) { Alert.alert("Error", "Update Failed"); }
    finally { setLoading(false); }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#003366" />;

  if (!isActivated) {
    return (
      <View style={styles.setupContainer}>
        <MaterialCommunityIcons name="shield-lock" size={80} color="#003366" />
        <Text style={styles.setupTitle}>Security Setup</Text>
        <TextInput style={styles.pinInput} placeholder="Set 4-Digit PIN" secureTextEntry keyboardType="numeric" maxLength={4} onChangeText={setPin} />
        <TextInput style={styles.pinInput} placeholder="Confirm PIN" secureTextEntry keyboardType="numeric" maxLength={4} onChangeText={setConfirmPin} />
        <Button mode="contained" onPress={handleActivate} style={styles.btn}>ACTIVATE WALLET</Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <Surface style={styles.balanceCard}>
              <Text style={styles.label}>Available Balance</Text>
              <View style={styles.balanceRow}>
                <Text style={styles.amountText}>{showBalance ? `₹${balance}` : '₹ ••••'}</Text>
                <TouchableOpacity onPress={() => showBalance ? setShowBalance(false) : setShowPinModal(true)}>
                  <MaterialCommunityIcons name={showBalance ? "eye-off" : "eye"} size={28} color="#fff" />
                </TouchableOpacity>
              </View>
            </Surface>

            {pendingAmount > 0 && (
              <Surface style={styles.pendingAlert}>
                <MaterialCommunityIcons name="update" size={24} color="#B45309" />
                <View style={{flex: 1, marginLeft: 12}}>
                  <Text style={styles.pendingTitle}>Pending: ₹{pendingAmount}</Text>
                  <Text style={styles.pendingSub}>Payment verification under process.</Text>
                </View>
              </Surface>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setAddMoneyModal(true)}>
                <Surface style={styles.iconCircle}><MaterialCommunityIcons name="plus" size={28} color="#003366" /></Surface>
                <Text style={styles.actionLabel}>Add Money</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setChangePinModal(true)}>
                <Surface style={styles.iconCircle}><MaterialCommunityIcons name="lock-reset" size={28} color="#003366" /></Surface>
                <Text style={styles.actionLabel}>Change PIN</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionTitle}>Recent History</Text>
          </>
        }
        renderItem={({ item }) => (
          <Surface style={styles.txItem}>
             <View style={[styles.txIcon, {backgroundColor: item.type === 'debit' ? '#FEE2E2' : '#DCFCE7'}]}>
              <MaterialCommunityIcons name={item.type === 'debit' ? "minus" : "plus"} size={22} color={item.type === 'debit' ? '#EF4444' : '#10B981'} />
            </View>
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={{ fontWeight: 'bold', color: '#1E293B' }}>{item.remark || "Wallet Operation"}</Text>
              <Text style={{ fontSize: 10, color: '#94a3b8' }}>{formatTime(item.timestamp)}</Text>
            </View>
            <Text style={{ fontWeight: 'bold', color: item.type === 'debit' ? '#EF4444' : '#10B981' }}>
              {item.type === 'debit' ? '-' : '+'} ₹{item.amount}
            </Text>
          </Surface>
        )}
      />

      <Modal visible={addMoneyModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Surface style={styles.centeredModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Deposit Funds</Text>
              <TouchableOpacity onPress={() => setAddMoneyModal(false)}><MaterialCommunityIcons name="close" size={24} color="#666" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.qrSection}>
                <Surface style={styles.qrBorder}>
                  <QRCode value={`upi://pay?pa=7518640453-2@axl&pn=SewaOne&am=${amount || 0}`} size={150} />
                </Surface>
                <Text style={styles.upiIdText}>7518640453-2@axl</Text>
              </View>
              <TextInput style={styles.input} placeholder="Amount (₹)" keyboardType="numeric" value={amount} onChangeText={setAmount} />
              <TextInput style={styles.input} placeholder="12 Digit UTR" keyboardType="numeric" maxLength={12} onChangeText={setUtr} />
              <TouchableOpacity style={styles.uploadBox} onPress={async () => {
                let res = await ImagePicker.launchImageLibraryAsync({allowsEditing: true, quality: 0.5});
                if(!res.canceled) setProofImage(res.assets[0].uri);
              }}>
                {proofImage ? <Image source={{ uri: proofImage }} style={styles.preview} /> : 
                <><MaterialCommunityIcons name="image-plus" size={30} color="#003366" /><Text style={{fontSize:11}}>Screenshot Upload</Text></>}
              </TouchableOpacity>
              <Button mode="contained" onPress={submitAddMoney} style={styles.submitBtn}>SUBMIT PROOF</Button>
            </ScrollView>
          </Surface>
        </View>
      </Modal>

      <Modal visible={changePinModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Surface style={styles.centeredModal}>
            <Text style={styles.modalTitle}>Update Security PIN</Text>
            <TextInput style={styles.input} placeholder="Old PIN" secureTextEntry keyboardType="numeric" maxLength={4} onChangeText={setOldPin} />
            <TextInput style={styles.input} placeholder="New PIN" secureTextEntry keyboardType="numeric" maxLength={4} onChangeText={setNewPin} />
            <TextInput style={styles.input} placeholder="Confirm New PIN" secureTextEntry keyboardType="numeric" maxLength={4} onChangeText={setConfirmNewPin} />
            <Button mode="contained" onPress={handleChangePin} style={styles.submitBtn}>SAVE NEW PIN</Button>
            <Button onPress={() => setChangePinModal(false)} color="red">CANCEL</Button>
          </Surface>
        </View>
      </Modal>

      <Modal visible={showPinModal} transparent>
        <View style={styles.modalOverlay}>
          <Surface style={styles.miniModal}>
            <Text style={styles.modalTitle}>Security PIN</Text>
            <TextInput style={styles.pinInputSmall} secureTextEntry keyboardType="numeric" maxLength={4} onChangeText={setInputPin} />
            <Button mode="contained" onPress={verifyPinForBalance} style={styles.submitBtn}>VERIFY</Button>
            <Button onPress={() => setShowPinModal(false)}>CANCEL</Button>
          </Surface>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  setupContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  setupTitle: { fontSize: 24, fontWeight: '900', color: '#003366', marginBottom: 20 },
  pinInput: { backgroundColor: '#fff', width: '100%', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', textAlign: 'center', fontSize: 20, letterSpacing: 10, marginBottom: 15 },
  btn: { backgroundColor: '#003366', width: '100%', padding: 5, borderRadius: 10 },
  balanceCard: { backgroundColor: '#003366', margin: 20, padding: 30, borderRadius: 25, elevation: 8 },
  label: { color: '#94A3B8', fontSize: 12, textTransform: 'uppercase' },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  amountText: { color: '#fff', fontSize: 32, fontWeight: '900' },
  pendingAlert: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', marginHorizontal: 20, padding: 12, borderRadius: 15, borderLeftWidth: 4, borderColor: '#F59E0B', marginBottom: 15 },
  pendingTitle: { fontWeight: 'bold', color: '#92400E', fontSize: 14 },
  pendingSub: { fontSize: 10, color: '#B45309' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  actionBtn: { alignItems: 'center' },
  iconCircle: { width: 60, height: 60, borderRadius: 15, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 3, marginBottom: 8 },
  actionLabel: { fontWeight: 'bold', color: '#475569', fontSize: 11 },
  sectionTitle: { fontSize: 16, fontWeight: '900', marginHorizontal: 20, marginBottom: 12, color: '#1E293B' },
  txItem: { flexDirection: 'row', alignItems: 'center', padding: 12, marginHorizontal: 20, marginBottom: 10, borderRadius: 15, backgroundColor: '#fff', elevation: 1 },
  txIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  centeredModal: { width: '92%', backgroundColor: '#fff', borderRadius: 25, padding: 20 },
  miniModal: { width: '80%', padding: 20, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#003366' },
  qrSection: { alignItems: 'center', marginBottom: 20 },
  qrBorder: { padding: 10, backgroundColor: '#fff', borderRadius: 15, elevation: 4 },
  upiIdText: { fontSize: 16, fontWeight: '900', color: '#003366', marginTop: 10 },
  input: { width: '100%', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  uploadBox: { height: 120, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', marginBottom: 15 },
  preview: { width: '100%', height: '100%', borderRadius: 13 },
  submitBtn: { backgroundColor: '#10B981', padding: 8, borderRadius: 12, width: '100%', marginVertical: 5 },
  pinInputSmall: { backgroundColor: '#F8FAFC', width: '90%', padding: 12, borderRadius: 10, textAlign: 'center', fontSize: 24, letterSpacing: 10, marginVertical: 15, borderWidth: 1, borderColor: '#E2E8F0' }
});
