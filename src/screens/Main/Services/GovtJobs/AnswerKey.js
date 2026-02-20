import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AnswerKey() {
  return (
    <View style={styles.center}>
      <Text style={styles.text}>Answer Key Section Ready!</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 18, fontWeight: 'bold' }
});
