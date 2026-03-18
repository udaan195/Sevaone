// ============================================================
// FILE: src/components/SkeletonLoader.js
// FEATURE: Loading skeleton — screen blank nahi dikhegi
// USE: <SkeletonCard /> ya <SkeletonList count={5} />
// ============================================================

import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Dimensions } from "react-native";
import { useAppTheme } from "../context/ThemeContext";

const { width } = Dimensions.get("window");

function SkeletonBox({ width: w, height: h, style }) {
  const { theme } = useAppTheme();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <Animated.View
      style={[
        { width: w, height: h, borderRadius: 8, backgroundColor: theme.border, opacity },
        style,
      ]}
    />
  );
}

// ── Card Skeleton (for service/job cards) ──────────────────
export function SkeletonCard() {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <SkeletonBox width={50} height={50} style={{ borderRadius: 25 }} />
      <View style={{ flex: 1, marginLeft: 15 }}>
        <SkeletonBox width="80%" height={14} style={{ marginBottom: 8 }} />
        <SkeletonBox width="50%" height={10} />
      </View>
    </View>
  );
}

// ── List Skeleton ──────────────────────────────────────────
export function SkeletonList({ count = 4 }) {
  return (
    <View style={{ padding: 15 }}>
      {Array(count).fill(null).map((_, i) => <SkeletonCard key={i} />)}
    </View>
  );
}

// ── Banner Skeleton ────────────────────────────────────────
export function SkeletonBanner() {
  const { theme } = useAppTheme();
  return (
    <View style={{ marginHorizontal: 20, marginTop: 20 }}>
      <SkeletonBox width={width - 40} height={160} style={{ borderRadius: 20 }} />
    </View>
  );
}

// ── Grid Skeleton (for home service grid) ─────────────────
export function SkeletonGrid() {
  const { theme } = useAppTheme();
  return (
    <View style={styles.grid}>
      {Array(6).fill(null).map((_, i) => (
        <View key={i} style={styles.gridItem}>
          <SkeletonBox width={65} height={65} style={{ borderRadius: 22 }} />
          <SkeletonBox width={60} height={10} style={{ marginTop: 8 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 15,
    marginBottom: 12,
    elevation: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 15,
  },
  gridItem: { width: "30%", alignItems: "center", marginBottom: 20 },
});