// ============================================================
// FILE: src/components/DraftBanner.js
// Show when draft exists — restore or discard
// ============================================================
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loadDraft, clearDraft } from '../utils/draftManager';

export default function DraftBanner({ jobId, onRestore, onDiscard }) {
  const [draft, setDraft]     = useState(null);
  const [visible, setVisible] = useState(false);
  const slideAnim             = useState(new Animated.Value(-100))[0];

  useEffect(() => {
    if (!jobId) return;
    loadDraft(jobId).then(d => {
      if (d) {
        setDraft(d);
        setVisible(true);
        Animated.spring(slideAnim, {
          toValue: 0, tension: 50, friction: 8, useNativeDriver: true,
        }).start();
      }
    });
  }, [jobId]);

  if (!visible || !draft) return null;

  const savedAt = new Date(draft.savedAt);
  const timeAgo = () => {
    const diff = Math.floor((Date.now() - savedAt) / 60000);
    if (diff < 1)  return 'Just now';
    if (diff < 60) return `${diff} min ago`;
    if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
    return savedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const handleRestore = () => {
    setVisible(false);
    onRestore(draft);
  };

  const handleDiscard = async () => {
    await clearDraft(jobId);
    setVisible(false);
    if (onDiscard) onDiscard();
  };

  return (
    <Animated.View style={[s.banner, { transform: [{ translateY: slideAnim }] }]}>
      <View style={s.left}>
        <MaterialCommunityIcons name="content-save" size={20} color="#92400E" />
        <View style={{ marginLeft: 10 }}>
          <Text style={s.title}>Draft Found!</Text>
          <Text style={s.sub}>Saved {timeAgo()} — Step {draft.step + 1}</Text>
        </View>
      </View>
      <View style={s.btns}>
        <TouchableOpacity style={s.discardBtn} onPress={handleDiscard}>
          <Text style={s.discardText}>Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.restoreBtn} onPress={handleRestore}>
          <MaterialCommunityIcons name="restore" size={14} color="#fff" />
          <Text style={s.restoreText}>Restore</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  banner:      { backgroundColor: '#FEF3C7', borderRadius: 16, padding: 14, margin: 16, marginBottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, borderLeftWidth: 4, borderLeftColor: '#F59E0B' },
  left:        { flexDirection: 'row', alignItems: 'center', flex: 1 },
  title:       { fontSize: 13, fontWeight: '900', color: '#92400E' },
  sub:         { fontSize: 11, color: '#B45309', fontWeight: '600', marginTop: 1 },
  btns:        { flexDirection: 'row', gap: 8 },
  discardBtn:  { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.08)' },
  discardText: { fontSize: 12, fontWeight: '800', color: '#92400E' },
  restoreBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#F59E0B' },
  restoreText: { fontSize: 12, fontWeight: '900', color: '#fff' },
});
