// ============================================================
// FILE: functions/tokenCleanup.js
// Weekly cleanup of invalid push tokens
// ============================================================
const { onSchedule }    = require("firebase-functions/v2/scheduler");
const { getFirestore }  = require("firebase-admin/firestore");

const db           = getFirestore();
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Runs every Sunday 2AM IST — clean dead tokens
exports.weeklyTokenCleanup = onSchedule(
  { schedule: "30 20 * * 0", timeZone: "Asia/Kolkata" }, // Sun 2AM IST = 20:30 Sat UTC
  async () => {
    try {
      // Get all users with tokens
      const snap   = await db.collection("users").where("pushToken", "!=", null).get();
      const users  = snap.docs.map(d => ({ id: d.id, token: d.data().pushToken }))
                           .filter(u => u.token);

      if (users.length === 0) return;

      // Send silent test ping to all tokens
      const CHUNK = 100;
      let cleaned = 0;

      for (let i = 0; i < users.length; i += CHUNK) {
        const chunk = users.slice(i, i + CHUNK);
        try {
          const res  = await fetch(EXPO_PUSH_URL, {
            method:  "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body:    JSON.stringify(chunk.map(u => ({
              to:       u.token,
              title:    "SewaOne",
              body:     "App active hai!",
              // _test: true — silent check, won't actually show on device
              data:     { _silent: true },
            }))),
          });

          const json    = await res.json();
          const results = json.data || [];
          const batch   = db.batch();
          let   changed = false;

          for (let j = 0; j < results.length; j++) {
            const err = results[j]?.details?.error;
            if (err === "DeviceNotRegistered" || err === "InvalidCredentials") {
              batch.update(db.doc(`users/${chunk[j].id}`), { pushToken: null });
              changed = true;
              cleaned++;
            }
          }
          if (changed) await batch.commit();
        } catch {}
      }

      // Log cleanup result
      await db.collection("admin_logs").add({
        type:      "token_cleanup",
        cleaned,
        total:     users.length,
        timestamp: new Date(),
      });
    } catch {}
  }
);
