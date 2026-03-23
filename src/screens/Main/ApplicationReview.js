import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Modal, TextInput, Alert, ActivityIndicator, SafeAreaView, Image 
} from 'react-native';
import { db, auth } from '../../api/firebaseConfig';
import { 
  doc, getDoc, collection, addDoc, 
  increment, serverTimestamp, updateDoc, query, where, getDocs 
} from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getMembershipDiscount, consumeFreeApp, incrementMonthlyUsage, checkMonthlyLimit } from '../../utils/membershipManager';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';

export default function ApplicationReview({ route, navigation }) {
  const { formData, feeDetails, jobId, jobTitle, documents, serviceType = 'gov_jobs', category = 'latest-jobs' } = route.params || {}; 

  // --- 🛠️ Fee Extraction ---
  const govFee = Number(feeDetails?.official || 0); 
  const serviceFee = Number(feeDetails?.service || 0); 
  const initialTotal = govFee + serviceFee; 

  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [membershipDiscount, setMembershipDiscount] = useState(0);
  const [membershipInfo, setMembershipInfo] = useState(null);
  const [isMembershipFree, setIsMembershipFree]   = useState(false);
  const [appLimitReached, setAppLimitReached]     = useState(false);
  const [appLimitInfo, setAppLimitInfo]           = useState(null);
  const [isCouponApplied, setIsCouponApplied] = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);
  const [finalTotal, setFinalTotal] = useState(initialTotal);

  const [selectedMethod, setSelectedMethod] = useState(null); 
  const [isPaid, setIsPaid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [paymentModal, setPaymentModal] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [upiModal, setUpiModal] = useState(false);
  const [userPin, setUserPin] = useState('');
  const [utr, setUtr] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [walletData, setWalletData] = useState({ balance: 0, pinHash: '' });

  const userId = auth.currentUser?.uid;
  const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dxuurwexl/image/upload";
  const UPLOAD_PRESET = "edusphere_uploads";

  // ── Fresh membership on every screen focus — direct Firestore ──
  useFocusEffect(
    useCallback(() => {
      if (!userId || !serviceFee) return;

      // Reset
      setMembershipDiscount(0);
      setMembershipInfo(null);
      setIsMembershipFree(false);
      setAppLimitReached(false);
      setAppLimitInfo(null);
      setFinalTotal(govFee + serviceFee);

      // Direct Firestore fetch — bypass any module-level cache
      const fetchFresh = async () => {
        const svcType = serviceType || 'gov_jobs';
        const svcCat  = category    || 'latest-jobs';
        try {
          const { getDoc, doc } = await import('firebase/firestore');
          const { db } = await import('../../api/firebaseConfig');

          // Fetch membership + config in parallel
          const [memSnap, cfgSnap] = await Promise.all([
            getDoc(doc(db, 'user_memberships', userId)),
            getDoc(doc(db, 'app_config', 'membership_master')),
          ]);

          if (!memSnap.exists()) return;
          const mem = memSnap.data();
          if (!mem.isActive) return;

          // ✅ LIMIT CHECK — but free apps bypass limit
          const rawLimit    = mem.lockedBenefits?.appLimit;
          const appLimit    = rawLimit != null ? Number(rawLimit) : -1;
          const freeAppsLB  = mem.lockedBenefits?.freeApps != null ? Number(mem.lockedBenefits.freeApps) : 0;
          const mkNow  = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
          const usSnap2 = await getDoc(doc(db, 'user_memberships', userId, 'monthly_usage', mkNow));
          const usedNow = usSnap2.exists() ? (usSnap2.data().apps_used || 0) : 0;
          const freeUsedNow = usSnap2.exists() ? (usSnap2.data().free_used || 0) : 0;
          const freeLeftNow = Math.max(0, freeAppsLB - freeUsedNow);

          if (appLimit > 0) {
            if (usedNow >= appLimit) {
              // Limit reached — but free apps bypass it
              if (freeLeftNow > 0) {
                // Free apps available — allow
              } else {
                setAppLimitReached(true);
                setAppLimitInfo({ used: usedNow, limit: appLimit, remaining: 0 });
                return;
              }
            } else {
              setAppLimitInfo({ used: usedNow, limit: appLimit, remaining: appLimit - usedNow });
            }
          }

          const cfg       = cfgSnap.exists() ? cfgSnap.data() : {};
          const isEnabled = cfg.isEnabled ?? false;
          const planKey   = mem.plan || 'basic';
          const lb      = mem.lockedBenefits;
          const isTrial = mem.isTrial === true;

          // Toggle OFF:
          //   Trial user  → discount band
          //   Paid user   → discount milta rahe (lockedBenefits se)
          if (!isEnabled && isTrial) return;
          if (!isEnabled && !isTrial && !lb) return; // paid but no lockedBenefits

          // Get config — locked for paid, live for trial
          let discountPct, freeApps, coverage;
          if (!isTrial && lb) {
            discountPct = lb.discount  ?? 0;
            freeApps    = lb.freeApps  != null ? Number(lb.freeApps)  : 0;
            coverage    = lb.coverage  || {};
          } else {
            const cfgPlan = (cfg.plans?.[planKey]) || { discount:10, freeApps:0 };
            const DEFAULT_COV = {
              basic:  { gov_jobs:{ enabled:true, categories:{ 'latest-jobs':true,'admit-card':false,'result':false,'answer-key':false }}, citizen_services:{enabled:true}, govt_schemes:{enabled:false}, students:{enabled:true}, others:{enabled:false} },
              silver: { gov_jobs:{ enabled:true, categories:{ 'latest-jobs':true,'admit-card':false,'result':false,'answer-key':false }}, citizen_services:{enabled:true}, govt_schemes:{enabled:true}, students:{enabled:true}, others:{enabled:true} },
              gold:   { gov_jobs:{ enabled:true, categories:{ 'latest-jobs':true,'admit-card':false,'result':false,'answer-key':false }}, citizen_services:{enabled:true}, govt_schemes:{enabled:true}, students:{enabled:true}, others:{enabled:true} },
            };
            discountPct = cfgPlan.discount  || 0;
            freeApps    = cfgPlan.freeApps   != null ? Number(cfgPlan.freeApps) : 0;
            coverage    = (cfg.coverage?.[planKey]) || DEFAULT_COV[planKey] || {};
          }

          const planName  = lb?.planName  || planKey;
          const planEmoji = lb?.planEmoji || '⭐';

          // Coverage check — fallback to DEFAULT if empty
          const DEFAULT_COV_AR = {
            basic:  { gov_jobs:{enabled:true}, citizen_services:{enabled:true}, govt_schemes:{enabled:false}, students:{enabled:true}, others:{enabled:false} },
            silver: { gov_jobs:{enabled:true}, citizen_services:{enabled:true}, govt_schemes:{enabled:true},  students:{enabled:true}, others:{enabled:true}  },
            gold:   { gov_jobs:{enabled:true}, citizen_services:{enabled:true}, govt_schemes:{enabled:true},  students:{enabled:true}, others:{enabled:true}  },
          };
          const effectiveCoverage = (Object.keys(coverage).length > 0) ? coverage : (DEFAULT_COV_AR[planKey] || {});
          const svcCov = effectiveCoverage[svcType];
          // If no coverage config — allow discount
          if (svcCov && svcCov.enabled === false) return;
          if (svcCat && svcCov?.categories && svcCov.categories[svcCat] === false) return;

          // Monthly usage
          const now     = new Date();
          const mk      = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
          const usSnap  = await getDoc(doc(db, 'user_memberships', userId, 'monthly_usage', mk));
          const usage   = usSnap.exists() ? usSnap.data() : {};
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

          // Step 2: App limit — already checked above before discount logic

          // Step 3: Discount
          if (discountPct <= 0) return;
          const disc = Math.floor(serviceFee * discountPct / 100);
          if (disc > 0) {
            setMembershipDiscount(disc);
            setMembershipInfo({ discount:disc, isFree:false, freeAppsLeft:0, discountPct, planName, planEmoji });
            setIsMembershipFree(false);
            setFinalTotal(govFee + serviceFee - disc);
          }
        } catch (e) {
          console.log('Fresh membership fetch error:', e.message);
        }
      };

      fetchFresh();
    }, [userId, govFee, serviceFee])
  );

  useEffect(() => {
    if (userId) fetchWalletInfo();
    // ✅ FIX: setFinalTotal yahan nahi — useFocusEffect se set hoti hai
  }, [userId, govFee, serviceFee]);

  const fetchWalletInfo = async () => {
    const userSnap = await getDoc(doc(db, "users", userId));
    if (userSnap.exists()) {
      const data = userSnap.data();
      setWalletData({
        balance: data.walletBalance || 0,
        // ✅ FIX: walletPinHash (new hashed) ya walletPin (purana plaintext) dono support
        pinHash: data.walletPinHash || data.walletPin || data.transactionPin || data.pin || '',
        isHashed: !!data.walletPinHash, // kya naya hashed system use ho raha hai
      });
    }
  };

  // --- 🚀 ✨ TELEGRAM NOTIFICATION LOGIC ---
  const sendTelegramNotification = async (appId, title, data, total) => {
    const BOT_TOKEN = Constants?.expoConfig?.extra?.telegramBotToken;
    const CHAT_ID = Constants?.expoConfig?.extra?.telegramChatId;
    if (!BOT_TOKEN || !CHAT_ID) return;

    let message = `🚀 *NEW APPLICATION RECEIVED* 🚀\n\n`;
    message += `🆔 *Tracking ID:* ${appId}\n`;
    message += `💼 *Job Name:* ${title}\n`;
    message += `💰 *Total Paid:* ₹${total}\n`;
    message += `💳 *Method:* ${selectedMethod?.toUpperCase()}\n`;
    message += `--------------------------\n`;
    message += `👤 *USER FORM DATA:*\n`;
    
    Object.entries(data).forEach(([key, value]) => {
      message += `🔹 *${key}:* ${value}\n`;
    });

    message += `\n📍 _SewaOne Admin Alert System_`;

    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: message,
          parse_mode: 'Markdown',
        }),
      });
    } catch (e) { }
  };

  // --- 🎫 Coupon Logic ---
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return Alert.alert("Error", "Coupon code dalo!");
    if (!userId) return Alert.alert("Error", "User details missing.");
    setCouponLoading(true);

    try {
      const q = query(
        collection(db, "vouchers"),
        where("code", "==", couponCode.toUpperCase()),
        where("isActive", "==", true)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        return Alert.alert("Invalid", "Yeh coupon code galat hai ya expire ho gaya.");
      }

      const voucherDoc = snap.docs[0];
      const voucher = voucherDoc.data();
      const voucherRef = doc(db, "vouchers", voucherDoc.id);

      // ✅ 1. Expiry date check
      if (voucher.expiryDate && new Date(voucher.expiryDate) < new Date()) {
        return Alert.alert("Expired", "Yeh coupon expire ho gaya hai.");
      }

      // ✅ 2. Usage limit check
      const usedCount = voucher.usedCount || 0;
      const usageLimit = voucher.usageLimit || 999;
      if (usedCount >= usageLimit) {
        return Alert.alert("Limit Full", "Is coupon ki limit khatam ho gayi hai.");
      }

      // ✅ 3. New user only check
      if (voucher.targetUsers === 'new') {
        const snapApps = await getDocs(
          query(collection(db, "applications"), where("userId", "==", userId))
        );
        if (snapApps.size > 0) {
          return Alert.alert("Not Eligible", "Yeh coupon sirf pehli application ke liye hai!");
        }
      }

      // ✅ 4. Job-specific check
      if (voucher.allowedJobs !== 'all' && !voucher.allowedJobs?.includes(jobId)) {
        return Alert.alert("Not Valid", "Yeh coupon is job ke liye valid nahi hai.");
      }

      // ✅ 5. Calculate discount
      let calculatedDiscount = voucher.discountType === 'percentage'
        ? Math.floor((serviceFee * voucher.discountValue) / 100)
        : voucher.discountValue;
      if (calculatedDiscount > serviceFee) calculatedDiscount = serviceFee;
      if (calculatedDiscount <= 0) {
        return Alert.alert("Error", "Discount calculate nahi ho saka.");
      }

      // ✅ 6. Increment usedCount in Firestore
      await updateDoc(voucherRef, {
        usedCount: increment(1)
      });

      setDiscount(calculatedDiscount);
      setFinalTotal(initialTotal - calculatedDiscount);
      setIsCouponApplied(true);
      Alert.alert(
        "Coupon Applied! 🎉",
        `₹${calculatedDiscount} discount apply ho gayi!\nPayable: ₹${initialTotal - calculatedDiscount}`
      );

    } catch (e) {
      Alert.alert("Error", "Coupon verify nahi ho saka. Try again.");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleWalletPay = async () => {
    // ✅ FIX: SHA-256 hash karke compare karo
    try {
      let inputToCompare;
      if (walletData.isHashed) {
        // New system — hash karke compare karo
        inputToCompare = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          String(userPin).trim()
        );
      } else {
        // Old system — plaintext compare (backward compat)
        inputToCompare = String(userPin).trim();
      }
      if (inputToCompare !== String(walletData.pinHash).trim()) {
        return Alert.alert("Galat PIN", "Security PIN galat hai. Dobara try karein.");
      }
    } catch (e) {
      return Alert.alert("Error", "PIN verify nahi ho saka. Try again.");
    }
    if (walletData.balance < finalTotal) return Alert.alert("Low Balance", "Recharge wallet.");

    setIsSubmitting(true);
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { walletBalance: increment(-finalTotal) });
      await addDoc(collection(db, "transactions"), {
        userId, amount: finalTotal, type: 'debit',
        remark: `Paid for ${jobTitle}`, status: 'success', timestamp: serverTimestamp()
      });
      setIsPaid(true); setSelectedMethod('wallet'); setPaymentModal(false); setPinModal(false);
      // Consume membership credit
      if (membershipInfo && userId) {
        if (isMembershipFree) consumeFreeApp(userId).catch(() => {});
        else incrementMonthlyUsage(userId).catch(() => {});
      }
    } catch (e) { Alert.alert("Error", "Transaction failed."); }
    finally { setIsSubmitting(false); }
  };

  const handleFinalSubmit = async () => { 
    setIsSubmitting(true);
    try {
      const trackingId = `SW1-${Math.floor(100000 + Math.random() * 900000)}`;
      let cloudImageUrl = screenshot;
      if (selectedMethod === 'upi' && screenshot && !screenshot.startsWith('http')) {
        cloudImageUrl = await uploadToCloudinary(screenshot);
      }

      // 1. Save to Firebase
      await addDoc(collection(db, "applications"), {
        trackingId, userId, jobId, jobTitle,
        feeDetails: { govFee, serviceFee, discount, totalPaid: finalTotal },
        formData, paymentMethod: selectedMethod,
        paymentScreenshot: cloudImageUrl || null,
        documents: documents || {}, 
        status: selectedMethod === 'wallet' ? 'Under Process' : 'Fee Verification Under Process',
        timestamp: serverTimestamp()
      });

      // 2. ✨ Send Telegram Notification
      await sendTelegramNotification(trackingId, jobTitle, formData, finalTotal);

      navigation.navigate('SubmitSuccess', { trackingId });
    } catch (e) { Alert.alert("Error", "Submit failed."); }
    finally { setIsSubmitting(false); }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.5 });
    if (!result.canceled) setScreenshot(result.assets[0].uri);
  };

  const uploadToCloudinary = async (uri) => {
    const data = new FormData();
    data.append('file', { uri, type: 'image/jpeg', name: 'p.jpg' });
    data.append('upload_preset', UPLOAD_PRESET);
    try {
      let res = await fetch(CLOUDINARY_URL, { method: 'POST', body: data });
      let json = await res.json();
      return json.secure_url;
    } catch (e) { return null; }
  };

  const handleUPIFinish = () => {
    if (!screenshot) return Alert.alert("Required", "Screenshot missing!");
    setIsPaid(true); setSelectedMethod('upi'); setUpiModal(false);
    // BUG-01 Fix: Track usage on UPI payment too
    if (membershipInfo && userId) {
      if (isMembershipFree) consumeFreeApp(userId).catch(() => {});
      else incrementMonthlyUsage(userId).catch(() => {});
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={styles.noteBox}><Text style={styles.noteText}>Review your data carefully before paying.</Text></View>

        {/* App Limit Reached */}
        {appLimitReached && (
          <View style={{ backgroundColor:'#FEF2F2', borderRadius:14, padding:14, margin:16, marginBottom:0, borderLeftWidth:4, borderLeftColor:'#DC2626' }}>
            <Text style={{ fontSize:14, fontWeight:'900', color:'#DC2626' }}>
              ⛔ Monthly Limit Reached
            </Text>
            <Text style={{ fontSize:12, fontWeight:'600', color:'#7F1D1D', marginTop:4 }}>
              {`${appLimitInfo?.used}/${appLimitInfo?.limit} applications is mahine use ho gaye. 1st ko reset hoga. Abhi bina discount ke apply kar sakte ho.`}
            </Text>
          </View>
        )}

        {/* Limit info (not reached) */}
        {!appLimitReached && appLimitInfo && appLimitInfo.limit > 0 && (
          <View style={{ backgroundColor:'#F0FDF4', borderRadius:12, padding:10, margin:16, marginBottom:0, flexDirection:'row', alignItems:'center', gap:8 }}>
            <Text style={{ fontSize:12, fontWeight:'700', color:'#166534' }}>
              ✅ {appLimitInfo.remaining} application{appLimitInfo.remaining !== 1 ? 's' : ''} remaining this month ({appLimitInfo.used}/{appLimitInfo.limit})
            </Text>
          </View>
        )}
        <View style={styles.receiptCard}>
          <View style={styles.watermarkBox}><Text style={styles.watermark}>SewaOne</Text></View>
          <Text style={styles.receiptTitle}>{jobTitle}</Text>
          <View style={styles.divider} />
          {Object.entries(formData).map(([key, val]) => (
            <View key={key} style={styles.infoRow}><Text style={styles.infoKey}>{key}:</Text><Text style={styles.infoVal}>{val}</Text></View>
          ))}
          <View style={styles.divider} />

          {!isPaid && (
            <View style={styles.couponContainer}>
              <TextInput style={styles.couponInput} placeholder="Voucher Code" value={couponCode} onChangeText={setCouponCode} editable={!isCouponApplied} autoCapitalize="characters" />
              <TouchableOpacity style={[styles.couponBtn, isCouponApplied && {backgroundColor:'#10B981'}]} onPress={handleApplyCoupon} disabled={isCouponApplied || couponLoading}>
                {couponLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.couponBtnText}>{isCouponApplied ? "APPLIED" : "APPLY"}</Text>}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Official Job Fee:</Text>
            <Text style={styles.infoVal}>₹{govFee}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>SewaOne Service Fee:</Text>
            <Text style={styles.infoVal}>₹{serviceFee}</Text>
          </View>
          {membershipDiscount > 0 && (
            <View style={styles.infoRow}>
              <View style={{flexDirection:'row', alignItems:'center', gap:6, flex:1}}>
                <Text style={[styles.infoKey, {color:'#10B981'}]}>
                  {membershipInfo?.planEmoji} {membershipInfo?.planName}
                  {isMembershipFree ? ' — FREE App' : ` — ${membershipInfo?.discountPct}% off`}
                </Text>
              </View>
              <Text style={[styles.infoVal, {color:'#10B981', fontWeight:'900'}]}>
                -₹{membershipDiscount}
              </Text>
            </View>
          )}
          {isCouponApplied && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoKey, {color:'#10B981'}]}>Coupon Discount:</Text>
              <Text style={[styles.infoVal, {color:'#10B981'}]}>-₹{discount}</Text>
            </View>
          )}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Payable Amount</Text>
            <Text style={styles.totalVal}>₹{finalTotal}</Text>
          </View>
          {membershipDiscount > 0 && (
            <Text style={{fontSize:11, color:'#10B981', fontWeight:'700', textAlign:'right', marginTop:4}}>
              You saved ₹{membershipDiscount} with {membershipInfo?.planName} plan 💰
            </Text>
          )}
        </View>

        {!isPaid && (
          <TouchableOpacity style={styles.payBtn} onPress={() => setPaymentModal(true)}>
            <Text style={styles.payBtnText}>PAY ₹{finalTotal} TO PROCEED</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.submitBtn, !isPaid && {backgroundColor:'#CBD5E1'}]} onPress={handleFinalSubmit} disabled={!isPaid || isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>FINAL SUBMIT TO ADMIN</Text>}
        </TouchableOpacity>
      </View>

      <Modal visible={paymentModal} transparent animationType="slide">
        <View style={styles.overlay}><View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Payment Options</Text>
            <TouchableOpacity style={styles.option} onPress={() => { setPinModal(true); setPaymentModal(false); }}>
              <MaterialCommunityIcons name="wallet" size={24} color="#003366" />
              <View style={{flex:1, marginLeft: 15}}><Text style={styles.optionName}>SewaOne Wallet</Text><Text style={styles.optionSub}>Balance: ₹{walletData.balance}</Text></View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.option} onPress={() => { setUpiModal(true); setPaymentModal(false); }}>
              <MaterialCommunityIcons name="qrcode-scan" size={24} color="#003366" /><Text style={[styles.optionName, {marginLeft: 15}]}>UPI / Scan QR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelLink} onPress={() => setPaymentModal(false)}><Text style={{color:'#EF4444', fontWeight:'700'}}>CLOSE</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <Modal visible={upiModal} transparent>
        <View style={styles.overlay}><View style={styles.upiCard}>
            <Text style={styles.sheetTitle}>Scan & Pay</Text>
            <Image source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`upi://pay?pa=7518640453-2@axl&pn=SewaOne&am=${finalTotal}&cu=INR`)}` }} style={styles.qr} />
            <Text style={{fontSize: 12, fontWeight: 'bold', color: '#003366', marginBottom: 10}}>Payable: ₹{finalTotal}</Text>
            <TextInput style={styles.input} placeholder="UTR / Ref Number" onChangeText={setUtr} />
            <TouchableOpacity style={styles.uploadBox} onPress={pickImage}><Text>{screenshot ? "✅ Uploaded" : "Upload Proof Screenshot"}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.finishBtn} onPress={handleUPIFinish}><Text style={{color:'#fff', fontWeight: '800'}}>I HAVE PAID</Text></TouchableOpacity>
            <TouchableOpacity style={styles.cancelLink} onPress={() => setUpiModal(false)}><Text style={{color:'#EF4444', fontWeight:'700', marginTop: 15}}>CANCEL / GO BACK</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <Modal visible={pinModal} transparent>
        <View style={styles.overlay}><View style={styles.pinBox}>
            <Text style={styles.sheetTitle}>Enter Wallet PIN</Text>
            <TextInput style={styles.input} secureTextEntry keyboardType="numeric" maxLength={4} onChangeText={setUserPin} />
            <TouchableOpacity style={styles.finishBtn} onPress={handleWalletPay} disabled={isSubmitting}><Text style={{color:'#fff', fontWeight: '800'}}>CONFIRM</Text></TouchableOpacity>
            <TouchableOpacity style={styles.cancelLink} onPress={() => setPinModal(false)}><Text style={{color:'#EF4444', fontWeight:'700', marginTop: 15}}>CANCEL</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  noteBox: { backgroundColor: '#E0F2FE', padding: 12, borderRadius: 10, margin: 15 },
  noteText: { fontSize: 11, color: '#003366', fontWeight: '700' },
  receiptCard: { backgroundColor: '#fff', borderRadius: 20, padding: 25, margin: 15, elevation: 4 },
  watermarkBox: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', opacity: 0.05 },
  watermark: { fontSize: 60, fontWeight: '900', transform: [{rotate: '-30deg'}] },
  receiptTitle: { fontSize: 18, fontWeight: '900', color: '#003366' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 15 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  infoKey: { fontSize: 12, color: '#94A3B8', fontWeight:'700' },
  infoVal: { fontSize: 13, color: '#1E293B', fontWeight: '800', textAlign: 'right', flex: 1, marginLeft: 15 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  totalLabel: { fontSize: 15, fontWeight: '900' },
  totalVal: { fontSize: 24, fontWeight: '900', color: '#10B981' },
  couponContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  couponInput: { flex: 1, backgroundColor: '#F1F5F9', paddingHorizontal: 15, borderRadius: 10, fontSize: 13, fontWeight: '700', borderWidth: 1, borderColor: '#E2E8F0' },
  couponBtn: { backgroundColor: '#003366', paddingHorizontal: 20, justifyContent: 'center', borderRadius: 10 },
  couponBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  payBtn: { backgroundColor: '#003366', margin: 15, padding: 18, borderRadius: 15, alignItems: 'center' },
  payBtnText: { color: '#fff', fontWeight: '900' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center' },
  sheet: { backgroundColor: '#fff', margin: 20, borderRadius: 25, padding: 25 },
  sheetTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 20 },
  option: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: '#F8FAFC', borderRadius: 15, marginBottom: 15 },
  optionName: { fontSize: 15, fontWeight: '800' },
  optionSub: { fontSize: 12, color: '#64748B' },
  cancelLink: { padding: 10, alignItems: 'center' },
  upiCard: { backgroundColor: '#fff', padding: 25, borderRadius: 25, width: '90%', alignSelf: 'center', alignItems: 'center' },
  qr: { width: 220, height: 220, marginVertical: 15 },
  input: { backgroundColor: '#F1F5F9', width: '100%', padding: 15, borderRadius: 15, marginBottom: 15, textAlign: 'center' },
  uploadBox: { padding: 15, borderWidth: 1, borderStyle: 'dashed', borderRadius: 15, width: '100%', alignItems: 'center', marginBottom: 20 },
  finishBtn: { backgroundColor: '#10B981', width: '100%', padding: 18, borderRadius: 15, alignItems: 'center' },
  pinBox: { backgroundColor: '#fff', padding: 30, borderRadius: 25, width: '85%', alignSelf: 'center' },
  footer: { padding: 15, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  submitBtn: { backgroundColor: '#003366', padding: 20, borderRadius: 15, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '900', fontSize: 16 }
});
