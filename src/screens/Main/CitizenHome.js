import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Surface } from 'react-native-paper';

export default function CitizenHome({ navigation }) {
  
  const CategoryCard = ({ title, sub, icon, color, categoryName }) => (
    <TouchableOpacity 
      style={styles.cardWrapper} 
      onPress={() => navigation.navigate('ServiceList', { 
        mainMenu: "Citizen Services", 
        category: categoryName 
      })}
    >
      <Surface style={[styles.card, { borderLeftColor: color }]}>
        <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
          <MaterialCommunityIcons name={icon} size={32} color={color} />
        </View>
        <View style={styles.textBox}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSub}>{sub}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#CBD5E1" />
      </Surface>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Citizen Services</Text>
        <Text style={styles.subtitle}>Select category to view live services</Text>
      </View>

      <View style={styles.list}>
        {/* Category names wahi rakhein jo Admin Panel mein hain */}
        <CategoryCard title="Identity Proof" sub="Aadhaar, PAN, Voter ID" icon="account-details" color="#3B82F6" categoryName="Identity Proof" />
        <CategoryCard title="Certificates" sub="Income, Caste, Domicile" icon="certificate" color="#EF4444" categoryName="Certificates" />
        <CategoryCard title="Transport" sub="License, RC, Challan" icon="car" color="#F59E0B" categoryName="Transport" />
        <CategoryCard title="Legal & Police" sub="FIR, Verification" icon="shield-account" color="#10B981" categoryName="Legal & Police" />
        <CategoryCard title="Others" sub="Miscellaneous Services" icon="apps" color="#64748B" categoryName="Others" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 25, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#003366' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 5 },
  list: { padding: 15 },
  cardWrapper: { marginBottom: 15 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 15, backgroundColor: '#fff', elevation: 2, borderLeftWidth: 5 },
  iconBox: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  textBox: { flex: 1, marginLeft: 15 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  cardSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 }
});
