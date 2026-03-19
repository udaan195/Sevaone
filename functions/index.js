const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp }   = require("firebase-admin/app");
const { getFirestore, increment, FieldValue } = require("firebase-admin/firestore");
const { defineSecret }    = require("firebase-functions/params");

initializeApp();
const db = getFirestore();

// ── Secrets (store in Firebase Secret Manager, NOT in code) ──
const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID   = defineSecret("TELEGRAM_CHAT_ID");

// ─────────────────────────────────────────────────────────────
// HELPER: Telegram message bhejo
// ─────────────────────────────────────────────────────────────
async function sendTelegram(message, secrets) {
  const token  = secrets.token;
  const chatId = secrets.chatId;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id:    chatId,
        text:       message,
        parse_mode: "Markdown",
      }),
    });
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// 1. WALLET REQUEST — Naya request aaya
// ─────────────────────────────────────────────────────────────
exports.onWalletRequest = onDocumentCreated(
  { document: "wallet_requests/{reqId}", secrets: [TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID] },
  async (event) => {
    const data  = event.data?.data();
    if (!data || data.type === "withdraw") return;

    const msg =
      `💰 *WALLET RECHARGE REQUEST*\n\n` +
      `👤 User: \`${data.userId?.substring(0, 12)}...\`\n` +
      `💵 Amount: ₹${data.amount}\n` +
      `🔖 UTR: ${data.utr || "—"}\n` +
      `📸 Proof: [View](${data.screenshot || "—"})\n\n` +
      `👉 [Admin Panel](https://sewaone-admin.netlify.app/wallet-requests)`;

    await sendTelegram(msg, {
      token:  TELEGRAM_BOT_TOKEN.value(),
      chatId: TELEGRAM_CHAT_ID.value(),
    });
  }
);

// ─────────────────────────────────────────────────────────────
// 2. JOB APPLICATION — Naya application aaya
// ─────────────────────────────────────────────────────────────
exports.onJobApplication = onDocumentCreated(
  { document: "applications/{appId}", secrets: [TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID] },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const msg =
      `🚀 *NEW JOB APPLICATION*\n\n` +
      `🆔 Tracking: ${data.trackingId || "—"}\n` +
      `💼 Job: ${data.jobTitle || "—"}\n` +
      `💰 Fee: ₹${data.feeDetails?.total || 0} via ${data.paymentMethod || "—"}\n` +
      `👤 User: \`${data.userId?.substring(0, 12)}...\`\n\n` +
      `👉 [Admin Panel](https://sewaone-admin.netlify.app/manage-applications)`;

    await sendTelegram(msg, {
      token:  TELEGRAM_BOT_TOKEN.value(),
      chatId: TELEGRAM_CHAT_ID.value(),
    });
  }
);

// ─────────────────────────────────────────────────────────────
// 3. SERVICE APPLICATION — Naya service application
// ─────────────────────────────────────────────────────────────
exports.onServiceApplication = onDocumentCreated(
  { document: "service_applications/{appId}", secrets: [TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID] },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const msg =
      `🏛️ *NEW SERVICE APPLICATION*\n\n` +
      `🆔 Tracking: ${data.trackingId || "—"}\n` +
      `📋 Service: ${data.serviceName || "—"}\n` +
      `💰 Fee: ₹${data.feeDetails?.total || 0} via ${data.paymentMethod || "—"}\n` +
      `👤 User: \`${data.userId?.substring(0, 12)}...\`\n\n` +
      `👉 [Admin Panel](https://sewaone-admin.netlify.app/service-applications)`;

    await sendTelegram(msg, {
      token:  TELEGRAM_BOT_TOKEN.value(),
      chatId: TELEGRAM_CHAT_ID.value(),
    });
  }
);

