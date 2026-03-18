import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, StatusBar, Platform, Animated
} from 'react-native';
import { db } from '../../../api/firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const SORT_OPTIONS = [
  { id: 'default', label: 'Default' },
  { id: 'az', label: 'A → Z' },
  { id: 'za', label: 'Z → A' },
];

export default function ServiceList({ route, navigation }) {
  const { mainMenu, category } = route.params;
  const [services, setServices]           = useState([]);
  const [filtered, setFiltered]           = useState([]);
  const [search, setSearch]               = useState('');
  const [sort, setSort]                   = useState('default');
  const [loading, setLoading]             = useState(true);
  const [showSort, setShowSort]           = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'all_services'),
      where('mainMenu', '==', mainMenu),
      where('category', '==', category)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setServices(data);
      setLoading(false);
    });
    return () => unsub();
  }, [mainMenu, category]);

  // ── Filter + Sort ─────────────────────────────────────────
  useEffect(() => {
    let result = [...services];

    // Search filter
    if (search.trim()) {
      result = result.filter(s =>
        s.title?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Sort
    switch (sort) {
      case 'az':
        result.sort((a, b) => (a.title||'').localeCompare(b.title||''));
        break;
      case 'za':
        result.sort((a, b) => (b.title||'').localeCompare(a.title||''));
        break;
    }

    setFiltered(result);
  }, [services, search, sort]);

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color="#003366" />
    </View>
  );

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#003366" />

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backCircle}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerSub}>{mainMenu.toUpperCase()}</Text>
            <Text style={s.headerTitle}>{category}</Text>
          </View>
          <Text style={s.countBadge}>{filtered.length}</Text>
        </View>

        {/* Search */}
        <View style={s.searchRow}>
          <View style={s.searchBox}>
            <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
            <TextInput
              style={s.searchInput}
              placeholder={`Search ${category}...`}
              value={search}
              onChangeText={setSearch}
              placeholderTextColor="#94A3B8"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
          {/* Sort button */}
          <TouchableOpacity
            style={[s.sortBtn, showSort && { backgroundColor: '#FFD700' }]}
            onPress={() => setShowSort(!showSort)}
          >
            <MaterialCommunityIcons name="sort" size={20} color={showSort ? '#003366' : '#fff'} />
          </TouchableOpacity>
        </View>

        {/* Sort pills */}
        {showSort && (
          <View style={s.sortPills}>
            {SORT_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.id}
                style={[s.sortPill, sort === opt.id && s.sortPillActive]}
                onPress={() => { setSort(opt.id); setShowSort(false); }}
              >
                <Text style={[s.sortPillText, sort === opt.id && { color: '#fff' }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Active sort indicator */}
      {sort !== 'default' && (
        <View style={s.activeSortRow}>
          <MaterialCommunityIcons name="sort" size={14} color="#003366" />
          <Text style={s.activeSortText}>
            Sorted by: {SORT_OPTIONS.find(o => o.id === sort)?.label}
          </Text>
          <TouchableOpacity onPress={() => setSort('default')}>
            <Text style={s.clearSort}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 15, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <MaterialCommunityIcons name="magnify-close" size={56} color="#CBD5E1" />
            <Text style={s.emptyTitle}>
              {search ? `"${search}" nahi mili` : 'Koi service nahi'}
            </Text>
            {search && (
              <TouchableOpacity onPress={() => setSearch('')} style={s.clearBtn}>
                <Text style={s.clearBtnText}>Search clear karo</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const totalFee = (item.officialFee||0) + (item.serviceFee||0);
          const isSmartFee = item.feeType === 'smart' || item.isSmartFee === true;
          return (
            <TouchableOpacity
              style={s.card}
              onPress={() => navigation.navigate('ServiceDetails', { jobId: item.id })}
              activeOpacity={0.88}
            >
              <View style={s.cardAccent} />
              <View style={s.cardBody}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
                  {item.shortDesc ? (
                    <Text style={s.cardDesc} numberOfLines={1}>{item.shortDesc}</Text>
                  ) : null}
                  <View style={s.cardMeta}>
                    <MaterialCommunityIcons name="currency-inr" size={13} color="#003366" />
                    <Text style={s.cardFee}>
                      {isSmartFee ? 'Category-wise fee' : totalFee > 0 ? `${totalFee} Total` : 'Free'}
                    </Text>
                  </View>
                </View>
                <View style={s.applyBadge}>
                  <Text style={s.applyText}>APPLY</Text>
                  <MaterialCommunityIcons name="arrow-right" size={14} color="#fff" />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: '#003366',
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 8,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerSub: { fontSize: 10, color: '#A5C9FF', fontWeight: '800', letterSpacing: 0.5 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  countBadge: { backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 13, fontWeight: '900', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },

  searchRow: { flexDirection: 'row', gap: 10 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, height: 44, gap: 8, elevation: 2 },
  searchInput: { flex: 1, fontSize: 14, color: '#1E293B', fontWeight: '600' },
  sortBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },

  sortPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  sortPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  sortPillActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  sortPillText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },

  activeSortRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#EBF5FB' },
  activeSortText: { fontSize: 12, color: '#003366', fontWeight: '700', flex: 1 },
  clearSort: { fontSize: 12, color: '#EF4444', fontWeight: '800' },

  card: { backgroundColor: '#fff', borderRadius: 18, marginBottom: 12, flexDirection: 'row', overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
  cardAccent: { width: 5, backgroundColor: '#003366' },
  cardBody: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: '#1E293B', marginBottom: 3 },
  cardDesc: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginBottom: 6 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardFee: { fontSize: 12, color: '#003366', fontWeight: '700' },
  applyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#003366', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  applyText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#94A3B8', marginTop: 16 },
  clearBtn: { marginTop: 16, backgroundColor: '#003366', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  clearBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
