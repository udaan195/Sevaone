import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Share, Alert, BackHandler
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Clipboard } from 'react-native';

export default function SubmitSuccess({ route, navigation }) {
  const { trackingId } = route.params || {};

  // ✅ Animations
  const scaleAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Entrance animation
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    // ✅ Prevent back to payment screen
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('MainTabs', { screen: 'Application' });
      return true;
    });
    return () => sub.remove();
  }, []);

  const copyTrackingId = async () => {
    if (!trackingId) return;
    Clipboard.setString(trackingId);
    Alert.alert('Copied!', 'Tracking ID copy ho gaya');
  };

  const shareSuccess = async () => {
    try {
      await Share.share({
        message: `🎉 Maine SewaOne se successfully apply kar diya!\n\nTracking ID: #${trackingId}\n\nAap bhi ghar baithe sarkari forms apply karein 👇\nhttps://sewaone.in`
      });
    } catch {}
  };

  return (
    <View style={s.container}>
      {/* Confetti dots */}
      {[...Array(8)].map((_, i) => (
        <Animated.View
          key={i}
          style={[
            s.confettiDot,
            {
              left: `${10 + i * 12}%`,
              top: `${5 + (i % 3) * 8}%`,
              backgroundColor: ['#FFD700','#10B981','#3B82F6','#EF4444','#8B5CF6','#F59E0B','#EC4899','#06B6D4'][i],
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        />
      ))}

      <Animated.View style={[s.card, { transform: [{ scale: scaleAnim }] }]}>

        {/* Success icon */}
        <View style={s.iconCircle}>
          <MaterialCommunityIcons name="check-decagram" size={72} color="#10B981" />
        </View>

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Text style={s.title}>Application Submit!</Text>
          <Text style={s.subtitle}>
            Aapki application successfully receive ho gayi hai. SewaOne team aapka form process karegi.
          </Text>

          {/* Tracking ID box */}
          <TouchableOpacity style={s.trackingBox} onPress={copyTrackingId} activeOpacity={0.8}>
            <View style={s.trackingLeft}>
              <Text style={s.trackingLabel}>TRACKING ID</Text>
              <Text style={s.trackingId}>#{trackingId}</Text>
            </View>
            <View style={s.copyBtn}>
              <MaterialCommunityIcons name="content-copy" size={18} color="#003366" />
              <Text style={s.copyText}>Copy</Text>
            </View>
          </TouchableOpacity>

          {/* What next */}
          <View style={s.nextStepsBox}>
            <Text style={s.nextStepsTitle}>⏭️ Aage Kya Hoga?</Text>
            {[
              { icon: 'account-check', text: 'Agent assign hoga — aapko notification aayegi' },
              { icon: 'file-edit', text: 'Team aapka form process karegi' },
              { icon: 'bell-ring', text: 'Status updates notifications pe milenge' },
              { icon: 'download', text: 'Final document app mein available hoga' },
            ].map((item, i) => (
              <View key={i} style={s.nextStepRow}>
                <View style={s.nextStepIcon}>
                  <MaterialCommunityIcons name={item.icon} size={16} color="#003366" />
                </View>
                <Text style={s.nextStepText}>{item.text}</Text>
              </View>
            ))}
          </View>

          {/* Buttons */}
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Application' })}
          >
            <MaterialCommunityIcons name="file-document-outline" size={18} color="#fff" />
            <Text style={s.primaryBtnText}>TRACK MY APPLICATION</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.shareBtn} onPress={shareSuccess}>
            <MaterialCommunityIcons name="share-variant" size={18} color="#003366" />
            <Text style={s.shareBtnText}>Share with Friends</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#003366', justifyContent: 'center', padding: 20 },

  confettiDot: {
    position: 'absolute', width: 10, height: 10, borderRadius: 5,
  },

  card: {
    backgroundColor: '#fff', borderRadius: 28, padding: 28,
    elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20,
  },

  iconCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center', marginBottom: 20,
    borderWidth: 4, borderColor: '#DCFCE7',
  },

  title: { fontSize: 26, fontWeight: '900', color: '#003366', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24 },

  // Tracking ID
  trackingBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#EBF5FB', borderRadius: 16, padding: 18, marginBottom: 20,
    borderWidth: 2, borderColor: '#BFDBFE',
  },
  trackingLeft: { flex: 1 },
  trackingLabel: { fontSize: 10, fontWeight: '900', color: '#1a5276', letterSpacing: 1.5, marginBottom: 4 },
  trackingId: { fontSize: 20, fontWeight: '900', color: '#003366' },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  copyText: { fontSize: 12, fontWeight: '800', color: '#003366' },

  // Next steps
  nextStepsBox: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, marginBottom: 20 },
  nextStepsTitle: { fontSize: 13, fontWeight: '900', color: '#1E293B', marginBottom: 14 },
  nextStepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  nextStepIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#EBF5FB', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  nextStepText: { fontSize: 13, color: '#475569', flex: 1, lineHeight: 18 },

  // Buttons
  primaryBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    backgroundColor: '#003366', padding: 17, borderRadius: 16, marginBottom: 12, elevation: 3,
  },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
  shareBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  shareBtnText: { color: '#003366', fontWeight: '700', fontSize: 14 },
});
