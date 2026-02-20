import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Modal, TextInput, Alert, ActivityIndicator, SafeAreaView, Image, StatusBar 
} from 'react-native';
import { db, auth } from '../../api/firebaseConfig';
import { 
  doc, getDoc, collection, addDoc, 
  increment, serverTimestamp, updateDoc, query, where, getDocs 
} from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

export default function ServiceReview({ route, navigation }) {
  const { formData, feeDetails, serviceId, serviceTitle, documents } = route.params || {}; 

  const govFee = Number(feeDetails?.govFee || 0); 
  const serviceFee = Number(feeDetails?.serviceFee || 0); 
  const initialTotal = govFee + serviceFee; 

  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
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
  const [walletData, setWalletData] = useState({ balance: 0, realPin: '' });

  const userId = auth.currentUser?.uid;
  const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dxuurwexl/image/upload";
  const UPLOAD_PRESET = "edusphere_uploads";

  useEffect(() => {
    if (userId) fetchWalletInfo();
    setFinalTotal(govFee + serviceFee);
  }, [userId, govFee, serviceFee]);

  const fetchWalletInfo = async () => {
    const userSnap = await getDoc(doc(db, "users", userId));
    if (userSnap.exists()) {
      const data = userSnap.data();
      setWalletData({
        balance: Number(data.walletBalance || 0),
        realPin: String(data.transactionPin || data.walletPin || data.pin || '') 
      });
    }
  };

  // --- 💸 Wallet Pay Logic (Fixed) ---
  const handleWalletPay = async () => {
    if (!userPin) return Alert.alert("Error", "PIN dalo bhai!");
    if (userPin.trim() !== walletData.realPin.trim()) return Alert.alert("Security", "Galat PIN hai!");
    if (walletData.balance < finalTotal) return Alert.alert("Low Balance", "Wallet recharge karein.");

    setIsSubmitting(true);
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { walletBalance: increment(-finalTotal) });
      await addDoc(collection(db, "transactions"), {
        userId, amount: finalTotal, type: 'debit',
        remark: `Paid for Service: ${serviceTitle}`, status: 'success', timestamp: serverTimestamp()
      });
      setIsPaid(true); setSelectedMethod('wallet'); setPinModal(false); setPaymentModal(false);
      Alert.alert("Success ✅", "Paisa wallet se kat gaya!");
    } catch (e) { Alert.alert("Error", "Payment fail ho gaya."); }
    finally { setIsSubmitting(false); }
  };

  const handleFinalSubmit = async () => { 
    setIsSubmitting(true);
    try {
      const trackingId = `SW1-S-${Math.floor(100000 + Math.random() * 900000)}`;
      let cloudImageUrl = screenshot;

      if (selectedMethod === 'upi' && screenshot && !screenshot.startsWith('http')) {
        cloudImageUrl = await uploadToCloudinary(screenshot);
      }

      await addDoc(collection(db, "service_applications"), {
        trackingId, userId, serviceId, serviceTitle,
        feeDetails: { govFee, serviceFee, discount, totalPaid: finalTotal },
        formData, paymentMethod: selectedMethod,
        paymentScreenshot: cloudImageUrl || null,
        documents: documents || {}, 
        status: selectedMethod === 'wallet' ? 'Under Process' : 'Payment Verification Pending',
        timestamp: serverTimestamp()
      });

      navigation.navigate('SubmitSuccess', { trackingId });
    } catch (e) { Alert.alert("Error", "Submit failed."); }
    finally { setIsSubmitting(false); }
  };

  const uploadToCloudinary = async (uri) => {
    const data = new FormData();
    data.append('file', { uri, type: 'image/jpeg', name: 'proof.jpg' });
    data.append('upload_preset', UPLOAD_PRESET);
    try {
      let res = await fetch(CLOUDINARY_URL, { method: 'POST', body: data });
      let json = await res.json();
      return json.secure_url;
    } catch (e) { return null; }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.5 });
    if (!result.canceled) setScreenshot(result.assets[0].uri);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        
        <View style={styles.receiptCard}>
          <Text style={styles.receiptTag}>APPLICATION REVIEW</Text>
          <Text style={styles.receiptTitle}>{serviceTitle}</Text>
          <View style={styles.divider} />
          {Object.entries(formData).map(([key, val]) => (
            <View key={key} style={styles.infoRow}>
              <Text style={styles.infoKey}>{key}</Text>
              <Text style={styles.infoVal}>{val}</Text>
            </View>
          ))}
        </View>

        <View style={styles.receiptCard}>
          <Text style={styles.sectionHead}>Payment Summary</Text>
          <View style={styles.infoRow}><Text style={styles.infoKey}>Portal Fee</Text><Text style={styles.infoVal}>₹{serviceFee}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoKey}>Govt Fee</Text><Text style={styles.infoVal}>₹{govFee}</Text></View>
          <View style={styles.divider} />
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalVal}>₹{finalTotal}</Text></View>
        </View>

        {!isPaid && (
          <TouchableOpacity style={styles.payBtn} onPress={() => setPaymentModal(true)}>
            <Text style={styles.payBtnText}>SECURE PAY ₹{finalTotal}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.submitBtn, !isPaid && {backgroundColor:'#CBD5E1'}]} 
          onPress={handleFinalSubmit} 
          disabled={!isPaid || isSubmitting}
        >
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>FINAL SUBMIT TO ADMIN</Text>}
        </TouchableOpacity>
      </View>

      {/* --- 🔘 Main Payment Modal (Fixed UPI Click) --- */}
      <Modal visible={paymentModal} transparent animationType="slide">
        <View style={styles.overlay}><View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Choose Payment Method</Text>
            <TouchableOpacity style={styles.option} onPress={() => { setPinModal(true); setPaymentModal(false); }}>
              <MaterialCommunityIcons name="wallet" size={26} color="#003366" />
              <View style={{flex:1, marginLeft: 15}}><Text style={styles.optionName}>SewaOne Wallet</Text><Text style={styles.optionSub}>Balance: ₹{walletData.balance}</Text></View>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.option} onPress={() => { setUpiModal(true); setPaymentModal(false); }}>
              <MaterialCommunityIcons name="qrcode-scan" size={26} color="#003366" />
              <View style={{flex:1, marginLeft: 15}}><Text style={styles.optionName}>UPI / Scan QR</Text><Text style={styles.optionSub}>Manual Screenshot Proof</Text></View>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.cancelLink} onPress={() => setPaymentModal(false)}><Text style={{color:'red', fontWeight:'bold'}}>CLOSE</Text></TouchableOpacity>
        </View></View>
      </Modal>

      {/* --- 📲 UPI QR Modal (Fixed & Added Cancel) --- */}
      <Modal visible={upiModal} transparent animationType="fade">
        <View style={styles.overlay}><View style={styles.upiCard}>
            <Text style={styles.sheetTitle}>Scan to Pay</Text>
            <Image source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`upi://pay?pa=75186453-2@axl&pn=SewaOne&am=${finalTotal}&cu=INR`)}` }} style={styles.qr} />
            <Text style={styles.totalVal}>₹ {finalTotal}</Text>
            <TextInput style={styles.input} placeholder="UTR / Ref Number" onChangeText={setUtr} />
            <TouchableOpacity style={styles.uploadBox} onPress={pickImage}><Text>{screenshot ? "✅ Screenshot Added" : "Upload Payment Screenshot"}</Text></TouchableOpacity>
            
            <TouchableOpacity style={styles.finishBtn} onPress={() => {if(!screenshot) return Alert.alert("Required", "Upload proof!"); setIsPaid(true); setSelectedMethod('upi'); setUpiModal(false);}}>
              <Text style={{color:'#fff', fontWeight: '900'}}>I HAVE PAID</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{marginTop:15}} onPress={() => setUpiModal(false)}>
              <Text style={{color:'red', fontWeight:'900'}}>CANCEL / GO BACK</Text>
            </TouchableOpacity>
        </View></View>
      </Modal>

      {/* --- 🔑 PIN Modal --- */}
      <Modal visible={pinModal} transparent animationType="fade">
        <View style={styles.overlay}><View style={styles.pinBox}>
            <Text style={styles.sheetTitle}>Enter Transaction PIN</Text>
            <TextInput style={styles.input} secureTextEntry keyboardType="numeric" maxLength={4} onChangeText={setUserPin} autoFocus />
            <TouchableOpacity style={styles.finishBtn} onPress={handleWalletPay} disabled={isSubmitting}>
              <Text style={{color:'#fff', fontWeight:'800'}}>CONFIRM PAYMENT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{marginTop:15, alignItems:'center'}} onPress={() => setPinModal(false)}><Text style={{color:'red', fontWeight:'bold'}}>CANCEL</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  receiptCard: { backgroundColor: '#fff', borderRadius: 20, padding: 25, margin: 15, elevation: 4 },
  receiptTag: { alignSelf: 'flex-start', backgroundColor: '#F1F5F9', color: '#64748B', fontSize: 10, fontWeight: '900', padding: 5, borderRadius: 5, marginBottom: 10 },
  receiptTitle: { fontSize: 18, fontWeight: '900', color: '#003366' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 15 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  infoKey: { fontSize: 12, color: '#94A3B8', fontWeight:'700' },
  infoVal: { fontSize: 13, color: '#1E293B', fontWeight: '800', textAlign: 'right', flex: 1, marginLeft: 15 },
  sectionHead: { fontSize: 16, fontWeight: '900', color: '#003366', marginBottom: 15 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 15, fontWeight: '900' },
  totalVal: { fontSize: 24, fontWeight: '900', color: '#10B981' },
  payBtn: { backgroundColor: '#003366', margin: 15, padding: 18, borderRadius: 15, alignItems: 'center' },
  payBtnText: { color: '#fff', fontWeight: '900' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center' },
  sheet: { backgroundColor: '#fff', margin: 20, borderRadius: 30, padding: 30 },
  sheetTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 20 },
  option: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: '#F8FAFC', borderRadius: 15, marginBottom: 15 },
  optionName: { fontSize: 15, fontWeight: '800' },
  optionSub: { fontSize: 11, color: '#64748B' },
  cancelLink: { padding: 10, alignItems: 'center' },
  upiCard: { backgroundColor: '#fff', padding: 30, borderRadius: 30, width: '90%', alignSelf: 'center', alignItems: 'center' },
  qr: { width: 200, height: 200, marginVertical: 15 },
  input: { backgroundColor: '#F1F5F9', width: '100%', padding: 15, borderRadius: 15, marginBottom: 15, textAlign: 'center', fontSize: 18, fontWeight: 'bold' },
  uploadBox: { padding: 15, borderWidth: 2, borderStyle: 'dashed', borderColor: '#CBD5E1', borderRadius: 15, width: '100%', alignItems: 'center', marginBottom: 20 },
  finishBtn: { backgroundColor: '#10B981', width: '100%', padding: 18, borderRadius: 15, alignItems: 'center' },
  pinBox: { backgroundColor: '#fff', padding: 30, borderRadius: 25, width: '85%', alignSelf: 'center' },
  footer: { padding: 15, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  submitBtn: { backgroundColor: '#003366', padding: 20, borderRadius: 15, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '900', fontSize: 16 }
});
