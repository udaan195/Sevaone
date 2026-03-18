// ============================================================
// FILE: src/components/CachedImage.js
// FEATURE: Image caching — FastImage alternative for Expo
// expo-image use karo — built-in caching with Expo
// USE: <CachedImage uri="https://..." style={...} />
// ============================================================

import React, { useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

// expo-image has built-in caching — blurhash placeholder support bhi hai
const blurhash = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4'; // Generic placeholder

export default function CachedImage({
  uri,
  style,
  resizeMode = 'cover',
  showLoader = true,
  placeholder = blurhash,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <View style={[styles.wrapper, style]}>
      <Image
        source={error ? require('../assets/placeholder.png') : { uri }}
        style={[StyleSheet.absoluteFillObject]}
        contentFit={resizeMode}
        placeholder={placeholder}
        cachePolicy="memory-disk"  // ✅ Memory + Disk dono cache
        transition={200}           // Smooth fade in
        onLoadStart={() => setLoading(true)}
        onLoad={() => setLoading(false)}
        onError={() => { setLoading(false); setError(true); }}
      />
      {loading && showLoader && (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="small" color="#003366" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { overflow: 'hidden', backgroundColor: '#F1F5F9' },
  loaderBox: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
});
