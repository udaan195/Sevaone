import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  StatusBar, TouchableOpacity, Animated, Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

export default function PrivateJobs({ navigation }) {
  const { theme } = useAppTheme();

  // Animations
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const badgeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 600, useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1, tension: 50, friction: 8, useNativeDriver: true,
      }),
    ]).start();

    // Floating icon loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -12, duration: 1800, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0,   duration: 1800, useNativeDriver: true }),
      ])
    ).start();

    // Badge pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(badgeAnim, { toValue: 1, duration: 800,  useNativeDriver: true }),
        Animated.timing(badgeAnim, { toValue: 0, duration: 800,  useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const badgeScale = badgeAnim.interpolate({
    inputRange: [0, 1], outputRange: [1, 1.08],
  });

  const features = [
    { icon: 'domain',               color: '#3B82F6', label: 'Top Companies'      },
    { icon: 'briefcase-search',     color: '#8B5CF6', label: 'Smart Job Match'    },
    { icon: 'bell-ring',            color: '#F59E0B', label: 'Instant Alerts'     },
    { icon: 'file-document-edit',   color: '#10B981', label: 'Easy Apply'         },
    { icon: 'chart-line',           color: '#EF4444', label: 'Salary Insights'    },
    { icon: 'shield-check',         color: '#002855', label: 'Verified Listings'  },
  ];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor="#002855" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Private Jobs</Text>
        <View style={{ width: 38 }} />
      </View>

      <Animated.View style={[s.body, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>

        {/* Coming Soon Badge */}
        <Animated.View style={[s.badge, { transform: [{ scale: badgeScale }] }]}>
          <MaterialCommunityIcons name="clock-fast" size={13} color="#92400E" />
          <Text style={s.badgeText}>COMING SOON</Text>
        </Animated.View>

        {/* Floating Icon */}
        <Animated.View style={[s.iconWrap, { transform: [{ translateY: floatAnim }] }]}>
          <View style={s.iconCircle}>
            <MaterialCommunityIcons name="briefcase-variant" size={64} color="#002855" />
          </View>
          {/* Orbit dots */}
          <View style={[s.orbitDot, { top: 8,  right: 8,  backgroundColor: '#3B82F6' }]} />
          <View style={[s.orbitDot, { bottom: 10, left: 12, backgroundColor: '#10B981' }]} />
          <View style={[s.orbitDot, { top: 20, left: 0,  backgroundColor: '#F59E0B', width: 8, height: 8 }]} />
        </Animated.View>

        {/* Title */}
        <Text style={[s.title, { color: theme.text }]}>Private Jobs</Text>
        <Text style={[s.title2, { color: '#002855' }]}>Portal</Text>
        <Text style={[s.sub, { color: theme.textMuted }]}>
          We are building something amazing.{'\n'}
          Corporate & private sector jobs are{'\n'}coming to SewaOne very soon!
        </Text>

        {/* Features grid */}
        <View style={s.featuresGrid}>
          {features.map((f, i) => (
            <View key={i} style={[s.featureCard, { backgroundColor: theme.card }]}>
              <View style={[s.featureIcon, { backgroundColor: f.color + '18' }]}>
                <MaterialCommunityIcons name={f.icon} size={22} color={f.color} />
              </View>
              <Text style={[s.featureLabel, { color: theme.text }]}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* Notify button */}
        <TouchableOpacity style={s.notifyBtn} activeOpacity={0.85}>
          <MaterialCommunityIcons name="bell-plus" size={18} color="#fff" />
          <Text style={s.notifyBtnText}>Notify Me When Live</Text>
        </TouchableOpacity>

        <Text style={[s.footer, { color: theme.textMuted }]}>
          🚀 Launching Soon — Stay Tuned!
        </Text>

      </Animated.View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#002855', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:     { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },

  body:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 30 },

  badge:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 28, borderWidth: 1, borderColor: '#FDE68A' },
  badgeText:   { fontSize: 11, fontWeight: '900', color: '#92400E', letterSpacing: 1.5 },

  iconWrap:    { width: 140, height: 140, justifyContent: 'center', alignItems: 'center', marginBottom: 24, position: 'relative' },
  iconCircle:  { width: 120, height: 120, borderRadius: 36, backgroundColor: '#EBF5FB', justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#002855', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16 },
  orbitDot:    { position: 'absolute', width: 12, height: 12, borderRadius: 6 },

  title:       { fontSize: 32, fontWeight: '900', textAlign: 'center', lineHeight: 36 },
  title2:      { fontSize: 32, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  sub:         { fontSize: 14, textAlign: 'center', lineHeight: 24, marginBottom: 28 },

  featuresGrid:{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 28, width: '100%' },
  featureCard: { width: (width - 68) / 3, alignItems: 'center', padding: 12, borderRadius: 16, elevation: 1, gap: 8 },
  featureIcon: { width: 44, height: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  featureLabel:{ fontSize: 10, fontWeight: '800', textAlign: 'center' },

  notifyBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#002855', paddingHorizontal: 28, paddingVertical: 15, borderRadius: 16, elevation: 4, shadowColor: '#002855', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, marginBottom: 16 },
  notifyBtnText:{ color: '#fff', fontWeight: '900', fontSize: 15 },

  footer:      { fontSize: 12, fontWeight: '700' },
});
