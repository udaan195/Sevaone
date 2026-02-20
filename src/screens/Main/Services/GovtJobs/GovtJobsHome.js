import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function GovtJobsHome({ navigation }) {
  // Menu items array for cleaner code
  const menuItems = [
    { id: 'latest-jobs', title: 'Latest Jobs', icon: 'briefcase-check', color: '#003366', desc: 'New vacancies & forms' },
    { id: 'admit-card', title: 'Admit Cards', icon: 'card-account-details', color: '#FF9800', desc: 'Download exam hall tickets' },
    { id: 'result', title: 'Results', icon: 'trophy-variant', color: '#4CAF50', desc: 'Check your exam scores' },
    { id: 'answer-key', title: 'Answer Keys', icon: 'key-variant', color: '#E91E63', desc: 'Verify your answers' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Government Services</Text>
          <Text style={styles.headerSub}>Select a category to view listings</Text>
        </View>

        <View style={styles.grid}>
          {menuItems.map((item) => (
            <TouchableOpacity 
              key={item.id}
              style={styles.card}
              onPress={() => navigation.navigate('JobList', { category: item.id })}
            >
              <View style={[styles.iconBox, { backgroundColor: item.color + '15' }]}>
                <MaterialCommunityIcons name={item.icon} size={32} color={item.color} />
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDesc}>{item.desc}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" style={styles.arrow} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

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
  scrollContainer: { padding: 20, paddingBottom: 100 },
  header: { marginBottom: 25 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1E293B' },
  headerSub: { fontSize: 14, color: '#64748B', marginTop: 5 },
  grid: { gap: 15 },
  card: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 20, 
    flexDirection: 'row', 
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    position: 'relative'
  },
  iconBox: { width: 60, height: 60, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: '#1E293B' },
  cardDesc: { fontSize: 12, color: '#94A3B8', marginTop: 2, position: 'absolute', left: 95, bottom: 15 },
  arrow: { position: 'absolute', right: 20 },
  verifiedFooter: { 
    position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#fff', 
    padding: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', 
    borderTopWidth: 1, borderTopColor: '#E2E8F0' 
  },
  footerText: { fontSize: 11, color: '#10B981', fontWeight: 'bold', marginLeft: 5 }
});
