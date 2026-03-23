import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, FlatList, Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { auth, db } from '../../api/firebaseConfig';
import {
  doc, onSnapshot, collection, query, orderBy, where, limit,
} from 'firebase/firestore';
import { useAppTheme } from '../../context/ThemeContext';
import NetInfo from '@react-native-community/netinfo';
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
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOffline, setIsOffline]     = useState(false);
  const [membership, setMembership]   = useState(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);
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

    // ✅ Unread notifications count
    const unsubNoti = onSnapshot(
      query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(20)),
      snap => {
        const unread = snap.docs.filter(d => !d.data().isRead).length;
        setUnreadCount(unread);
        setHasNewNoti(unread > 0);
      }
    );

    // ✅ Membership status
    const unsubMembership = onSnapshot(doc(db, 'user_memberships', uid), snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.isActive) {
          setMembership(data);
          if (data.isTrial && data.endDate) {
            const end  = new Date(data.endDate);
            const days = Math.ceil((end - new Date()) / (1000*60*60*24));
            setTrialDaysLeft(Math.max(0, days));
          }
        }
      }
    });

    // ✅ Offline detection
    const unsubNet = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected || !state.isInternetReachable);
    });

    return () => {
      unsubUser(); unsubBanners(); unsubUpdates();
      unsubApps(); unsubFeatures(); unsubLayout(); unsubNoti();
      unsubMembership(); unsubNet();
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

      {/* ── FIXED Header ── */}
      <View style={styles.topBlock}>
        <View style={styles.header}>
          <View>
            <Text style={styles.appTitle}>SewaOne</Text>
            <Text style={styles.appTagline}>Har Sarkari Kaam, Ek Jagah</Text>
          </View>
          <View style={styles.headerRight}>
            {features.notifications !== false && (
              <TouchableOpacity
                style={styles.bellWrap}
                onPress={() => { navigation.navigate('Notifications'); setHasNewNoti(false); setUnreadCount(0); }}
              >
                <MaterialCommunityIcons
                  name={unreadCount > 0 ? 'bell-ring' : 'bell-outline'}
                  size={26} color="#002855"
                />
                {unreadCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            {features.wallet !== false && (
              <TouchableOpacity
                style={styles.walletBtn}
                onPress={() => navigation.navigate('Wallet')}
              >
                <MaterialCommunityIcons name="wallet-outline" size={16} color="#fff" />
                <Text style={styles.walletText}>
                  ₹{userData.walletBalance?.toLocaleString('en-IN') ?? '0'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ✅ Offline Banner */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={16} color="#fff" />
          <Text style={styles.offlineText}>Internet nahi hai — Cached data dikh raha hai</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Welcome + Greeting ── */}
        <View style={[styles.welcomeRow, { backgroundColor: theme.card }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greetText, { color: theme.textMuted }]}>{greeting.text}</Text>
            <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
              {userData.name || 'User'}
            </Text>
          </View>
          <View style={[styles.greetIconBox, { backgroundColor: greeting.color + '20' }]}>
            <MaterialCommunityIcons name={greeting.icon} size={28} color={greeting.color} />
          </View>
        </View>

        {/* ── Trial / Membership Banner ── */}
        {membership?.isTrial && trialDaysLeft > 0 && (
          <TouchableOpacity
            style={st2.trialBanner}
            onPress={() => navigation.navigate('Membership')}
            activeOpacity={0.88}
          >
            <Text style={st2.trialEmoji}>🎁</Text>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={st2.trialTitle}>
                Free Trial — {trialDaysLeft} din baaki
              </Text>
              <Text style={st2.trialSub}>
                {membership.plan === 'gold' ? 'Gold' : membership.plan === 'silver' ? 'Silver' : 'Basic'} plan enjoy kar rahe ho • Plan lo aur save karte raho
              </Text>
            </View>
            <Text style={st2.trialArrow}>→</Text>
          </TouchableOpacity>
        )}
        {membership?.isTrial && trialDaysLeft === 0 && (
          <TouchableOpacity
            style={[st2.trialBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
            onPress={() => navigation.navigate('Membership')}
            activeOpacity={0.88}
          >
            <Text style={st2.trialEmoji}>⏰</Text>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[st2.trialTitle, { color: '#DC2626' }]}>Trial Expire Ho Gaya</Text>
              <Text style={[st2.trialSub, { color: '#EF4444' }]}>
                Plan lo — Rs. 99/month se shuru
              </Text>
            </View>
            <Text style={[st2.trialArrow, { color: '#EF4444' }]}>→</Text>
          </TouchableOpacity>
        )}

        {/* ── Stats Row ── */}
        <View style={[styles.statsRow, { backgroundColor: theme.card }]}>
          <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('ApplicationsScreen')} activeOpacity={0.75}>
            <View style={[styles.statIconBg, { backgroundColor: '#EBF5FB' }]}>
              <MaterialCommunityIcons name="file-document-multiple" size={20} color="#3B82F6" />
            </View>
            <Text style={[styles.statVal, { color: theme.text }]}>{appCount.total}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>APPLICATIONS</Text>
          </TouchableOpacity>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('ApplicationsScreen')} activeOpacity={0.75}>
            <View style={[styles.statIconBg, { backgroundColor: '#FEF3C7' }]}>
              <MaterialCommunityIcons name="clock-fast" size={20} color="#F59E0B" />
            </View>
            <Text style={[styles.statVal, { color: theme.text }]}>{appCount.active}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>ACTIVE</Text>
          </TouchableOpacity>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('ApplicationsScreen')} activeOpacity={0.75}>
            <View style={[styles.statIconBg, { backgroundColor: '#DCFCE7' }]}>
              <MaterialCommunityIcons name="check-decagram" size={20} color="#10B981" />
            </View>
            <Text style={[styles.statVal, { color: theme.text }]}>{appCount.completed}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>COMPLETED</Text>
          </TouchableOpacity>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('Recommended')} activeOpacity={0.75}>
            <View style={[styles.statIconBg, { backgroundColor: '#F3E8FF' }]}>
              <MaterialCommunityIcons name="star-circle" size={20} color="#8B5CF6" />
            </View>
            <Text style={[styles.statVal, { color: '#8B5CF6' }]}>New</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>FOR YOU</Text>
          </TouchableOpacity>
        </View>



        {/* ── Banner ── */}
        {/* ✅ Full offline empty state */}
        {isOffline && loadingScreen && (
          <View style={styles.offlineEmpty}>
            <MaterialCommunityIcons name="wifi-off" size={60} color={theme.border} />
            <Text style={[styles.offlineEmptyTitle, { color: theme.text }]}>
              Internet nahi hai
            </Text>
            <Text style={[styles.offlineEmptySub, { color: theme.textMuted }]}>
              Connect karo aur screen pull karo refresh karne ke liye
            </Text>
          </View>
        )}

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

  // Fixed header — navy
  topBlock:     { backgroundColor: '#fff', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 44, paddingHorizontal: 20, paddingBottom: 12 },
  appTitle:     { fontSize: 22, fontWeight: '900', color: '#002855' },
  appTagline:   { fontSize: 11, fontWeight: '600', marginTop: 1, color: '#94A3B8' },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bellWrap:     { position: 'relative', padding: 4 },
  walletBtn:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 5, backgroundColor: '#002855' },
  walletText:   { color: '#fff', fontWeight: '800', fontSize: 13 },

  // Welcome — scrollable white card
  welcomeRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  greetText:    { fontSize: 14, fontWeight: '600' },
  userName:     { fontSize: 26, fontWeight: '900', marginTop: 2 },
  greetIconBox: { width: 52, height: 52, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

  // Stats Row — scrollable white card
  statsRow:     { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 4,
                  borderRadius: 20, elevation: 2, shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  statItem:     { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 6 },
  statIconBg:   { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  statVal:      { fontSize: 20, fontWeight: '900' },
  statLabel:    { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  statDivider:  { width: 1, height: 44, borderRadius: 1 },

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

  // Bell badge
  bellBadge:      { position: 'absolute', top: -5, right: -6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#fff' },
  bellBadgeText:  { color: '#fff', fontSize: 9, fontWeight: '900' },

  // Offline
  offlineBanner:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EF4444', paddingVertical: 9, paddingHorizontal: 16 },
  offlineText:    { color: '#fff', fontSize: 12, fontWeight: '800' },
  offlineEmpty:   { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  offlineEmptyTitle: { fontSize: 20, fontWeight: '900', marginTop: 16 },
  offlineEmptySub:   { fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});

const st2 = StyleSheet.create({
  trialBanner:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', marginHorizontal: 16, marginBottom: 10, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: '#FDE68A' },
  trialEmoji:   { fontSize: 24 },
  trialTitle:   { fontSize: 13, fontWeight: '900', color: '#92400E' },
  trialSub:     { fontSize: 11, fontWeight: '600', color: '#B45309', marginTop: 2 },
  trialArrow:   { fontSize: 18, fontWeight: '900', color: '#92400E', marginLeft: 8 },
});
