import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { consumeFreeApp, incrementMonthlyUsage } from '../../utils/membershipManager';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, SafeAreaView,
  Image, StatusBar
} from 'react-native';
import { db, auth } from '../../api/firebaseConfig';
import {
  doc, getDoc, collection, addDoc,
  increment, serverTimestamp, updateDoc, query, where, getDocs
} from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import Config from '../../config';

export default function ServiceReview({ route, navigation }) {
  const { formData, feeDetails, serviceId, serviceTitle, documents, serviceType = 'citizen_services', category = '' } = route.params || {};

  const govFee     = Number(feeDetails?.govFee     || 0);
  const serviceFee = Number(feeDetails?.serviceFee || 0);
  const initialTotal = govFee + serviceFee;

  const [couponCode, setCouponCode]       = useState('');
  const [discount, setDiscount]           = useState(0);
  const [membershipDiscount, setMembershipDiscount] = useState(0);
  const [membershipInfo, setMembershipInfo] = useState(null);
  const [isMembershipFree, setIsMembershipFree]     = useState(false);
  const [appLimitReached, setAppLimitReached]       = useState(false);
  const [appLimitInfo, setAppLimitInfo]             = useState(null);
  const [isCouponApplied, setIsCouponApplied] = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);
  const [finalTotal, setFinalTotal]       = useState(initialTotal);

  const [selectedMethod, setSelectedMethod] = useState(null);
  const [isPaid, setIsPaid]               = useState(false);
  const [isSubmitting, setIsSubmitting]   = useState(false);

  const [paymentModal, setPaymentModal]   = useState(false);
  const [pinModal, setPinModal]           = useState(false);
  const [upiModal, setUpiModal]           = useState(false);
  const [userPin, setUserPin]             = useState('');
  const [utr, setUtr]                     = useState('');
  const [screenshot, setScreenshot]       = useState(null);
  const [walletData, setWalletData]       = useState({ balance: 0, pinHash: '', isHashed: false });

  const userId = auth.currentUser?.uid;
  const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${Config.cloudinary.cloudName}/image/upload`;
  const UPLOAD_PRESET  = Config.cloudinary.uploadPreset;

  // ── Membership discount — fresh on every focus ──────────────
  useFocusEffect(
    useCallback(() => {
      if (!userId || !serviceFee) return;
      setMembershipDiscount(0);
      setMembershipInfo(null);
      setIsMembershipFree(false);
      setAppLimitReached(false);
      setAppLimitInfo(null);
      setFinalTotal(govFee + serviceFee);

      const fetchMembership = async () => {
        try {
          const { getDoc, doc } = await import('firebase/firestore');
          const { db } = await import('../../api/firebaseConfig');

          const [memSnap, cfgSnap] = await Promise.all([
            getDoc(doc(db, 'user_memberships', userId)),
            getDoc(doc(db, 'app_config', 'membership_master')),
          ]);

          if (!memSnap.exists()) { console.log('🔴 SR-EXIT: No membership doc'); return; }
          const mem = memSnap.data();
          if (!mem.isActive) { console.log('🔴 SR-EXIT: Membership not active'); return; }

          // ✅ LIMIT CHECK — free apps bypass limit
          const rawLimitSR  = mem.lockedBenefits?.appLimit;
          const appLimitSR  = rawLimitSR != null ? Number(rawLimitSR) : -1;
          const freeAppsLB  = mem.lockedBenefits?.freeApps != null ? Number(mem.lockedBenefits.freeApps) : 0;
          const mkNow = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
          const usSnap2 = await getDoc(doc(db, 'user_memberships', userId, 'monthly_usage', mkNow));
          const usedNow     = usSnap2.exists() ? (usSnap2.data().apps_used  || 0) : 0;
          const freeUsedNow = usSnap2.exists() ? (usSnap2.data().free_used || 0) : 0;
          const freeLeftNow = Math.max(0, freeAppsLB - freeUsedNow);

          if (appLimitSR > 0) {
            if (usedNow >= appLimitSR) {
              if (freeLeftNow > 0) {
                // Free apps available — bypass limit block
              } else {
                setAppLimitReached(true);
                setAppLimitInfo({ used: usedNow, limit: appLimitSR, remaining: 0 });
                return;
              }
            } else {
              setAppLimitInfo({ used: usedNow, limit: appLimitSR, remaining: appLimitSR - usedNow });
            }
          }

          const isTrial   = mem.isTrial === true;
          const cfg       = cfgSnap.exists() ? cfgSnap.data() : {};
          const isEnabled = cfg.isEnabled ?? false;
          const planKey   = mem.plan || 'basic';
          const lb        = mem.lockedBenefits;

          if (!isEnabled && isTrial) { console.log('🔴 SR-EXIT: Toggle OFF + trial'); return; }
          if (!isEnabled && !isTrial && !lb) { console.log('🔴 SR-EXIT: Toggle OFF + no lockedBenefits'); return; }

          // Use lockedBenefits for paid, live config for trial
          let discountPct, freeApps, coverage;
          if (!isTrial && lb) {
            discountPct = lb.discount  ?? 0;
            freeApps    = lb.freeApps  != null ? Number(lb.freeApps)  : 0;
            coverage    = lb.coverage  || {};
          } else {
            const plan  = (cfg.plans?.[planKey]) || { discount:10, freeApps:0 };
            discountPct = plan.discount  || 0;
            freeApps    = plan.freeApps  != null ? Number(plan.freeApps) : 0;
            coverage    = (cfg.coverage?.[planKey]) || {};
          }

          const planName  = lb?.planName  || planKey;
          const planEmoji = lb?.planEmoji || '⭐';

          // Coverage check — fallback to DEFAULT if empty
          const DEFAULT_COV_SR = {
            basic:  { gov_jobs:{enabled:true}, citizen_services:{enabled:true}, govt_schemes:{enabled:false}, students:{enabled:true}, others:{enabled:false} },
            silver: { gov_jobs:{enabled:true}, citizen_services:{enabled:true}, govt_schemes:{enabled:true},  students:{enabled:true}, others:{enabled:true}  },
            gold:   { gov_jobs:{enabled:true}, citizen_services:{enabled:true}, govt_schemes:{enabled:true},  students:{enabled:true}, others:{enabled:true}  },
          };
          const effectiveCoverage = (Object.keys(coverage).length > 0) ? coverage : (DEFAULT_COV_SR[mem.plan] || {});
          const svcCov = effectiveCoverage[serviceType];
          if (svcCov && svcCov.enabled === false) { console.log('🔴 SR-EXIT: serviceType coverage OFF'); return; }
          if (category && svcCov?.categories && svcCov.categories[category] === false) { console.log('🔴 SR-EXIT: category coverage OFF'); return; }

          // Monthly usage
          const now      = new Date();
          const mk       = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
          const usSnap   = await getDoc(doc(db, 'user_memberships', userId, 'monthly_usage', mk));
          const usage    = usSnap.exists() ? usSnap.data() : {};
          const freeUsed = Number(usage.free_used || 0);
          const appsUsed = Number(usage.apps_used || 0);

          // Step 1: Free apps
          if (freeApps > 0) {
            const freeLeft = Math.max(0, freeApps - freeUsed);
            if (freeLeft > 0) {
              setMembershipDiscount(serviceFee);
              setMembershipInfo({ discount:serviceFee, isFree:true, freeAppsLeft:freeLeft, discountPct:100, planName, planEmoji });
              setIsMembershipFree(true);
              setFinalTotal(govFee);
              return;
            }
          }

          // Step 2: App limit already checked above (appLimitSR)

          // Step 3: Discount
          if (discountPct <= 0) { console.log('🔴 SR-EXIT: discountPct is 0'); return; }
          const disc = Math.floor(serviceFee * discountPct / 100);
          if (disc > 0) {
            setMembershipDiscount(disc);
            setMembershipInfo({ discount:disc, isFree:false, freeAppsLeft:0, discountPct, planName, planEmoji });
            setIsMembershipFree(false);
            setFinalTotal(govFee + serviceFee - disc);
          }
        } catch (e) {
        }
      };

      fetchMembership();
    }, [userId, govFee, serviceFee])
  );

  useEffect(() => {
    if (userId) fetchWalletInfo();
    // ✅ FIX: setFinalTotal yahan nahi — useFocusEffect se set hoti hai
    // Pehle initialTotal set hai useState mein — kaafi hai
  }, [userId]);

  const fetchWalletInfo = async () => {
    const snap = await getDoc(doc(db, 'users', userId));
    if (snap.exists()) {
      const d = snap.data();
      setWalletData({
        balance:  Number(d.walletBalance || 0),
        pinHash:  d.walletPinHash || d.walletPin || '',
        isHashed: !!d.walletPinHash,
      });
    }
  };

  // ── Voucher / Coupon ─────────────────────────────────────
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return Alert.alert('Error', 'Coupon code daalo!');
    if (!userId) return Alert.alert('Error', 'User details missing.');
    setCouponLoading(true);
    try {
      const q = query(
        collection(db, 'vouchers'),
        where('code', '==', couponCode.toUpperCase()),
        where('isActive', '==', true)
      );
      const snap = await getDocs(q);
      if (snap.empty) return Alert.alert('Invalid', 'Yeh coupon galat hai ya expire ho gaya.');

      const vDoc    = snap.docs[0];
      const voucher = vDoc.data();
      const vRef    = doc(db, 'vouchers', vDoc.id);

      if (voucher.expiryDate && new Date(voucher.expiryDate) < new Date())
        return Alert.alert('Expired', 'Yeh coupon expire ho gaya hai.');

      if ((voucher.usedCount || 0) >= (voucher.usageLimit || 999))
        return Alert.alert('Limit Full', 'Is coupon ki limit khatam ho gayi.');

      if (voucher.targetUsers === 'new') {
        const appsSnap = await getDocs(
          query(collection(db, 'service_applications'), where('userId', '==', userId))
        );
        if (appsSnap.size > 0) return Alert.alert('Not Eligible', 'Sirf pehli service ke liye valid hai!');
      }

      if (voucher.allowedServices !== 'all' && !voucher.allowedServices?.includes(serviceId))
        return Alert.alert('Not Valid', 'Yeh coupon is service ke liye valid nahi.');

      let calc = voucher.discountType === 'percentage'
        ? Math.floor((serviceFee * voucher.discountValue) / 100)
        : voucher.discountValue;
      if (calc > serviceFee) calc = serviceFee;
      if (calc <= 0) return Alert.alert('Error', 'Discount calculate nahi ho saka.');

      await updateDoc(vRef, { usedCount: increment(1) });

      setDiscount(calc);
      setFinalTotal(initialTotal - calc);
      setIsCouponApplied(true);
      Alert.alert('🎉 Coupon Applied!', `₹${calc} discount mil gayi!\nPayable: ₹${initialTotal - calc}`);
    } catch {
      Alert.alert('Error', 'Coupon verify nahi ho saka. Try again.');
    } finally { setCouponLoading(false); }
  };

  // ── Wallet Pay ────────────────────────────────────────────
  const handleWalletPay = async () => {
    try {
      let input;
      if (walletData.isHashed) {
        input = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          String(userPin).trim()
        );
      } else {
        input = String(userPin).trim();
      }
      if (input !== String(walletData.pinHash).trim())
        return Alert.alert('Galat PIN', 'Security PIN galat hai. Dobara try karein.');
    } catch {
      return Alert.alert('Error', 'PIN verify nahi ho saka.');
    }
    if (walletData.balance < finalTotal)
      return Alert.alert('Low Balance', 'Wallet mein balance kam hai. Recharge karo.');

    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'users', userId), { walletBalance: increment(-finalTotal) });
      await addDoc(collection(db, 'transactions'), {
        userId, amount: finalTotal, type: 'debit',
        remark: `Paid for ${serviceTitle}`, status: 'success', timestamp: serverTimestamp()
      });
            setIsPaid(true);
      if (membershipInfo && userId) {
        // BUG-02 Fix: Use imported functions (not require)
        if (isMembershipFree) consumeFreeApp(userId).catch(() => {});
        else incrementMonthlyUsage(userId).catch(() => {});
      } setSelectedMethod('wallet');
      setPaymentModal(false);
      setPinModal(false);
    } catch { Alert.alert('Error', 'Transaction failed. Try again.'); }
    finally { setIsSubmitting(false); }
  };

  // ── Telegram Notification ─────────────────────────────────
  const sendTelegramNotification = async (appId, title, data, total) => {
    const BOT_TOKEN = Constants?.expoConfig?.extra?.telegramBotToken;
    const CHAT_ID   = Constants?.expoConfig?.extra?.telegramChatId;
    if (!BOT_TOKEN || !CHAT_ID) return;
    const adminUrl = `https://sewaone-admin.netlify.app/service-applications`;
    let msg = `🏛️ *NEW SERVICE APPLICATION!*\n\n`;
    msg += `🆔 *Tracking ID:* ${appId}\n`;
    msg += `📋 *Service:* ${title}\n`;
    msg += `💰 *Paid:* ₹${total} via ${selectedMethod?.toUpperCase()}\n`;
    msg += `⏰ *Time:* ${new Date().toLocaleString('en-IN')}\n`;
    msg += `\n👤 *USER DATA:*\n`;
    Object.entries(data || {}).forEach(([k, v]) => { msg += `🔹 *${k}:* ${v}\n`; });
    msg += `\n⚡️ *Quick Action:*\n`;
    msg += `👉 [Admin Panel Kholein](${adminUrl})\n`;
    msg += `\n📍 _SewaOne Service Alert_`;
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: 'Markdown' }),
      });
    } catch {}
  };

  // ── Final Submit ──────────────────────────────────────────
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const trackingId = `SW1-S-${Math.floor(100000 + Math.random() * 900000)}`;
      let cloudImageUrl = screenshot;
      if (selectedMethod === 'upi' && screenshot && !screenshot.startsWith('http')) {
        cloudImageUrl = await uploadToCloudinary(screenshot);
      }
      await addDoc(collection(db, 'service_applications'), {
        trackingId, userId, serviceId, serviceTitle,
        feeDetails: { govFee, serviceFee, discount, totalPaid: finalTotal },
        formData, paymentMethod: selectedMethod,
        paymentScreenshot: cloudImageUrl || null,
        documents: documents || {},
        status: selectedMethod === 'wallet' ? 'Under Process' : 'Payment Verification Pending',
        timestamp: serverTimestamp()
      });
      await sendTelegramNotification(trackingId, serviceTitle, formData, finalTotal);
      navigation.navigate('SubmitSuccess', { trackingId, jobTitle: serviceTitle });
    } catch { Alert.alert('Error', 'Submit failed. Try again.'); }
    finally { setIsSubmitting(false); }
  };

  const pickImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.5 });
    if (!r.canceled) setScreenshot(r.assets[0].uri);
  };

  const uploadToCloudinary = async (uri) => {
    const data = new FormData();
    data.append('file', { uri, type: 'image/jpeg', name: 'proof.jpg' });
    data.append('upload_preset', UPLOAD_PRESET);
    try {
      const res  = await fetch(CLOUDINARY_URL, { method: 'POST', body: data });
      const json = await res.json();
      return json.secure_url;
    } catch { return null; }
  };

  const handleUPIFinish = () => {
    if (!screenshot) return Alert.alert('Required', 'Payment screenshot upload karo!');
    setIsPaid(true); setSelectedMethod('upi'); setUpiModal(false);
    // BUG-01 Fix: Track usage on UPI payment too
    if (membershipInfo && userId) {
      if (isMembershipFree) consumeFreeApp(userId).catch(() => {});
      else incrementMonthlyUsage(userId).catch(() => {});
    }
  };

  // ── RENDER ────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F4FF" />
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>

        {/* ── Info banner ── */}
        <View style={s.infoBanner}>
          <MaterialCommunityIcons name="information" size={16} color="#1a5276" />
          <Text style={s.infoBannerText}>Submit karne se pehle sabhi details verify karein.</Text>
        </View>

        {/* ── Form data receipt ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIconWrap}>
              <MaterialCommunityIcons name="file-document-outline" size={20} color="#003366" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{serviceTitle}</Text>
              <Text style={s.cardSub}>Service Application</Text>
            </View>
          </View>
          <View style={s.divider} />
          {Object.entries(formData || {}).map(([key, val]) => (
            <View key={key} style={s.dataRow}>
              <Text style={s.dataKey}>{key}</Text>
              <Text style={s.dataVal}>{val}</Text>
            </View>
          ))}
        </View>

        {/* ── Payment card ── */}
        <View style={s.card}>
          <Text style={s.secTitle}>Payment Summary</Text>

          <View style={s.feeRow}>
            <Text style={s.feeLabel}>Portal Service Fee</Text>
            <Text style={s.feeVal}>₹{serviceFee}</Text>
          </View>
          {membershipDiscount > 0 && (
            <View style={s.feeRow}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:6, flex:1 }}>
                <Text style={[s.feeLabel, { color:'#10B981' }]}>
                  {membershipInfo?.planEmoji} {membershipInfo?.planName}
                  {isMembershipFree ? ' — FREE App' : ` — ${membershipInfo?.discountPct}% off`}
                </Text>
              </View>
              <Text style={[s.feeVal, { color:'#10B981', fontWeight:'900' }]}>
                -₹{membershipDiscount}
              </Text>
            </View>
          )}
          <View style={s.feeRow}>
            <Text style={s.feeLabel}>Government Fee</Text>
            <Text style={s.feeVal}>₹{govFee}</Text>
          </View>
          {isCouponApplied && (
            <View style={s.feeRow}>
              <Text style={[s.feeLabel, { color: '#10B981' }]}>Coupon Discount</Text>
              <Text style={[s.feeVal, { color: '#10B981' }]}>-₹{discount}</Text>
            </View>
          )}

          <View style={s.divider} />

          {/* ✅ Voucher input */}
          {!isPaid && (
            <View style={s.couponRow}>
              <View style={[s.couponInputWrap, isCouponApplied && { borderColor: '#10B981' }]}>
                <MaterialCommunityIcons name="ticket-percent" size={16} color={isCouponApplied ? '#10B981' : '#94A3B8'} />
                <TextInput
                  style={s.couponInput}
                  placeholder="Voucher / Coupon Code"
                  placeholderTextColor="#94A3B8"
                  value={couponCode}
                  onChangeText={setCouponCode}
                  editable={!isCouponApplied}
                  autoCapitalize="characters"
                />
              </View>
              <TouchableOpacity
                style={[s.couponBtn, isCouponApplied && { backgroundColor: '#10B981' }]}
                onPress={handleApplyCoupon}
                disabled={isCouponApplied || couponLoading}
              >
                {couponLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.couponBtnText}>{isCouponApplied ? '✅' : 'APPLY'}</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total Payable</Text>
            <Text style={s.totalAmt}>₹{finalTotal}</Text>
          </View>
        </View>

        {/* ── Pay button ── */}
        {!isPaid ? (
          <TouchableOpacity style={s.payBtn} onPress={() => setPaymentModal(true)}>
            <MaterialCommunityIcons name="lock" size={18} color="#fff" />
            <Text style={s.payBtnText}>PAY ₹{finalTotal} SECURELY</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.paidBanner}>
            <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
            <Text style={s.paidText}>Payment Done — {selectedMethod?.toUpperCase()}</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Sticky Submit ── */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.submitBtn, !isPaid && { backgroundColor: '#CBD5E1' }]}
          onPress={handleFinalSubmit}
          disabled={!isPaid || isSubmitting}
        >
          {isSubmitting
            ? <ActivityIndicator color="#fff" />
            : <>
                <MaterialCommunityIcons name="send" size={18} color="#fff" />
                <Text style={s.submitText}>FINAL SUBMIT</Text>
              </>
          }
        </TouchableOpacity>
        <View style={s.verifiedRow}>
          <MaterialCommunityIcons name="shield-check" size={13} color="#10B981" />
          <Text style={s.verifiedText}>Verified by SewaOne</Text>
        </View>
      </View>

      {/* ── Payment Method Modal ── */}
      <Modal visible={paymentModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Payment Method</Text>
            <TouchableOpacity style={s.methodCard} onPress={() => { setPinModal(true); setPaymentModal(false); }}>
              <View style={[s.methodIcon, { backgroundColor: '#EBF5FB' }]}>
                <MaterialCommunityIcons name="wallet" size={24} color="#003366" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.methodName}>SewaOne Wallet</Text>
                <Text style={s.methodSub}>Balance: ₹{walletData.balance}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity style={s.methodCard} onPress={() => { setUpiModal(true); setPaymentModal(false); }}>
              <View style={[s.methodIcon, { backgroundColor: '#F0FDF4' }]}>
                <MaterialCommunityIcons name="qrcode-scan" size={24} color="#10B981" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.methodName}>UPI / QR Code</Text>
                <Text style={s.methodSub}>Screenshot upload karein</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPaymentModal(false)} style={s.cancelBtn}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── UPI Modal ── */}
      <Modal visible={upiModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.sheet, { alignItems: 'center' }]}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Scan & Pay</Text>
            <Image
              source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`upi://pay?pa=75186453-2@axl&pn=SewaOne&am=${finalTotal}&cu=INR`)}` }}
              style={s.qrImage}
            />
            <Text style={s.qrAmount}>₹{finalTotal}</Text>
            <TextInput
              style={s.inputField}
              placeholder="UTR / Reference Number"
              placeholderTextColor="#94A3B8"
              onChangeText={setUtr}
            />
            <TouchableOpacity style={s.uploadBox} onPress={pickImage}>
              <MaterialCommunityIcons name={screenshot ? 'check-circle' : 'upload'} size={20} color={screenshot ? '#10B981' : '#94A3B8'} />
              <Text style={[s.uploadText, screenshot && { color: '#10B981' }]}>
                {screenshot ? 'Screenshot Added ✅' : 'Upload Payment Screenshot'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.confirmBtn} onPress={handleUPIFinish}>
              <Text style={s.confirmBtnText}>I HAVE PAID</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setUpiModal(false)} style={s.cancelBtn}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── PIN Modal ── */}
      <Modal visible={pinModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={[s.methodIcon, { width: 60, height: 60, borderRadius: 18, backgroundColor: '#EBF5FB' }]}>
                <MaterialCommunityIcons name="lock" size={28} color="#003366" />
              </View>
            </View>
            <Text style={s.sheetTitle}>Wallet PIN Enter Karein</Text>
            <TextInput
              style={[s.inputField, { textAlign: 'center', fontSize: 28, letterSpacing: 12 }]}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              onChangeText={setUserPin}
              autoFocus
              placeholder="••••"
              placeholderTextColor="#CBD5E1"
            />
            <TouchableOpacity style={s.confirmBtn} onPress={handleWalletPay} disabled={isSubmitting}>
              {isSubmitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.confirmBtnText}>CONFIRM PAYMENT</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPinModal(false)} style={s.cancelBtn}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF' },

  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EBF5FB', margin: 16, marginBottom: 8, padding: 12, borderRadius: 12 },
  infoBannerText: { fontSize: 12, color: '#1a5276', fontWeight: '600', flex: 1 },

  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginHorizontal: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  cardIconWrap: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#EBF5FB', justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '900', color: '#002855' },
  cardSub: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },

  dataRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  dataKey: { fontSize: 12, color: '#64748B', fontWeight: '700', flex: 0.45 },
  dataVal: { fontSize: 13, color: '#1E293B', fontWeight: '700', flex: 0.55, textAlign: 'right' },

  secTitle: { fontSize: 15, fontWeight: '900', color: '#002855', marginBottom: 14 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  feeLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  feeVal: { fontSize: 13, color: '#1E293B', fontWeight: '800' },

  couponRow: { flexDirection: 'row', gap: 10, marginBottom: 14, marginTop: 4 },
  couponInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12 },
  couponInput: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1E293B', paddingVertical: 11 },
  couponBtn: { backgroundColor: '#002855', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12, minWidth: 68, alignItems: 'center', paddingVertical: 11 },
  couponBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  totalLabel: { fontSize: 16, fontWeight: '900', color: '#002855' },
  totalAmt: { fontSize: 28, fontWeight: '900', color: '#10B981' },

  payBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: '#002855', marginHorizontal: 16, marginBottom: 12, padding: 17, borderRadius: 16, elevation: 4, shadowColor: '#002855', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3 },
  payBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  paidBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#ECFDF5', marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 14 },
  paidText: { color: '#166534', fontWeight: '800', fontSize: 14 },

  footer: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1, borderTopColor: '#F1F5F9', elevation: 8 },
  submitBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: '#002855', padding: 17, borderRadius: 16, marginBottom: 8 },
  submitText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  verifiedRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
  verifiedText: { fontSize: 11, color: '#10B981', fontWeight: '700' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#002855', textAlign: 'center', marginBottom: 20 },
  methodCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  methodIcon: { width: 46, height: 46, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  methodName: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  methodSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelText: { color: '#94A3B8', fontWeight: '700' },

  qrImage: { width: 200, height: 200, marginVertical: 12, borderRadius: 12 },
  qrAmount: { fontSize: 22, fontWeight: '900', color: '#002855', marginBottom: 16 },
  inputField: { backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 14, padding: 14, fontSize: 15, fontWeight: '700', color: '#1E293B', width: '100%', marginBottom: 12 },
  uploadBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#E2E8F0', borderRadius: 14, padding: 14, width: '100%', marginBottom: 16, justifyContent: 'center' },
  uploadText: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
  confirmBtn: { backgroundColor: '#10B981', padding: 16, borderRadius: 14, alignItems: 'center', width: '100%', marginBottom: 8, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  confirmBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
