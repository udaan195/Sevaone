import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, StatusBar, SafeAreaView, Modal, Animated, Linking 
} from 'react-native';
import { db } from '../../api/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ServiceDetails({ route, navigation }) {
  const { jobId } = route.params; 
  const [data, setData] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- ⚙️ Selection States ---
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [selections, setSelections] = useState({ post: '', category: '', gender: '' });
  const [calculatedGovFee, setCalculatedGovFee] = useState(null);
  const [selectedCatName, setSelectedCatName] = useState("");
  const pulseAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const sSnap = await getDoc(doc(db, "all_services", jobId));
        if (sSnap.exists()) setData({ id: sSnap.id, ...sSnap.data() });

        const cSnap = await getDoc(doc(db, "service_wizard_configs", jobId));
        if (cSnap.exists()) {
          const wConfig = cSnap.data();
          setConfig(wConfig);
          if (!wConfig.isSmartFee) setCalculatedGovFee(wConfig.simpleGovFee || 0);
        }
        setLoading(false);
      } catch (err) {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [jobId]);

  useEffect(() => {
    if (config?.isSmartFee && calculatedGovFee === null) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else { pulseAnim.setValue(1); }
  }, [config, calculatedGovFee]);

  const getUnique = (key) => {
    if (!config?.smartFeeMapping) return [];
    const vals = config.smartFeeMapping.map(item => item[key]).filter(v => v && v !== '' && v !== 'All');
    return [...new Set(vals)];
  };

  const handleFinalCalculate = () => {
    const match = config?.smartFeeMapping?.find(item => 
      (item.post === selections.post || !item.post || item.post === "") &&
      (item.category === selections.category || !item.category || item.category === "") &&
      (item.gender === selections.gender || item.gender === 'All' || !item.gender || item.gender === "")
    );

    if (match) {
      setCalculatedGovFee(match.amount);
      setSelectedCatName(`${selections.post} ${selections.category} (${selections.gender})`.trim());
      setShowFeeModal(false);
    } else {
      alert("Bhai, is selection ke liye fee set nahi hai!");
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#003366" /></View>;

  const isFeePending = config?.isSmartFee && calculatedGovFee === null;
  const finalTotal = (config?.serviceFee || 0) + (calculatedGovFee || 0);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#003366" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        
        <View style={styles.header}>
          <Text style={styles.headerCat}>{data?.category?.toUpperCase()}</Text>
          <Text style={styles.headerTitle}>{data?.title}</Text>
          <Text style={styles.headerDesc}>{data?.shortDesc}</Text>
        </View>

        <View style={[styles.feeCard, isFeePending && styles.highlightCard]}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Portal Service Fee</Text>
            <Text style={styles.feeVal}>₹ {config?.serviceFee || 50}</Text>
          </View>

          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Government Fee</Text>
            {config?.isSmartFee ? (
              calculatedGovFee !== null ? (
                <View style={styles.row}>
                  <Text style={styles.feeVal}>₹ {calculatedGovFee}</Text>
                  <TouchableOpacity onPress={() => setShowFeeModal(true)}><MaterialCommunityIcons name="pencil-box" size={24} color="#003366" /></TouchableOpacity>
                </View>
              ) : (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity style={styles.checkBtn} onPress={() => setShowFeeModal(true)}>
                    <Text style={styles.checkBtnText}>CHECK NOW</Text>
                  </TouchableOpacity>
                </Animated.View>
              )
            ) : <Text style={styles.feeVal}>₹ {config?.simpleGovFee || 0}</Text>}
          </View>

          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>Total Payable</Text>
              {selectedCatName !== "" && <Text style={styles.catSubText}>{selectedCatName}</Text>}
            </View>
            <Text style={[styles.totalAmount, !isFeePending && {color:'#10B981'}]}>₹ {finalTotal}</Text>
          </View>
        </View>

        {data?.sections?.map((sec, idx) => (
          <View key={idx} style={styles.infoSection}>
            <Text style={styles.sectionTitle}>{sec.heading}</Text>
            {sec.fields?.map((f, fIdx) => (
              <View key={fIdx} style={styles.fieldBox}>
                {f.type === 'table' ? (
                  <View style={styles.table}>
                    <View style={styles.tableHeader}>
                      {f.headers?.map((h, hI) => <Text key={hI} style={styles.th}>{h}</Text>)}
                    </View>
                    {f.rows?.map((row, rI) => (
                      <View key={rI} style={styles.tableRow}>
                        {f.headers?.map((_, cI) => <Text key={cI} style={styles.td}>{row[`c${cI}`]}</Text>)}
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.textRowInline}>
                    <Text style={styles.fieldLabelText}>{f.label}:</Text>
                    <Text style={styles.fieldValueText}>{f.value}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <Modal visible={showFeeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Calculate Your Fee</Text>
            <ScrollView>
              {getUnique('post').length > 0 && (
                <View style={styles.dropGroup}>
                  <Text style={styles.dropLabel}>Select Post/Service</Text>
                  <View style={styles.selRow}>{getUnique('post').map(p => (
                    <TouchableOpacity key={p} style={[styles.selBtn, selections.post === p && styles.selBtnActive]} onPress={() => setSelections({...selections, post: p})}>
                      <Text style={[styles.selTxt, selections.post === p && styles.selTxtActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}</View>
                </View>
              )}
              {getUnique('category').length > 0 && (
                <View style={styles.dropGroup}>
                  <Text style={styles.dropLabel}>Select Category</Text>
                  <View style={styles.selRow}>{getUnique('category').map(c => (
                    <TouchableOpacity key={c} style={[styles.selBtn, selections.category === c && styles.selBtnActive]} onPress={() => setSelections({...selections, category: c})}>
                      <Text style={[styles.selTxt, selections.category === c && styles.selTxtActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}</View>
                </View>
              )}
              <View style={styles.dropGroup}>
                <Text style={styles.dropLabel}>Select Gender</Text>
                <View style={styles.selRow}>
                  {['Male', 'Female'].map(g => (
                    <TouchableOpacity key={g} style={[styles.selBtn, selections.gender === g && styles.selBtnActive]} onPress={() => setSelections({...selections, gender: g})}>
                      <Text style={[styles.selTxt, selections.gender === g && styles.selTxtActive]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
            <TouchableOpacity style={styles.calcFinalBtn} onPress={handleFinalCalculate}>
              <Text style={styles.calcFinalTxt}>CALCULATE TOTAL</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowFeeModal(false)} style={{marginTop:15, alignItems:'center'}}><Text style={{color:'red', fontWeight:'bold'}}>CANCEL</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- ✨ FOOTER: DYNAMIC BUTTONS (JobDetails ki tarah) --- */}
      <View style={styles.footer}>
        {data?.buttons && data.buttons.filter(b => b.show).length > 0 ? (
          data.buttons.filter(b => b.show).map((btn, i) => {
            const isApplyBtn = btn.name.toLowerCase().includes('apply');
            return (
              <TouchableOpacity 
                key={i} 
                disabled={isFeePending}
                style={[
                  styles.dynamicBtn, 
                  isApplyBtn ? styles.applyColor : styles.otherColor,
                  isFeePending && { backgroundColor: '#CBD5E1' } 
                ]} 
                onPress={() => {
                  if(isApplyBtn) {
                    navigation.navigate('ServiceWizard', { serviceId: data.id, serviceData: data });
                  } else { Linking.openURL(btn.url); }
                }}
              >
                <Text style={styles.btnText}>
                  {isFeePending ? "SELECT FEE TO PROCEED" : btn.name.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })
        ) : (
          /* Default Fallback Button */
          <TouchableOpacity disabled={isFeePending} style={[styles.applyBtn, isFeePending && {backgroundColor:'#CBD5E1'}]} onPress={() => navigation.navigate('ServiceWizard', { serviceId: data.id, serviceData: data })}>
            <Text style={styles.applyBtnText}>{isFeePending ? "SELECT FEE TO PROCEED" : "PROCEED TO APPLY"}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#003366', padding: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerCat: { color: '#A5C9FF', fontSize: 10, fontWeight: 'bold' },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 5 },
  headerDesc: { color: '#CBD5E1', fontSize: 13, marginTop: 10 },
  feeCard: { backgroundColor: '#fff', margin: 20, padding: 20, borderRadius: 20, elevation: 5 },
  highlightCard: { borderWidth: 2, borderColor: '#F59E0B' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#003366', marginBottom: 15 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  feeLabel: { color: '#64748B', fontSize: 14, fontWeight: '600' },
  feeVal: { color: '#1E293B', fontWeight: 'bold', fontSize: 15 },
  checkBtn: { backgroundColor: '#D97706', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  checkBtnText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontWeight: '900', color: '#003366', fontSize: 16 },
  catSubText: { fontSize: 9, color: '#64748B', fontWeight: 'bold' },
  totalAmount: { fontWeight: '900', fontSize: 24, color: '#64748B' },
  infoSection: { paddingHorizontal: 20, marginBottom: 15 },
  fieldBox: { backgroundColor: '#fff', padding: 15, borderRadius: 15, marginBottom: 10, borderLeftWidth: 5, borderLeftColor: '#003366' },
  
  // ✨ Field Alignment Styles
  textRowInline: { flexDirection: 'row', paddingVertical: 4, alignItems: 'flex-start' },
  fieldLabelText: { fontSize: 13, fontWeight: 'bold', color: '#334155', flex: 0.42, marginRight: 10 },
  fieldValueText: { fontSize: 13, color: '#475569', flex: 0.58, textAlign: 'left', flexWrap: 'wrap', lineHeight: 18 },

  table: { borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#003366', padding: 10 },
  th: { flex: 1, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' },
  tableRow: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  td: { flex: 1, fontSize: 11, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25 },
  modalHeader: { fontSize: 18, fontWeight: '900', color: '#003366', marginBottom: 20, textAlign: 'center' },
  dropGroup: { marginBottom: 20 },
  dropLabel: { fontSize: 11, fontWeight: 'bold', color: '#64748B', marginBottom: 10, textTransform: 'uppercase' },
  selRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  selBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  selBtnActive: { backgroundColor: '#003366', borderColor: '#003366' },
  selTxt: { fontWeight: 'bold', color: '#475569', fontSize: 13 },
  selTxtActive: { color: '#fff' },
  calcFinalBtn: { backgroundColor: '#10B981', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  calcFinalTxt: { color: '#fff', fontWeight: '900', fontSize: 16 },
  
  // ✨ Dynamic Button Styles
  footer: { padding: 15, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', gap: 10 },
  dynamicBtn: { padding: 16, borderRadius: 15, alignItems: 'center' },
  applyColor: { backgroundColor: '#003366' },
  otherColor: { backgroundColor: '#64748B' },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  
  applyBtn: { backgroundColor: '#003366', padding: 18, borderRadius: 15, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 }
});
