import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AdmitCards() {
  return (
    <View style={styles.center}>
      <Text style={styles.text}>Admit Cards Section Ready!</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 18, fontWeight: 'bold' }
});
