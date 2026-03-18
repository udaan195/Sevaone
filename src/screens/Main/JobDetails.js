import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Share, Linking, Alert, Modal, ActivityIndicator,
  Animated, BackHandler, FlatList
} from 'react-native';
import { db, auth } from '../../api/firebaseConfig';
import {
  doc, getDoc, setDoc, updateDoc,
  query, where, getDocs, collection,
  increment, onSnapshot, limit, orderBy
} from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function JobDetails({ route, navigation }) {
  const { job, jobId } = route.params || {};
  const [jobData, setJobData]         = useState(job || null);
  const [loading, setLoading]         = useState(!job);
  const [eligibilityStatus, setEligibilityStatus] = useState('unchecked');
  const [hasApplied, setHasApplied]   = useState(false);
  const [answers, setAnswers]         = useState({});
  const [selectedUrl, setSelectedUrl] = useState('');
  const [userData, setUserData]       = useState({});

  // ── New feature states ────────────────────────────────────
  const [isBookmarked, setIsBookmarked]       = useState(false);
  const [isSubscribed, setIsSubscribed]       = useState(false);
  const [appCount, setAppCount]               = useState(0);
  const [similarJobs, setSimilarJobs]         = useState([]);
  const [vacancyCount, setVacancyCount]       = useState('');
  const [bookmarkAnim]                        = useState(new Animated.Value(1));

  // ── Modal states ──────────────────────────────────────────
  const [showEligibilityModal, setShowEligibilityModal] = useState(false);
  const [showApplyOptions, setShowApplyOptions]         = useState(false);
  const [showConsent, setShowConsent]                   = useState(false);
  const [showSimilar, setShowSimilar]                   = useState(false);

  const resultAnim = useRef(new Animated.Value(0)).current;
  const userId = auth.currentUser?.uid;

  // ── Fetch job ─────────────────────────────────────────────
  useEffect(() => {
    if (!jobData && jobId) {
      getDoc(doc(db, 'gov_jobs', jobId))
        .then(snap => { if (snap.exists()) setJobData({ id: snap.id, ...snap.data() }); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [jobId]);

  // ── Main data fetch ───────────────────────────────────────
  useEffect(() => {
    if (!userId || !jobData) return;
    const jId = jobData.id;

    const fetchAll = async () => {
      try {
        // User profile
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (userSnap.exists()) {
          const d = userSnap.data();
          setUserData(d);
          const profile = d.profileEligibility || {};
          setAnswers(prev => ({ ...prev, ...profile }));
          if (jobData.eligibilityQuestions?.length > 0) {
            const eligible = jobData.eligibilityQuestions.every(q => profile[q.question] === 'Yes');
            if (eligible) setEligibilityStatus('eligible');
          }
          // Bookmark check
          setIsBookmarked((d.bookmarkedJobs || []).includes(jId));
          // Subscribe check
          setIsSubscribed((d.subscribedJobs || []).includes(jId));
        }

        // Already applied
        const appsSnap = await getDocs(
          query(collection(db, 'applications'), where('userId', '==', userId), where('jobId', '==', jId))
        );
        if (!appsSnap.empty) setHasApplied(true);

        // ✅ Application count — SewaOne social proof
        const countSnap = await getDocs(
          query(collection(db, 'applications'), where('jobId', '==', jId))
        );
        setAppCount(countSnap.size);

        // ✅ Vacancy count from sections
        extractVacancy(jobData.sections || []);

        // ✅ Similar jobs
        if (jobData.conductedBy) {
          const simSnap = await getDocs(
            query(collection(db, 'gov_jobs'),
              where('conductedBy', '==', jobData.conductedBy),
              orderBy('createdAt', 'desc'),
              limit(5)
            )
          );
          const sim = simSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(j => j.id !== jId);
          setSimilarJobs(sim.slice(0, 4));
        }
      } catch (e) { }
    };
    fetchAll();
  }, [userId]);

  // ── Extract vacancy from sections ─────────────────────────
  const extractVacancy = (sections) => {
    for (const sec of sections) {
      for (const f of sec.fields || []) {
        const lbl = f.label?.toLowerCase() || '';
        if (lbl.includes('vacancy') || lbl.includes('post') || lbl.includes('total')) {
          if (f.value && /\d/.test(f.value)) {
            setVacancyCount(f.value);
            return;
          }
        }
        // Check table rows for total
        if (f.type === 'table') {
          const totalRow = (f.rows || []).find(r =>
            Object.values(r).some(v => String(v).toLowerCase().includes('total'))
          );
          if (totalRow) {
            const vals = Object.values(totalRow).filter(v => /^\d+$/.test(String(v)));
            if (vals.length) { setVacancyCount(vals[vals.length - 1]); return; }
          }
        }
      }
    }
  };

  // ── Last date ─────────────────────────────────────────────
  const getLastDate = () => {
    for (const sec of jobData?.sections || []) {
      for (const f of sec.fields || []) {
        if (f.label?.toLowerCase().includes('last date') || f.label?.toLowerCase().includes('last day')) {
          return f.value;
        }
      }
    }
    return null;
  };

  // ── Header with share + bookmark ─────────────────────────
  useEffect(() => {
    if (!jobData) return;
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
  }, [jobData, isBookmarked]);

  // ── Android back ──────────────────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showSimilar) { setShowSimilar(false); return true; }
      if (showConsent) { setShowConsent(false); return true; }
      if (showApplyOptions) { setShowApplyOptions(false); return true; }
      if (showEligibilityModal) { setShowEligibilityModal(false); return true; }
      return false;
    });
    return () => sub.remove();
  }, [showSimilar, showConsent, showApplyOptions, showEligibilityModal]);

  // ── ✅ Bookmark toggle ────────────────────────────────────
  const toggleBookmark = async () => {
    if (!userId) return;
    const newVal = !isBookmarked;
    setIsBookmarked(newVal);

    // Spring animation
    Animated.sequence([
      Animated.spring(bookmarkAnim, { toValue: 1.4, useNativeDriver: true, tension: 200 }),
      Animated.spring(bookmarkAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();

    try {
      const ref = doc(db, 'users', userId);
      const snap = await getDoc(ref);
      const current = snap.data()?.bookmarkedJobs || [];
      const updated = newVal
        ? [...new Set([...current, jobData.id])]
        : current.filter(id => id !== jobData.id);
      await updateDoc(ref, { bookmarkedJobs: updated });
      Alert.alert(
        newVal ? '🔖 Saved!' : 'Removed',
        newVal ? 'Job saved kari. Profile > Saved Jobs mein dekho.' : 'Bookmark hata diya.'
      );
    } catch {}
  };

  // ── ✅ Notification subscribe ─────────────────────────────
  const toggleSubscribe = async () => {
    if (!userId) return;
    const newVal = !isSubscribed;
    setIsSubscribed(newVal);
    try {
      const ref = doc(db, 'users', userId);
      const snap = await getDoc(ref);
      const current = snap.data()?.subscribedJobs || [];
      const updated = newVal
        ? [...new Set([...current, jobData.id])]
        : current.filter(id => id !== jobData.id);
      await updateDoc(ref, { subscribedJobs: updated });
      Alert.alert(
        newVal ? '🔔 Subscribed!' : '🔕 Unsubscribed',
        newVal
          ? 'Jab bhi is job ka result, admit card ya update aayega — notification milegi!'
          : 'Is job ki notifications band kar di.'
      );
    } catch {}
  };

  // ── Smart share ────────────────────────────────────────────
  const onShare = async () => {
    try {
      const category  = jobData.category || 'latest-jobs';
      const title     = jobData.title || '';
      const org       = jobData.conductedBy || '';
      const refCode   = userData?.referralCode || '';
      const lastDate  = getLastDate();
      const appLink   = `https://sewaone.in${refCode ? `?ref=${refCode}` : ''}`;
      const vacLine   = vacancyCount ? `📊 Total Posts: *${vacancyCount}*` : '';
      const refLine   = refCode ? `\n🎁 Refer code: *${refCode}* — dono ko ₹50 milenge!` : '';

      const msgs = {
        'admit-card': `🎫 *ADMIT CARD JARI HO GAYA!* 🎫\n\n📋 *${title}*\n🏛️ ${org}\n${vacLine ? vacLine + '\n' : ''}\n✅ Admit Card ab available hai!\n📲 SewaOne App se turant download karo\n${lastDate ? `⏰ Last Date: ${lastDate}\n` : ''}\n👇 *Abhi download karo:*\n${appLink}\n\n📱 _SewaOne — Har Sarkari Kaam, Ek Jagah_${refLine}`,

        'result': `🏆 *RESULT DECLARED!* 🏆\n\n📋 *${title}*\n🏛️ ${org}\n\n🎯 Result aa gaya — seedha check karo!\n📲 SewaOne App pe free mein dekho\n\n👇 *Result yahan:*\n${appLink}\n\n📱 _SewaOne — Free Download_${refLine}`,

        'answer-key': `🔑 *ANSWER KEY JARI!* 🔑\n\n📋 *${title}*\n🏛️ ${org}\n\n📝 Answer Key release ho gayi\n⏳ Objection window khuli hai — abhi check karo!\n\n👇 *Dekho yahan:*\n${appLink}\n\n📱 _SewaOne App — Bilkul Free_${refLine}`,

        'latest-jobs': `🚨 *SARKARI NAUKRI ALERT!* 🚨\n\n💼 *${title}*\n🏛️ By: ${org}\n${vacLine ? vacLine + '\n' : ''}${lastDate ? `📅 Last Date: *${lastDate}*\n` : ''}\n✅ SewaOne se apply karo — FREE service!\n🔔 Notification ke liye app download karo\n\n👇 *Apply karo yahan:*\n${appLink}\n\n📱 _SewaOne — Har Sarkari Kaam Aasaan_${refLine}`,
      };

      await Share.share({ message: msgs[category] || msgs['latest-jobs'] });
    } catch {}
  };

  // ── Eligibility submit ─────────────────────────────────────
  const submitEligibility = async () => {
    if (!jobData.eligibilityQuestions?.length) return;
    const allYes = jobData.eligibilityQuestions.every(q => answers[q.question] === 'Yes');
    setEligibilityStatus(allYes ? 'eligible' : 'not-eligible');
    setShowEligibilityModal(false);
    Animated.spring(resultAnim, { toValue: 1, useNativeDriver: true }).start();
    if (userId) await setDoc(doc(db, 'users', userId), { profileEligibility: answers }, { merge: true });
    if (!allYes) Alert.alert('❌ Not Eligible', 'Profile update karke dobara check karein.');
  };

  // ── Apply process ─────────────────────────────────────────
  const startSewaOneProcess = () => {
    setShowApplyOptions(false);
    if (eligibilityStatus === 'eligible') setShowConsent(true);
    else if (eligibilityStatus === 'not-eligible') Alert.alert('Not Eligible', 'Pehle eligibility verify karein.');
    else Alert.alert('Eligibility Check', 'Aapne eligibility verify nahi ki. Continue karein?', [
      { text: 'Check First', onPress: () => setShowEligibilityModal(true) },
      { text: 'Continue', onPress: () => setShowConsent(true) }
    ]);
  };

  // ── Loading / Error ───────────────────────────────────────
  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color="#003366" />
      <Text style={s.loadingText}>Job details load ho rahi hain...</Text>
    </View>
  );
  if (!jobData) return (
    <View style={s.center}>
      <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#CBD5E1" />
      <Text style={s.errorText}>Job details nahi mili</Text>
      <TouchableOpacity style={s.retryBtn} onPress={() => navigation.goBack()}>
        <Text style={s.retryText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  const lastDate = getLastDate();

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerTop}>
            <View style={s.orgBadge}>
              <MaterialCommunityIcons name="bank-outline" size={18} color="#003366" />
            </View>
            <Text style={s.conductedBy} numberOfLines={1}>{jobData.conductedBy}</Text>
          </View>

          <Text style={s.mainTitle}>{jobData.title}</Text>
          {jobData.mainDesc ? <Text style={s.shortDesc}>{jobData.mainDesc}</Text> : null}

          {/* ✅ Badges row */}
          <View style={s.badgesRow}>
            {/* Vacancy count */}
            {vacancyCount ? (
              <View style={[s.badge, { backgroundColor: '#EBF5FB' }]}>
                <MaterialCommunityIcons name="account-group" size={12} color="#1a5276" />
                <Text style={[s.badgeText, { color: '#1a5276' }]}>{vacancyCount} Posts</Text>
              </View>
            ) : null}

            {/* Last date */}
            {lastDate ? (
              <View style={[s.badge, { backgroundColor: '#FEF2F2' }]}>
                <MaterialCommunityIcons name="calendar-clock" size={12} color="#B91C1C" />
                <Text style={[s.badgeText, { color: '#B91C1C' }]}>Last: {lastDate}</Text>
              </View>
            ) : null}

            {/* Already applied */}
            {hasApplied && (
              <View style={[s.badge, { backgroundColor: '#ECFDF5' }]}>
                <MaterialCommunityIcons name="check-circle" size={12} color="#166534" />
                <Text style={[s.badgeText, { color: '#166534' }]}>Applied</Text>
              </View>
            )}
          </View>

          {/* ✅ Social proof + Subscribe row */}
          <View style={s.socialRow}>
            {/* Application count */}
            {appCount > 0 && (
              <View style={s.socialProof}>
                <MaterialCommunityIcons name="account-check" size={14} color="#6D28D9" />
                <Text style={s.socialProofText}>
                  {appCount >= 100
                    ? `${Math.floor(appCount / 10) * 10}+ log apply kar chuke hain`
                    : `${appCount} log apply kar chuke hain`
                  } SewaOne se
                </Text>
              </View>
            )}

            {/* ✅ Notification Subscribe button */}
            <TouchableOpacity
              style={[s.subscribeBtn, isSubscribed && s.subscribedBtn]}
              onPress={toggleSubscribe}
            >
              <MaterialCommunityIcons
                name={isSubscribed ? 'bell-check' : 'bell-plus-outline'}
                size={14}
                color={isSubscribed ? '#fff' : '#003366'}
              />
              <Text style={[s.subscribeBtnText, isSubscribed && { color: '#fff' }]}>
                {isSubscribed ? 'Subscribed' : 'Get Updates'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ✅ Eligibility banner */}
        {jobData.isEligibilityEnabled && eligibilityStatus !== 'unchecked' && (
          <Animated.View style={[
            s.eligibilityBanner,
            {
              backgroundColor: eligibilityStatus === 'eligible' ? '#ECFDF5' : '#FEF2F2',
              transform: [{ scale: resultAnim.interpolate({ inputRange: [0,1], outputRange: [0.95, 1] }) }]
            }
          ]}>
            <MaterialCommunityIcons
              name={eligibilityStatus === 'eligible' ? 'check-decagram' : 'close-circle'}
              size={24}
              color={eligibilityStatus === 'eligible' ? '#10B981' : '#EF4444'}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[s.eligBannerTitle, { color: eligibilityStatus === 'eligible' ? '#166534' : '#B91C1C' }]}>
                {eligibilityStatus === 'eligible' ? '✅ Aap Eligible Hain!' : '❌ Not Eligible'}
              </Text>
              <Text style={[s.eligBannerSub, { color: eligibilityStatus === 'eligible' ? '#10B981' : '#EF4444' }]}>
                {eligibilityStatus === 'eligible' ? 'Aap is job ke liye apply kar sakte hain' : 'Profile update karke dobara check karein'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowEligibilityModal(true)}>
              <Text style={{ color: '#003366', fontWeight: '700', fontSize: 12 }}>Re-check</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Dynamic Sections ── */}
        {(jobData.sections || []).map((sec, sIdx) => (
          <View key={sIdx} style={s.sectionBox}>
            <View style={s.sectionHeadRow}>
              <View style={s.sectionAccent} />
              <Text style={s.sectionHeading}>{sec.heading}</Text>
            </View>
            {(sec.fields || []).map((field, fIdx) => (
              <View key={fIdx} style={s.fieldWrapper}>
                {field.type === 'table' ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={s.tableContainer}>
                      <View style={s.tableHeaderRow}>
                        {field.headers.map((h, i) => <Text key={i} style={s.tableHeaderText}>{h}</Text>)}
                      </View>
                      {(field.rows || []).map((row, i) => (
                        <View key={i} style={[s.tableRow, { backgroundColor: i % 2 === 0 ? '#F8FAFC' : '#fff' }]}>
                          {field.headers.map((_, hI) => <Text key={hI} style={s.tableCell}>{row[`c${hI}`]}</Text>)}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                ) : field.type === 'media' ? (
                  <View style={s.mediaRow}>
                    <Text style={s.fieldLabel}>{field.label}</Text>
                    <TouchableOpacity style={s.viewMediaBtn} onPress={() => Linking.openURL(field.value)}>
                      <MaterialCommunityIcons name="file-eye-outline" size={15} color="#003366" />
                      <Text style={s.viewMediaText}>VIEW</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={s.textRow}>
                    <Text style={s.fieldLabel}>{field.label}:</Text>
                    <Text style={s.fieldValue}>{field.value}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        ))}

        {/* ── Eligibility check button ── */}
        {jobData.isEligibilityEnabled && (
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <TouchableOpacity
              style={[s.checkBtn, eligibilityStatus === 'eligible' && { backgroundColor: '#10B981' }]}
              onPress={() => {
                if (eligibilityStatus === 'eligible') {
                  Alert.alert('Already Verified ✅', 'Dobara check karna chahte hain?', [
                    { text: 'No', style: 'cancel' },
                    { text: 'Re-check', onPress: () => setShowEligibilityModal(true) }
                  ]);
                } else setShowEligibilityModal(true);
              }}
            >
              <MaterialCommunityIcons
                name={eligibilityStatus === 'eligible' ? 'check-decagram' : 'clipboard-check-outline'}
                size={20} color="#fff"
              />
              <Text style={s.checkBtnText}>
                {eligibilityStatus === 'eligible' ? 'ELIGIBILITY VERIFIED ✅' : 'CHECK ELIGIBILITY'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Download/other buttons ── */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          {(jobData.buttons || []).filter(b => b.show && !b.name.toLowerCase().includes('apply')).map((btn, i) => (
            <TouchableOpacity key={i} style={s.otherBtn} onPress={() => btn.url && Linking.openURL(btn.url)}>
              <MaterialCommunityIcons name="open-in-new" size={16} color="#003366" />
              <Text style={s.otherBtnText}>{btn.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ✅ Similar Jobs section */}
        {similarJobs.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <View style={s.similarHeader}>
              <Text style={s.similarTitle}>Similar Jobs</Text>
              {similarJobs.length > 2 && (
                <TouchableOpacity onPress={() => setShowSimilar(true)}>
                  <Text style={s.seeAllText}>See All ({similarJobs.length})</Text>
                </TouchableOpacity>
              )}
            </View>
            {similarJobs.slice(0, 2).map(j => (
              <TouchableOpacity
                key={j.id}
                style={s.similarCard}
                onPress={() => navigation.replace('JobDetails', { jobId: j.id })}
                activeOpacity={0.85}
              >
                <View style={s.similarIcon}>
                  <MaterialCommunityIcons name="briefcase-variant" size={18} color="#003366" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.similarJobTitle} numberOfLines={1}>{j.title}</Text>
                  <Text style={s.similarJobOrg} numberOfLines={1}>{j.conductedBy}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#94A3B8" />
              </TouchableOpacity>
            ))}
          </View>
        )}

      </ScrollView>

      {/* ✅ Sticky footer */}
      <View style={s.stickyFooter}>
        {hasApplied ? (
          <View style={s.alreadyAppliedRow}>
            <MaterialCommunityIcons name="check-circle" size={18} color="#10B981" />
            <Text style={s.alreadyAppliedText}>Applied — Track in Applications</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={s.applyBtn}
            onPress={() => {
              const applyBtn = (jobData.buttons || []).find(b => b.name.toLowerCase().includes('apply'));
              setSelectedUrl(applyBtn?.url || '');
              setShowApplyOptions(true);
            }}
          >
            <MaterialCommunityIcons name="send" size={20} color="#fff" />
            <Text style={s.applyBtnText}>APPLY NOW</Text>
          </TouchableOpacity>
        )}
        <View style={s.verifiedRow}>
          <MaterialCommunityIcons name="shield-check" size={13} color="#10B981" />
          <Text style={s.verifiedText}>Verified by SewaOne</Text>
        </View>
      </View>

      {/* ── Modals ── */}

      {/* Apply Options */}
      <Modal visible={showApplyOptions} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.optionSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.modalTitle}>Apply Kaise Karna Chahte Hain?</Text>
            <TouchableOpacity
              style={[s.optBtn, { borderColor: '#E2E8F0', borderWidth: 1.5, backgroundColor: '#F8FAFC' }]}
              onPress={() => { setShowApplyOptions(false); selectedUrl && Linking.openURL(selectedUrl); }}
            >
              <MaterialCommunityIcons name="web" size={22} color="#003366" />
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text style={[s.optBtnTitle, { color: '#003366' }]}>Khud Apply Karein</Text>
                <Text style={s.optBtnSub}>Official website pe redirect hoga</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity style={[s.optBtn, { backgroundColor: '#003366' }]} onPress={startSewaOneProcess}>
              <MaterialCommunityIcons name="account-tie" size={22} color="#FFD700" />
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text style={[s.optBtnTitle, { color: '#fff' }]}>SewaOne Team se Apply Karwao</Text>
                <Text style={[s.optBtnSub, { color: '#94A3B8' }]}>Expert team form bharegi aapke liye</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#4A90D9" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowApplyOptions(false)} style={s.cancelBtn}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Consent */}
      <Modal visible={showConsent} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.consentSheet}>
            <View style={s.sheetHandle} />
            <MaterialCommunityIcons name="shield-account" size={45} color="#003366" style={{ alignSelf: 'center', marginBottom: 10 }} />
            <Text style={s.modalTitle}>SewaOne Service Consent</Text>
            <ScrollView style={s.termsBox} showsVerticalScrollIndicator={false}>
              <Text style={s.termsText}>{`✅ Main SewaOne team ko apni taraf se form bharne ki anumati deta/deti hoon.\n\n✅ Mere dwara di gayi jankari sahi hai.\n\n✅ Service charges wallet se kaate jayenge.\n\n✅ SewaOne sirf form fill karne mein madad karta hai — selection guarantee nahi hai.`}</Text>
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={[s.consentBtn, { backgroundColor: '#10B981' }]}
                onPress={() => {
                  setShowConsent(false);
                  navigation.navigate('ApplyWizard', { jobId: jobData.id, jobTitle: jobData.title });
                }}
              >
                <MaterialCommunityIcons name="check" size={18} color="#fff" />
                <Text style={s.consentBtnText}>I ACCEPT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.consentBtn, { backgroundColor: '#F1F5F9' }]} onPress={() => setShowConsent(false)}>
                <Text style={[s.consentBtnText, { color: '#64748B' }]}>DECLINE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Eligibility */}
      <Modal visible={showEligibilityModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.eligModal}>
            <View style={s.sheetHandle} />
            <Text style={s.modalTitle}>Eligibility Check</Text>
            <Text style={{ color: '#64748B', textAlign: 'center', marginBottom: 20, fontSize: 13 }}>
              Sach sach jawab dein — profile mein save hoga
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(jobData.eligibilityQuestions || []).map((q, i) => (
                <View key={i} style={s.qCard}>
                  <Text style={s.qText}>{i + 1}. {q.question}</Text>
                  <View style={s.ansRow}>
                    <TouchableOpacity
                      style={[s.ansBtn, answers[q.question] === 'Yes' && s.ansBtnYes]}
                      onPress={() => setAnswers({ ...answers, [q.question]: 'Yes' })}
                    >
                      <MaterialCommunityIcons name="check-circle" size={18} color={answers[q.question] === 'Yes' ? '#fff' : '#64748B'} />
                      <Text style={[s.ansBtnText, answers[q.question] === 'Yes' && { color: '#fff' }]}>Yes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.ansBtn, answers[q.question] === 'No' && s.ansBtnNo]}
                      onPress={() => setAnswers({ ...answers, [q.question]: 'No' })}
                    >
                      <MaterialCommunityIcons name="close-circle" size={18} color={answers[q.question] === 'No' ? '#fff' : '#64748B'} />
                      <Text style={[s.ansBtnText, answers[q.question] === 'No' && { color: '#fff' }]}>No</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.submitEligBtn} onPress={submitEligibility}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>SUBMIT & CHECK</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowEligibilityModal(false)} style={{ padding: 12 }}>
              <Text style={{ textAlign: 'center', color: '#94A3B8', fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Similar Jobs Full Modal */}
      <Modal visible={showSimilar} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.optionSheet, { maxHeight: '80%' }]}>
            <View style={s.sheetHandle} />
            <Text style={s.modalTitle}>Similar Jobs ({similarJobs.length})</Text>
            <FlatList
              data={similarJobs}
              keyExtractor={j => j.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.similarCard, { marginBottom: 10 }]}
                  onPress={() => { setShowSimilar(false); navigation.replace('JobDetails', { jobId: item.id }); }}
                >
                  <View style={s.similarIcon}>
                    <MaterialCommunityIcons name="briefcase-variant" size={18} color="#003366" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.similarJobTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={s.similarJobOrg}>{item.conductedBy}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setShowSimilar(false)} style={s.cancelBtn}>
              <Text style={s.cancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 30 },
  loadingText: { marginTop: 16, color: '#64748B', fontWeight: '600' },
  errorText: { fontSize: 16, fontWeight: '700', color: '#94A3B8', marginTop: 16 },
  retryBtn: { marginTop: 20, backgroundColor: '#003366', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '700' },

  header: { backgroundColor: '#fff', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  orgBadge: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#EBF5FB', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  conductedBy: { fontSize: 13, color: '#64748B', fontWeight: '700', flex: 1 },
  mainTitle: { fontSize: 20, fontWeight: '900', color: '#003366', lineHeight: 27 },
  shortDesc: { fontSize: 13, color: '#475569', marginTop: 10, lineHeight: 20 },

  // Badges
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '800' },

  // Social proof + subscribe
  socialRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, flexWrap: 'wrap', gap: 8 },
  socialProof: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  socialProofText: { fontSize: 11, color: '#6D28D9', fontWeight: '700' },
  subscribeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#003366' },
  subscribedBtn: { backgroundColor: '#003366', borderColor: '#003366' },
  subscribeBtnText: { fontSize: 12, fontWeight: '800', color: '#003366' },

  // Eligibility banner
  eligibilityBanner: { margin: 16, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  eligBannerTitle: { fontWeight: '800', fontSize: 14 },
  eligBannerSub: { fontSize: 12, marginTop: 2 },

  // Sections
  sectionBox: { margin: 12, backgroundColor: '#fff', borderRadius: 16, padding: 18, elevation: 1 },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  sectionAccent: { width: 4, height: 18, backgroundColor: '#003366', borderRadius: 2, marginRight: 10 },
  sectionHeading: { fontSize: 14, fontWeight: '900', color: '#003366', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldWrapper: { marginBottom: 10 },
  textRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#334155', flex: 0.42, marginRight: 10 },
  fieldValue: { fontSize: 13, color: '#475569', flex: 0.58, lineHeight: 19 },
  mediaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  viewMediaBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EBF5FB', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  viewMediaText: { fontSize: 12, fontWeight: '800', color: '#003366' },
  tableContainer: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, overflow: 'hidden', minWidth: 320 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#003366', padding: 10 },
  tableHeaderText: { flex: 1, color: '#fff', fontWeight: '800', fontSize: 12, textAlign: 'center' },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#E2E8F0', padding: 10 },
  tableCell: { flex: 1, fontSize: 12, textAlign: 'center', color: '#475569' },

  // Eligibility check button
  checkBtn: { backgroundColor: '#F59E0B', padding: 14, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  checkBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  otherBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 10 },
  otherBtnText: { color: '#003366', fontWeight: '700', fontSize: 14 },

  // Similar jobs
  similarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  similarTitle: { fontSize: 16, fontWeight: '900', color: '#1E293B' },
  seeAllText: { fontSize: 12, fontWeight: '800', color: '#003366' },
  similarCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9', elevation: 1 },
  similarIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#EBF5FB', justifyContent: 'center', alignItems: 'center' },
  similarJobTitle: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
  similarJobOrg: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },

  // Sticky footer
  stickyFooter: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9', elevation: 8 },
  applyBtn: { backgroundColor: '#003366', padding: 17, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 8 },
  applyBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  alreadyAppliedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, backgroundColor: '#ECFDF5', borderRadius: 14, marginBottom: 8 },
  alreadyAppliedText: { color: '#166534', fontWeight: '700', fontSize: 13 },
  verifiedRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
  verifiedText: { fontSize: 11, color: '#10B981', fontWeight: '700' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#003366', textAlign: 'center', marginBottom: 16 },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelText: { color: '#94A3B8', fontWeight: '700' },
  optionSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  optBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 12 },
  optBtnTitle: { fontWeight: '800', fontSize: 15 },
  optBtnSub: { fontSize: 12, marginTop: 2, color: '#64748B' },
  consentSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, maxHeight: '85%' },
  termsBox: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 16, maxHeight: 200, marginBottom: 4 },
  termsText: { fontSize: 13, lineHeight: 22, color: '#475569' },
  consentBtn: { flex: 1, padding: 16, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  consentBtnText: { fontWeight: '800', fontSize: 14, color: '#fff' },
  eligModal: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, maxHeight: '85%' },
  qCard: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  qText: { fontSize: 14, fontWeight: '700', color: '#1E293B', lineHeight: 21, marginBottom: 12 },
  ansRow: { flexDirection: 'row', gap: 12 },
  ansBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  ansBtnYes: { backgroundColor: '#10B981', borderColor: '#10B981' },
  ansBtnNo: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  ansBtnText: { fontWeight: '800', fontSize: 14, color: '#64748B' },
  submitEligBtn: { backgroundColor: '#003366', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 8 },
});
