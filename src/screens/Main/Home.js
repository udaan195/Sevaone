import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, FlatList, Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { auth, db } from '../../api/firebaseConfig';
import {
  doc, onSnapshot, collection, query, orderBy, where,
} from 'firebase/firestore';
import { useAppTheme } from '../../context/ThemeContext';
import { SkeletonBanner, SkeletonGrid } from '../../components/SkeletonLoader';

const { width } = Dimensions.get('window');

// ── Greeting by time ─────────────────────────────────────
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: 'शुभ प्रभात 🌅',   icon: 'weather-sunny',    color: '#F59E0B' };
  if (h < 17) return { text: 'शुभ दोपहर ☀️',   icon: 'white-balance-sunny', color: '#EF4444' };
  if (h < 20) return { text: 'शुभ संध्या 🙏',   icon: 'weather-sunset',   color: '#8B5CF6' };
  return       { text: 'शुभ रात्रि 🌙',          icon: 'weather-night',    color: '#3B82F6' };
};

const ServiceItem = ({ icon, title, color, iconCol, target, navigation, theme }) => (
  <TouchableOpacity style={styles.serviceCard} onPress={() => navigation.navigate(target)}>
    <View style={[styles.iconCircle, { backgroundColor: color }]}>
      <MaterialCommunityIcons name={icon} size={30} color={iconCol} />
    </View>
    <Text style={[styles.serviceTitle, { color: theme.text }]}>{title}</Text>
  </TouchableOpacity>
);

