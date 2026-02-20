import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, Modal, Alert, ActivityIndicator, SafeAreaView, Linking 
} from 'react-native';
import { db, auth } from '../../api/firebaseConfig';
import { collection, addDoc, serverTimestamp, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function HelpScreen() {
  const [loading, setLoading] = useState(false);
  const [faqs, setFaqs] = useState([]); 
  const [showGrievanceModal, setShowGrievanceModal] = useState(false);
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [showFAQModal, setShowFAQModal] = useState(false);

  // Form States
  const [trackingId, setTrackingId] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [searchId, setSearchId] = useState('');

  const categories = ["Payment Issue", "Document Error", "Wallet Balance", "Form Status", "Agent Behavior", "Refral Issue", "Others"];

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "faqs"), (snap) => {
      const faqList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFaqs(faqList);
    });
    return () => unsub();
  }, []);

  const openWhatsApp = () => {
    const phone = "919876543210"; 
    const msg = "Namaste SewaOne Support! Mujhe help chahiye.";
    Linking.openURL(`whatsapp://send?phone=${phone}&text=${msg}`).catch(() => Alert.alert("Error", "WhatsApp install nahi hai."));
  };

  const openCall = () => Linking.openURL('tel:+919876543210');

  const handleSubmitGrievance = async () => {
    if (!trackingId || !category || !description) {
      return Alert.alert("Required", "All field Mandatory, !");
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "grievances"), {
        userId: auth.currentUser?.uid,
        trackingId: trackingId.trim(),
        category, 
        description,
        status: 'Under Review',
        timestamp: serverTimestamp()
      });
      Alert.alert("Success", "Ticket Raised! Our support team will help you soon.");
      setShowGrievanceModal(false);
      setTrackingId(''); setCategory(''); setDescription('');
    } catch (e) { Alert.alert("Error", "Server error. Try again."); }
    finally { setLoading(false); }
  };

  const handleTrackGrievance = async () => {
    if (!searchId) return Alert.alert("Empty", "Please, Enter Valid Tracking Id!");
    setLoading(true);
    try {
      const q = query(collection(db, "grievances"), where("trackingId", "==", searchId.trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        Alert.alert("Status Found", `Category: ${data.category}\nStatus: ${data.status}\nUpdate: ${data.adminNote || 'Checking...'}`);
      } else {
        Alert.alert("Not Found", "Please, Enter Valid Trecking Id.");
      }
    } catch (e) { Alert.alert("Error", "Records Not Found."); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topStrip} />
      <View style={styles.header}>
        <MaterialCommunityIcons name="shield-account" size={35} color="#003366" />
        <View style={{marginLeft: 12}}>
          <Text style={styles.headerTitle}>SewaOne Support Portal</Text>
          <Text style={styles.headerSubtitle}>Official Grievance Redressal System</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Service Grid Buttons */}
        <View style={styles.gridRow}>
          <TouchableOpacity style={styles.gridCard} onPress={() => setShowGrievanceModal(true)}>
            <View style={[styles.iconCircle, {backgroundColor: '#E0F2FE'}]}><MaterialCommunityIcons name="plus-circle" size={28} color="#003366" /></View>
            <Text style={styles.gridLabel}>Add Ticket</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridCard} onPress={() => setShowTrackModal(true)}>
            <View style={[styles.iconCircle, {backgroundColor: '#F0FDF4'}]}><MaterialCommunityIcons name="magnify" size={28} color="#10B981" /></View>
            <Text style={styles.gridLabel}>Track ID</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridCard} onPress={() => setShowFAQModal(true)}>
            <View style={[styles.iconCircle, {backgroundColor: '#FEF3C7'}]}><MaterialCommunityIcons name="help-circle" size={28} color="#D97706" /></View>
            <Text style={styles.gridLabel}>View FAQs</Text>
          </TouchableOpacity>
        </View>

        {/* --- ✨ NEW SECTION: HOW TO USE SEWAONE (Hindi) --- */}
        <View style={styles.guideCard}>
          <View style={styles.guideHeader}>
            <MaterialCommunityIcons name="lightbulb-on" size={22} color="#003366" />
            <Text style={styles.guideTitle}>SewaOne का उपयोग कैसे करें?</Text>
          </View>

          <View style={styles.guideStep}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
            <Text style={styles.stepText}>सबसे पहले अपनी प्रोफाइल पूरी करें और 'Job Details' में जाकर अपनी योग्यता (Eligibility) को सत्यापित करें।</Text>
          </View>

          <View style={styles.guideStep}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
            <Text style={styles.stepText}>अपनी पसंद की नौकरी चुनें। आप स्वयं आधिकारिक लिंक से भर सकते हैं या 'SewaOne Team' की सहायता ले सकते हैं।</Text>
          </View>

          <View style={styles.guideStep}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
            <Text style={styles.stepText}>टीम से फॉर्म भरवाने के लिए वॉलेट में बैलेंस रखें। फॉर्म सबमिट होते ही आपको ट्रैकिंग आईडी मिल जाएगी।</Text>
          </View>

          <View style={styles.guideStep}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>4</Text></View>
            <Text style={styles.stepText}>किसी भी समस्या के लिए यहाँ 'Add Ticket' पर क्लिक करें या व्हाट्सएप सपोर्ट का उपयोग करें।</Text>
          </View>
        </View>

        {/* Contact Strip */}
        <View style={styles.contactBar}>
          <TouchableOpacity style={styles.barItem} onPress={openWhatsApp}>
            <MaterialCommunityIcons name="whatsapp" size={22} color="#25D366" /><Text style={styles.barText}>WhatsApp</Text>
          </TouchableOpacity>
          <View style={styles.vLine} />
          <TouchableOpacity style={styles.barItem} onPress={openCall}>
            <MaterialCommunityIcons name="phone" size={22} color="#003366" /><Text style={styles.barText}>Call Support</Text>
          </TouchableOpacity>
        </View>

        {/* Trust Banner */}
        <View style={styles.trustBanner}>
          <MaterialCommunityIcons name="security" size={40} color="#003366" />
          <Text style={styles.trustTitle}>SewaOne Trusted Support</Text>
          <Text style={styles.trustDesc}>Dear, User our aim is to help you in every way and give you the right guidance.</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2026 SewaOne Digital Solutions</Text>
          <Text style={styles.footerSubText}>Verified Support Ecosystem</Text>
        </View>
      </ScrollView>

      {/* --- MODALS (Rest of the code remains same) --- */}
      <Modal visible={showFAQModal} animationType="slide">
        <SafeAreaView style={{flex: 1}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>General FAQs</Text>
            <TouchableOpacity onPress={() => setShowFAQModal(false)}><MaterialCommunityIcons name="close" size={28} color="#000" /></TouchableOpacity>
          </View>
          <ScrollView style={{padding: 20}}>
            {faqs.length > 0 ? faqs.map((f, i) => (
              <View key={f.id} style={styles.faqCard}>
                <Text style={styles.faqQ}>Q: {f.question}</Text>
                <Text style={styles.faqA}>A: {f.answer}</Text>
              </View>
            )) : (
              <Text style={{textAlign:'center', marginTop: 50, color: '#94A3B8'}}>Bhai, abhi koi FAQs nahi hain.</Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showTrackModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.trackCard}>
            <Text style={styles.modalHeading}>Track Ticket Status</Text>
            <TextInput style={styles.trackInput} placeholder="Enter Tracking ID" onChangeText={setSearchId} />
            <TouchableOpacity style={styles.trackBtn} onPress={handleTrackGrievance} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTextWhite}>CHECK STATUS</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTrackModal(false)}><Text style={styles.closeLink}>CLOSE</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showGrievanceModal} animationType="slide">
        <SafeAreaView style={{flex:1}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Raise a Ticket</Text>
            <TouchableOpacity onPress={() => setShowGrievanceModal(false)}><MaterialCommunityIcons name="close" size={28} color="#000" /></TouchableOpacity>
          </View>
          <ScrollView style={{padding: 20}}>
            <Text style={styles.label}>Tracking ID *</Text>
            <TextInput style={styles.input} placeholder="e.g. SW1-123456" onChangeText={setTrackingId} value={trackingId} />
            <Text style={styles.label}>Category *</Text>
            <View style={styles.catGrid}>
              {categories.map(c => (
                <TouchableOpacity key={c} style={[styles.pill, category === c && styles.pillActive]} onPress={() => setCategory(c)}>
                  <Text style={[styles.pillText, category === c && {color: '#fff'}]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Describe Issue *</Text>
            <TextInput style={[styles.input, {height: 100}]} multiline placeholder="Bhai, kya pareshani hai?" onChangeText={setDescription} value={description} />
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitGrievance}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>SUBMIT COMPLAINT</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topStrip: { height: 5, backgroundColor: '#003366' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E2E8F0' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#003366' },
  headerSubtitle: { fontSize: 10, color: '#64748B', fontWeight: '700' },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  gridCard: { backgroundColor: '#fff', width: '31%', padding: 15, borderRadius: 20, alignItems: 'center', elevation: 3 },
  iconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  gridLabel: { fontSize: 11, fontWeight: '800', color: '#1E293B' },

  // ✨ NEW STYLES: Usage Guide Section
  guideCard: { backgroundColor: '#fff', padding: 20, borderRadius: 25, marginBottom: 25, elevation: 2, borderLeftWidth: 6, borderLeftColor: '#003366' },
  guideHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  guideTitle: { marginLeft: 10, fontSize: 15, fontWeight: '900', color: '#003366' },
  guideStep: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' },
  stepNum: { backgroundColor: '#E0F2FE', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginRight: 10, marginTop: 2 },
  stepNumText: { fontSize: 12, fontWeight: '900', color: '#003366' },
  stepText: { flex: 1, fontSize: 12, color: '#475569', fontWeight: '700', lineHeight: 18 },

  contactBar: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 15, padding: 15, alignItems: 'center', elevation: 2, marginBottom: 25 },
  barItem: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  barText: { marginLeft: 8, fontWeight: '800', color: '#334155' },
  vLine: { width: 1, height: 25, backgroundColor: '#F1F5F9' },
  trustBanner: { padding: 25, backgroundColor: '#E0F2FE', borderRadius: 25, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#003366' },
  trustTitle: { fontSize: 16, fontWeight: '900', color: '#003366', marginTop: 10 },
  trustDesc: { textAlign: 'center', fontSize: 11, color: '#64748B', marginTop: 5, fontWeight: '600' },
  footer: { marginTop: 40, alignItems: 'center', paddingBottom: 20 },
  footerText: { fontSize: 12, fontWeight: '900', color: '#003366' },
  footerSubText: { fontSize: 10, color: '#94A3B8', marginTop: 3 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  faqCard: { backgroundColor: '#F1F5F9', padding: 15, borderRadius: 12, marginBottom: 12 },
  faqQ: { fontWeight: '900', color: '#003366' },
  faqA: { marginTop: 5, color: '#475569', fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '800', marginTop: 20, marginBottom: 8 },
  input: { backgroundColor: '#F1F5F9', padding: 15, borderRadius: 12, fontWeight: '700' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#003366' },
  pillActive: { backgroundColor: '#003366' },
  pillText: { fontSize: 12, fontWeight: '700', color: '#003366' },
  submitBtn: { backgroundColor: '#EF4444', padding: 18, borderRadius: 15, marginTop: 30, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '900' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  trackCard: { backgroundColor: '#fff', width: '85%', padding: 25, borderRadius: 20 },
  modalHeading: { fontSize: 16, fontWeight: '900', color: '#003366', textAlign: 'center', marginBottom: 20 },
  trackInput: { backgroundColor: '#F1F5F9', padding: 15, borderRadius: 12, textAlign: 'center', fontWeight: '700', marginBottom: 15 },
  trackBtn: { backgroundColor: '#003366', padding: 15, borderRadius: 12, alignItems: 'center' },
  btnTextWhite: { color: '#fff', fontWeight: '900' },
  closeLink: { textAlign: 'center', marginTop: 15, color: '#EF4444', fontWeight: '800' }
});
