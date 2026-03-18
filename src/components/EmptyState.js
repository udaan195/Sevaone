// ============================================================
// FILE: src/components/EmptyState.js
// FEATURE: Empty state — data nahi hone par blank screen nahi
// USE: <EmptyState icon="briefcase-off" title="Koi job nahi" subtitle="..." />
// ============================================================

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../context/ThemeContext";

export default function EmptyState({ icon = "folder-open-outline", title, subtitle, btnText, onBtnPress }) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.surface }]}>
        <MaterialCommunityIcons name={icon} size={52} color={theme.textMuted} />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>{title || "Koi data nahi mila"}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
      )}
      {btnText && onBtnPress && (
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: theme.primary }]}
          onPress={onBtnPress}
        >
          <Text style={styles.btnText}>{btnText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40, minHeight: 300 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, justifyContent: "center", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  btn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});