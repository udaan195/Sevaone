// ============================================================
// FILE: src/utils/draftManager.js
// Application Form Draft Save — AsyncStorage based
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'sewaone_draft_';

// Save draft
export async function saveDraft(jobId, formData, step = 0) {
  try {
    const key  = `${PREFIX}${jobId}`;
    const data = {
      jobId,
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
    const key  = `${PREFIX}${jobId}`;
    const raw  = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Expire after 7 days
    const savedAt = new Date(data.savedAt);
    const diff    = (Date.now() - savedAt) / (1000 * 60 * 60 * 24);
    if (diff > 7) { await clearDraft(jobId); return null; }
    return data;
  } catch { return null; }
}

// Clear draft
export async function clearDraft(jobId) {
  try {
    await AsyncStorage.removeItem(`${PREFIX}${jobId}`);
  } catch {}
}

// Get all drafts
export async function getAllDrafts() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const draftKeys = keys.filter(k => k.startsWith(PREFIX));
    if (!draftKeys.length) return [];
    const pairs = await AsyncStorage.multiGet(draftKeys);
    return pairs
      .map(([, val]) => { try { return JSON.parse(val); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}

// Clear all drafts
export async function clearAllDrafts() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const draftKeys = keys.filter(k => k.startsWith(PREFIX));
    await AsyncStorage.multiRemove(draftKeys);
  } catch {}
}
