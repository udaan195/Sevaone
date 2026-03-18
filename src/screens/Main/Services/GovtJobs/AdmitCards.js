// AUTO-REDIRECT — Yeh screen ab JobList use karti hai
// Purana placeholder tha — ab actual data dikhata hai
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';

export default function AdmitCards({ navigation, route }) {
  useEffect(() => {
    // Seedha JobList pe redirect karo sahi category ke saath
    navigation.replace('JobList', { category: 'admit-card' });
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
      <ActivityIndicator size="large" color="#003366" />
    </View>
  );
}
