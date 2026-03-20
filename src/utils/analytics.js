import { db, auth } from '../api/firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const getUid = () => auth.currentUser?.uid || 'anonymous';

// ── Core log function ────────────────────────────────────────
async function logEvent(eventName, params = {}) {
  try {
    await addDoc(collection(db, 'analytics_events'), {
      event:     eventName,
      userId:    getUid(),
      params,
      timestamp: serverTimestamp(),
      platform:  'app',
    });
  } catch {} // Never crash app for analytics
}

// ═══════════════════════════════════════════════════════════
// Screen Views
// ═══════════════════════════════════════════════════════════
export const logScreen = (screenName) =>
  logEvent('screen_view', { screen: screenName });

// ═══════════════════════════════════════════════════════════
// Auth Events
// ═══════════════════════════════════════════════════════════
export const logLogin  = (method) => logEvent('login',    { method });
export const logSignup = (method) => logEvent('signup',   { method });
export const logLogout = ()       => logEvent('logout',   {});

// ═══════════════════════════════════════════════════════════
// Job Events
// ═══════════════════════════════════════════════════════════
export const logJobView    = (jobId, jobTitle, category) =>
  logEvent('job_view',    { jobId, jobTitle, category });

export const logJobApply   = (jobId, jobTitle, payMethod) =>
  logEvent('job_apply',   { jobId, jobTitle, payMethod });

export const logJobBookmark = (jobId, jobTitle) =>
  logEvent('job_bookmark', { jobId, jobTitle });

export const logJobSearch  = (query) =>
  logEvent('job_search',  { query });

// ═══════════════════════════════════════════════════════════
// Service Events
// ═══════════════════════════════════════════════════════════
export const logServiceView  = (serviceId, serviceTitle, category) =>
  logEvent('service_view',  { serviceId, serviceTitle, category });

export const logServiceApply = (serviceId, serviceTitle, payMethod) =>
  logEvent('service_apply', { serviceId, serviceTitle, payMethod });

// ═══════════════════════════════════════════════════════════
// Wallet Events
// ═══════════════════════════════════════════════════════════
export const logWalletOpen    = ()                => logEvent('wallet_open',    {});
export const logWalletRecharge = (amount, method) => logEvent('wallet_recharge', { amount, method });
export const logWalletPay     = (amount, forWhat) => logEvent('wallet_pay',     { amount, forWhat });

// ═══════════════════════════════════════════════════════════
// Referral Events
// ═══════════════════════════════════════════════════════════
export const logReferralShare = (channel) => logEvent('referral_share', { channel });
export const logReferralCopy  = ()         => logEvent('referral_copy',  {});

// ═══════════════════════════════════════════════════════════
// Coupon Events
// ═══════════════════════════════════════════════════════════
export const logCouponApplied = (code, discount) =>
  logEvent('coupon_applied', { code, discount });
export const logCouponFailed  = (code, reason) =>
  logEvent('coupon_failed',  { code, reason });

// ═══════════════════════════════════════════════════════════
// Error Events
// ═══════════════════════════════════════════════════════════
export const logError = (screen, errorCode, message) =>
  logEvent('app_error', { screen, errorCode, message });
