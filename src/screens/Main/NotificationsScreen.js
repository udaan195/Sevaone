import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, SafeAreaView,
  ActivityIndicator, TouchableOpacity, Alert,
  StatusBar, Animated,
} from 'react-native';
import { db, auth } from '../../api/firebaseConfig';
import {
  collection, query, orderBy, limit,
  startAfter, getDocs, doc, updateDoc,
  writeBatch, onSnapshot,
} from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// ── Type config ───────────────────────────────────────────
const TYPE_CONFIG = {
  'job':             { icon: 'briefcase-variant',    color: '#1565C0', bg: '#E3F2FD', label: 'JOB'        },
  'result':          { icon: 'trophy',               color: '#2E7D32', bg: '#E8F5E9', label: 'RESULT'     },
  'admit-card':      { icon: 'card-account-details', color: '#6A1B9A', bg: '#F3E5F5', label: 'ADMIT CARD' },
  'answer-key':      { icon: 'key-variant',          color: '#E65100', bg: '#FBE9E7', label: 'ANSWER KEY' },
  'service':         { icon: 'account-check',        color: '#00695C', bg: '#E0F2F1', label: 'SERVICE'    },
  'wallet_approved': { icon: 'wallet-plus',          color: '#1B5E20', bg: '#E8F5E9', label: 'WALLET'     },
  'wallet_rejected': { icon: 'wallet-remove',        color: '#B71C1C', bg: '#FFEBEE', label: 'WALLET'     },
  'update':          { icon: 'bullhorn-variant',     color: '#003366', bg: '#E8EAF6', label: 'UPDATE'     },
  'promotion':       { icon: 'tag-heart',            color: '#AD1457', bg: '#FCE4EC', label: 'OFFER'      },
  'reminder':        { icon: 'clock-alert',          color: '#E65100', bg: '#FBE9E7', label: 'REMINDER'   },
};
const getCfg  = t => TYPE_CONFIG[t] || { icon: 'bell', color: '#003366', bg: '#E8EAF6', label: 'UPDATE' };
const PAGE_SIZE = 15;

const FILTERS = [
  { id: 'all',     label: 'All',      icon: 'bell'              },
  { id: 'job',     label: 'Jobs',     icon: 'briefcase-variant' },
  { id: 'service', label: 'Services', icon: 'account-check'     },
  { id: 'wallet',  label: 'Wallet',   icon: 'wallet'            },
  { id: 'update',  label: 'Updates',  icon: 'bullhorn-variant'  },
];

