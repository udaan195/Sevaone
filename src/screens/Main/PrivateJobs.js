// ============================================================
// FILE: src/screens/Main/PrivateJobs.js
// Private / Corporate Jobs screen
// ============================================================
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, SafeAreaView, ActivityIndicator
} from 'react-native';
import { db } from '../../api/firebaseConfig';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';

export default function PrivateJobs({ navigation }) {
  const { theme } = useAppTheme();
  const [jobs, setJobs] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'gov_jobs'),
      where('category', '==', 'private-jobs'),
      orderBy('lastUpdated', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setJobs(data);
      setFiltered(data);
      setLoading(false);
    }, () => {
      // Fallback without orderBy
      const q2 = query(collection(db, 'gov_jobs'), where('category', '==', 'private-jobs'));
      onSnapshot(q2, (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setJobs(data);
        setFiltered(data);
        setLoading(false);
      });
    });

    return () => unsub();
  }, []);

  const handleSearch = (text) => {
    setSearch(text);
    if (!text.trim()) { setFiltered(jobs); return; }
    setFiltered(jobs.filter(j =>
      j.title?.toLowerCase().includes(text.toLowerCase()) ||
      j.conductedBy?.toLowerCase().includes(text.toLowerCase())
    ));
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.card }]}
      onPress={() => navigation.navigate('JobDetails', { jobId: item.id })}
      activeOpacity={0.85}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.iconBox, { backgroundColor: '#F3E5F5' }]}>
          <MaterialCommunityIcons name="office-building" size={26} color="#7B1FA2" />
        </View>
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
        {item.conductedBy && (
          <Text style={[styles.company, { color: theme.textMuted }]}>{item.conductedBy}</Text>
        )}
        <View style={styles.badge}>
          <MaterialCommunityIcons name="briefcase-variant" size={12} color="#7B1FA2" />
          <Text style={styles.badgeText}>PRIVATE JOB</Text>
        </View>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={theme.border} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Search */}
      <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={theme.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Company ya job naam se dhoondho..."
          placeholderTextColor={theme.textMuted}
          value={search}
          onChangeText={handleSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <MaterialCommunityIcons name="close-circle" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="office-building-outline" size={64} color={theme.border} />
              <Text style={[styles.emptyTitle, { color: theme.textMuted }]}>
                {search ? 'Koi job nahi mili' : 'Abhi koi private job nahi hai'}
              </Text>
              <Text style={[styles.emptySub, { color: theme.border }]}>
                Jald hi private companies ke opportunities aayenge
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 16, padding: 12, borderRadius: 14, borderWidth: 1.5,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderRadius: 18, marginBottom: 12,
    elevation: 2, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },
  cardLeft: { marginRight: 14 },
  iconBox: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cardContent: { flex: 1 },
  title: { fontSize: 15, fontWeight: '800', lineHeight: 21 },
  company: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 7, alignSelf: 'flex-start',
    backgroundColor: '#F3E5F5', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 20,
  },
  badgeText: { fontSize: 9, fontWeight: '900', color: '#7B1FA2' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '800', marginTop: 18 },
  emptySub: { fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 },
});
