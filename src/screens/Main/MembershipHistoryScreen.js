// ============================================================
// FILE: src/screens/Main/MembershipHistoryScreen.js
// Purchase history — data from user_memberships/{uid}/history
// ============================================================
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { db, auth } from '../../api/firebaseConfig';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '../../context/ThemeContext';

const REASON_LABELS = {
  renewed:   { label:'Renewed',   icon:'refresh',       color:'#3B82F6' },
  upgraded:  { label:'Upgraded',  icon:'arrow-up-bold', color:'#10B981' },
  downgraded:{ label:'Downgraded',icon:'arrow-down-bold',color:'#F59E0B'},
  changed:   { label:'Changed',   icon:'swap-horizontal',color:'#8B5CF6'},
  expired:   { label:'Expired',   icon:'clock-outline', color:'#94A3B8' },
};

const PLAN_CONFIG = {
  basic:  { name:'Basic',  emoji:'🥉', color:'#CD7F32' },
  silver: { name:'Silver', emoji:'🥈', color:'#94A3B8' },
  gold:   { name:'Gold',   emoji:'🥇', color:'#F59E0B' },
};

export default function MembershipHistoryScreen({ navigation }) {
  const { theme } = useAppTheme();
  const uid = auth.currentUser?.uid;
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    const load = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'user_memberships', uid, 'history'),
          orderBy('timestamp', 'desc')
        );
        const snap = await getDocs(q);
        setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.log('History load error:', e.message);
      }
      setLoading(false);
    };
    load();
  }, [uid]));

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate?.() || new Date(ts);
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  };

  const renderItem = ({ item, index }) => {
    const plan    = PLAN_CONFIG[item.plan] || { name: item.plan, emoji:'⭐', color:'#002855' };
    const reason  = REASON_LABELS[item.reason] || { label: item.reason, icon:'information', color:'#64748B' };
    const isFirst = index === 0;

    return (
      <View style={[s.card, { backgroundColor: theme.card }, isFirst && s.firstCard]}>
        {/* Top row */}
        <View style={s.cardTop}>
          <View style={[s.planBadge, { backgroundColor: plan.color + '20' }]}>
            <Text style={s.planEmoji}>{plan.emoji}</Text>
            <Text style={[s.planName, { color: plan.color }]}>{plan.name}</Text>
          </View>
          <View style={[s.reasonBadge, { backgroundColor: reason.color + '15' }]}>
            <MaterialCommunityIcons name={reason.icon} size={13} color={reason.color} />
            <Text style={[s.reasonText, { color: reason.color }]}>{reason.label}</Text>
          </View>
        </View>

        {/* Details */}
        <View style={s.details}>
          <View style={s.detailRow}>
            <MaterialCommunityIcons name="calendar-range" size={14} color={theme.textMuted} />
            <Text style={[s.detailText, { color: theme.textMuted }]}>
              {formatDate(item.startDate)} → {formatDate(item.endDate)}
            </Text>
          </View>
          <View style={s.detailRow}>
            <MaterialCommunityIcons name="currency-inr" size={14} color={theme.textMuted} />
            <Text style={[s.detailText, { color: theme.textMuted }]}>
              Paid: <Text style={[s.detailBold, { color: theme.text }]}>₹{item.pricePaid || 0}</Text>
              {item.creditGiven > 0 && (
                <Text style={{ color:'#10B981' }}>  (Credit: ₹{item.creditGiven})</Text>
              )}
            </Text>
          </View>
          <View style={s.detailRow}>
            <MaterialCommunityIcons name="clock-outline" size={14} color={theme.textMuted} />
            <Text style={[s.detailText, { color: theme.textMuted }]}>
              {formatDate(item.timestamp)}
            </Text>
          </View>
        </View>

        {/* Timeline dot */}
        <View style={[s.timelineDot, { backgroundColor: plan.color }]} />
        {index < history.length - 1 && (
          <View style={[s.timelineLine, { backgroundColor: theme.border }]} />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Plan History</Text>
        <View style={{ width:38 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex:1 }} color="#002855" size="large" />
      ) : history.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize:48, marginBottom:12 }}>📋</Text>
          <Text style={[s.emptyText, { color: theme.textMuted }]}>
            Koi history nahi mili
          </Text>
          <Text style={[s.emptySub, { color: theme.textMuted }]}>
            Jab aap plan purchase, renew ya upgrade karenge to history yahan dikhegi
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding:16, paddingLeft:36 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={() => (
            <Text style={[s.totalCount, { color: theme.textMuted }]}>
              {history.length} plan changes
            </Text>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex:1 },
  header:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between',
                  backgroundColor:'#002855', paddingHorizontal:16, paddingVertical:14 },
  backBtn:      { width:38, height:38, borderRadius:12, backgroundColor:'rgba(255,255,255,0.15)',
                  justifyContent:'center', alignItems:'center' },
  headerTitle:  { color:'#fff', fontSize:17, fontWeight:'900' },
  totalCount:   { fontSize:12, fontWeight:'700', marginBottom:12 },
  card:         { borderRadius:16, padding:14, marginBottom:16, elevation:2,
                  marginLeft:16, position:'relative' },
  firstCard:    { borderWidth:2, borderColor:'#002855', borderStyle:'solid' },
  cardTop:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  planBadge:    { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:10,
                  paddingVertical:5, borderRadius:20 },
  planEmoji:    { fontSize:16 },
  planName:     { fontSize:13, fontWeight:'900' },
  reasonBadge:  { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10,
                  paddingVertical:5, borderRadius:20 },
  reasonText:   { fontSize:11, fontWeight:'800' },
  details:      { gap:6 },
  detailRow:    { flexDirection:'row', alignItems:'center', gap:6 },
  detailText:   { fontSize:12, fontWeight:'600' },
  detailBold:   { fontWeight:'900' },
  timelineDot:  { position:'absolute', left:-24, top:20, width:12, height:12, borderRadius:6 },
  timelineLine: { position:'absolute', left:-19, top:32, width:2, bottom:-16 },
  empty:        { flex:1, justifyContent:'center', alignItems:'center', padding:40 },
  emptyText:    { fontSize:16, fontWeight:'900', marginBottom:8 },
  emptySub:     { fontSize:13, fontWeight:'600', textAlign:'center', lineHeight:20 },
});
