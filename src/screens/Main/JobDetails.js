import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Share, Linking, Alert, Modal, ActivityIndicator 
} from 'react-native';
import { db, auth } from '../../api/firebaseConfig';
import { 
  doc, getDoc, setDoc, 
  query, where, getDocs, collection 
} from 'firebase/firestore'; 
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function JobDetails({ route, navigation }) {
  const { job, jobId } = route.params || {}; 
  
  const [jobData, setJobData] = useState(job || null);
  const [loading, setLoading] = useState(!job);

  const [eligibilityStatus, setEligibilityStatus] = useState('unchecked');
  const [hasApplied, setHasApplied] = useState(false); 
  const userId = auth.currentUser?.uid; 
  
  const [showEligibilityModal, setShowEligibilityModal] = useState(false);
  const [showApplyOptions, setShowApplyOptions] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false); 

  const [answers, setAnswers] = useState({});
  const [selectedUrl, setSelectedUrl] = useState('');

  const onShare = async () => {
    try {
      const shareMessage = `🚨 *Nayi Sarkari Naukri Alert!* 🚨\n\n*Job:* ${jobData.title}\n*Department:* ${jobData.conductedBy}\n\n✅ Is job ki poori details dekhne aur apply karne ke liye *SewaOne* App download karein.\n\n👇 *Download App Now:* \nhttps://sewaone.in\n\n_Ab har sarkari kaam, ghar baithe aasaan!_`;
      
      await Share.share({
        message: shareMessage,
      });
    } catch (error) {
      Alert.alert("Share Error", error.message);
    }
  };

  useEffect(() => {
    if (!jobData && jobId) {
      const fetchJob = async () => {
        try {
          const docRef = doc(db, "gov_jobs", jobId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setJobData({ id: docSnap.id, ...docSnap.data() });
          }
        } catch (err) {
          console.log("Error fetching job:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchJob();
    }
  }, [jobId]);

  useEffect(() => {
    const checkStatus = async () => {
      if (!userId || !jobData) return;
      try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const profileData = userSnap.data().profileEligibility || {};
          setAnswers(prev => ({ ...prev, ...profileData }));
          if (jobData.eligibilityQuestions) {
            const isAlreadyEligible = jobData.eligibilityQuestions.every(q => profileData[q.question] === 'Yes');
            if (isAlreadyEligible) setEligibilityStatus('eligible');
          }
        }

        const q = query(
          collection(db, "applications"), 
          where("userId", "==", userId), 
          where("jobId", "==", jobData.id)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setHasApplied(true); 
        }
      } catch (e) { console.log("Error checking status:", e); }
    };

    if (jobData) checkStatus();
  }, [userId, jobData?.id]);

  useEffect(() => {
    if (jobData) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity onPress={onShare} style={{ marginRight: 20 }}>
            <MaterialCommunityIcons name="share-variant" size={24} color="#fff" />
          </TouchableOpacity>
        ),
      });
    }
  }, [jobData]);

  const handleEligibilityPress = () => {
    if (eligibilityStatus === 'eligible') {
      Alert.alert("Already Verified", "Aap eligible hain. Update karein?", [
        { text: "No", style: "cancel" },
        { text: "Yes", onPress: () => setShowEligibilityModal(true) }
      ]);
    } else { setShowEligibilityModal(true); }
  };

  const startSewaOneProcess = () => {
    setShowApplyOptions(false);
    setIsVerifying(true); 
    setTimeout(() => {
      setIsVerifying(false); 
      if (eligibilityStatus === 'eligible') { setShowConsent(true); } 
      else { Alert.alert("Not Eligible", "Please verify eligibility first."); }
    }, 2000);
  };

  const submitEligibility = async () => {
    if (!jobData.eligibilityQuestions) return;
    const allCorrect = jobData.eligibilityQuestions.every(q => answers[q.question] === 'Yes');
    setEligibilityStatus(allCorrect ? 'eligible' : 'not-eligible');
    setShowEligibilityModal(false);
    if (userId) {
      const userRef = doc(db, "users", userId);
      await setDoc(userRef, { profileEligibility: answers }, { merge: true });
    }
  };

  if (loading) return <View style={styles.blurOverlay}><ActivityIndicator size="large" color="#fff" /></View>;
  if (!jobData) return <View style={styles.blurOverlay}><Text style={styles.whiteText}>Bhai, details nahi mili!</Text></View>;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        
        <View style={styles.headerSection}>
          <Text style={styles.mainTitle}>{jobData.title}</Text>
          <Text style={styles.conductedBy}>By: {jobData.conductedBy}</Text>
          <Text style={styles.shortDesc}>{jobData.mainDesc}</Text>
        </View>

        {jobData.sections && jobData.sections.map((sec, sIdx) => (
          <View key={sIdx} style={styles.sectionBox}>
            <Text style={styles.sectionHeading}>{sec.heading}</Text>
            {sec.fields && sec.fields.map((field, fIdx) => (
              <View key={fIdx} style={styles.fieldWrapper}>
                {field.type === 'table' ? (
                  <ScrollView horizontal>
                    <View style={styles.tableContainer}>
                      <View style={styles.tableHeader}>
                        {field.headers.map((h, i) => <Text key={i} style={styles.tableHeaderText}>{h}</Text>)}
                      </View>
                      {field.rows.map((row, i) => (
                        <View key={i} style={styles.tableRow}>
                          {field.headers.map((_, hI) => (<Text key={hI} style={styles.tableCell}>{row[`c${hI}`]}</Text>))}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                ) : field.type === 'media' ? (
                  /* ✨ NEW: Media (Image/PDF) View Button */
                  <View style={styles.mediaRow}>
                    {field.label ? <Text style={styles.fieldLabel}>{field.label}:</Text> : null}
                    <TouchableOpacity 
                      style={styles.viewMediaBtn} 
                      onPress={() => Linking.openURL(field.value)}
                    >
                      <MaterialCommunityIcons name="file-eye-outline" size={16} color="#003366" />
                      <Text style={styles.viewMediaText}>VIEW FILE</Text>
                    </TouchableOpacity>
                  </View>
                ) : ( 
                  <View style={styles.textRow}>
                    <Text style={styles.fieldLabel}>{field.label}:</Text>
                    <Text style={styles.fieldValue}>{field.value}</Text>
                  </View> 
                )}
              </View>
            ))}
          </View>
        ))}

        {jobData.isEligibilityEnabled && (
          <View style={styles.actionArea}>
            <TouchableOpacity style={[styles.checkBtn, eligibilityStatus === 'eligible' && {backgroundColor: '#10B981'}]} onPress={handleEligibilityPress}>
              <MaterialCommunityIcons name="clipboard-check" size={20} color="#fff" /><Text style={styles.btnText}>{eligibilityStatus === 'eligible' ? "ELIGIBILITY VERIFIED" : "CHECK ELIGIBILITY"}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.buttonContainer}>
          {jobData.buttons && jobData.buttons.filter(b => b.show).map((btn, i) => {
            const isApplyBtn = btn.name.toLowerCase().includes('apply');
            return (
              <TouchableOpacity 
                key={i} 
                disabled={isApplyBtn && hasApplied}
                style={[
                  styles.dynamicBtn, 
                  isApplyBtn ? styles.applyColor : styles.otherColor,
                  (isApplyBtn && hasApplied) && { backgroundColor: '#94A3B8' } 
                ]} 
                onPress={() => {
                  if(isApplyBtn) {
                    setSelectedUrl(btn.url);
                    setShowApplyOptions(true);
                  } else { Linking.openURL(btn.url); }
                }}
              >
                <Text style={styles.btnText}>
                  {(isApplyBtn && hasApplied) ? "ALREADY APPLIED" : btn.name.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modals and Footer (Same as provided) */}
      {/* ... rest of the code remains identical ... */}
      <Modal visible={isVerifying} transparent animationType="fade">
        <View style={styles.blurOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.blurText}>Verifying Eligibility Status...</Text>
        </View>
      </Modal>

      <Modal visible={showApplyOptions} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.optionBox}>
            <Text style={styles.modalTitle}>Application Method</Text>
            <TouchableOpacity style={styles.optBtn} onPress={() => {setShowApplyOptions(false); Linking.openURL(selectedUrl)}}>
              <Text style={styles.whiteText}>Apply with Self (Official Link)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optBtn, {backgroundColor: '#FF5722'}]} onPress={startSewaOneProcess}>
              <Text style={styles.whiteText}>Apply with SewaOne Team</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowApplyOptions(false)}><Text style={styles.closeText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showConsent} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.consentBox}>
            <MaterialCommunityIcons name="shield-account" size={50} color="#003366" style={{alignSelf:'center'}} />
            <Text style={styles.consentTitle}>SewaOne Service Consent</Text>
            <ScrollView style={styles.termsScroll}>
              <Text style={styles.termsText}>
                1. Main SewaOne team ko apna form bharne ki anumati deta hoon.{"\n\n"}
                2. Mere dwara di gayi saari jankari sahi hai.{"\n\n"}
                3. Service charges wallet se kaate jayenge.
              </Text>
            </ScrollView>
            <View style={{flexDirection:'row', gap:10}}>
              <TouchableOpacity style={[styles.consentBtn, {backgroundColor: '#10B981'}]} onPress={() => { setShowConsent(false); navigation.navigate('ApplyWizard', { jobId: jobData.id, jobTitle: jobData.title }); }}>
                <Text style={styles.whiteText}>I ACCEPT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.consentBtn, {backgroundColor: '#EF4444'}]} onPress={() => setShowConsent(false)}>
                <Text style={styles.whiteText}>DECLINE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showEligibilityModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Eligibility Check</Text>
            <ScrollView>
              {jobData.eligibilityQuestions?.map((q, i) => (
                <View key={i} style={{marginBottom:15}}>
                  <Text style={{fontWeight:'bold', marginBottom:8}}>{q.question}</Text>
                  <View style={{flexDirection:'row', gap:10}}>
                    <TouchableOpacity style={[styles.ansBtn, answers[q.question] === 'Yes' && styles.ansActive]} onPress={() => setAnswers({...answers, [q.question]: 'Yes'})}>
                      <Text style={answers[q.question] === 'Yes' ? {color:'#fff'} : {color:'#000'}}>Yes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.ansBtn, answers[q.question] === 'No' && styles.ansActiveRed]} onPress={() => setAnswers({...answers, [q.question]: 'No'})}>
                      <Text style={answers[q.question] === 'No' ? {color:'#fff'} : {color:'#000'}}>No</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.submitBtn} onPress={submitEligibility}><Text style={styles.whiteText}>SUBMIT</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowEligibilityModal(false)}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.verifiedFooter}>
        <MaterialCommunityIcons name="shield-check" size={16} color="#10B981" />
        <Text style={styles.footerText}>Verified by SewaOne Secure Systems</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerSection: { padding: 25, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  mainTitle: { fontSize: 20, fontWeight: 'bold', color: '#003366' },
  conductedBy: { fontSize: 13, color: '#64748B', marginTop: 5, fontWeight: 'bold' },
  shortDesc: { fontSize: 13, color: '#475569', marginTop: 12, lineHeight: 20 },
  sectionBox: { margin: 15, padding: 20, backgroundColor: '#fff', borderRadius: 15, elevation: 1 },
  sectionHeading: { fontSize: 15, fontWeight: 'bold', color: '#FF5722', marginBottom: 15, borderBottomWidth: 2, borderBottomColor: '#FF5722', alignSelf:'flex-start', textTransform: 'uppercase' },
  fieldWrapper: { marginBottom: 12 },
  
  textRow: { 
    flexDirection: 'row', 
    paddingVertical: 4,
    alignItems: 'flex-start' 
  },

  /* ✨ NEW: Media Row Styling */
  mediaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 5
  },
  viewMediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#003366'
  },
  viewMediaText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#003366',
    marginLeft: 5
  },

  fieldLabel: { 
    fontSize: 13,
    fontWeight: 'bold', 
    color: '#334155',
    flex: 0.42, 
    marginRight: 10
  },
  fieldValue: { 
    fontSize: 13,
    color: '#475569',
    flex: 0.58, 
    textAlign: 'left', 
    flexWrap: 'wrap',
    lineHeight: 18 
  },

  tableContainer: { marginTop: 10, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, overflow: 'hidden', minWidth: 300 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#003366', padding: 10 },
  tableHeaderText: { flex: 1, color: '#fff', fontWeight: 'bold', fontSize: 11, textAlign: 'center' },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#CBD5E1', padding: 10 },
  tableCell: { flex: 1, fontSize: 11, textAlign: 'center' },
  actionArea: { paddingHorizontal: 15, marginTop: 15 },
  checkBtn: { backgroundColor: '#F59E0B', padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  buttonContainer: { padding: 15, gap: 10 },
  dynamicBtn: { padding: 16, borderRadius: 12, alignItems: 'center' },
  applyColor: { backgroundColor: '#003366' },
  otherColor: { backgroundColor: '#64748B' },
  btnText: { color: '#fff', fontWeight: 'bold', marginLeft: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  blurOverlay: { flex: 1, backgroundColor: 'rgba(0,51,102,0.9)', justifyContent: 'center', alignItems: 'center' },
  blurText: { color: '#fff', marginTop: 15, fontWeight: 'bold' },
  optionBox: { backgroundColor: '#fff', padding: 25, borderRadius: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  optBtn: { backgroundColor: '#003366', padding: 15, borderRadius: 10, marginBottom: 10, alignItems: 'center' },
  consentBox: { backgroundColor: '#fff', padding: 25, borderRadius: 25 },
  consentTitle: { fontSize: 18, fontWeight: 'bold', color: '#003366', textAlign: 'center', marginBottom: 15 },
  termsScroll: { backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, marginBottom: 15 },
  termsText: { fontSize: 13, lineHeight: 20 },
  consentBtn: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', padding: 25, borderRadius: 20, maxHeight:'80%' },
  ansBtn: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, alignItems: 'center' },
  ansActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  ansActiveRed: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  submitBtn: { backgroundColor: '#003366', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  whiteText: { color: '#fff', fontWeight: 'bold' },
  closeText: { textAlign: 'center', marginTop: 15, color: '#94A3B8' },
  verifiedFooter: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#fff', padding: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  footerText: { fontSize: 11, color: '#10B981', fontWeight: 'bold', marginLeft: 5 }
});
