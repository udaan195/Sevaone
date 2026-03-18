import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, StatusBar, SafeAreaView, Modal, Animated, Linking, Share, Alert 
} from 'react-native';
import { db } from '../../api/firebaseConfig';
import { doc, getDoc, collection, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { auth } from '../../api/firebaseConfig';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';

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

  // ✅ New features
  const [isBookmarked, setIsBookmarked]     = useState(false);
  const [isSubscribed, setIsSubscribed]     = useState(false);
  const [appCount, setAppCount]             = useState(0);
  const [similarServices, setSimilarServices] = useState([]);
  const [bookmarkAnim]                      = useState(new Animated.Value(1));
  const userId = auth.currentUser?.uid;

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

        // ✅ App count
        try {
          const appsSnap = await getDocs(
            query(collection(db, 'service_applications'), where('serviceId', '==', jobId))
          );
          setAppCount(appsSnap.size);
        } catch {}

        // ✅ Similar services
        if (sSnap.exists()) {
          const sData = sSnap.data();
          try {
            const simSnap = await getDocs(
              query(collection(db, 'all_services'),
                where('category', '==', sData.category),
                where('mainMenu', '==', sData.mainMenu)
              )
            );
            const sim = simSnap.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter(s => s.id !== jobId && s.title !== data?.title)
              .slice(0, 3);
            setSimilarServices(sim);
          } catch {}
        }

        // ✅ Bookmark + Subscribe check
        if (userId) {
          try {
            const uSnap = await getDoc(doc(db, 'users', userId));
            if (uSnap.exists()) {
              const ud = uSnap.data();
              setIsBookmarked((ud.bookmarkedServices || []).includes(jobId));
              setIsSubscribed((ud.subscribedServices || []).includes(jobId));
            }
          } catch {}
        }

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

  // ✅ Header buttons — bookmark + share
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 }}>
          <TouchableOpacity onPress={toggleBookmark} style={{ padding: 8 }}>
            <Animated.View style={{ transform: [{ scale: bookmarkAnim }] }}>
              <MaterialCommunityIcons
                name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={24} color={isBookmarked ? '#FFD700' : '#fff'}
              />
            </Animated.View>
          </TouchableOpacity>
          <TouchableOpacity onPress={onShare} style={{ padding: 8 }}>
            <MaterialCommunityIcons name="share-variant" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [data, isBookmarked]);

  // ✅ Bookmark toggle
  const toggleBookmark = async () => {
    if (!userId) return;
    const newVal = !isBookmarked;
    setIsBookmarked(newVal);
    Animated.sequence([
      Animated.spring(bookmarkAnim, { toValue: 1.4, useNativeDriver: true, tension: 200 }),
      Animated.spring(bookmarkAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    try {
      const ref = doc(db, 'users', userId);
      const snap = await getDoc(ref);
      const current = snap.data()?.bookmarkedServices || [];
      await updateDoc(ref, {
        bookmarkedServices: newVal
          ? [...new Set([...current, jobId])]
          : current.filter(id => id !== jobId)
      });
    } catch {}
  };

  // ✅ Subscribe toggle
  const toggleSubscribe = async () => {
    if (!userId) return;
    const newVal = !isSubscribed;
    setIsSubscribed(newVal);
    try {
      const ref = doc(db, 'users', userId);
      const snap = await getDoc(ref);
      const current = snap.data()?.subscribedServices || [];
      await updateDoc(ref, {
        subscribedServices: newVal
          ? [...new Set([...current, jobId])]
          : current.filter(id => id !== jobId)
      });
      Alert.alert(
        newVal ? '🔔 Subscribed!' : '🔕 Unsubscribed',
        newVal ? 'Is service ke updates pe notification milegi!' : 'Notifications band kar di.'
      );
    } catch {}
  };

  const onShare = async () => {
    if (!data) return;
    const refCode = ''; // can add userData.referralCode later
    const appLink = `https://sewaone.in${refCode ? '?ref=' + refCode : ''}`;
    try {
      await Share.share({
        message: `🏛️ *${data.title}*\n\nSewaOne App se ghar baithe apply karo!\n\n📋 ${data.shortDesc || ''}\n\n👇 Download karo:\n${appLink}\n\n📱 _SewaOne — Har Sarkari Kaam, Ek Jagah_`
      });
    } catch {}
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

        {/* ✅ Social proof + Subscribe */}
        <View style={styles.socialRow}>
          {appCount > 0 && (
            <View style={styles.socialProof}>
              <MaterialCommunityIcons name="account-check" size={14} color="#6D28D9" />
              <Text style={styles.socialProofText}>
                {appCount >= 100 ? `${Math.floor(appCount/10)*10}+` : appCount} log apply kar chuke SewaOne se
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.subscribeBtn, isSubscribed && styles.subscribedBtn]}
            onPress={toggleSubscribe}
          >
            <MaterialCommunityIcons
              name={isSubscribed ? 'bell-check' : 'bell-plus-outline'}
              size={14} color={isSubscribed ? '#fff' : '#003366'}
            />
            <Text style={[styles.subscribeBtnText, isSubscribed && { color: '#fff' }]}>
              {isSubscribed ? 'Subscribed' : 'Get Updates'}
            </Text>
          </TouchableOpacity>
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
            <View style={styles.secHeadRow}>
              <View style={styles.secAccent} />
              <Text style={styles.sectionTitle}>{sec.heading}</Text>
            </View>
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
        {/* ✅ Similar Services — ScrollView ke end mein */}
        {similarServices.length > 0 && (
          <View style={styles.similarSection}>
            <View style={styles.secHeadRow}>
              <View style={styles.secAccent} />
              <Text style={styles.sectionTitle}>Similar Services</Text>
            </View>
            {similarServices.map(s => (
              <TouchableOpacity
                key={s.id}
                style={styles.similarCard}
                onPress={() => navigation.replace('ServiceDetails', { jobId: s.id })}
                activeOpacity={0.85}
              >
                <View style={styles.similarIcon}>
                  <MaterialCommunityIcons name="bank-outline" size={18} color="#003366" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.similarName} numberOfLines={2}>{s.title}</Text>
                  <Text style={styles.similarFee}>
                    {s.isSmartFee ? 'Fee: Category-wise' : `₹${(s.officialFee||0)+(s.serviceFee||0)}`}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#94A3B8" />
              </TouchableOpacity>
            ))}
          </View>
        )}
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

      {/* Footer */}
      <View style={styles.footer}>
        {/* Apply — full width prominent */}
        <TouchableOpacity
          disabled={isFeePending}
          style={[styles.applyBtn, isFeePending && { backgroundColor: '#94A3B8' }]}
          onPress={() => navigation.navigate('ServiceWizard', { serviceId: data.id, serviceData: data })}
        >
          <MaterialCommunityIcons name="send-circle" size={20} color="#fff" />
          <Text style={styles.applyBtnText}>
            {isFeePending ? 'PEHLE FEE CHECK KARO' : 'APPLY NOW'}
          </Text>
        </TouchableOpacity>

        {/* Other buttons — row mein compact side by side */}
        {(data?.buttons?.filter(b => b.show && !b.name.toLowerCase().includes('apply')) || []).length > 0 && (
          <View style={styles.otherBtnsRow}>
            {data.buttons.filter(b => b.show && !b.name.toLowerCase().includes('apply')).map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={styles.otherBtnSmall}
                onPress={() => btn.url && Linking.openURL(btn.url)}
              >
                <MaterialCommunityIcons
                  name={btn.name.toLowerCase().includes('download') ? 'download-outline'
                    : btn.name.toLowerCase().includes('official') ? 'web'
                    : 'open-in-new'}
                  size={15} color="#003366"
                />
                <Text style={styles.otherBtnSmallText} numberOfLines={1}>{btn.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F4FF' },

  // Header
  header: {
    backgroundColor: '#002855',
    padding: 22,
    paddingTop: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 6,
  },
  headerCat: { color: '#93C5FD', fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '900', lineHeight: 27, marginBottom: 8 },
  headerDesc: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 20 },

  // Social + Subscribe row
  socialRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, flexWrap: 'wrap', gap: 6, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  socialProof: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  socialProofText: { fontSize: 11, color: '#6D28D9', fontWeight: '700' },
  subscribeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#002855', backgroundColor: '#fff' },
  subscribedBtn: { backgroundColor: '#002855', borderColor: '#002855' },
  subscribeBtnText: { fontSize: 12, fontWeight: '800', color: '#002855' },

  // Fee card
  feeCard: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 14, marginBottom: 8, padding: 18, borderRadius: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06 },
  highlightCard: { borderWidth: 2, borderColor: '#F59E0B' },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#002855', marginBottom: 14 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  feeLabel: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  feeVal: { color: '#1E293B', fontWeight: '800', fontSize: 14 },
  checkBtn: { backgroundColor: '#F59E0B', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  checkBtnText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  divider: { height: 1.5, backgroundColor: '#EBF5FB', marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  totalLabel: { fontWeight: '900', color: '#002855', fontSize: 15 },
  catSubText: { fontSize: 10, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  totalAmount: { fontWeight: '900', fontSize: 26, color: '#10B981' },

  // Info sections
  infoSection: { paddingHorizontal: 16, marginBottom: 6 },
  secHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  secAccent: { width: 4, height: 18, backgroundColor: '#002855', borderRadius: 2 },
  fieldBox: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 8, overflow: 'hidden', elevation: 1 },
  textRowInline: { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', alignItems: 'flex-start' },
  fieldLabelText: { fontSize: 12, fontWeight: '700', color: '#64748B', flex: 0.42, marginRight: 8 },
  fieldValueText: { fontSize: 13, color: '#1E293B', flex: 0.58, fontWeight: '600', lineHeight: 19 },

  // Table
  table: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 2 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#002855', paddingVertical: 10, paddingHorizontal: 8 },
  th: { flex: 1, color: '#fff', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  td: { flex: 1, fontSize: 11, textAlign: 'center', color: '#475569', fontWeight: '500' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '80%' },
  modalHeader: { fontSize: 18, fontWeight: '900', color: '#002855', marginBottom: 20, textAlign: 'center' },
  dropGroup: { marginBottom: 20 },
  dropLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  selRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  selBtnActive: { backgroundColor: '#002855', borderColor: '#002855' },
  selTxt: { fontWeight: '700', color: '#475569', fontSize: 13 },
  selTxtActive: { color: '#fff' },
  calcFinalBtn: { backgroundColor: '#10B981', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  calcFinalTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },

  // Footer
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 10, elevation: 8 },
  dynamicBtn: { padding: 15, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  applyColor: { backgroundColor: '#002855' },
  otherColor: { backgroundColor: '#475569' },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  applyBtn: { backgroundColor: '#002855', padding: 17, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  applyBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // Similar
  similarSection: { paddingHorizontal: 16, marginBottom: 10, marginTop: 6 },
  similarTitle: { fontSize: 15, fontWeight: '900', color: '#1E293B', marginBottom: 10 },
  similarCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9', elevation: 1 },
  similarIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#EBF5FB', justifyContent: 'center', alignItems: 'center' },
  similarName: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
  similarFee: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },

  // Footer
  otherBtnsRow: { flexDirection: 'row', gap: 10 },
  otherBtnSmall: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  otherBtnSmallText: { fontSize: 12, fontWeight: '700', color: '#003366' },
});