const formatTime = ts => {
  if (!ts) return '';
  try {
    const d    = ts?.toDate ? ts.toDate() : new Date(ts);
    const diff = Math.floor((Date.now() - d) / 1000);
    if (diff < 60)    return 'Abhi abhi';
    if (diff < 3600)  return `${Math.floor(diff / 60)} min pehle`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ghante pehle`;
    if (diff < 172800) return 'Kal';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch { return ''; }
};

// ── Notification Card ─────────────────────────────────────
const NotifCard = React.memo(({ item, onPress, onMarkRead, onDelete }) => {
  const cfg     = getCfg(item.type);
  const isUnread = !item.isRead;
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  const handleDelete = () => {
    Alert.alert('Delete', 'Is notification ko delete karein?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
            onDelete(item.id);
          });
        }
      }
    ]);
  };

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity
        onPress={() => onPress(item)}
        onLongPress={handleDelete}
        activeOpacity={0.82}
        style={[
          s.card,
          isUnread && s.cardUnread,
        ]}
      >
        {/* Unread dot */}
        {isUnread && <View style={s.unreadDot} />}

        {/* Icon */}
        <View style={[s.iconBox, { backgroundColor: cfg.bg }]}>
          <MaterialCommunityIcons name={cfg.icon} size={24} color={cfg.color} />
        </View>

        {/* Content */}
        <View style={s.content}>
          <View style={s.topRow}>
            <View style={[s.typePill, { backgroundColor: cfg.bg }]}>
              <Text style={[s.typePillText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <Text style={s.time}>{formatTime(item.timestamp)}</Text>
          </View>
          <Text style={[s.title, isUnread && s.titleUnread]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={s.message} numberOfLines={2}>{item.message}</Text>
        </View>

        {/* Right side */}
        <View style={s.rightCol}>
          {item.screen && item.jobId
            ? <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" />
            : null
          }
          {isUnread && (
            <TouchableOpacity onPress={() => onMarkRead(item.id)} style={s.readBtn} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
              <MaterialCommunityIcons name="check" size={14} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ── Main Screen ───────────────────────────────────────────
export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [lastDoc, setLastDoc]             = useState(null);
  const [hasMore, setHasMore]             = useState(true);
  const [activeFilter, setActiveFilter]   = useState('all');
  const [unreadCount, setUnreadCount]     = useState(0);

  const uid = auth.currentUser?.uid;

  // ── Initial load ─────────────────────────────────────────
  const loadFirst = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'notifications'),
        orderBy('timestamp', 'desc'),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(docs);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadFirst(); }, [loadFirst]);

  // ── Unread count — client side se calculate (no index needed)
  useEffect(() => {
    const count = notifications.filter(n => !n.isRead).length;
    setUnreadCount(count);
  }, [notifications]);

  // ── Load more (pagination) ────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !lastDoc) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'notifications'),
        orderBy('timestamp', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(prev => [...prev, ...docs]);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch {}
    setLoadingMore(false);
  }, [loadingMore, hasMore, lastDoc]);

  // ── Mark single as read ───────────────────────────────────
  const markRead = useCallback(async id => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
    } catch {}
  }, []);

  // ── Mark all as read ──────────────────────────────────────
  const markAllRead = useCallback(async () => {
    const unread = notifications.filter(n => !n.isRead);
    if (!unread.length) return;
    try {
      const batch = writeBatch(db);
      unread.forEach(n => batch.update(doc(db, 'notifications', n.id), { isRead: true }));
      await batch.commit();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {}
  }, [notifications]);

  // ── Delete ────────────────────────────────────────────────
  const deleteNotif = useCallback(async id => {
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'notifications', id));
      await batch.commit();
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch {}
  }, []);

  // ── Navigate ──────────────────────────────────────────────
  const handlePress = useCallback(item => {
    if (!item.isRead) markRead(item.id);
    if (!item.screen || !item.jobId) return;
    try {
      navigation.navigate(item.screen, { jobId: item.jobId, serviceId: item.jobId });
    } catch {}
  }, [markRead, navigation]);

  // ── Filter logic ──────────────────────────────────────────
  const filtered = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    if (activeFilter === 'wallet')
      return notifications.filter(n => n.type?.startsWith('wallet'));
    return notifications.filter(n => n.type === activeFilter ||
      (activeFilter === 'job' && ['job','result','admit-card','answer-key'].includes(n.type))
    );
  }, [notifications, activeFilter]);

  const unreadFiltered = filtered.filter(n => !n.isRead).length;

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator color="#002855" size="large" />
    </View>
  );

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Notifications</Text>
          <Text style={s.headerSub}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'Sab padh liye ✅'}
          </Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={s.markAllBtn} onPress={markAllRead}>
            <MaterialCommunityIcons name="check-all" size={16} color="#002855" />
            <Text style={s.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter tabs */}
      <View style={s.filterWrap}>
        <FlatList
          horizontal
          data={FILTERS}
          showsHorizontalScrollIndicator={false}
          keyExtractor={f => f.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
          renderItem={({ item: f }) => {
            const isActive = activeFilter === f.id;
            return (
              <TouchableOpacity
                style={[s.filterTab, isActive && s.filterTabActive]}
                onPress={() => setActiveFilter(f.id)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name={f.icon}
                  size={14}
                  color={isActive ? '#fff' : '#64748B'}
                />
                <Text style={[s.filterText, isActive && s.filterTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Unread count for current filter */}
      {unreadFiltered > 0 && (
        <View style={s.unreadBar}>
          <MaterialCommunityIcons name="circle-medium" size={16} color="#002855" />
          <Text style={s.unreadBarText}>{unreadFiltered} unread in this category</Text>
        </View>
      )}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <NotifCard
            item={item}
            onPress={handlePress}
            onMarkRead={markRead}
            onDelete={deleteNotif}
          />
        )}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator color="#002855" />
            </View>
          ) : !hasMore && notifications.length > 0 ? (
            <Text style={s.endText}>— Sab notifications dekh liye —</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <MaterialCommunityIcons name="bell-off-outline" size={64} color="#CBD5E1" />
            <Text style={s.emptyTitle}>
              {activeFilter === 'all' ? 'Koi notification nahi' : `Koi ${activeFilter} notification nahi`}
            </Text>
            <Text style={s.emptyText}>
              Naye jobs aur services add hone pe yahan dikhenge
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#F0F4FF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#002855' },
  headerSub:   { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  markAllBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EBF5FB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  markAllText: { fontSize: 12, fontWeight: '800', color: '#002855' },

  // Filters
  filterWrap:      { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  filterTab:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  filterTabActive: { backgroundColor: '#002855', borderColor: '#002855' },
  filterText:      { fontSize: 12, fontWeight: '700', color: '#64748B' },
  filterTextActive:{ color: '#fff' },

  unreadBar:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#EBF5FB' },
  unreadBarText: { fontSize: 12, color: '#002855', fontWeight: '700' },

  // Card
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', padding: 14, borderRadius: 18,
    marginBottom: 10, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3,
  },
  cardUnread: {
    backgroundColor: '#F8FBFF',
    borderLeftWidth: 3, borderLeftColor: '#002855',
    elevation: 2,
  },
  unreadDot: {
    position: 'absolute', top: 14, left: 10,
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#002855',
  },
  iconBox: {
    width: 48, height: 48, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12, flexShrink: 0,
  },
  content:     { flex: 1 },
  topRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  typePill:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginRight: 8 },
  typePillText:{ fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  time:        { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  title:       { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 3 },
  titleUnread: { fontWeight: '900', color: '#1E293B' },
  message:     { fontSize: 12, color: '#64748B', lineHeight: 17 },

  rightCol:  { alignItems: 'center', gap: 8, marginLeft: 6 },
  readBtn:   { padding: 4, backgroundColor: '#F1F5F9', borderRadius: 8 },

  endText:   { textAlign: 'center', color: '#CBD5E1', fontWeight: '600', fontSize: 12, paddingVertical: 16 },
  emptyBox:  { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyTitle:{ fontSize: 17, fontWeight: '800', color: '#94A3B8', marginTop: 16 },
  emptyText: { fontSize: 13, color: '#CBD5E1', marginTop: 8, textAlign: 'center', lineHeight: 20 },
});
