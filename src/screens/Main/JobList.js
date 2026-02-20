import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator 
} from 'react-native';
import { db } from '../../api/firebaseConfig';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function JobList({ navigation, route }) {
  // Category fetch logic
  const { category } = route.params || { category: 'latest-jobs' };
  
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let q;
    try {
      // Logic: Category wise filtering aur Sorting
      q = query(
        collection(db, "gov_jobs"), 
        where("category", "==", category),
        orderBy("lastUpdated", "desc") 
      );
    } catch (e) {
      // Fallback: Agar Index nahi bana toh bina sorting ke dikhao
      q = query(collection(db, "gov_jobs"), where("category", "==", category));
    }

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setJobs(data);
      setFilteredJobs(data);
      setLoading(false);
    }, (error) => {
      console.log("Firestore Error:", error);
      // Agar 'Index Required' error aaye, toh bina orderBy ke try karein
      const fallbackQuery = query(collection(db, "gov_jobs"), where("category", "==", category));
      onSnapshot(fallbackQuery, (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setJobs(data);
        setFilteredJobs(data);
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, [category]);

  // Search Functionality
  const handleSearch = (text) => {
    setSearch(text);
    if (!text) {
      setFilteredJobs(jobs);
      return;
    }
    const filtered = jobs.filter(item => 
      item.title.toLowerCase().includes(text.toLowerCase()) ||
      item.conductedBy.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredJobs(filtered);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.jobCard} 
      onPress={() => navigation.navigate('JobDetails', { job: item })}
    >
      <View style={styles.cardAccent} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.conductedText}>{item.conductedBy}</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" />
        </View>
        <Text style={styles.jobTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.cardFooter}>
          <View style={styles.tag}>
            <MaterialCommunityIcons name="calendar" size={12} color="#64748B" />
            <Text style={styles.tagText}>
              {item.lastUpdated ? new Date(item.lastUpdated.toDate()).toLocaleDateString() : 'New'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#003366" />
      <Text style={{marginTop: 10, color: '#64748B'}}>Fetching Latest Updates...</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={22} color="#94A3B8" />
          <TextInput 
            style={styles.searchInput}
            placeholder={`Search in ${category.replace('-', ' ')}...`}
            value={search}
            onChangeText={handleSearch}
          />
          {search !== '' && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <MaterialCommunityIcons name="close-circle" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Jobs List */}
      <FlatList 
        data={filteredJobs}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="text-search-variant" size={60} color="#E2E8F0" />
            <Text style={styles.emptyText}>Bhai, abhi koi job nahi mili.</Text>
            <Text style={styles.emptySub}>Admin panel se check karein agar jobs add ho gayi hain.</Text>
          </View>
        }
      />

      {/* Verified Footer */}
      <View style={styles.verifiedFooter}>
        <MaterialCommunityIcons name="shield-check" size={16} color="#10B981" />
        <Text style={styles.footerText}>Verified by SewaOne Secure Systems</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#003366', padding: 20, borderBottomLeftRadius: 25, borderBottomRightRadius: 25, elevation: 5 },
  searchBar: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center' },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#1E293B' },
  listContent: { padding: 15, paddingBottom: 100 },
  jobCard: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 15, flexDirection: 'row', overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  cardAccent: { width: 6, backgroundColor: '#003366' },
  cardContent: { flex: 1, padding: 15 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  conductedText: { fontSize: 11, fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase' },
  jobTitle: { fontSize: 15, fontWeight: 'bold', color: '#1E293B', lineHeight: 22 },
  cardFooter: { marginTop: 10, flexDirection: 'row', alignItems: 'center' },
  tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 11, color: '#64748B', marginLeft: 5, fontWeight: '600' },
  emptyBox: { marginTop: 100, alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#475569', marginTop: 15 },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 5 },
  verifiedFooter: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#fff', padding: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  footerText: { fontSize: 11, color: '#10B981', fontWeight: 'bold', marginLeft: 5 }
});
