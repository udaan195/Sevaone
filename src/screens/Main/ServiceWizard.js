import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, ActivityIndicator, SafeAreaView, 
  KeyboardAvoidingView, Platform, Alert, StatusBar 
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { db } from '../../api/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const CLOUD_NAME = "dxuurwexl";
const UPLOAD_PRESET = "edusphere_uploads";

export default function ServiceWizard({ route, navigation }) {
  const { serviceId, serviceData } = route.params || {};
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({});
  const [activeDropdowns, setActiveDropdowns] = useState({}); 
  const [uploadedDocs, setUploadedDocs] = useState({});
  const [isUploading, setIsUploading] = useState(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        if (serviceId) {
          const snap = await getDoc(doc(db, "service_wizard_configs", serviceId));
          if (snap.exists()) setConfig(snap.data());
        }
        setLoading(false);
      } catch (err) { setLoading(false); }
    };
    fetchConfig();
  }, [serviceId]);

  // --- ☁️ Real Upload Logic ---
  const handleFileUpload = async (docName) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"] });
      if (result.canceled) return;
      setIsUploading(docName);
      const file = result.assets[0];
      const data = new FormData();
      data.append("file", { uri: file.uri, type: file.mimeType || "image/jpeg", name: file.name });
      data.append("upload_preset", UPLOAD_PRESET);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: "POST", body: data });
      const json = await response.json();
      if (json.secure_url) {
        setUploadedDocs(prev => ({ ...prev, [docName]: json.secure_url }));
      }
    } catch (error) { Alert.alert("Error", "Upload failed!"); }
    finally { setIsUploading(null); }
  };

  // --- 🛠️ Validation ---
  const isFormValid = () => {
    if (!config) return false;
    for (let f of (config.formFields || [])) {
      if (f.required && (!formData[f.id] || formData[f.id].trim() === "")) return false;
      if (f.type === 'dropdown') {
        const selectedOpt = f.options?.find(o => o.id === activeDropdowns[f.id]);
        if (selectedOpt?.subFields) {
          for (let sf of selectedOpt.subFields) {
            if (sf.required && (!formData[sf.id] || formData[sf.id].trim() === "")) return false;
          }
        }
      }
    }
    for (let d of (config.documents || [])) {
      if (d.required && !uploadedDocs[d.name]) return false;
    }
    return true;
  };

  // --- 🚀 ✨ Mapping IDs to Real Titles for Review ---
  const handleReviewNavigation = () => {
    if (!config) return;

    const readableData = {};
    config.formFields.forEach(field => {
      // 1. Main Field Value (Title ke sath set karein)
      if (formData[field.id]) {
        readableData[field.title] = formData[field.id];
      }

      // 2. Dropdown Sub-fields Value (Title ke sath set karein)
      if (field.type === 'dropdown') {
        const selectedOptId = activeDropdowns[field.id];
        const selectedOpt = field.options?.find(o => o.id === selectedOptId);
        
        selectedOpt?.subFields?.forEach(sf => {
          if (formData[sf.id]) {
            readableData[sf.title] = formData[sf.id];
          }
        });
      }
    });

    navigation.navigate('ServiceReview', {
      serviceId,
      serviceTitle: serviceData.title,
      formData: readableData, // 👈 Ab yahan IDs nahi, Real Titles jayenge
      feeDetails: {
        govFee: route.params?.selectedGovFee || config.simpleGovFee || 0,
        serviceFee: config.serviceFee || 50
      },
      documents: uploadedDocs
    });
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#003366" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex:1}}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          
          <View style={styles.header}>
            <Text style={styles.mainTitle}>{serviceData?.title}</Text>
            <Text style={styles.subTitle}>SewaOne Application Portal</Text>
          </View>

          {/* STEP 1: Instructions */}
          <View style={styles.sectionTitleRow}>
            <View style={styles.stepCircle}><Text style={styles.stepNum}>1</Text></View>
            <Text style={styles.sectionHead}>Read Instructions</Text>
          </View>
          {config?.instructions?.map((ins, i) => (
            <View key={i} style={styles.card}><Text style={styles.bold}>{ins.heading}</Text><Text style={styles.desc}>{ins.desc}</Text></View>
          ))}

          {/* STEP 2: Application Form */}
          <View style={[styles.sectionTitleRow, {marginTop: 30}]}>
            <View style={styles.stepCircle}><Text style={styles.stepNum}>2</Text></View>
            <Text style={styles.sectionHead}>Fill Details</Text>
          </View>
          {config?.formFields?.map((f) => (
            <View key={f.id} style={styles.formGroup}>
              <Text style={styles.label}>{f.title} {f.required && "*"}</Text>
              {f.type === 'dropdown' ? (
                <View>
                  <View style={styles.optionsGrid}>{f.options?.map((opt) => (
                    <TouchableOpacity key={opt.id} style={[styles.optBtn, activeDropdowns[f.id] === opt.id && styles.optBtnActive]} 
                    onPress={() => { setActiveDropdowns({...activeDropdowns, [f.id]: opt.id}); setFormData({...formData, [f.id]: opt.label}); }}>
                      <Text style={[styles.optTxt, activeDropdowns[f.id] === opt.id && styles.optTxtActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}</View>
                  {f.options?.find(o => o.id === activeDropdowns[f.id])?.subFields?.map((sf) => (
                    <View key={sf.id} style={{marginTop: 10}}>
                      <Text style={styles.subLabel}>{sf.title} {sf.required && "*"}</Text>
                      <TextInput style={styles.input} placeholder={sf.title} onChangeText={(val) => setFormData({...formData, [sf.id]: val})} />
                    </View>
                  ))}
                </View>
              ) : <TextInput style={styles.input} placeholder={f.title} onChangeText={(val) => setFormData({...formData, [f.id]: val})} />}
            </View>
          ))}

          {/* STEP 3: Documents */}
          <View style={[styles.sectionTitleRow, {marginTop: 30}]}>
            <View style={styles.stepCircle}><Text style={styles.stepNum}>3</Text></View>
            <Text style={styles.sectionHead}>Documents</Text>
          </View>
          {config?.documents?.map((d, i) => (
            <View key={i} style={styles.docRow}>
              <Text style={styles.docName}>{d.name}</Text>
              <TouchableOpacity style={[styles.upBtn, uploadedDocs[d.name] && styles.upBtnSuccess]} onPress={() => handleFileUpload(d.name)}>
                {isUploading === d.name ? <ActivityIndicator size="small" color="#fff" /> : 
                <Text style={styles.upTxt}>{uploadedDocs[d.name] ? "✅ DONE" : "UPLOAD"}</Text>}
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity disabled={!isFormValid()} style={[styles.submitBtn, !isFormValid() && { backgroundColor: '#CBD5E1' }]} onPress={handleReviewNavigation}>
            <Text style={styles.submitTxt}>{isFormValid() ? "REVIEW & PAY" : "FILL ALL REQUIRED"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FBFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: 20 },
  mainTitle: { fontSize: 22, fontWeight: '900', color: '#003366' },
  subTitle: { fontSize: 12, color: '#64748B' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  stepCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#003366', justifyContent: 'center', alignItems: 'center' },
  stepNum: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  sectionHead: { fontSize: 17, fontWeight: '800', color: '#003366' },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#003366', elevation: 2 },
  bold: { fontWeight: 'bold', fontSize: 14 },
  desc: { fontSize: 12, color: '#64748B' },
  formGroup: { marginBottom: 15 },
  label: { fontSize: 13, fontWeight: 'bold', marginBottom: 8 },
  subLabel: { fontSize: 11, color: '#475569', marginBottom: 5 },
  input: { backgroundColor: '#fff', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optBtn: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  optBtnActive: { backgroundColor: '#003366', borderColor: '#003366' },
  optTxt: { fontSize: 12, color: '#64748B', fontWeight: 'bold' },
  optTxtActive: { color: '#fff' },
  docRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10 },
  docName: { fontWeight: 'bold', fontSize: 13 },
  upBtn: { backgroundColor: '#E0F2FE', padding: 10, borderRadius: 8, minWidth: 90, alignItems: 'center' },
  upBtnSuccess: { backgroundColor: '#10B981' },
  upTxt: { fontSize: 10, fontWeight: '900', color: '#003366' },
  footer: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  submitBtn: { backgroundColor: '#003366', padding: 18, borderRadius: 15, alignItems: 'center' },
  submitTxt: { color: '#fff', fontWeight: '900', fontSize: 15 }
});