export default function HomeScreen({ navigation }) {
  const { theme, t } = useAppTheme();

  const [userData, setUserData]     = useState({ name: 'User', walletBalance: 0 });
  const [banners, setBanners]       = useState([]);
  const [updates, setUpdates]       = useState([]);
  const [hasNewNoti, setHasNewNoti] = useState(false);
  const [loadingScreen, setLoading] = useState(true);
  const [appCount, setAppCount]     = useState({ total: 0, active: 0, completed: 0 });

  // ✅ Config from admin
  const [features, setFeatures]     = useState({
    wallet: true, jobs: true, services: true, notifications: true,
  });
  const [sections, setSections]     = useState([
    { id: 'banner',   visible: true },
    { id: 'services', visible: true },
    { id: 'ticker',   visible: true },
  ]);

  const tickerRef   = useRef(null);
  const bannerRef   = useRef(null);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [bannerIndex, setBannerIndex] = useState(0);
  const greeting = getGreeting();

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    // User
    const unsubUser = onSnapshot(doc(db, 'users', uid), snap => {
      if (snap.exists()) setUserData(snap.data());
      setLoading(false);
    });

    // Banners
    const qBanners = query(
      collection(db, 'banners'),
      where('isActive', '==', true),
      orderBy('timestamp', 'desc')
    );
    const unsubBanners = onSnapshot(qBanners, snap =>
      setBanners(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    // Updates
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const qUpdates = query(
      collection(db, 'updates'),
      where('timestamp', '>=', fiveDaysAgo),
      orderBy('timestamp', 'desc')
    );
    const unsubUpdates = onSnapshot(qUpdates, snap => {
      if (!snap.empty) {
        setUpdates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setHasNewNoti(true);
      }
    });

    // Application counts
    const unsubApps = onSnapshot(
      query(collection(db, 'applications'), where('userId', '==', uid)),
      snap => {
        const docs = snap.docs.map(d => d.data());
        setAppCount({
          total:     docs.length,
          active:    docs.filter(d => ['submitted','assigned','in-process'].includes(d.status?.toLowerCase())).length,
          completed: docs.filter(d => ['completed','final submit'].includes(d.status?.toLowerCase())).length,
        });
      }
    );

    // ✅ Feature flags
    const unsubFeatures = onSnapshot(doc(db, 'app_config', 'features'), snap => {
      if (snap.exists()) setFeatures(prev => ({ ...prev, ...snap.data() }));
    });

    // ✅ Home layout
    const unsubLayout = onSnapshot(doc(db, 'app_config', 'home_layout'), snap => {
      if (snap.exists() && snap.data().sections) setSections(snap.data().sections);
    });

    return () => {
      unsubUser(); unsubBanners(); unsubUpdates();
      unsubApps(); unsubFeatures(); unsubLayout();
    };
  }, []);

  // Auto-scroll banner
  useEffect(() => {
    if (banners.length > 1) {
      const i = setInterval(() => {
        const next = (bannerIndex + 1) % banners.length;
        setBannerIndex(next);
        bannerRef.current?.scrollToIndex({ index: next, animated: true });
      }, 5000);
      return () => clearInterval(i);
    }
  }, [bannerIndex, banners]);

  // Auto-scroll ticker
  useEffect(() => {
    if (updates.length > 1) {
      const i = setInterval(() => {
        const next = (tickerIndex + 1) % updates.length;
        setTickerIndex(next);
        tickerRef.current?.scrollToIndex({ index: next, animated: true });
      }, 4000);
      return () => clearInterval(i);
    }
  }, [tickerIndex, updates]);

  const services = [
    { icon: 'briefcase-variant', title: t.govtJob,         color: '#E3F2FD', iconCol: '#1976D2', target: 'GovtJobs',        show: features.jobs     !== false },
    { icon: 'office-building',   title: t.privateJob,      color: '#F3E5F5', iconCol: '#7B1FA2', target: 'PrivateJobs',     show: true                        },
    { icon: 'account-group',     title: t.citizenServices, color: '#E8F5E9', iconCol: '#388E3C', target: 'CitizenServices',  show: features.services !== false },
    { icon: 'bank',              title: t.govtSchemes,     color: '#FFF3E0', iconCol: '#F57C00', target: 'GovtSchemes',     show: true                        },
    { icon: 'school',            title: t.students,        color: '#FCE4EC', iconCol: '#C2185B', target: 'Students',        show: true                        },
    { icon: 'dots-grid',         title: t.other,           color: '#E0F7FA', iconCol: '#0097A7', target: 'Others',          show: true                        },
  ].filter(s => s.show);

  const isSectionVisible = (id) => {
    const sec = sections.find(s => s.id === id);
    return sec ? sec.visible !== false : true;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>

      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <View>
          <Text style={[styles.appTitle, { color: theme.primary }]}>SewaOne</Text>
          <Text style={[styles.appTagline, { color: theme.textMuted }]}>Har Sarkari Kaam, Ek Jagah</Text>
        </View>
        <View style={styles.headerRight}>
          {features.notifications !== false && (
            <TouchableOpacity
              style={styles.bellWrap}
              onPress={() => { navigation.navigate('Notifications'); setHasNewNoti(false); }}
            >
              <MaterialCommunityIcons name="bell-outline" size={26} color={theme.primary} />
              {hasNewNoti && <View style={styles.dot} />}
            </TouchableOpacity>
          )}
          {features.wallet !== false && (
            <TouchableOpacity
              style={[styles.walletBtn, { backgroundColor: theme.primary }]}
              onPress={() => navigation.navigate('Wallet')}
            >
              <MaterialCommunityIcons name="wallet-outline" size={18} color="#fff" />
              <Text style={styles.walletText}>
                ₹{userData.walletBalance?.toLocaleString('en-IN') ?? '0'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Welcome + Greeting ── */}
        <View style={[styles.welcomeRow, { backgroundColor: theme.card }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greetText, { color: theme.textMuted }]}>{greeting.text}</Text>
            <Text style={[styles.userName, { color: theme.text }]}>
              {userData.name || 'User'}
            </Text>
          </View>
          <View style={[styles.greetIconBox, { backgroundColor: greeting.color + '20' }]}>
            <MaterialCommunityIcons name={greeting.icon} size={28} color={greeting.color} />
          </View>
        </View>

        {/* ── Stats Row ── */}
        <View style={[styles.statsRow, { backgroundColor: theme.card }]}>
          {[
            { icon: 'file-document-multiple', label: 'Applications', val: appCount.total,     color: '#3B82F6' },
            { icon: 'clock-outline',          label: 'Active',       val: appCount.active,    color: '#F59E0B' },
            { icon: 'check-circle-outline',   label: 'Completed',    val: appCount.completed, color: '#10B981' },
            { icon: 'star-face',              label: 'For You',      val: null,               color: '#8B5CF6',
              onPress: () => navigation.navigate('Recommended'), label2: 'Matches' },
          ].map((s, i) => (
            <TouchableOpacity
              key={i} style={styles.statItem}
              onPress={s.onPress} disabled={!s.onPress}
              activeOpacity={s.onPress ? 0.7 : 1}
            >
              <MaterialCommunityIcons name={s.icon} size={20} color={s.color} />
              <Text style={[styles.statVal, { color: s.onPress ? s.color : theme.text }]}>
                {s.val !== null ? s.val : s.label2}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Banner ── */}
        {isSectionVisible('banner') && (
          loadingScreen ? <SkeletonBanner /> :
          banners.length > 0 ? (
            <View style={styles.bannerWrapper}>
              <FlatList
                ref={bannerRef}
                data={banners}
                horizontal pagingEnabled scrollEnabled={false}
                showsHorizontalScrollIndicator={false}
                keyExtractor={item => item.id}
                renderItem={({ item }) => {
                  const bg = item.bannerColor || theme.primary;
                  return (
                    <TouchableOpacity
                      style={styles.bannerCard}
                      onPress={() => item.target && item.jobId &&
                        navigation.navigate(item.target, { jobId: item.jobId, serviceId: item.jobId })}
                      activeOpacity={0.9}
                    >
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                      ) : (
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: bg, padding: 22 }]}>
                          <View style={styles.categoryBadge}>
                            <Text style={styles.badgeText}>{item.subTitle || '🔥 NEW JOB ALERT'}</Text>
                          </View>
                          <Text style={styles.bannerTitle} numberOfLines={2}>{item.title}</Text>
                          <View style={styles.bannerBtn}>
                            <Text style={[styles.bannerBtnText, { color: bg }]}>
                              {item.btnText || 'Apply Now'}
                            </Text>
                            <MaterialCommunityIcons name="arrow-right" size={14} color={bg} />
                          </View>
                          <MaterialCommunityIcons
                            name={item.bannerIcon || 'briefcase-variant-outline'}
                            size={90} color="rgba(255,255,255,0.12)"
                            style={styles.bannerBgIcon}
                          />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
              <View style={styles.dots}>
                {banners.map((_, i) => (
                  <View key={i} style={[styles.dot2,
                    { backgroundColor: i === bannerIndex ? '#F59E0B' : 'rgba(0,0,0,0.15)' }
                  ]} />
                ))}
              </View>
            </View>
          ) : null
        )}

        {/* ── Ticker ── */}
        {isSectionVisible('ticker') && updates.length > 0 && (
          <View style={[styles.ticker, { backgroundColor: theme.card, borderLeftColor: theme.secondary }]}>
            <FlatList
              ref={tickerRef}
              data={updates}
              horizontal pagingEnabled scrollEnabled={false}
              showsHorizontalScrollIndicator={false}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={{ width: width - 70, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.tickerBadge,
                    { backgroundColor: item.type === 'new' ? '#D1FAE5' : '#FEF3C7' }
                  ]}>
                    <Text style={[styles.tickerBadgeText,
                      { color: item.type === 'new' ? '#059669' : '#B45309' }
                    ]}>
                      {item.type?.toUpperCase() || 'INFO'}
                    </Text>
                  </View>
                  <Text style={[styles.tickerText, { color: theme.text }]} numberOfLines={1}>
                    {item.text}
                  </Text>
                </View>
              )}
            />
          </View>
        )}

        {/* ── Services ── */}
        {isSectionVisible('services') && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Our Services</Text>
              <Text style={[styles.sectionSub, { color: theme.textMuted }]}>Sab kuch ek jagah</Text>
            </View>
            {loadingScreen ? <SkeletonGrid /> : (
              <View style={styles.serviceGrid}>
                {services.map((svc, i) => (
                  <ServiceItem key={i} navigation={navigation} theme={theme} {...svc} />
                ))}
              </View>
            )}
          </>
        )}

        {/* ── Trust Footer ── */}
        <View style={[styles.trustRow, { borderTopColor: theme.border }]}>
          <MaterialCommunityIcons name="shield-check" size={16} color="#10B981" />
          <Text style={[styles.trustText, { color: theme.textMuted }]}>
            Secured by SewaOne  •  Har Sarkari Kaam Aasaan
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },

  // Header
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 14, elevation: 2 },
  appTitle:     { fontSize: 22, fontWeight: '900' },
  appTagline:   { fontSize: 11, fontWeight: '600', marginTop: 1 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bellWrap:     { position: 'relative', padding: 2 },
  walletBtn:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, gap: 5 },
  walletText:   { color: '#fff', fontWeight: '800', fontSize: 13 },

  // Welcome
  welcomeRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, marginBottom: 2 },
  greetText:    { fontSize: 14, fontWeight: '600' },
  userName:     { fontSize: 26, fontWeight: '900', marginTop: 2 },
  greetIconBox: { width: 52, height: 52, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

  // Stats
  statsRow:     { flexDirection: 'row', marginHorizontal: 0, marginBottom: 2, paddingVertical: 10 },
  statItem:     { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 4 },
  statVal:      { fontSize: 18, fontWeight: '900' },
  statLabel:    { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  // Banner
  bannerWrapper:{ marginTop: 14, marginHorizontal: 16 },
  bannerCard:   { width: width - 32, height: 168, borderRadius: 20, overflow: 'hidden', elevation: 8 },
  categoryBadge:{ backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 10 },
  badgeText:    { color: '#fff', fontSize: 10, fontWeight: '900' },
  bannerTitle:  { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 16, lineHeight: 26 },
  bannerBtn:    { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12, gap: 5 },
  bannerBtnText:{ fontWeight: '800', fontSize: 13 },
  bannerBgIcon: { position: 'absolute', right: -5, bottom: -10 },
  dots:         { flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 6 },
  dot2:         { width: 8, height: 8, borderRadius: 4 },

  // Ticker
  ticker:       { margin: 16, padding: 14, borderRadius: 14, borderLeftWidth: 5, elevation: 2, overflow: 'hidden' },
  tickerBadge:  { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 10 },
  tickerBadgeText:{ fontSize: 10, fontWeight: '900' },
  tickerText:   { fontSize: 13, fontWeight: '700', flex: 1 },

  // Services
  sectionHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  sectionSub:   { fontSize: 12, fontWeight: '600' },
  serviceGrid:  { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 8 },
  serviceCard:  { width: '30%', alignItems: 'center', marginBottom: 20 },
  iconCircle:   { width: 68, height: 68, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  serviceTitle: { marginTop: 8, fontSize: 12, fontWeight: '700', textAlign: 'center' },

  // Trust
  trustRow:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 16, marginHorizontal: 20, borderTopWidth: 1 },
  trustText:    { fontSize: 12, fontWeight: '600' },

  // Common
  dot:          { position: 'absolute', right: 0, top: 0, width: 9, height: 9, borderRadius: 5, backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#fff' },
});
