import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function SubmitSuccess({ route, navigation }) {
  // ApplicationReview se data receive ho raha hai
  const { trackingId, agentName } = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.successCard}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="check-decagram" size={80} color="#10B981" />
        </View>
        <Text style={styles.congrats}>Submission Successful!</Text>
        <Text style={styles.subText}>Your application has been received and added to the admin pool for verification.</Text>
        
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>TRACKING ID</Text>
          <Text style={styles.infoVal}>{trackingId}</Text>
          <View style={styles.divider} />
          <Text style={styles.infoLabel}>ASSIGNED TO</Text>
          <Text style={styles.infoVal}>{agentName || 'Admin Assignment Pending'}</Text>
        </View>

        <TouchableOpacity 
          style={styles.homeBtn} 
          /* FIX: Extra dot (.) hata diya gaya hai */
          onPress={() => navigation.navigate('MainTabs', { screen: 'Application' })}
        >
          <Text style={styles.homeBtnText}>TRACK IN MY APPLICATIONS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#003366', justifyContent: 'center', padding: 25 },
  successCard: { backgroundColor: '#fff', borderRadius: 30, padding: 30, alignItems: 'center', elevation: 20 },
  iconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  congrats: { fontSize: 24, fontWeight: '900', color: '#1E293B', textAlign: 'center' },
  subText: { textAlign: 'center', color: '#64748B', marginTop: 10, lineHeight: 20 },
  infoBox: { backgroundColor: '#F8FAFC', width: '100%', borderRadius: 20, padding: 20, marginVertical: 30, borderWidth: 1, borderColor: '#E2E8F0' },
  infoLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 1 },
  infoVal: { fontSize: 18, fontWeight: '900', color: '#003366', marginBottom: 15, marginTop: 4 },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginBottom: 15 },
  homeBtn: { backgroundColor: '#003366', width: '100%', padding: 20, borderRadius: 18, alignItems: 'center' },
  homeBtnText: { color: '#fff', fontWeight: '800', letterSpacing: 1 }
});
