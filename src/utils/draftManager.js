// ============================================================
// FILE: src/utils/draftManager.js
// ✅ User-specific drafts — key = userId + jobId
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../api/firebaseConfig';

const PREFIX = 'sewaone_draft_';

// Key = userId_jobId — har user ka alag draft
function draftKey(jobId) {
  const uid = auth.currentUser?.uid || 'guest';
  return `${PREFIX}${uid}_${jobId}`;
}

// Save draft
export async function saveDraft(jobId, formData, step = 0) {
  try {
    const key  = draftKey(jobId);
    const data = {
      jobId,
      userId: auth.currentUser?.uid || 'guest',
      formData,
      step,
      savedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch { return false; }
}

// Load draft
export async function loadDraft(jobId) {
  try {
    const key  = draftKey(jobId);
    const raw  = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);

    // Safety — sirf apna draft lo
    const uid = auth.currentUser?.uid;
    if (uid && data.userId && data.userId !== uid) return null;

    // 7 din baad expire
    const diff = (Date.now() - new Date(data.savedAt)) / (1000 * 60 * 60 * 24);
    if (diff > 7) { await clearDraft(jobId); return null; }

    return data;
  } catch { return null; }
}

// Clear draft
export async function clearDraft(jobId) {
  try {
    await AsyncStorage.removeItem(draftKey(jobId));
  } catch {}
}

// Get all drafts for current user
export async function getAllDrafts() {
  try {
    const uid  = auth.currentUser?.uid || 'guest';
    const keys = await AsyncStorage.getAllKeys();
    const myKeys = keys.filter(k => k.startsWith(`${PREFIX}${uid}_`));
    if (!myKeys.length) return [];
    const pairs = await AsyncStorage.multiGet(myKeys);
    return pairs
      .map(([, val]) => { try { return JSON.parse(val); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}

// Clear all drafts for current user
export async function clearAllDrafts() {
  try {
    const uid  = auth.currentUser?.uid || 'guest';
    const keys = await AsyncStorage.getAllKeys();
    const myKeys = keys.filter(k => k.startsWith(`${PREFIX}${uid}_`));
    await AsyncStorage.multiRemove(myKeys);
  } catch {}
}
