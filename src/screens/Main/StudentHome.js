import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Surface } from 'react-native-paper';

export default function StudentHome({ navigation }) {
  
  const CategoryCard = ({ title, sub, icon, color, categoryName }) => (
    <TouchableOpacity 
      style={styles.cardWrapper} 
      onPress={() => navigation.navigate('ServiceList', { 
        mainMenu: "Students", 
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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Student Corner</Text>
        <Text style={styles.subtitle}>Educational services & scholarships</Text>
      </View>

      <View style={styles.list}>
        <CategoryCard title="Scholarships" sub="UP Scholarship, NSP" icon="school" color="#6366F1" categoryName="Scholarships" />
        <CategoryCard title="Entrance Exams" sub="CUET, JEE, NEET, PET" icon="file-document-edit" color="#F59E0B" categoryName="Entrance Exams" />
        <CategoryCard title="Board Results" sub="All State & Central Boards" icon="clipboard-check" color="#10B981" categoryName="Board Results" />
        <CategoryCard title="E-Learning" sub="Study Material & Notes" icon="laptop" color="#3B82F6" categoryName="E-Learning" />
        <CategoryCard title="Skill Training" sub="PMKVY, Computer Courses" icon="tools" color="#64748B" categoryName="Skill Training" />
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
