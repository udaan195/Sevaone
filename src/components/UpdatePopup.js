// ============================================================
// FILE: src/components/UpdatePopup.js
// In-app update popup with download link
// ============================================================
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, Linking, ScrollView, Animated, BackHandler
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function UpdatePopup({ updateInfo, onClose }) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (updateInfo) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [updateInfo]);

  // Force update pe back button disable
  useEffect(() => {
    if (!updateInfo?.forceUpdate) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [updateInfo]);

  const handleDownload = () => {
    Linking.openURL(updateInfo.apkUrl);
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem('skipped_update_version', updateInfo.version);
    onClose();
  };

  if (!updateInfo) return null;

  return (
    <Modal visible={true} transparent animationType="none">
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[s.card, { transform: [{ scale: scaleAnim }] }]}>

          {/* Badge */}
          <View style={[s.badge, updateInfo.forceUpdate && { backgroundColor: '#EF4444' }]}>
            <MaterialCommunityIcons
              name={updateInfo.forceUpdate ? 'alert' : 'star-circle'}
              size={12} color="#fff"
            />
            <Text style={s.badgeText}>
              {updateInfo.forceUpdate ? 'ZAROORI UPDATE' : 'NEW UPDATE'}
            </Text>
          </View>

          {/* Icon */}
          <View style={s.iconWrap}>
            <Text style={{ fontSize: 42 }}>🚀</Text>
          </View>

          {/* Title */}
          <Text style={s.title}>
            {updateInfo.forceUpdate ? 'Update Zaroori Hai!' : 'Naya Update Aaya!'}
          </Text>
          <View style={s.versionBadge}>
            <Text style={s.versionText}>Version {updateInfo.version}</Text>
          </View>

          <Text style={s.desc}>{updateInfo.description}</Text>

          {/* Changes */}
          <View style={s.changesBox}>
            <Text style={s.changesTitle}>Is update mein kya naya:</Text>
            <ScrollView style={{ maxHeight: 130 }} showsVerticalScrollIndicator={false}>
              {(updateInfo.changes || []).map((c, i) => (
                <View key={i} style={s.changeRow}>
                  <Text style={s.changeIcon}>✅</Text>
                  <Text style={s.changeText}>{c}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Download button */}
          <TouchableOpacity style={s.dlBtn} onPress={handleDownload} activeOpacity={0.88}>
            <MaterialCommunityIcons name="android" size={22} color="#fff" />
            <Text style={s.dlBtnText}>Download v{updateInfo.version} — Free</Text>
          </TouchableOpacity>

          {/* Skip — only if not force update */}
          {!updateInfo.forceUpdate && (
            <TouchableOpacity style={s.skipBtn} onPress={handleSkip}>
              <Text style={s.skipText}>Baad mein remind karo</Text>
            </TouchableOpacity>
          )}

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,20,60,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 18,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  iconWrap: {
    width: 90, height: 90,
    backgroundColor: '#EBF5FB',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#BFDBFE',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#002855',
    textAlign: 'center',
    marginBottom: 8,
  },
  versionBadge: {
    backgroundColor: '#EBF5FB',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
  },
  versionText: { color: '#003d99', fontWeight: '800', fontSize: 13 },
  desc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  changesBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  changesTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  changeRow: { flexDirection: 'row', gap: 8, marginBottom: 7 },
  changeIcon: { fontSize: 12, marginTop: 1 },
  changeText: { fontSize: 13, color: '#475569', flex: 1, lineHeight: 19 },
  dlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#002855',
    padding: 16,
    borderRadius: 16,
    width: '100%',
    marginBottom: 10,
    elevation: 4,
    shadowColor: '#002855',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  dlBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  skipBtn: { padding: 10, width: '100%', alignItems: 'center' },
  skipText: { color: '#94A3B8', fontWeight: '600', fontSize: 13 },
});