// ─────────────────────────────────────────────────────────────
// 4. REFERRAL REWARD — Secure server-side credit
// ─────────────────────────────────────────────────────────────
exports.onNewUser = onDocumentCreated(
  "users/{userId}",
  async (event) => {
    const data   = event.data?.data();
    const userId = event.params.userId;
    if (!data?.usedReferralCode) return;

    try {
      // Referral config fetch
      const configSnap = await db.doc("app_config/referral").get();
      const config      = configSnap.exists ? configSnap.data() : {};
      const referrerBonus = config.referrerBonus || 5;
      const joineeBonus   = config.joineeBonus   || 20;
      const tierThreshold = config.tierThreshold || 5;
      const tierBonus     = config.tierBonus     || 25;
      const isActive      = config.isActive !== false;

      if (!isActive) return;

      // Referrer dhundho
      const referrerSnap = await db
        .collection("users")
        .where("myReferralCode", "==", data.usedReferralCode)
        .limit(1)
        .get();

      if (referrerSnap.empty) return;

      const referrerDoc  = referrerSnap.docs[0];
      const referrerId   = referrerDoc.id;
      const referrerData = referrerDoc.data();

      // ✅ Batch write — atomic
      const batch = db.batch();

      // Referrer ko bonus
      batch.update(db.doc(`users/${referrerId}`), {
        walletBalance:       increment(referrerBonus),
        totalReferralEarned: increment(referrerBonus),
      });
      batch.set(db.collection("transactions").doc(), {
        userId:    referrerId,
        amount:    referrerBonus,
        type:      "credit",
        remark:    "Referral Bonus: Friend Joined",
        timestamp: FieldValue.serverTimestamp(),
      });

      // Joinee ko bonus
      batch.update(db.doc(`users/${userId}`), {
        walletBalance: increment(joineeBonus),
      });
      batch.set(db.collection("transactions").doc(), {
        userId:    userId,
        amount:    joineeBonus,
        type:      "credit",
        remark:    "Joining Bonus: Referral Used",
        timestamp: FieldValue.serverTimestamp(),
      });

      await batch.commit();

      // Tier bonus check
      const currentEarned = (referrerData.totalReferralEarned || 0) + referrerBonus;
      const referralCount = Math.floor(currentEarned / referrerBonus);
      if (referralCount > 0 && referralCount % tierThreshold === 0) {
        await db.doc(`users/${referrerId}`).update({
          walletBalance:       increment(tierBonus),
          totalReferralEarned: increment(tierBonus),
        });
        await db.collection("transactions").add({
          userId:    referrerId,
          amount:    tierBonus,
          type:      "credit",
          remark:    `Tier Bonus: ${referralCount} Referrals Complete!`,
          timestamp: FieldValue.serverTimestamp(),
        });
      }

    } catch {}
  }
);

// ─────────────────────────────────────────────────────────────
// 5. VOUCHER — Atomic usedCount (race condition fix)
// ─────────────────────────────────────────────────────────────
exports.onVoucherUse = onDocumentCreated(
  "voucher_usage_requests/{reqId}",
  async (event) => {
    const data  = event.data?.data();
    if (!data?.voucherId || !data?.userId) return;

    const reqRef     = db.doc(`voucher_usage_requests/${event.params.reqId}`);
    const voucherRef = db.doc(`vouchers/${data.voucherId}`);

    try {
      await db.runTransaction(async (tx) => {
        const vSnap = await tx.get(voucherRef);
        if (!vSnap.exists) throw new Error("Voucher not found");

        const v          = vSnap.data();
        const usedCount  = v.usedCount  || 0;
        const usageLimit = v.usageLimit || 999;

        if (!v.isActive)          throw new Error("Voucher inactive");
        if (usedCount >= usageLimit) throw new Error("Limit reached");
        if (v.expiryDate && new Date(v.expiryDate) < new Date())
                                  throw new Error("Expired");

        tx.update(voucherRef, { usedCount: increment(1) });
        tx.update(reqRef, { status: "approved", discount: v.discountValue });
      });
    } catch (e) {
      await reqRef.update({ status: "rejected", reason: e.message });
    }
  }
);
