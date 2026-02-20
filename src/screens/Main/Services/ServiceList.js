import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  ActivityIndicator, TextInput, StatusBar, Platform 
} from 'react-native';
import { db } from '../../../api/firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ServiceList({ route, navigation }) {
  const { mainMenu, category } = route.params; 
  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Admin mapping ke hisaab se data fetch
    const q = query(
      collection(db, "all_services"), 
      where("mainMenu", "==", mainMenu),
      where("category", "==", category)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setServices(data);
      setFilteredServices(data);
      setLoading(false);
    });
    return () => unsub();
  }, [mainMenu, category]);

  const handleSearch = (text) => {
    setSearch(text);
    if (text) {
      const filtered = services.filter(item => 
        item.title.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredServices(filtered);
    } else {
      setFilteredServices(services);
    }
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#003366" /></View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#003366" />
      
      {/* --- 🏛️ Sleek Custom Header --- */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backCircle}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerSubText}>{mainMenu.toUpperCase()}</Text>
            <Text style={styles.headerTitle}>{category}</Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
          <TextInput 
            style={styles.searchInput}
            placeholder={`Search ${category}...`}
            value={search}
            onChangeText={handleSearch}
            placeholderTextColor="#94A3B8"
          />
        </View>
      </View>

      {/* --- 📝 Premium Application-Style Cards --- */}
      <FlatList
        data={filteredServices}
        contentContainerStyle={{ padding: 15, paddingBottom: 50 }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          // --- 🛠️ Logic for Smart vs Simple Fee ---
          const totalFee = Number(item.officialFee || 0) + Number(item.serviceFee || 0);
          
          // Check if smart fee is enabled (Assume flag is feeType === 'smart' or isSmartFee)
          const isSmartFee = item.feeType === 'smart' || item.isSmartFee === true;

          return (
            <TouchableOpacity 
              activeOpacity={0.9}
              style={styles.serviceCard}
              onPress={() => navigation.navigate('ServiceDetails', { jobId: item.id })}
            >
              <View style={styles.leftAccent} />
              
              <View style={styles.cardMain}>
                <View style={styles.infoArea}>
                  <Text style={styles.titleText} numberOfLines={1}>{item.title}</Text>
                  
                  {/* ✨ Dynamic Fee Logic */}
                  {!isSmartFee && totalFee > 0 ? (
                    <Text style={styles.feeText}>Total Fee: ₹{totalFee}</Text>
                  ) : (
                    <Text style={styles.feeText}>Fee: Calculated on Application</Text>
                  )}
                </View>

                {/* Blue Apply Button */}
                <View style={styles.applyBadge}>
                  <Text style={styles.applyText}>APPLY</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>No services found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    backgroundColor: '#003366', 
    paddingTop: Platform.OS === 'ios' ? 60 : 45, 
    paddingHorizontal: 20, 
    paddingBottom: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 8
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  headerSubText: { fontSize: 10, color: '#A5C9FF', fontWeight: 'bold', letterSpacing: 0.5 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 15, height: 45, elevation: 4 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: '#1E293B', fontWeight: '600' },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    marginBottom: 15,
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  leftAccent: {
    width: 6,
    backgroundColor: '#003366',
  },
  cardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 18,
    justifyContent: 'space-between',
  },
  infoArea: {
    flex: 1,
    marginRight: 10,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 2,
  },
  feeText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
  },
  applyBadge: {
    backgroundColor: '#003366',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
  },
  applyText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  emptyText: { textAlign: 'center', marginTop: 100, color: '#94A3B8', fontWeight: 'bold' }
});
