// ============================================================
// FILE: src/screens/Main/ApplyWizard.js
// ✅ Draft Save/Restore integrated
// ✅ Auto-fill from profile
// ✅ Document upload with profile sync
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Animated, ActivityIndicator, Alert,
  SafeAreaView, Modal, FlatList
} from 'react-native';
import { db, auth } from '../../api/firebaseConfig';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import DraftBanner from '../../components/DraftBanner';
import { saveDraft, clearDraft } from '../../utils/draftManager';

const CLOUD_NAME    = 'dxuurwexl';
const UPLOAD_PRESET = 'edusphere_uploads';

// ── Dropdown Component ────────────────────────────────────────
const DropdownSelector = ({ label, options, selectedValue, onSelect, placeholder }) => {
  const [visible, setVisible] = useState(false);
  return (
    <View style={st.selectorWrap}>
      <Text style={st.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={[st.dropTrigger, selectedValue && st.dropActive]}
        onPress={() => setVisible(true)}
      >
        <Text style={{ color: selectedValue ? '#0F172A' : '#64748B', fontSize: 15, fontWeight: '500' }}>
          {selectedValue || placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color={selectedValue ? '#003366' : '#94A3B8'} />
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="slide">
        <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={st.dropSheet}>
            <View style={st.sheetHandle} />
            <Text style={st.dropHeader}>Select {label.replace('*', '')}</Text>
            <FlatList
              data={options}
              keyExtractor={item => item.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[st.optionRow, selectedValue === item && st.optionActive]}
                  onPress={() => { onSelect(item); setVisible(false); }}
                >
                  <Text style={[st.optionText, selectedValue === item && st.optionActiveText]}>{item}</Text>
                  {selectedValue === item && (
                    <MaterialCommunityIcons name="check-circle" size={20} color="#003366" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ── Floating Label Input ──────────────────────────────────────
const FloatingInput = ({ label, value, ...props }) => {
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: (focused || value) ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [focused, value]);
  const labelStyle = {
    position: 'absolute', left: 14,
    top:      anim.interpolate({ inputRange: [0, 1], outputRange: [16, -10] }),
    fontSize: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 12] }),
    color:    anim.interpolate({ inputRange: [0, 1], outputRange: ['#94A3B8', '#003366'] }),
    backgroundColor: '#fff', paddingHorizontal: 6, fontWeight: '600', zIndex: 1,
  };
  return (
    <View style={st.floatWrap}>
      <Animated.Text style={labelStyle}>{label}</Animated.Text>
      <TextInput
        style={[st.floatInput, focused && st.dropActive]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        value={value}
        {...props}
      />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
export default function ApplyWizard({ route, navigation }) {
  const { jobId } = route.params;
  const userId = auth.currentUser?.uid;

  const [step, setStep]               = useState(1);
  const [formConfig, setFormConfig]   = useState(null);
  const [responses, setResponses]     = useState({});
  const [selectedPrefs, setSelectedPrefs] = useState({});
  const [uploadedDocs, setUploadedDocs]   = useState({});
  const [uploading, setUploading]     = useState(null);
  const [officialFee, setOfficialFee] = useState(0);
  const [selCat, setSelCat]           = useState(null);
  const [selPost, setSelPost]         = useState(null);
  const [selGen, setSelGen]           = useState(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // ── Load form config + profile docs ──────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [formSnap, jobSnap] = await Promise.all([
          getDoc(doc(db, 'job_wizard_configs', jobId)),
          getDoc(doc(db, 'gov_jobs', jobId)),
        ]);

        let profileDocs = {};
        if (userId) {
          const userSnap = await getDoc(doc(db, 'users', userId));
          if (userSnap.exists()) profileDocs = userSnap.data().profileDocuments || {};
        }

        if (formSnap.exists()) {
          const formData = formSnap.data();
          const jobData  = jobSnap.exists() ? jobSnap.data() : {};
          setFormConfig({ ...formData, title: jobData.title || 'Job Application' });

          // Auto-fill matched docs from profile
          const preFilled = {};
          if (formData.documents) {
            formData.documents.forEach(d => {
              if (profileDocs[d.name]) preFilled[d.name] = profileDocs[d.name];
            });
          }
          setUploadedDocs(preFilled);
        }
      } catch {}
    })();
  }, [jobId, userId]);

  // ── Fee calculation ───────────────────────────────────────
  useEffect(() => {
    if (selCat && selPost && selGen && formConfig?.feeMapping) {
      const match = formConfig.feeMapping.find(f =>
        f.category === selCat && f.post === selPost &&
        (f.gender === selGen || f.gender === 'All')
      );
      setOfficialFee(match?.amount || 0);
    }
  }, [selCat, selPost, selGen, formConfig]);

  // ── Auto-save draft on changes ────────────────────────────
  useEffect(() => {
    if (!formConfig || !draftRestored) return;
    const draft = { responses, selectedPrefs, selCat, selPost, selGen, uploadedDocs };
    saveDraft(jobId, draft, step - 1);
  }, [responses, selectedPrefs, selCat, selPost, selGen, step]);

  // ── Restore draft ─────────────────────────────────────────
  const handleRestoreDraft = (draft) => {
    const d = draft.formData;
    if (d.responses)     setResponses(d.responses);
    if (d.selectedPrefs) setSelectedPrefs(d.selectedPrefs);
    if (d.selCat)        setSelCat(d.selCat);
    if (d.selPost)       setSelPost(d.selPost);
    if (d.selGen)        setSelGen(d.selGen);
    if (d.uploadedDocs)  setUploadedDocs(d.uploadedDocs);
    setStep((draft.step || 0) + 1);
    setDraftRestored(true);
    Alert.alert('✅ Draft Restored!', 'Aapka pehle ka data wapas aa gaya.');
  };

  const handleDiscardDraft = () => setDraftRestored(true);

  // ── Upload document ───────────────────────────────────────
  const handleUpload = async (docName) => {
    if (uploading) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      setUploading(docName);

      let file = result.assets[0];
      if (file.mimeType?.startsWith('image/')) {
        const manip = await ImageManipulator.manipulateAsync(
          file.uri, [{ resize: { width: 1200 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        file = { uri: manip.uri, type: 'image/jpeg', name: file.name || `img_${Date.now()}.jpg` };
      }

      const data = new FormData();
      data.append('file', { uri: file.uri, type: file.type || 'application/octet-stream', name: file.name });
      data.append('upload_preset', UPLOAD_PRESET);

      const res       = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: 'POST', body: data });
      const cloudData = await res.json();

      if (cloudData.secure_url) {
        setUploadedDocs(prev => ({ ...prev, [docName]: cloudData.secure_url }));
        // Sync to profile
        if (userId) {
          const userRef = doc(db, 'users', userId);
          await updateDoc(userRef, { [`profileDocuments.${docName}`]: cloudData.secure_url })
            .catch(async () => {
              await setDoc(userRef, { profileDocuments: { [docName]: cloudData.secure_url } }, { merge: true });
            });
        }
        Alert.alert('✅ Uploaded!', 'Document profile mein bhi save ho gaya.');
      } else {
        throw new Error('Upload failed');
      }
    } catch { Alert.alert('Error', 'Upload fail ho gaya. Try again.'); }
    finally { setUploading(null); }
  };

  // ── Validation ────────────────────────────────────────────
  const isStep2Valid = () => {
    if (!formConfig || !selCat || !selPost || !selGen) return false;
    return (formConfig.formFields || []).every(f => {
      if (!f.required) return true;
      if (f.type === 'preference') return (selectedPrefs[f.id]?.length || 0) > 0;
      return responses[f.id]?.toString().trim() !== '';
    });
  };

  const isStep3Valid = () => {
    if (!formConfig?.documents) return true;
    return formConfig.documents.every(d => uploadedDocs[d.name]);
  };

  // ── Navigate to review ────────────────────────────────────
  const handleReview = () => {
    const currentOfficial = officialFee || 0;
    const currentService  = formConfig?.serviceFee || 0;
    const total           = currentOfficial + currentService;

    if (total === 0) {
      return Alert.alert('Fee Error', 'Category aur Post sahi se select karein.');
    }

    const cleanData = {};
    (formConfig?.formFields || []).forEach(field => {
      if (responses[field.id]) cleanData[field.title] = responses[field.id];
    });

    navigation.navigate('ApplicationReview', {
      formData: { Category: selCat, Post: selPost, Gender: selGen, ...cleanData },
      feeDetails: { official: currentOfficial, service: currentService, total },
      jobId,
      jobTitle: formConfig?.title || 'Job Application',
      documents: uploadedDocs,
    });
  };

  const handleNext = () => {
    if (!draftRestored) setDraftRestored(true); // Start auto-save
    if (step === 3) handleReview();
    else setStep(s => s + 1);
  };

  const progress = ((step / 3) * 100).toFixed(0);

  if (!formConfig) {
    return (
      <SafeAreaView style={st.container}>
        <ActivityIndicator style={{ flex: 1 }} color="#003366" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.container}>

      {/* Progress bar */}
      <View style={st.progressBg}>
        <View style={[st.progressFill, { width: `${progress}%` }]} />
      </View>

      {/* Step indicator */}
      <View style={st.stepRow}>
        {['Instructions', 'Fill Form', 'Documents'].map((label, i) => (
          <View key={i} style={st.stepItem}>
            <View style={[st.stepDot, {
              backgroundColor: step > i + 1 ? '#10B981' : step === i + 1 ? '#003366' : '#E2E8F0',
            }]}>
              {step > i + 1
                ? <MaterialCommunityIcons name="check" size={12} color="#fff" />
                : <Text style={[st.stepNum, { color: step === i + 1 ? '#fff' : '#94A3B8' }]}>{i + 1}</Text>
              }
            </View>
            <Text style={[st.stepLabel, { color: step === i + 1 ? '#003366' : '#94A3B8' }]}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      {/* Draft Banner */}
      <DraftBanner
        jobId={jobId}
        onRestore={handleRestoreDraft}
        onDiscard={handleDiscardDraft}
      />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── STEP 1: Instructions ── */}
        {step === 1 && (formConfig.instructions || []).map((ins, i) => (
          <View key={i} style={st.instrCard}>
            <Text style={st.instrTitle}>{ins.heading}</Text>
            <View style={st.instrAccent} />
            <Text style={st.instrText}>{ins.desc}</Text>
          </View>
        ))}

        {/* ── STEP 2: Form ── */}
        {step === 2 && (
          <View>
            {/* Fee card */}
            <View style={st.feeCard}>
              <Text style={st.feeTag}>PAYMENT SUMMARY</Text>
              <View style={st.feeRow}>
                <Text style={st.feeText}>Official Job Fee:</Text>
                <Text style={st.feeText}>₹{officialFee}</Text>
              </View>
              <View style={st.feeRow}>
                <Text style={st.feeText}>SewaOne Service Fee:</Text>
                <Text style={st.feeText}>+ ₹{formConfig.serviceFee || 0}</Text>
              </View>
              <View style={st.feeDivider}>
                <Text style={st.feeTotalLabel}>Total Payable:</Text>
                <Text style={st.feeTotalVal}>₹{officialFee + (formConfig.serviceFee || 0)}</Text>
              </View>
            </View>

            <DropdownSelector
              label="Select Category *"
              placeholder="Choose Category"
              options={[...new Set((formConfig.feeMapping || []).map(f => f.category))]}
              selectedValue={selCat}
              onSelect={setSelCat}
            />
            <DropdownSelector
              label="Select Post *"
              placeholder="Choose Post"
              options={[...new Set((formConfig.feeMapping || []).map(f => f.post))]}
              selectedValue={selPost}
              onSelect={setSelPost}
            />
            <DropdownSelector
              label="Select Gender *"
              placeholder="Choose Gender"
              options={['Male', 'Female']}
              selectedValue={selGen}
              onSelect={setSelGen}
            />

            <View style={st.separator} />

            {(formConfig.formFields || []).map(f => (
              <View key={f.id} style={{ marginBottom: 24 }}>
                {f.type === 'dropdown' ? (
                  <View>
                    <DropdownSelector
                      label={`${f.title} ${f.required ? '*' : ''}`}
                      placeholder="Choose Option"
                      options={(f.options || []).map(o => o.label)}
                      selectedValue={responses[f.id]}
                      onSelect={val => setResponses({ ...responses, [f.id]: val })}
                    />
                    {f.options.find(o => o.label === responses[f.id])?.subFields?.map(sf => (
                      <FloatingInput
                        key={sf.id}
                        label={sf.title}
                        value={responses[sf.id] || ''}
                        onChangeText={t => setResponses({ ...responses, [sf.id]: t })}
                      />
                    ))}
                  </View>
                ) : f.type === 'preference' ? (
                  <View>
                    <Text style={st.prefLabel}>{f.title} *</Text>
                    <View style={st.pillGrid}>
                      {(f.listItems || []).filter(it => !selectedPrefs[f.id]?.includes(it)).map(it => (
                        <TouchableOpacity
                          key={it}
                          style={st.pill}
                          onPress={() => {
                            const c = selectedPrefs[f.id] || [];
                            setSelectedPrefs({ ...selectedPrefs, [f.id]: [...c, it] });
                          }}
                        >
                          <Text style={st.pillText}>+ {it}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {(selectedPrefs[f.id] || []).map((it, idx) => (
                      <View key={idx} style={st.selectedRow}>
                        <View style={st.selectedLeft}>
                          <View style={st.numBadge}>
                            <Text style={st.numText}>{idx + 1}</Text>
                          </View>
                          <Text style={st.selectedText}>{it}</Text>
                        </View>
                        <TouchableOpacity onPress={() => {
                          const c = selectedPrefs[f.id].filter(x => x !== it);
                          setSelectedPrefs({ ...selectedPrefs, [f.id]: c });
                        }}>
                          <MaterialCommunityIcons name="close-circle" size={22} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <FloatingInput
                    label={`${f.title} ${f.required ? '*' : ''}`}
                    value={responses[f.id]?.toString() || ''}
                    onChangeText={t => setResponses({ ...responses, [f.id]: t })}
                  />
                )}
              </View>
            ))}

            <View style={st.verifyRow}>
              <MaterialCommunityIcons name="shield-check" size={18} color="#10B981" />
              <Text style={st.verifyText}>Verified by SewaOne Secure Systems</Text>
            </View>
          </View>
        )}

        {/* ── STEP 3: Documents ── */}
        {step === 3 && (
          <View>
            <View style={st.docHeader}>
              <MaterialCommunityIcons name="file-upload" size={22} color="#003366" />
              <Text style={st.docHeaderText}>Upload Required Documents</Text>
            </View>

            {(formConfig.documents || []).map((d, i) => {
              const isUploaded    = !!uploadedDocs[d.name];
              const isFromProfile = isUploaded && !uploading;
              return (
                <View key={i} style={[st.docCard, isUploaded && st.docCardDone]}>
                  <View style={[st.docIcon, { backgroundColor: isUploaded ? '#ECFDF5' : '#F1F5F9' }]}>
                    <MaterialCommunityIcons
                      name={isUploaded ? 'check-decagram' : 'file-upload-outline'}
                      size={24}
                      color={isUploaded ? '#10B981' : '#64748B'}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={st.docName}>{d.name}</Text>
                    {isFromProfile && (
                      <Text style={st.docProfileTag}>✅ Matched from profile</Text>
                    )}
                    {d.hint && (
                      <Text style={st.docHint}>{d.hint}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[st.uploadBtn, isUploaded && st.uploadBtnDone]}
                    onPress={() => handleUpload(d.name)}
                    disabled={uploading === d.name}
                  >
                    {uploading === d.name
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={st.uploadBtnText}>{isUploaded ? 'CHANGE' : 'UPLOAD'}</Text>
                    }
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={st.footer}>
        <View style={st.footerRow}>
          {step > 1 && (
            <TouchableOpacity style={st.backBtn} onPress={() => setStep(s => s - 1)}>
              <MaterialCommunityIcons name="chevron-left" size={24} color="#64748B" />
              <Text style={st.backBtnText}>BACK</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[st.nextBtn, {
              flex: 1,
              backgroundColor:
                (step === 2 && !isStep2Valid()) || (step === 3 && !isStep3Valid())
                  ? '#CBD5E1' : '#003366',
            }]}
            onPress={handleNext}
            disabled={(step === 2 && !isStep2Valid()) || (step === 3 && !isStep3Valid())}
          >
            <Text style={st.nextBtnText}>
              {step === 3 ? 'Review & Pay' : 'CONTINUE'}
            </Text>
            <MaterialCommunityIcons
              name={step === 3 ? 'credit-card-check' : 'arrow-right'}
              size={20}
              color="#fff"
              style={{ marginLeft: 10 }}
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F8FAFC' },

  // Progress
  progressBg:   { height: 4, backgroundColor: '#E2E8F0' },
  progressFill: { height: 4, backgroundColor: '#003366' },

  // Step indicator
  stepRow:      { flexDirection: 'row', justifyContent: 'space-evenly', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  stepItem:     { alignItems: 'center', gap: 5 },
  stepDot:      { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  stepNum:      { fontSize: 12, fontWeight: '900' },
  stepLabel:    { fontSize: 10, fontWeight: '700', textAlign: 'center' },

  // Instructions
  instrCard:    { backgroundColor: '#fff', padding: 22, borderRadius: 18, marginBottom: 15, elevation: 2 },
  instrTitle:   { fontSize: 18, fontWeight: '800', color: '#003366', marginBottom: 5 },
  instrAccent:  { width: 35, height: 4, backgroundColor: '#10B981', borderRadius: 2, marginBottom: 12 },
  instrText:    { color: '#475569', fontSize: 14, lineHeight: 22 },

  // Fee card
  feeCard:      { backgroundColor: '#003366', padding: 22, borderRadius: 24, marginBottom: 25, elevation: 8 },
  feeTag:       { color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  feeRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  feeText:      { color: '#F8FAFC', fontSize: 15 },
  feeDivider:   { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', marginTop: 10, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeTotalLabel:{ color: '#fff', fontWeight: '700', fontSize: 15 },
  feeTotalVal:  { color: '#10B981', fontSize: 28, fontWeight: '800' },

  // Dropdown
  selectorWrap: { marginBottom: 20 },
  fieldLabel:   { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 8, marginLeft: 4 },
  dropTrigger:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0' },
  dropActive:   { borderColor: '#003366' },
  overlay:      { flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', justifyContent: 'flex-end' },
  dropSheet:    { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 25, maxHeight: '65%' },
  sheetHandle:  { width: 45, height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  dropHeader:   { fontSize: 18, fontWeight: '800', marginBottom: 15, color: '#0F172A' },
  optionRow:    { flexDirection: 'row', justifyContent: 'space-between', padding: 18, borderRadius: 14, marginBottom: 8 },
  optionActive: { backgroundColor: '#F1F5F9' },
  optionText:   { fontSize: 16, color: '#475569', fontWeight: '500' },
  optionActiveText: { color: '#003366', fontWeight: '700' },

  // Float input
  floatWrap:    { paddingTop: 12, marginBottom: 4 },
  floatInput:   { borderWidth: 1.5, borderColor: '#E2E8F0', padding: 15, borderRadius: 14, fontSize: 16, color: '#0F172A', backgroundColor: '#fff' },

  separator:    { height: 1, backgroundColor: '#E2E8F0', marginVertical: 25 },

  // Preference
  prefLabel:    { fontWeight: '700', color: '#334155', marginBottom: 12, fontSize: 15 },
  pillGrid:     { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 15 },
  pill:         { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#fff', borderRadius: 25, borderWidth: 1.2, borderColor: '#003366' },
  pillText:     { color: '#003366', fontWeight: '700', fontSize: 13 },
  selectedRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 14, marginTop: 10, borderWidth: 1, borderColor: '#F1F5F9', elevation: 2 },
  selectedLeft: { flexDirection: 'row', alignItems: 'center' },
  numBadge:     { width: 26, height: 26, borderRadius: 13, backgroundColor: '#003366', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  numText:      { color: '#fff', fontSize: 12, fontWeight: '800' },
  selectedText: { fontSize: 15, fontWeight: '700', color: '#1E293B' },

  verifyRow:    { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 40, marginBottom: 20 },
  verifyText:   { fontSize: 12, color: '#64748B', marginLeft: 8, fontWeight: '700' },

  // Documents
  docHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, padding: 14, backgroundColor: '#EBF5FB', borderRadius: 14 },
  docHeaderText:{ fontSize: 15, fontWeight: '800', color: '#003366' },
  docCard:      { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, borderWidth: 1.5, borderColor: '#E2E8F0', elevation: 1 },
  docCardDone:  { borderColor: '#6EE7B7', backgroundColor: '#F0FDF4' },
  docIcon:      { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  docName:      { fontSize: 14, fontWeight: '800', color: '#1E293B', marginBottom: 3 },
  docProfileTag:{ fontSize: 10, fontWeight: '800', color: '#10B981' },
  docHint:      { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  uploadBtn:    { backgroundColor: '#003366', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, flexShrink: 0 },
  uploadBtnDone:{ backgroundColor: '#10B981' },
  uploadBtnText:{ color: '#fff', fontWeight: '800', fontSize: 12 },

  // Footer
  footer:       { backgroundColor: '#fff', padding: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  footerRow:    { flexDirection: 'row', alignItems: 'center', gap: 15 },
  backBtn:      { paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', height: 50 },
  backBtnText:  { color: '#64748B', fontWeight: '800', fontSize: 14, marginLeft: 2 },
  nextBtn:      { height: 60, borderRadius: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  nextBtnText:  { color: '#fff', fontWeight: '800', fontSize: 16 },
});
