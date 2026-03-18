import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, SafeAreaView,
  KeyboardAvoidingView, Platform, Alert, StatusBar,
  Animated, Image
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { db } from '../../api/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Config from '../../config';

const CLOUD_NAME    = Config.cloudinary.cloudName;
const UPLOAD_PRESET = Config.cloudinary.uploadPreset;

// ── Floating Label Input ──────────────────────────────────
const FloatingInput = ({ label, value, required, ...props }) => {
  const [isFocused, setIsFocused] = useState(false);
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: (isFocused || value) ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [isFocused, value]);

  return (
    <View style={fw.wrap}>
      <Animated.Text style={[fw.label, {
        top:      anim.interpolate({ inputRange: [0,1], outputRange: [16, -9] }),
        fontSize: anim.interpolate({ inputRange: [0,1], outputRange: [15, 11] }),
        color:    anim.interpolate({ inputRange: [0,1], outputRange: ['#94A3B8', '#002855'] }),
      }]}>
        {label}{required ? ' *' : ''}
      </Animated.Text>
      <TextInput
        style={[fw.input, isFocused && fw.focused]}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        value={value}
        {...props}
      />
    </View>
  );
};

const fw = StyleSheet.create({
  wrap:    { paddingTop: 10, marginBottom: 16 },
  label:   { position: 'absolute', left: 14, backgroundColor: '#fff', paddingHorizontal: 5, fontWeight: '600', zIndex: 1 },
  input:   { borderWidth: 1.5, borderColor: '#E2E8F0', padding: 15, borderRadius: 14, fontSize: 15, color: '#1E293B', backgroundColor: '#fff' },
  focused: { borderColor: '#002855' },
});

