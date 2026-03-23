import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, Animated, ActivityIndicator, Alert, SafeAreaView, Modal, FlatList 
} from 'react-native';
// auth, updateDoc, setDoc ko import kiya
import { db, auth } from '../../api/firebaseConfig'; 
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { saveDraft, loadDraft, clearDraft } from '../../utils/draftManager';
import DraftBanner from '../../components/DraftBanner';
import * as ImageManipulator from 'expo-image-manipulator';

const CLOUD_NAME = "dxuurwexl";
const UPLOAD_PRESET = "edusphere_uploads";

// --- DropdownSelector & FloatingInput Components wahi hain ---
const DropdownSelector = ({ label, options, selectedValue, onSelect, placeholder }) => {
  const [modalVisible, setModalVisible] = useState(false);
  return (
    <View style={styles.selectorContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity 
        style={[styles.dropdownTrigger, selectedValue && styles.activeBorder]} 
        onPress={() => setModalVisible(true)}
      >
        <Text style={{ color: selectedValue ? '#0F172A' : '#64748B', fontSize: 15, fontWeight: '500' }}>
          {selectedValue || placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color={selectedValue ? "#003366" : "#94A3B8"} />
      </TouchableOpacity>
      <Modal visible={modalVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalIndicator} />
            <Text style={styles.modalHeader}>Select {label.replace('*', '')}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.optionItem, selectedValue === item && styles.selectedOptionBg]} 
                  onPress={() => { onSelect(item); setModalVisible(false); }}
                >
                  <Text style={[styles.optionText, selectedValue === item && styles.selectedOptionText]}>{item}</Text>
                  {selectedValue === item && <MaterialCommunityIcons name="check-circle" size={20} color="#003366" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const FloatingInput = ({ label, value, ...props }) => {
  const [isFocused, setIsFocused] = useState(false);
  const animatedIsFocused = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => { 
    Animated.timing(animatedIsFocused, { toValue: (isFocused || value) ? 1 : 0, duration: 200, useNativeDriver: false }).start(); 
  }, [isFocused, value]);
  const labelStyle = { 
    position: 'absolute', left: 14, 
    top: animatedIsFocused.interpolate({ inputRange: [0, 1], outputRange: [16, -10] }), 
    fontSize: animatedIsFocused.interpolate({ inputRange: [0, 1], outputRange: [16, 12] }), 
    color: animatedIsFocused.interpolate({ inputRange: [0, 1], outputRange: ['#94A3B8', '#003366'] }), 
    backgroundColor: '#fff', paddingHorizontal: 6, fontWeight: '600', zIndex: 1
  };
  return (
    <View style={styles.floatContainer}>
      <Animated.Text style={labelStyle}>{label}</Animated.Text>
      <TextInput style={[styles.inputBox, isFocused && styles.activeBorder]} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} {...props} value={value} />
    </View>
  );
};

export default function ApplyWizard({ route, navigation }) {
  const { jobId } = route.params;
  const userId = auth.currentUser?.uid; // User ID fetch
  const [step, setStep] = useState(1);
  const [formConfig, setFormConfig] = useState(null);
  const [responses, setResponses] = useState({});
  const [selectedPrefs, setSelectedPrefs] = useState({}); 
  const [uploadedDocs, setUploadedDocs] = useState({}); 
  const [uploading, setUploading] = useState(null);
  const [officialFee, setOfficialFee] = useState(0);

  const [selCat, setSelCat] = useState(null);
  const [selPost, setSelPost] = useState(null);
  const [selGen, setSelGen] = useState(null);
  const [userProfile, setUserProfile] = useState({});
  const [draftRestored, setDraftRestored] = useState(false);
  const [eligibilityResults, setEligibilityResults] = useState({});

  // --- ✨ 1. Fetch Job Config + Profile Docs + Auto Eligibility ---
  useEffect(() => {
    (async () => {
      try {
        const formSnap = await getDoc(doc(db, "job_wizard_configs", jobId));
        const jobSnap  = await getDoc(doc(db, "gov_jobs", jobId));

        // Fetch user profile
        let profileDocs = {};
        let profile = {};
        if (userId) {
          const userSnap = await getDoc(doc(db, "users", userId));
          if (userSnap.exists()) {
            const ud = userSnap.data();
            profileDocs = ud.profileDocuments || {};
            profile     = ud;
            setUserProfile(ud);
          }
        }

        if (formSnap.exists()) {
          const formData = formSnap.data();
          const jobData  = jobSnap.exists() ? jobSnap.data() : {};
          const config   = { ...formData, title: jobData.title || "Job Application" };
          setFormConfig(config);

          // --- ✨ AUTO-FILL DOCUMENTS from profile ---
          const preFilled = {};
          if (formData.documents) {
            formData.documents.forEach(docReq => {
              if (profileDocs[docReq.name]) {
                preFilled[docReq.name] = profileDocs[docReq.name];
              }
            });
          }
          setUploadedDocs(preFilled);

          // --- ✨ AUTO-FILL FORM FIELDS from profile ---
          if (formData.formFields && Object.keys(profile).length > 0) {
            const autoResponses = {};
            const profileMap = {
              // Common field name → user profile key mapping
              'name':          profile.name,
              'full name':     profile.name,
              'mobile':        profile.phone,
              'phone':         profile.phone,
              'mobile number': profile.phone,
              'email':         profile.email,
              'email id':      profile.email,
              'state':         profile.state,
              'city':          profile.city,
              'pincode':       profile.pincode,
              'pin code':      profile.pincode,
              'father name':   profile.fatherName,
              "father's name": profile.fatherName,
              'dob':           profile.dob,
              'date of birth': profile.dob,
              'aadhar':        profile.aadharNumber,
              'aadhar number': profile.aadharNumber,
              'gender':        profile.gender,
            };
            formData.formFields.forEach(field => {
              const key = field.title?.toLowerCase().trim();
              if (profileMap[key] && profileMap[key] !== undefined) {
                autoResponses[field.id] = profileMap[key];
              }
            });
            if (Object.keys(autoResponses).length > 0) {
              setResponses(autoResponses);
            }
          }

          // --- ✨ AUTO ELIGIBILITY CHECK ---
          if (formData.eligibilityCriteria && Object.keys(profile).length > 0) {
            const results = {};
            formData.eligibilityCriteria.forEach(criteria => {
              const key   = criteria.key?.toLowerCase();
              const value = criteria.value;
              let matched = false;

              if (key === 'age' || key === 'min age' || key === 'age limit') {
                // Calculate age from DOB
                if (profile.dob) {
                  const dob  = new Date(profile.dob);
                  const age  = Math.floor((new Date() - dob) / (365.25 * 24 * 60 * 60 * 1000));
                  const min  = criteria.minAge || 0;
                  const max  = criteria.maxAge || 99;
                  matched    = age >= min && age <= max;
                }
              } else if (key === 'qualification' || key === 'education') {
                const order = ['10th', '12th', 'diploma', 'graduate', 'ug', 'pg', 'postgraduate'];
                const userIdx  = order.indexOf(profile.qualification?.toLowerCase());
                const reqIdx   = order.indexOf(value?.toLowerCase());
                matched        = userIdx >= reqIdx;
              } else if (key === 'category') {
                matched = profile.category?.toLowerCase() === value?.toLowerCase();
              } else if (key === 'state') {
                matched = profile.state?.toLowerCase() === value?.toLowerCase();
              } else if (key === 'gender') {
                matched = !value || value === 'All' || profile.gender?.toLowerCase() === value?.toLowerCase();
              } else {
                // Generic string match
                const profileVal = profile[criteria.key];
                matched = profileVal !== undefined && 
                  profileVal.toString().toLowerCase() === value?.toString().toLowerCase();
              }
              results[criteria.id || criteria.key] = matched;
            });
            setEligibilityResults(results);
          }
        }
      } catch (e) { console.log('ApplyWizard load error:', e.message); }
    })();
  }, [jobId, userId]);

  // --- Auto-save draft on every change ---
  useEffect(() => {
    if (!jobId || !formConfig) return;
    const draftData = { responses, selectedPrefs, uploadedDocs, selCat, selPost, selGen, step };
    saveDraft(jobId, draftData, step).catch(() => {});
  }, [responses, selectedPrefs, selCat, selPost, selGen, step]);

  useEffect(() => {
    if(selCat && selPost && selGen && formConfig?.feeMapping) {
      const match = formConfig.feeMapping.find(f => f.category === selCat && f.post === selPost && (f.gender === selGen || f.gender === 'All'));
      setOfficialFee(match ? match.amount : 0);
    }
  }, [selCat, selPost, selGen, formConfig]);

  // --- ✨ 2. REAL UPLOAD + PROFILE SYNC ---
  const handleRealUpload = async (docName) => {
    if (uploading) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (!result.canceled) {
        setUploading(docName);
        let fileToUpload = result.assets[0];

        // Compression logic
        if (fileToUpload.mimeType?.startsWith('image/')) {
          const manipResult = await ImageManipulator.manipulateAsync(fileToUpload.uri, [{ resize: { width: 1200 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
          fileToUpload = { uri: manipResult.uri, type: 'image/jpeg', name: fileToUpload.name || `img_${Date.now()}.jpg` };
        }

        const data = new FormData();
        data.append('file', { uri: fileToUpload.uri, type: fileToUpload.type || 'application/octet-stream', name: fileToUpload.name });
        data.append('upload_preset', UPLOAD_PRESET);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: 'POST', body: data });
        const cloudData = await response.json();

        if (cloudData.secure_url) {
          const secureUrl = cloudData.secure_url;
          
          // Current Application state update
          setUploadedDocs(prev => ({ ...prev, [docName]: secureUrl }));

          // --- ✨ PROFILE SYNC: Save to user permanent record ---
          if (userId) {
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, {
              [`profileDocuments.${docName}`]: secureUrl 
            }).catch(async () => {
              // Agar field na ho toh setDoc merge use karein
              await setDoc(userRef, { profileDocuments: { [docName]: secureUrl } }, { merge: true });
            });
          }
          Alert.alert("Success", "Document saved to your profile!");
        } else { throw new Error("Upload Failed"); }
      }
    } catch (error) { Alert.alert("Error", "Upload fail ho gaya."); }
    finally { setUploading(null); }
  };

  const isStep2Valid = () => {
    if(!formConfig) return false;
    if (!selCat || !selPost || !selGen) return false;
    return (formConfig.formFields || []).every(f => {
      if (!f.required) return true;
      if (f.type === 'preference') return (selectedPrefs[f.id]?.length || 0) > 0;
      return responses[f.id] && responses[f.id].toString().trim() !== "";
    });
  };

  const isStep3Valid = () => {
    if (!formConfig?.documents) return true;
    return formConfig.documents.every(d => uploadedDocs[d.name]);
  };
const handleReviewNavigation = () => {
  // 1. Current Fee nikalein (State delay se bachne ke liye)
  const currentOfficial = officialFee || 0;
  const currentService = formConfig.serviceFee || 0;
  const total = currentOfficial + currentService;

  // Debug Alert: Agar zero ja rahi ho toh yahan pata chal jayega
  if (total === 0) {
    return Alert.alert("Fee Error", "Bhai, fee 0 dikha raha hai. Category aur Post sahi se select karein.");
  }

  const feeData = {
    official: currentOfficial,
    service: currentService,
    total: total
  };

  // 2. Mapping Logic
  const cleanData = {};
  formConfig.formFields.forEach(field => {
    if (responses[field.id]) cleanData[field.title] = responses[field.id];
    // ... baki dropdown/pref logic
  });

  navigation.navigate('ApplicationReview', {
    formData: { Category: selCat, Post: selPost, Gender: selGen, ...cleanData },
    feeDetails: feeData, // ✨ Object sahi se pass ho raha hai
    jobId: jobId,
    jobTitle: formConfig.title || "Job Application",
    documents: uploadedDocs,
  });
};

  

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progressHeader}><View style={[styles.activeProgress, {width: `${(step/3)*100}%`}]} /></View>
      <ScrollView contentContainerStyle={{padding: 20, paddingBottom: 40}} showsVerticalScrollIndicator={false}>
        {/* Draft restore banner */}
        {!draftRestored && (
          <DraftBanner
            jobId={jobId}
            onRestore={(draft) => {
              const d = draft.formData;
              if (d.responses)      setResponses(d.responses);
              if (d.selectedPrefs)  setSelectedPrefs(d.selectedPrefs);
              if (d.uploadedDocs)   setUploadedDocs(prev => ({ ...prev, ...d.uploadedDocs }));
              if (d.selCat)         setSelCat(d.selCat);
              if (d.selPost)        setSelPost(d.selPost);
              if (d.selGen)         setSelGen(d.selGen);
              if (d.step)           setStep(d.step);
              setDraftRestored(true);
            }}
            onDiscard={() => {
              clearDraft(jobId).catch(() => {});
              setDraftRestored(true);
            }}
          />
        )}

        {step === 1 && (
          <>
            {/* Eligibility auto-check */}
            {formConfig?.eligibilityCriteria?.length > 0 && (
              <View style={styles.instrCard}>
                <Text style={styles.instrHeading}>✅ Eligibility Check</Text>
                <View style={styles.accentLine} />
                {Object.keys(eligibilityResults).length > 0 ? (
                  <>
                    {formConfig.eligibilityCriteria.map((c, i) => {
                      const id      = c.id || c.key;
                      const matched = eligibilityResults[id];
                      return (
                        <View key={i} style={{ flexDirection:'row', alignItems:'center', marginVertical:4, gap:10 }}>
                          <MaterialCommunityIcons
                            name={matched ? 'check-circle' : 'close-circle'}
                            size={18}
                            color={matched ? '#10B981' : '#EF4444'}
                          />
                          <View style={{ flex:1 }}>
                            <Text style={{ fontSize:13, fontWeight:'700', color:'#1E293B' }}>
                              {c.label || c.key}
                            </Text>
                            {c.minAge && c.maxAge && (
                              <Text style={{ fontSize:11, color:'#64748B', fontWeight:'600' }}>
                                Required: {c.minAge}-{c.maxAge} years
                                {userProfile.dob ? ` | Your age: ${Math.floor((new Date() - new Date(userProfile.dob)) / (365.25*24*60*60*1000))} years` : ''}
                              </Text>
                            )}
                            {c.value && !c.minAge && (
                              <Text style={{ fontSize:11, color:'#64748B', fontWeight:'600' }}>
                                Required: {c.value}
                              </Text>
                            )}
                          </View>
                          <Text style={{ fontSize:11, fontWeight:'800', color: matched ? '#10B981' : '#EF4444' }}>
                            {matched ? 'ELIGIBLE' : 'CHECK'}
                          </Text>
                        </View>
                      );
                    })}
                    {Object.values(eligibilityResults).every(v => v) ? (
                      <View style={{ backgroundColor:'#DCFCE7', padding:10, borderRadius:10, marginTop:8 }}>
                        <Text style={{ color:'#166534', fontWeight:'800', fontSize:13, textAlign:'center' }}>
                          🎉 You appear eligible for this position!
                        </Text>
                      </View>
                    ) : (
                      <View style={{ backgroundColor:'#FEF3C7', padding:10, borderRadius:10, marginTop:8 }}>
                        <Text style={{ color:'#92400E', fontWeight:'700', fontSize:12, textAlign:'center' }}>
                          ⚠️ Please verify eligibility criteria before applying
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={{ color:'#64748B', fontSize:12, fontWeight:'600' }}>
                    Complete your profile (DOB, qualification) for automatic eligibility check
                  </Text>
                )}
              </View>
            )}

            {(formConfig?.instructions || []).map((ins, i) => (
              <View key={i} style={styles.instrCard}>
                <Text style={styles.instrHeading}>{ins.heading}</Text>
                <View style={styles.accentLine} />
                <Text style={styles.instrText}>{ins.desc}</Text>
              </View>
            ))}
          </>
        )}

        {step === 2 && (
          <View>
            <View style={styles.feeCard}>
               <Text style={styles.feeTag}>PAYMENT SUMMARY</Text>
               <View style={styles.feeRow}><Text style={styles.whiteText}>Official Job Fee:</Text><Text style={styles.whiteText}>₹{officialFee}</Text></View>
               <View style={styles.feeRow}><Text style={styles.whiteText}>SewaOne Service Fee:</Text><Text style={styles.whiteText}>+ ₹{formConfig.serviceFee}</Text></View>
               <View style={styles.totalDivider}><Text style={styles.totalLabel}>Total Payable Amount:</Text><Text style={styles.totalVal}>₹{officialFee + (formConfig.serviceFee || 0)}</Text></View>
            </View>
            <DropdownSelector label="Select Category *" placeholder="Choose Category" options={[...new Set((formConfig.feeMapping || []).map(f => f.category))]} selectedValue={selCat} onSelect={setSelCat} />
            <DropdownSelector label="Select Post *" placeholder="Choose Post" options={[...new Set((formConfig.feeMapping || []).map(f => f.post))]} selectedValue={selPost} onSelect={setSelPost} />
            <DropdownSelector label="Select Gender *" placeholder="Choose Gender" options={['Male', 'Female']} selectedValue={selGen} onSelect={setSelGen} />
            <View style={styles.formSeparator} />
            {(formConfig.formFields || []).map(f => (
              <View key={f.id} style={{marginBottom: 24}}>
                {f.type === 'dropdown' ? (
                  <View>
                    <DropdownSelector label={`${f.title} ${f.required ? '*' : ''}`} placeholder="Choose Option" options={(f.options || []).map(o => o.label)} selectedValue={responses[f.id]} onSelect={(val) => setResponses({...responses, [f.id]: val})} />
                    {f.options.find(o => o.label === responses[f.id])?.subFields?.map(sf => (<FloatingInput key={sf.id} label={sf.title} value={responses[sf.id]} onChangeText={t => setResponses({...responses, [sf.id]: t})} />))}
                  </View>
                ) : f.type === 'preference' ? (
                  <View>
                    <Text style={styles.prefLabel}>{f.title} *</Text>
                    <View style={styles.pillGrid}>
                      {(f.listItems || []).filter(it => !selectedPrefs[f.id]?.includes(it)).map(it => (
                        <TouchableOpacity key={it} style={styles.prefPill} onPress={() => { let c = selectedPrefs[f.id] || []; setSelectedPrefs({...selectedPrefs, [f.id]: [...c, it]}); }}><Text style={styles.pillText}>+ {it}</Text></TouchableOpacity>
                      ))}
                    </View>
                    {selectedPrefs[f.id]?.map((it, idx) => (
                      <View key={idx} style={styles.selectedRow}>
                        <View style={styles.prefInfo}><View style={styles.numBadge}><Text style={styles.numText}>{idx+1}</Text></View><Text style={styles.prefText}>{it}</Text></View>
                        <TouchableOpacity onPress={() => { let c = selectedPrefs[f.id].filter(x => x !== it); setSelectedPrefs({...selectedPrefs, [f.id]: c}); }}><MaterialCommunityIcons name="close-circle" size={22} color="#EF4444" /></TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View>
                    <FloatingInput
                      label={`${f.title} ${f.required ? '*' : ''}`}
                      value={responses[f.id]?.toString() || ''}
                      onChangeText={t => setResponses({...responses, [f.id]: t})}
                    />
                    {responses[f.id] && (() => {
                      const key = f.title?.toLowerCase().trim();
                      const profileMap = { 'name':'name','full name':'name','mobile':'phone','phone':'phone','email':'email','state':'state','city':'city','pincode':'pincode','gender':'gender' };
                      const profileKey = profileMap[key];
                      if (profileKey && userProfile[profileKey] && userProfile[profileKey].toString() === responses[f.id]?.toString()) {
                        return <Text style={{ fontSize:10, color:'#10B981', fontWeight:'800', marginTop:-8, marginBottom:4, marginLeft:4 }}>✓ Auto-filled from profile</Text>;
                      }
                      return null;
                    })()}
                  </View>
                )}
              </View>
            ))}
            <View style={styles.swipeVerifyRow}><MaterialCommunityIcons name="shield-check" size={18} color="#10B981" /><Text style={styles.verifyText}>Verified by SewaOne Secure Systems</Text></View>
          </View>
        )}

         {/* --- ✨ 3. UPDATED STEP 3 UI --- */}
         {step === 3 && (formConfig.documents || []).map((d, i) => {
           // Pehle se upload hai ya nahi check karein
           const isFromProfile = uploadedDocs[d.name] && !uploading; 

           return (
             <View key={i} style={styles.selectedRow}>
               <View style={styles.prefInfo}>
                  <MaterialCommunityIcons 
                    name={uploadedDocs[d.name] ? "check-decagram" : "file-upload-outline"} 
                    size={24} 
                    color={uploadedDocs[d.name] ? "#10B981" : "#64748B"} 
                  />
                  <View style={{marginLeft: 12}}>
                    <Text style={styles.prefText}>{d.name}</Text>
                    {/* Status Text for auto-matched docs */}
                    {isFromProfile && (
                      <Text style={{fontSize: 10, color: '#10B981', fontWeight: '800'}}>MATCHED FROM PROFILE</Text>
                    )}
                  </View>
               </View>
               <TouchableOpacity 
                 style={[styles.upBtn, uploadedDocs[d.name] && styles.changeBtn]} 
                 onPress={() => handleRealUpload(d.name)}
                 disabled={uploading === d.name}
               >
                 {uploading === d.name ? <ActivityIndicator size="small" color="#fff" /> : (
                   <Text style={{color:'#fff', fontWeight:'800', fontSize: 11}}>
                     {uploadedDocs[d.name] ? "CHANGE" : "UPLOAD"}
                   </Text>
                 )}
               </TouchableOpacity>
             </View>
           );
         })}
      </ScrollView>

      <View style={styles.actionFooter}>
        <View style={styles.footerRow}>
          {step > 1 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)}>
              <MaterialCommunityIcons name="chevron-left" size={24} color="#64748B" />
              <Text style={styles.backBtnText}>BACK</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
             style={[styles.nextBtn, ((step === 2 && !isStep2Valid()) || (step === 3 && !isStep3Valid())) && {backgroundColor: '#CBD5E1'}, { flex: 1 }]}
             onPress={() => { if (step === 3) handleReviewNavigation(); else setStep(step + 1); }}
             disabled={(step === 2 && !isStep2Valid()) || (step === 3 && !isStep3Valid())}
          >
            <Text style={styles.nextBtnText}>{step === 3 ? "Review & Pay" : "CONTINUE"}</Text>
            <MaterialCommunityIcons name={step === 3 ? "chevron-right" : "arrow-right"} size={20} color="#fff" style={{marginLeft: 10}} />
            
          </TouchableOpacity>
        </View>
        
      </View>
      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  progressHeader: { height: 4, backgroundColor: '#E2E8F0' },
  activeProgress: { height: 4, backgroundColor: '#003366' },
  feeCard: { backgroundColor: '#003366', padding: 22, borderRadius: 24, marginBottom: 25, elevation: 8, shadowColor: '#003366', shadowOpacity: 0.3 },
  feeTag: { color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totalDivider: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', marginTop: 10, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: '#fff', fontWeight: '700', fontSize: 15 },
  totalVal: { color: '#10B981', fontSize: 28, fontWeight: '800' },
  whiteText: { color: '#F8FAFC', fontSize: 15 },
  floatContainer: { paddingTop: 12, marginBottom: 4 },
  inputBox: { borderWidth: 1.5, borderColor: '#E2E8F0', padding: 15, borderRadius: 14, fontSize: 16, color: '#0F172A', backgroundColor: '#fff' },
  activeBorder: { borderColor: '#003366' },
  selectorContainer: { marginBottom: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 8, marginLeft: 4 },
  dropdownTrigger: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 25, maxHeight: '65%' },
  modalIndicator: { width: 45, height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { fontSize: 18, fontWeight: '800', marginBottom: 15, color: '#0F172A' },
  optionItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 18, borderRadius: 14, marginBottom: 8 },
  selectedOptionBg: { backgroundColor: '#F1F5F9' },
  optionText: { fontSize: 16, color: '#475569', fontWeight: '500' },
  selectedOptionText: { color: '#003366', fontWeight: '700' },
  prefLabel: { fontWeight: '700', color: '#334155', marginBottom: 12, fontSize: 15 },
  pillGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 15 },
  prefPill: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#fff', borderRadius: 25, borderWidth: 1.2, borderColor: '#003366' },
  pillText: { color: '#003366', fontWeight: '700', fontSize: 13 },
  selectedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 14, marginTop: 10, borderWidth: 1, borderColor: '#F1F5F9', elevation: 2 },
  prefInfo: { flexDirection: 'row', alignItems: 'center' },
  numBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#003366', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  numText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  prefText: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  actionFooter: { backgroundColor: '#fff', padding: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  backBtn: { paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', height: 50 },
  backBtnText: { color: '#64748B', fontWeight: '800', fontSize: 14, marginLeft: 2 },
  nextBtn: { backgroundColor: '#003366', height: 60, borderRadius: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  nextBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  instrCard: { backgroundColor: '#fff', padding: 22, borderRadius: 18, marginBottom: 15, elevation: 2 },
  instrHeading: { fontSize: 18, fontWeight: '800', color: '#003366', marginBottom: 5 },
  accentLine: { width: 35, height: 4, backgroundColor: '#10B981', borderRadius: 2, marginBottom: 12 },
  instrText: { color: '#475569', fontSize: 14, lineHeight: 22 },
  formSeparator: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 25 },
  swipeVerifyRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 40, marginBottom: 20 },
  verifyText: { fontSize: 12, color: '#64748B', marginLeft: 8, fontWeight: '700' },
  upBtn: { backgroundColor: '#003366', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  changeBtn: { backgroundColor: '#10B981' }
});
