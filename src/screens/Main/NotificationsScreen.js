import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, ActivityIndicator } from 'react-native';
import { db } from '../../api/firebaseConfig';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ✨ Global Notifications fetch karein
    const q = query(collection(db, "notifications"), orderBy("timestamp", "desc"));
    
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.notiCard}>
      <View style={[styles.iconBox, { backgroundColor: item.type === 'update' ? '#E0F2FE' : '#FEE2E2' }]}>
        <MaterialCommunityIcons 
          name={item.type === 'update' ? "bullhorn-variant" : "alert-circle"} 
          size={24} 
          color={item.type === 'update' ? "#0369A1" : "#EF4444"} 
        />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.notiTitle}>{item.title}</Text>
        <Text style={styles.notiMsg}>{item.message}</Text>
        <Text style={styles.notiTime}>{item.timestamp?.toDate().toLocaleString()}</Text>
      </View>
    </View>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator color="#003366" size="large" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 20 }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="bell-off-outline" size={60} color="#CBD5E1" />
            <Text style={styles.emptyText}>Bhai, abhi koi naya update nahi hai.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notiCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 18, marginBottom: 12, elevation: 1 },
  iconBox: { width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  textContainer: { flex: 1 },
  notiTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  notiMsg: { fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18, fontWeight: '500' },
  notiTime: { fontSize: 10, color: '#94A3B8', marginTop: 8, fontWeight: '700' },
  emptyBox: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#94A3B8', marginTop: 15, fontWeight: '700' }
});
