import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Surface } from 'react-native-paper';

export default function OtherHome({ navigation }) {
  
  const CategoryCard = ({ title, sub, icon, color, categoryName }) => (
    <TouchableOpacity 
      style={styles.cardWrapper} 
      onPress={() => navigation.navigate('ServiceList', { 
        mainMenu: "Others", 
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
        <Text style={styles.title}>Other Services</Text>
        <Text style={styles.subtitle}>Miscellaneous utility services</Text>
      </View>

      <View style={styles.list}>
        <CategoryCard title="Utility Services" sub="Bill Payment, Recharge, Booking" icon="lightning-bolt" color="#F59E0B" categoryName="General Services" />
        <CategoryCard title="Business Services" sub="GST, MSME, ITR Filling" icon="finance" color="#003366" categoryName="Business Services" />
        <CategoryCard title="Legal Others" sub="Affidavits, Agreements" icon="gavel" color="#EF4444" categoryName="Legal Others" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 25, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#003366' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 5 },
  list: { padding: 15 },
  cardWrapper: { marginBottom: 15 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 15, backgroundColor: '#fff', elevation: 2, borderLeftWidth: 5 },
  iconBox: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  textBox: { flex: 1, marginLeft: 15 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  cardSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 }
});
