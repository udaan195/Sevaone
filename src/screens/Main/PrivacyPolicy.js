import React from 'react';
import { 
  View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function PrivacyPolicy({ navigation }) {
  
  // Reusable Section Component
  const PolicySection = ({ title, content, icon }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name={icon} size={22} color="#003366" />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.sectionContent}>{content}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <MaterialCommunityIcons name="shield-check" size={60} color="#003366" />
          <Text style={styles.mainTitle}>Privacy Policy</Text>
          <Text style={styles.lastUpdated}>Last Updated: January 2026</Text>
        </View>

        <Text style={styles.introText}>
          SewaOne Digital Portal par aapka swagat hai. Hum aapki privacy aur data security ko sabse upar rakhte hain. Is policy mein bataya gaya hai ki hum aapka data kaise handle karte hain.
        </Text>

        <PolicySection 
          icon="account-details"
          title="1. Information We Collect"
          content="Hum aapse wahi jankari lete hain jo application process ke liye zaruri hai, jaise ki aapka Name, Phone Number, Email, City, Pincode aur zaruri Documents."
        />

        <PolicySection 
          icon="database-lock"
          title="2. How We Use Data"
          content="Aapka data sirf Government Jobs, Schemes aur Citizen Services ko apply karne ke liye use kiya jata hai. Hum aapka data kisi third-party ko sell nahi karte."
        />

        <PolicySection 
          icon="security"
          title="3. Data Security"
          content="SewaOne 256-bit encryption ka use karta hai. Aapka saara data Firebase Secure Cloud par encrypted format mein rehta hai."
        />

        <PolicySection 
          icon="wallet"
          title="4. Financial Transactions"
          content="Humare portal par hone wale saare payments aur refunds (Wallet/Gateways) puri tarah secure hain aur inka audit record rakha jata hai."
        />

        <PolicySection 
          icon="account-edit"
          title="5. Your Rights"
          content="Aap jab chahein apni details Profile section mein ja kar update kar sakte hain. Aapka system hamesha verified data hi process karega."
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Agar aapka koi sawal hai, toh humein contact karein:</Text>
          <Text style={styles.emailText}>support@sewaone.com</Text>
        </View>

        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backBtnText}>I UNDERSTAND</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 25 },
  header: { alignItems: 'center', marginBottom: 30 },
  mainTitle: { fontSize: 26, fontWeight: '900', color: '#003366', marginTop: 10 },
  lastUpdated: { fontSize: 12, color: '#94A3B8', fontWeight: '700', marginTop: 5 },
  introText: { fontSize: 14, color: '#475569', lineHeight: 22, textAlign: 'center', marginBottom: 30, fontWeight: '500' },
  
  section: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 20, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginLeft: 10 },
  sectionContent: { fontSize: 13, color: '#64748B', lineHeight: 20, fontWeight: '600' },
  
  footer: { marginTop: 20, alignItems: 'center', padding: 20 },
  footerText: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  emailText: { fontSize: 15, color: '#003366', fontWeight: '900', marginTop: 5 },
  
  backBtn: { backgroundColor: '#003366', padding: 18, borderRadius: 15, marginTop: 30, alignItems: 'center' },
  backBtnText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 1 }
});
