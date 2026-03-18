// ============================================================
// FILE: src/screens/Main/RecommendedScreen.js
// ADVANCED FEATURES:
//   ✅ letterSpacing bug fix (string → number)
//   ✅ Match breakdown — har question ka status
//   ✅ "Check Eligibility" button — seedha JobDetails pe open
//   ✅ Smart notification — new matching job aaya to alert
//   ✅ Eligibility improvement tips
//   ✅ Match score breakdown popup
//   ✅ Pagination + Pull to refresh
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl,
  Modal, ScrollView, Animated
} from 'react-native';
import { db, auth } from '../../api/firebaseConfig';
import {
  collection, getDocs, query, where, doc,
  getDoc, orderBy, limit, startAfter, onSnapshot
} from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';

const PAGE_SIZE = 10;

// ── Calculate match details ───────────────────────────────
const calcMatch = (job, profile) => {
  const questions = job.eligibilityQuestions || [];
  if (!questions.length) return null;

  let matchCount = 0, mismatchCount = 0, unknownCount = 0;
  const details = questions.map(q => {
    const ans = profile[q.question];
    if (ans === 'Yes') { matchCount++; return { q: q.question, status: 'yes' }; }
    if (ans === 'No')  { mismatchCount++; return { q: q.question, status: 'no' }; }
    unknownCount++;
    return { q: q.question, status: 'unknown' };
  });

  if (mismatchCount > 3) return null;

  const matchPercent = Math.round((matchCount / questions.length) * 100);
  return { matchPercent, matchCount, mismatchCount, unknownCount, total: questions.length, details };
};

