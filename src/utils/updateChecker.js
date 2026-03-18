// ============================================================
// FILE: src/utils/updateChecker.js
// Checks Firebase for new app version on launch
// ============================================================
import { db } from '../api/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CURRENT_VERSION = '1.0.0'; // ← Har build pe update karo

// Version compare: "1.2.0" > "1.1.5" = true
export const isNewerVersion = (latest, current) => {
  const a = latest.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i]||0) > (b[i]||0)) return true;
    if ((a[i]||0) < (b[i]||0)) return false;
  }
  return false;
};

export const checkAppUpdate = async () => {
  try {
    const snap = await getDoc(doc(db, 'app_config', 'version'));
    if (!snap.exists()) return null;

    const data = snap.data();
    const latest = data.latestVersion || CURRENT_VERSION;

    if (!isNewerVersion(latest, CURRENT_VERSION)) return null;

    // User ne is version ko skip kiya tha?
    const skipped = await AsyncStorage.getItem('skipped_update_version');
    if (skipped === latest && !data.forceUpdate) return null;

    return {
      version: latest,
      apkUrl:      data.apkUrl      || 'https://sewaone.in/SewaOne.apk',
      description: data.description || 'Naya update available hai!',
      changes:     data.changes     || ['Bug fixes aur performance improvements'],
      forceUpdate: data.forceUpdate || false,
      releaseDate: data.releaseDate || '',
    };
  } catch (e) {
    return null;
  }
};