// ── Main Component ────────────────────────────────────────
export default function ServiceWizard({ route, navigation }) {
  const { serviceId, serviceData } = route.params || {};

  const [config, setConfig]               = useState(null);
  const [loading, setLoading]             = useState(true);
  const [formData, setFormData]           = useState({});
  const [activeDropdowns, setActiveDropdowns] = useState({});
  const [selectedPrefs, setSelectedPrefs] = useState({});
  const [uploadedDocs, setUploadedDocs]   = useState({});
  const [isUploading, setIsUploading]     = useState(null);

  // ── Fetch config + profile docs ─────────────────────────
  useEffect(() => {
    const fetch = async () => {
      try {
        if (!serviceId) { setLoading(false); return; }

        const snap = await getDoc(doc(db, 'service_wizard_configs', serviceId));
        if (snap.exists()) {
          const cfg = snap.data();
          setConfig(cfg);
          // No auto-fill — har user fresh documents upload karega
        }
      } catch {}
      finally { setLoading(false); }
    };
    fetch();
  }, [serviceId]);

  // ── Image compress + upload ──────────────────────────────
  const handleFileUpload = async (docName) => {
    if (isUploading) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      setIsUploading(docName);

      let file = result.assets[0];

      // ✅ Image compression
      if (file.mimeType?.startsWith('image/')) {
        const compressed = await ImageManipulator.manipulateAsync(
          file.uri,
          [{ resize: { width: 1200 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        file = { uri: compressed.uri, type: 'image/jpeg', name: file.name || `img_${Date.now()}.jpg` };
      }

      const data = new FormData();
      data.append('file', { uri: file.uri, type: file.type || 'application/octet-stream', name: file.name });
      data.append('upload_preset', UPLOAD_PRESET);

      const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: 'POST', body: data });
      const json = await res.json();

      if (json.secure_url) {
        setUploadedDocs(prev => ({ ...prev, [docName]: json.secure_url }));
      } else {
        Alert.alert('Error', 'Upload failed. Try again.');
      }
    } catch {
      Alert.alert('Error', 'Upload nahi ho saka.');
    } finally {
      setIsUploading(null);
    }
  };

  // ── Validation ───────────────────────────────────────────
  const isFormValid = () => {
    if (!config) return false;
    for (const f of (config.formFields || [])) {
      if (!f.required) continue;
      if (f.type === 'preference') {
        if (!(selectedPrefs[f.id]?.length > 0)) return false;
        continue;
      }
      if (!formData[f.id]?.toString().trim()) return false;
      if (f.type === 'dropdown') {
        const selOpt = f.options?.find(o => o.id === activeDropdowns[f.id]);
        for (const sf of (selOpt?.subFields || [])) {
          if (sf.required && !formData[sf.id]?.trim()) return false;
        }
      }
    }
    for (const d of (config.documents || [])) {
      if (d.required !== false && !uploadedDocs[d.name]) return false;
    }
    return true;
  };

  // ── Navigate to review ───────────────────────────────────
  const handleReviewNavigation = () => {
    if (!config) return;
    const readableData = {};

    config.formFields.forEach(field => {
      if (formData[field.id]) readableData[field.title] = formData[field.id];

      if (field.type === 'dropdown') {
        const selOpt = field.options?.find(o => o.id === activeDropdowns[field.id]);
        selOpt?.subFields?.forEach(sf => {
          if (formData[sf.id]) readableData[sf.title] = formData[sf.id];
        });
      }

      if (field.type === 'preference' && selectedPrefs[field.id]?.length) {
        readableData[field.title] = selectedPrefs[field.id].join(', ');
      }
    });

    navigation.navigate('ServiceReview', {
      serviceId,
      serviceTitle: serviceData?.title || config.title,
      formData: readableData,
      feeDetails: {
        govFee:     route.params?.selectedGovFee || config.simpleGovFee || 0,
        serviceFee: config.serviceFee || 50,
      },
      documents: uploadedDocs,
    });
  };

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color="#002855" />
      <Text style={{ marginTop: 12, color: '#64748B', fontWeight: '600' }}>Loading form...</Text>
    </View>
  );

  if (!config) return (
    <View style={s.center}>
      <MaterialCommunityIcons name="alert-circle-outline" size={56} color="#CBD5E1" />
      <Text style={s.errorText}>Form config nahi mili</Text>
      <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
        <Text style={s.backBtnText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  const hasInstructions = (config.instructions || []).length > 0;
  const hasFields       = (config.formFields   || []).length > 0;
  const hasDocs         = (config.documents    || []).length > 0;

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F4FF" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>{serviceData?.title}</Text>
            <View style={s.verifiedRow}>
              <MaterialCommunityIcons name="shield-check" size={14} color="#10B981" />
              <Text style={s.verifiedText}>SewaOne Verified Service</Text>
            </View>
          </View>

          {/* ── Step 1: Instructions ── */}
          {hasInstructions && (
            <>
              <View style={s.stepHeader}>
                <View style={s.stepBadge}><Text style={s.stepNum}>1</Text></View>
                <View>
                  <Text style={s.stepTitle}>Instructions</Text>
                  <Text style={s.stepSub}>Apply karne se pehle padho</Text>
                </View>
              </View>
              {config.instructions.map((ins, i) => (
                <View key={i} style={s.instrCard}>
                  <View style={s.instrHeader}>
                    <View style={s.instrAccent} />
                    <Text style={s.instrHeading}>{ins.heading}</Text>
                  </View>
                  {ins.desc ? <Text style={s.instrText}>{ins.desc}</Text> : null}
                </View>
              ))}
            </>
          )}

          {/* ── Step 2: Form Fields ── */}
          {hasFields && (
            <>
              <View style={[s.stepHeader, hasInstructions && { marginTop: 8 }]}>
                <View style={s.stepBadge}>
                  <Text style={s.stepNum}>{hasInstructions ? '2' : '1'}</Text>
                </View>
                <View>
                  <Text style={s.stepTitle}>Fill Your Details</Text>
                  <Text style={s.stepSub}>Sabhi starred (*) fields zaroori hain</Text>
                </View>
              </View>

              {config.formFields.map((f) => (
                <View key={f.id} style={s.formGroup}>

                  {/* TEXT field */}
                  {f.type === 'text' && (
                    <FloatingInput
                      label={f.title}
                      required={f.required}
                      value={formData[f.id] || ''}
                      onChangeText={v => setFormData({ ...formData, [f.id]: v })}
                    />
                  )}

                  {/* DROPDOWN field */}
                  {f.type === 'dropdown' && (
                    <View>
                      <Text style={s.fieldLabel}>
                        {f.title}{f.required ? ' *' : ''}
                      </Text>
                      <View style={s.optGrid}>
                        {(f.options || []).map(opt => (
                          <TouchableOpacity
                            key={opt.id}
                            style={[s.optChip, activeDropdowns[f.id] === opt.id && s.optChipActive]}
                            onPress={() => {
                              setActiveDropdowns({ ...activeDropdowns, [f.id]: opt.id });
                              setFormData({ ...formData, [f.id]: opt.label });
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={[s.optChipText, activeDropdowns[f.id] === opt.id && s.optChipTextActive]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Option note */}
                      {(() => {
                        const selOpt = f.options?.find(o => o.id === activeDropdowns[f.id]);
                        return selOpt?.note ? (
                          <View style={s.noteBox}>
                            <MaterialCommunityIcons name="information" size={14} color="#1a5276" />
                            <Text style={s.noteText}>{selOpt.note}</Text>
                          </View>
                        ) : null;
                      })()}

                      {/* Sub-fields */}
                      {(f.options?.find(o => o.id === activeDropdowns[f.id])?.subFields || []).map(sf => (
                        <FloatingInput
                          key={sf.id}
                          label={sf.title}
                          required={sf.required}
                          value={formData[sf.id] || ''}
                          onChangeText={v => setFormData({ ...formData, [sf.id]: v })}
                        />
                      ))}
                    </View>
                  )}

                  {/* PREFERENCE field */}
                  {f.type === 'preference' && (
                    <View>
                      <Text style={s.fieldLabel}>
                        {f.title}{f.required ? ' *' : ''}
                      </Text>
                      <Text style={s.prefSub}>Tap to add — drag to reorder priority</Text>

                      {/* Available items */}
                      <View style={s.prefAvail}>
                        {(f.listItems || [])
                          .filter(it => !(selectedPrefs[f.id] || []).includes(it))
                          .map(it => (
                            <TouchableOpacity
                              key={it}
                              style={s.prefChip}
                              onPress={() => setSelectedPrefs({
                                ...selectedPrefs,
                                [f.id]: [...(selectedPrefs[f.id] || []), it]
                              })}
                            >
                              <Text style={s.prefChipText}>+ {it}</Text>
                            </TouchableOpacity>
                          ))
                        }
                      </View>

                      {/* Selected items */}
                      {(selectedPrefs[f.id] || []).map((it, idx) => (
                        <View key={idx} style={s.prefSelected}>
                          <View style={s.prefNumBadge}>
                            <Text style={s.prefNum}>{idx + 1}</Text>
                          </View>
                          <Text style={s.prefSelectedText}>{it}</Text>
                          <TouchableOpacity
                            onPress={() => setSelectedPrefs({
                              ...selectedPrefs,
                              [f.id]: (selectedPrefs[f.id] || []).filter(x => x !== it)
                            })}
                          >
                            <MaterialCommunityIcons name="close-circle" size={22} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </>
          )}

          {/* ── Step 3: Documents ── */}
          {hasDocs && (
            <>
              <View style={[s.stepHeader, { marginTop: 8 }]}>
                <View style={s.stepBadge}>
                  <Text style={s.stepNum}>
                    {(hasInstructions ? 1 : 0) + (hasFields ? 1 : 0) + 1}
                  </Text>
                </View>
                <View>
                  <Text style={s.stepTitle}>Upload Documents</Text>
                  <Text style={s.stepSub}>Profile documents auto-matched hain</Text>
                </View>
              </View>

              {config.documents.map((d, i) => {
                const isUploaded    = !!uploadedDocs[d.name];
                const isOptional    = d.required === false;
                return (
                  <View key={i} style={[s.docCard, isUploaded && s.docCardDone]}>
                    <View style={s.docLeft}>
                      <MaterialCommunityIcons
                        name={isUploaded ? 'check-decagram' : 'file-upload-outline'}
                        size={26}
                        color={isUploaded ? '#10B981' : '#64748B'}
                      />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={s.docName}>{d.name}</Text>
                          {isOptional && (
                            <View style={s.optionalBadge}>
                              <Text style={s.optionalText}>Optional</Text>
                            </View>
                          )}
                        </View>

                      </View>
                    </View>

                    <TouchableOpacity
                      style={[s.uploadBtn, isUploaded && s.uploadBtnDone]}
                      onPress={() => handleFileUpload(d.name)}
                      disabled={isUploading === d.name}
                    >
                      {isUploading === d.name ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={s.uploadBtnText}>
                          {isUploaded ? 'CHANGE' : 'UPLOAD'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )}

          {/* Verified badge */}
          <View style={s.bottomVerify}>
            <MaterialCommunityIcons name="shield-lock" size={16} color="#10B981" />
            <Text style={s.bottomVerifyText}>Documents securely stored — end-to-end encrypted</Text>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.submitBtn, !isFormValid() && s.submitBtnDisabled]}
            onPress={handleReviewNavigation}
            disabled={!isFormValid()}
            activeOpacity={0.88}
          >
            <MaterialCommunityIcons name="eye-check" size={20} color="#fff" />
            <Text style={s.submitText}>
              {isFormValid() ? 'REVIEW & PAY' : 'FILL ALL REQUIRED FIELDS'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  errorText: { fontSize: 16, fontWeight: '700', color: '#94A3B8', marginTop: 16 },
  backBtn: { marginTop: 20, backgroundColor: '#002855', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { color: '#fff', fontWeight: '700' },

  // Header
  header: { backgroundColor: '#002855', borderRadius: 20, padding: 20, marginBottom: 20, elevation: 4 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 8 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  verifiedText: { fontSize: 11, color: '#4ADE80', fontWeight: '700' },

  // Step headers
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  stepBadge: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#002855', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  stepNum: { color: '#fff', fontSize: 15, fontWeight: '900' },
  stepTitle: { fontSize: 16, fontWeight: '900', color: '#002855' },
  stepSub: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 1 },

  // Instructions
  instrCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, elevation: 1 },
  instrHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  instrAccent: { width: 4, height: 18, backgroundColor: '#002855', borderRadius: 2 },
  instrHeading: { fontSize: 14, fontWeight: '800', color: '#002855' },
  instrText: { fontSize: 13, color: '#475569', lineHeight: 20, marginLeft: 14 },

  // Form
  formGroup: { marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 10 },
  optGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  optChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  optChipActive: { backgroundColor: '#002855', borderColor: '#002855' },
  optChipText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  optChipTextActive: { color: '#fff' },
  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#EBF5FB', padding: 10, borderRadius: 10, marginBottom: 10 },
  noteText: { fontSize: 12, color: '#1a5276', flex: 1, lineHeight: 18 },

  // Preference
  prefSub: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 10 },
  prefAvail: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  prefChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#002855', backgroundColor: '#fff' },
  prefChipText: { fontSize: 12, fontWeight: '700', color: '#002855' },
  prefSelected: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 14, borderRadius: 14, marginBottom: 8, elevation: 1 },
  prefNumBadge: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#002855', justifyContent: 'center', alignItems: 'center' },
  prefNum: { color: '#fff', fontSize: 12, fontWeight: '900' },
  prefSelectedText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1E293B' },

  // Documents
  docCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 16, marginBottom: 10, borderWidth: 1.5, borderColor: '#F1F5F9', elevation: 1 },
  docCardDone: { borderColor: '#DCFCE7', backgroundColor: '#F0FDF4' },
  docLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  docName: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
  optionalBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  optionalText: { fontSize: 10, color: '#64748B', fontWeight: '700' },
  profileMatchText: { fontSize: 10, color: '#10B981', fontWeight: '800', marginTop: 2 },
  uploadBtn: { backgroundColor: '#002855', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, minWidth: 80, alignItems: 'center' },
  uploadBtnDone: { backgroundColor: '#10B981' },
  uploadBtnText: { fontSize: 11, fontWeight: '900', color: '#fff' },

  bottomVerify: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 16 },
  bottomVerifyText: { fontSize: 11, color: '#64748B', fontWeight: '600' },

  // Footer
  footer: { backgroundColor: '#fff', padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#F1F5F9', elevation: 8 },
  submitBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: '#002855', padding: 18, borderRadius: 16, elevation: 3 },
  submitBtnDisabled: { backgroundColor: '#CBD5E1' },
  submitText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