export default function RecommendedScreen({ navigation }) {
  const { theme } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [perfectMatches, setPerfectMatches] = useState([]);
  const [potentialMatches, setPotentialMatches] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [userProfile, setUserProfile] = useState({});
  const [appliedJobIds, setAppliedJobIds] = useState([]);
  const [selectedJobDetail, setSelectedJobDetail] = useState(null);
  const [newMatchAlert, setNewMatchAlert] = useState(null);
  const userId = auth.currentUser?.uid;
  const alertAnim = useRef(new Animated.Value(-100)).current;
  const processedJobIds = useRef(new Set());

  // ── Initial load ──────────────────────────────────────────
  useEffect(() => {
    fetchInitial();
  }, []);

  const fetchInitial = async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [userSnap, appSnap] = await Promise.all([
        getDoc(doc(db, 'users', userId)),
        getDocs(query(collection(db, 'applications'), where('userId', '==', userId)))
      ]);
      const profile = userSnap.exists() ? userSnap.data().profileEligibility || {} : {};
      const applied = appSnap.docs.map(d => d.data().jobId);
      setUserProfile(profile);
      setAppliedJobIds(applied);
      await fetchJobsPage(profile, applied, null, true);
    } catch (e) {
      // removed;
    } finally {
      setLoading(false);
    }
  };

  // ── Real-time new job watcher — notification style ────────
  useEffect(() => {
    if (!userId || Object.keys(userProfile).length === 0) return;

    // Watch for new jobs added in last 24 hours
    const yesterday = new Date(Date.now() - 86400000);
    const q = query(
      collection(db, 'gov_jobs'),
      where('isEligibilityEnabled', '==', true),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const job = { id: change.doc.id, ...change.doc.data() };
          // Already processed kiya tha?
          if (processedJobIds.current.has(job.id)) return;
          processedJobIds.current.add(job.id);

          const match = calcMatch(job, userProfile);
          if (match && match.matchPercent >= 80) {
            // New high-match job — show alert banner
            setNewMatchAlert({ job, match });
            Animated.sequence([
              Animated.spring(alertAnim, { toValue: 0, useNativeDriver: true, tension: 60 }),
              Animated.delay(4000),
              Animated.timing(alertAnim, { toValue: -100, duration: 300, useNativeDriver: true }),
            ]).start(() => setNewMatchAlert(null));
          }
        }
      });
    }, () => {}); // Silent error for index issues

    return () => unsub();
  }, [userId, userProfile]);

  // ── Fetch paginated jobs ──────────────────────────────────
  const fetchJobsPage = async (profile, applied, afterDoc, isFirst = false) => {
    try {
      let q = query(
        collection(db, 'gov_jobs'),
        where('isEligibilityEnabled', '==', true),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );
      if (afterDoc) q = query(
        collection(db, 'gov_jobs'),
        where('isEligibilityEnabled', '==', true),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
        startAfter(afterDoc)
      );

      const snap = await getDocs(q);
      if (snap.empty || snap.docs.length < PAGE_SIZE) setHasMore(false);
      if (!snap.empty) setLastDoc(snap.docs[snap.docs.length - 1]);

      processJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })), profile, applied, isFirst);
    } catch {
      // Fallback without index
      try {
        const snap = await getDocs(query(collection(db, 'gov_jobs'), limit(50)));
        const jobs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(j => j.isEligibilityEnabled);
        setHasMore(false);
        processJobs(jobs, profile, applied, isFirst);
      } catch {}
    }
  };

  const processJobs = (jobs, profile, applied, isFirst) => {
    const perfect = [], potential = [];
    jobs.forEach(job => {
      const match = calcMatch(job, profile);
      if (!match) return;
      const item = { ...job, ...match, isApplied: applied.includes(job.id) };
      if (match.matchPercent === 100) perfect.push(item);
      else if (match.matchPercent >= 60) potential.push(item);
    });
    if (isFirst) { setPerfectMatches(perfect); setPotentialMatches(potential); }
    else { setPerfectMatches(p => [...p, ...perfect]); setPotentialMatches(p => [...p, ...potential]); }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try { await fetchJobsPage(userProfile, appliedJobIds, lastDoc, false); }
    finally { setLoadingMore(false); }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setHasMore(true);
    setLastDoc(null);
    processedJobIds.current.clear();
    await fetchInitial();
    setRefreshing(false);
  }, []);

  // ── Render job card ───────────────────────────────────────
  const renderCard = (item, isPerfect) => {
    const barColor = isPerfect ? '#10B981' : item.matchPercent >= 80 ? '#F59E0B' : '#3B82F6';
    const missingCount = item.unknownCount + item.mismatchCount;

    return (
      <TouchableOpacity
        key={item.id}
        style={[s.card, { borderLeftColor: barColor }]}
        onPress={() => navigation.navigate('Home', {
          screen: 'JobDetails',
          params: { jobId: item.id }
        })}
        activeOpacity={0.87}
      >
        {/* Top row */}
        <View style={s.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
            {item.conductedBy ? (
              <Text style={s.cardOrg}>{item.conductedBy}</Text>
            ) : null}
          </View>
          {item.isApplied && (
            <View style={s.appliedBadge}>
              <MaterialCommunityIcons name="check-circle" size={11} color="#10B981" />
              <Text style={s.appliedText}>Applied</Text>
            </View>
          )}
        </View>

        {/* Match score */}
        <View style={s.matchRow}>
          <MaterialCommunityIcons
            name={isPerfect ? 'check-decagram' : 'chart-arc'}
            size={17}
            color={barColor}
          />
          <Text style={[s.matchText, { color: barColor }]}>
            {isPerfect ? '🎯 Perfect Match!' : `${item.matchPercent}% Match`}
          </Text>
          <Text style={s.matchCountText}>
            {item.matchCount}/{item.total} criteria
          </Text>
        </View>

        {/* Progress bar */}
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${item.matchPercent}%`, backgroundColor: barColor }]} />
        </View>

        {/* Bottom row — criteria breakdown + buttons */}
        <View style={s.cardBottom}>
          <View style={s.criteriaRow}>
            <View style={s.criteriaChip}>
              <MaterialCommunityIcons name="check-circle" size={12} color="#10B981" />
              <Text style={[s.chipText, { color: '#10B981' }]}>{item.matchCount} met</Text>
            </View>
            {item.mismatchCount > 0 && (
              <View style={s.criteriaChip}>
                <MaterialCommunityIcons name="close-circle" size={12} color="#EF4444" />
                <Text style={[s.chipText, { color: '#EF4444' }]}>{item.mismatchCount} not met</Text>
              </View>
            )}
            {item.unknownCount > 0 && (
              <View style={s.criteriaChip}>
                <MaterialCommunityIcons name="help-circle" size={12} color="#94A3B8" />
                <Text style={[s.chipText, { color: '#94A3B8' }]}>{item.unknownCount} unknown</Text>
              </View>
            )}
          </View>

          {/* Action buttons */}
          <View style={s.actionRow}>
            {/* Details */}
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: '#EBF5FB' }]}
              onPress={() => setSelectedJobDetail(item)}
            >
              <MaterialCommunityIcons name="clipboard-list" size={14} color="#003366" />
              <Text style={[s.actionBtnText, { color: '#003366' }]}>Details</Text>
            </TouchableOpacity>

            {/* Check Eligibility / Apply */}
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: barColor }]}
              onPress={() => navigation.navigate('Home', {
                screen: 'JobDetails',
                params: { jobId: item.id, openEligibility: !isPerfect }
              })}
            >
              <MaterialCommunityIcons
                name={isPerfect ? 'send' : 'clipboard-check'}
                size={14}
                color="#fff"
              />
              <Text style={[s.actionBtnText, { color: '#fff' }]}>
                {isPerfect ? 'Apply Now' : 'Check Eligibility'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Match Detail Modal ────────────────────────────────────
  const MatchDetailModal = () => {
    if (!selectedJobDetail) return null;
    const item = selectedJobDetail;
    return (
      <Modal visible={true} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.modalTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={s.modalOrg}>{item.conductedBy}</Text>

            {/* Score summary */}
            <View style={[s.scoreSummary, {
              backgroundColor: item.matchPercent === 100 ? '#ECFDF5' : item.matchPercent >= 80 ? '#FEF3C7' : '#EBF5FB'
            }]}>
              <Text style={s.scoreNum}>{item.matchPercent}%</Text>
              <Text style={s.scoreLabel}>Profile Match</Text>
              <View style={s.scoreProgress}>
                <View style={[s.scoreProgressFill, {
                  width: `${item.matchPercent}%`,
                  backgroundColor: item.matchPercent === 100 ? '#10B981' : item.matchPercent >= 80 ? '#F59E0B' : '#3B82F6'
                }]} />
              </View>
            </View>

            <Text style={s.criteriaTitle}>Eligibility Breakdown</Text>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {(item.details || []).map((d, i) => (
                <View key={i} style={s.criteriaItem}>
                  <View style={[s.criteriaIcon, {
                    backgroundColor: d.status === 'yes' ? '#ECFDF5' : d.status === 'no' ? '#FEF2F2' : '#F1F5F9'
                  }]}>
                    <MaterialCommunityIcons
                      name={d.status === 'yes' ? 'check' : d.status === 'no' ? 'close' : 'help'}
                      size={16}
                      color={d.status === 'yes' ? '#10B981' : d.status === 'no' ? '#EF4444' : '#94A3B8'}
                    />
                  </View>
                  <Text style={[s.criteriaText, {
                    color: d.status === 'yes' ? '#166534' : d.status === 'no' ? '#B91C1C' : '#64748B',
                    flex: 1
                  }]}>{d.q}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '800',
                    color: d.status === 'yes' ? '#10B981' : d.status === 'no' ? '#EF4444' : '#94A3B8'
                  }}>
                    {d.status === 'yes' ? 'MET' : d.status === 'no' ? 'NOT MET' : 'UNKNOWN'}
                  </Text>
                </View>
              ))}
            </ScrollView>

            {item.unknownCount > 0 && (
              <View style={s.tipBox}>
                <MaterialCommunityIcons name="lightbulb" size={16} color="#F59E0B" />
                <Text style={s.tipText}>
                  {item.unknownCount} criteria unknown — Profile update karo ya Job Details mein check karo
                </Text>
              </View>
            )}

            <View style={s.modalBtns}>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: '#F1F5F9' }]}
                onPress={() => setSelectedJobDetail(null)}
              >
                <Text style={{ color: '#64748B', fontWeight: '700' }}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: '#003366', flex: 1 }]}
                onPress={() => {
                  setSelectedJobDetail(null);
                  navigation.navigate('Home', {
                    screen: 'JobDetails',
                    params: { jobId: item.id }
                  });
                }}
              >
                <MaterialCommunityIcons name="arrow-right" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800' }}>View Full Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // ── Data ──────────────────────────────────────────────────
  const allItems = [
    ...(perfectMatches.length > 0 ? [
      { type: 'header', title: '🎯 Perfect Matches', sub: `${perfectMatches.length} jobs`, key: 'h1' },
      ...perfectMatches.map(j => ({ type: 'job', data: j, isPerfect: true, key: j.id }))
    ] : []),
    ...(potentialMatches.length > 0 ? [
      { type: 'header', title: '📈 Good Matches', sub: `${potentialMatches.length} jobs`, key: 'h2' },
      ...potentialMatches.map(j => ({ type: 'job', data: j, isPerfect: false, key: j.id + '_p' }))
    ] : []),
  ];

  if (loading) return (
    <SafeAreaView style={[s.container, { backgroundColor: '#F8FAFC' }]}>
      <View style={s.header}>
        <Text style={s.screenTitle}>For You ✨</Text>
      </View>
      <View style={s.center}>
        <ActivityIndicator size="large" color="#003366" />
        <Text style={s.loadingText}>Matching jobs dhoondh rahe hain...</Text>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={[s.container, { backgroundColor: '#F8FAFC' }]}>

      {/* ✅ New match alert banner */}
      {newMatchAlert && (
        <Animated.View style={[s.alertBanner, { transform: [{ translateY: alertAnim }] }]}>
          <MaterialCommunityIcons name="star-shooting" size={18} color="#FFD700" />
          <Text style={s.alertText}>
            New match: {newMatchAlert.job.title?.substring(0, 40)}...
            ({newMatchAlert.match.matchPercent}%)
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Home', {
            screen: 'JobDetails',
            params: { jobId: newMatchAlert.job.id }
          })}>
            <Text style={s.alertBtn}>View</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.screenTitle}>For You ✨</Text>
          <Text style={s.headerSub}>
            {perfectMatches.length + potentialMatches.length > 0
              ? `${perfectMatches.length + potentialMatches.length} matching jobs found`
              : 'Profile ke hisaab se jobs'
            }
          </Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={s.refreshBtn}>
          <MaterialCommunityIcons name="refresh" size={20} color="#003366" />
        </TouchableOpacity>
      </View>

      {/* Profile completeness warning */}
      {Object.keys(userProfile).length === 0 && (
        <TouchableOpacity
          style={s.profileWarning}
          onPress={() => navigation.navigate('Profile')}
        >
          <MaterialCommunityIcons name="account-alert" size={18} color="#B45309" />
          <Text style={s.profileWarningText}>
            Profile mein eligibility details bharo — better matches milenge
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color="#B45309" />
        </TouchableOpacity>
      )}

      {allItems.length === 0 ? (
        <View style={s.emptyState}>
          <MaterialCommunityIcons name="briefcase-search" size={70} color="#CBD5E1" />
          <Text style={s.emptyTitle}>Abhi koi match nahi</Text>
          <Text style={s.emptySub}>
            Pehle job apply karo ya eligibility check karo{'\n'}
            Profile update karo taaki matches milein
          </Text>
          <TouchableOpacity
            style={s.goProfileBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={s.goProfileText}>Update Profile</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={allItems}
          keyExtractor={item => item.key}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#003366']} />
          }
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>{item.title}</Text>
                  <Text style={s.sectionCount}>{item.sub}</Text>
                </View>
              );
            }
            return renderCard(item.data, item.isPerfect);
          }}
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity style={s.loadMoreBtn} onPress={loadMore} disabled={loadingMore}>
                {loadingMore
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.loadMoreText}>Load More</Text>
                }
              </TouchableOpacity>
            ) : (
              <Text style={s.endText}>— Sab matches dikh gaye —</Text>
            )
          }
        />
      )}

      <MatchDetailModal />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 14, color: '#64748B', fontWeight: '600', fontSize: 14 },

  // Alert banner
  alertBanner: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    backgroundColor: '#003366', flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 10,
  },
  alertText: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 12 },
  alertBtn: { color: '#FFD700', fontWeight: '900', fontSize: 12 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  screenTitle: { fontSize: 24, fontWeight: '900', color: '#003366' },
  headerSub: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  refreshBtn: { padding: 8, backgroundColor: '#EBF5FB', borderRadius: 10 },

  // Profile warning
  profileWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 12, padding: 12,
    backgroundColor: '#FEF3C7', borderRadius: 12,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  profileWarningText: { flex: 1, color: '#B45309', fontSize: 12, fontWeight: '700' },

  // Section
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: '#1E293B', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCount: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12,
    borderLeftWidth: 5, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B', lineHeight: 21 },
  cardOrg: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 3 },
  appliedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, marginLeft: 8 },
  appliedText: { fontSize: 9, fontWeight: '900', color: '#10B981' },

  // Match
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  matchText: { fontWeight: '800', fontSize: 13, flex: 1 },
  matchCountText: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  progressTrack: { height: 5, backgroundColor: '#F1F5F9', borderRadius: 5, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: '100%', borderRadius: 5 },

  // Criteria chips
  cardBottom: {},
  criteriaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  criteriaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#F8FAFC', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  chipText: { fontSize: 10, fontWeight: '700' },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 12 },
  actionBtnText: { fontSize: 12, fontWeight: '800' },

  // Empty
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#94A3B8', marginTop: 20 },
  emptySub: { fontSize: 13, color: '#CBD5E1', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  goProfileBtn: { marginTop: 20, backgroundColor: '#003366', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  goProfileText: { color: '#fff', fontWeight: '700' },

  // Load more
  loadMoreBtn: { backgroundColor: '#003366', padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  loadMoreText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  endText: { textAlign: 'center', padding: 20, fontSize: 12, color: '#94A3B8', fontWeight: '600' },

  // Match Detail Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, maxHeight: '85%' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: '#003366', marginBottom: 4 },
  modalOrg: { fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 16 },
  scoreSummary: { borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 20 },
  scoreNum: { fontSize: 42, fontWeight: '900', color: '#003366' },
  scoreLabel: { fontSize: 12, color: '#64748B', fontWeight: '700', marginBottom: 10 },
  scoreProgress: { width: '100%', height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  scoreProgressFill: { height: '100%', borderRadius: 4 },
  criteriaTitle: { fontSize: 13, fontWeight: '900', color: '#1E293B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  criteriaItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  criteriaIcon: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  criteriaText: { fontSize: 13, fontWeight: '600' },
  tipBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', padding: 12, borderRadius: 12, marginTop: 14 },
  tipText: { flex: 1, fontSize: 12, color: '#92400E', fontWeight: '600', lineHeight: 17 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 14 },
});
