// ============================================================
// FILE: functions/scheduledNotifications.js
// Cloud Function — Daily auto reminders
// Deploy: firebase deploy --only functions:dailyReminders
// ============================================================

const { onSchedule }    = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore }  = require('firebase-admin/firestore');
const { defineSecret }  = require('firebase-functions/params');

try { initializeApp(); } catch {}
const db = getFirestore();

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE    = 100;

// ── Helper: Chunked push ─────────────────────────────────────
async function sendChunked(messages) {
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    try {
      const res  = await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body:    JSON.stringify(chunk),
      });
      const json = await res.json();

      // Clean up invalid tokens
      const results = json.data || [];
      const batch   = db.batch();
      let   changed = false;
      for (let j = 0; j < results.length; j++) {
        const err = results[j]?.details?.error;
        if (err === 'DeviceNotRegistered' || err === 'InvalidCredentials') {
          const badToken = chunk[j]?.to;
          // Find user with this token and clear it
          const snap = await db.collection('users')
            .where('pushToken', '==', badToken).limit(1).get();
          if (!snap.empty) {
            batch.update(snap.docs[0].ref, { pushToken: null });
            changed = true;
          }
        }
      }
      if (changed) await batch.commit();
    } catch {}
  }
}

// ── Helper: Get all tokens ───────────────────────────────────
async function getAllUserTokens() {
  const snap = await db.collection('users').get();
  return snap.docs
    .map(d => ({ token: d.data().pushToken, uid: d.id }))
    .filter(u => u.token);
}

// ═══════════════════════════════════════════════════════════
// 1. Daily Job Deadline Reminder (runs every morning 9AM IST)
// ═══════════════════════════════════════════════════════════
exports.dailyReminders = onSchedule(
  { schedule: '30 3 * * *', timeZone: 'Asia/Kolkata' }, // 9AM IST = 3:30 UTC
  async () => {
    const now      = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 0);

    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    try {
      // Jobs expiring tomorrow
      const jobSnap = await db.collection('gov_jobs')
        .where('category', '==', 'latest-jobs')
        .get();

      const expiringJobs = jobSnap.docs.filter(d => {
        const dateStr = d.data().lastDate;
        if (!dateStr) return false;
        try {
          const parts = dateStr.split(/[-\/]/);
          let lastDate;
          // Try multiple formats: DD-MM-YYYY, YYYY-MM-DD
          if (parts[0].length === 4) {
            lastDate = new Date(parts[0], parts[1] - 1, parts[2]);
          } else {
            lastDate = new Date(parts[2], parts[1] - 1, parts[0]);
          }
          return lastDate >= tomorrow && lastDate <= dayAfter;
        } catch { return false; }
      });

      if (expiringJobs.length === 0) return;

      const users = await getAllUserTokens();
      if (users.length === 0) return;

      const messages = [];
      for (const job of expiringJobs) {
        const jobData = job.data();
        for (const user of users) {
          messages.push({
            to:        user.token,
            title:     `⚠️ Kal Last Date! — ${jobData.title}`,
            body:      `${jobData.conductedBy || 'Sarkari'} ki deadline kal hai. Abhi apply karo!`,
            sound:     'default',
            priority:  'high',
            channelId: 'sewaone_alerts',
            data:      { screen: 'JobDetails', jobId: job.id, type: 'reminder' },
          });
        }

        // Also save reminder notification in Firestore (bell icon mein dikhega)
        await db.collection('notifications').add({
          title:     `⚠️ Kal Last Date! — ${jobData.title}`,
          message:   `${jobData.conductedBy || 'Govt'} ki application deadline kal khatam ho rahi hai!`,
          type:      'reminder',
          icon:      'clock-alert',
          color:     '#E65100',
          jobId:     job.id,
          screen:    'JobDetails',
          timestamp: new Date(),
        });
      }

      await sendChunked(messages);
    } catch {}
  }
);

// ═══════════════════════════════════════════════════════════
// 2. Pending Application Reminder (every Monday 10AM IST)
// ═══════════════════════════════════════════════════════════
exports.pendingAppReminder = onSchedule(
  { schedule: '30 4 * * 1', timeZone: 'Asia/Kolkata' }, // Monday 10AM IST
  async () => {
    try {
      // Users with pending applications older than 3 days
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const pendingSnap = await db.collection('applications')
        .where('status', 'in', ['Under Process', 'Fee Verification Under Process'])
        .get();

      // Group by userId
      const userApps = {};
      pendingSnap.docs.forEach(d => {
        const data = d.data();
        if (!data.userId) return;
        const ts = data.timestamp?.toDate?.() || new Date(0);
        if (ts < threeDaysAgo) {
          if (!userApps[data.userId]) userApps[data.userId] = 0;
          userApps[data.userId]++;
        }
      });

      for (const [uid, count] of Object.entries(userApps)) {
        const userSnap = await db.doc(`users/${uid}`).get();
        const token    = userSnap.data()?.pushToken;
        if (!token) continue;

        await sendChunked([{
          to:        token,
          title:     `📋 ${count} Application${count > 1 ? 's' : ''} Pending`,
          body:      'Aapki application process mein hai. Status check karein!',
          sound:     'default',
          priority:  'normal',
          channelId: 'sewaone_alerts',
          data:      { screen: 'Applications', type: 'reminder' },
        }]);
      }
    } catch {}
  }
);

// ═══════════════════════════════════════════════════════════
// 3. Wallet Inactive Reminder (every 15th of month)
// ═══════════════════════════════════════════════════════════
exports.walletInactiveReminder = onSchedule(
  { schedule: '0 7 15 * *', timeZone: 'Asia/Kolkata' }, // 15th every month 12:30PM IST
  async () => {
    try {
      const snap = await db.collection('users').get();
      const messages = [];

      snap.docs.forEach(d => {
        const data  = d.data();
        const token = data.pushToken;
        if (!token) return;
        if ((data.walletBalance || 0) === 0 && !data.walletPinHash) {
          messages.push({
            to:        token,
            title:     '💳 Wallet Activate Karo!',
            body:      'SewaOne Wallet se instant payment karein — no UPI screenshot needed!',
            sound:     'default',
            priority:  'normal',
            channelId: 'sewaone_alerts',
            data:      { screen: 'Wallet', type: 'reminder' },
          });
        }
      });

      if (messages.length > 0) await sendChunked(messages);
    } catch {}
  }
);
