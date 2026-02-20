import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function LatestJobs() {
  return (
    <View style={styles.center}>
      <Text style={styles.text}>Latest Govt Jobs List Coming Soon!</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  text: { fontSize: 18, fontWeight: 'bold', color: '#003366' }
});
