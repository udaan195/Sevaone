// ============================================================
// FILE: src/components/OfflineBanner.js
// FEATURE: Offline mode — internet nahi hai toh banner dikhao
// USE: App.js mein wrap karo ya kisi bhi screen mein use karo
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const reconnectTimer = useRef(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = !state.isConnected || !state.isInternetReachable;

      if (offline) {
        // Offline ho gaya
        setIsOffline(true);
        setShowReconnected(false);
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        // Banner slide down
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }).start();
      } else {
        // Wapas online hua
        if (isOffline || wasOffline) {
          setIsOffline(false);
          setShowReconnected(true);
          setWasOffline(false);
          // 2.5 sec mein reconnected message hide karo
          reconnectTimer.current = setTimeout(() => {
            setShowReconnected(false);
            Animated.timing(slideAnim, {
              toValue: -60,
              duration: 300,
              useNativeDriver: true,
            }).start();
          }, 2500);
        } else {
          // Pehli baar online — banner nahi dikhana
          Animated.timing(slideAnim, {
            toValue: -60,
            duration: 1,
            useNativeDriver: true,
          }).start();
        }
      }
      if (offline) setWasOffline(true);
    });

    return () => {
      unsubscribe();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [isOffline, wasOffline]);

  if (!isOffline && !showReconnected) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          transform: [{ translateY: slideAnim }],
          backgroundColor: showReconnected ? '#10B981' : '#EF4444',
        }
      ]}
    >
      <MaterialCommunityIcons
        name={showReconnected ? 'wifi-check' : 'wifi-off'}
        size={18}
        color="#fff"
      />
      <Text style={styles.text}>
        {showReconnected
          ? '✅ Internet wapas aa gaya!'
          : '📵 Internet nahi hai — Offline Mode'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    gap: 8,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  text: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
});
