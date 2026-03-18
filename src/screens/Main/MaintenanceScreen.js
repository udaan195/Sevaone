import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, SafeAreaView, StatusBar,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function MaintenanceScreen({ config = {} }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const spin  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 3000, useNativeDriver: true })
    ).start();
  }, []);

  const rotate = spin.interpolate({ inputRange: [0,1], outputRange: ['0deg','360deg'] });

  const title   = config.title        || 'Maintenance in Progress';
  const message = config.message      || 'Hum kuch improvements kar rahe hain. Thodi der mein wapas aayenge!';
  const eta     = config.estimatedTime|| '';
  const contact = config.contactNumber|| '';

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#002855" />

      <View style={s.container}>
        {/* Animated icon */}
        <Animated.View style={[s.iconWrap, { transform: [{ scale: pulse }] }]}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <MaterialCommunityIcons name="cog" size={60} color="#FFD700" />
          </Animated.View>
        </Animated.View>

        <Text style={s.title}>{title}</Text>
        <Text style={s.message}>{message}</Text>

        {eta ? (
          <View style={s.etaBox}>
            <MaterialCommunityIcons name="clock-outline" size={18} color="#FFD700" />
            <Text style={s.etaText}>Wapas aane ka samay: {eta}</Text>
          </View>
        ) : null}

        {contact ? (
          <View style={s.contactBox}>
            <MaterialCommunityIcons name="phone" size={16} color="#94A3B8" />
            <Text style={s.contactText}>Helpline: {contact}</Text>
          </View>
        ) : null}

        <View style={s.footer}>
          <Text style={s.footerText}>SewaOne — Har Sarkari Kaam, Ek Jagah</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#002855' },
  container:   { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  iconWrap:    { width: 120, height: 120, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 28, elevation: 8 },
  title:       { fontSize: 24, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 14 },
  message:     { fontSize: 15, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 24, marginBottom: 28 },
  etaBox:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,215,0,0.15)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  etaText:     { color: '#FFD700', fontWeight: '800', fontSize: 14 },
  contactBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 40 },
  contactText: { color: '#94A3B8', fontWeight: '600', fontSize: 13 },
  footer:      { position: 'absolute', bottom: 40 },
  footerText:  { color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: '600' },
});
