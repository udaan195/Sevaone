// ============================================================
// FILE: src/utils/membershipManager.js
// ✅ locked benefits at purchase
// ✅ Monthly reset for free apps
// ✅ Coverage from locked data
// ✅ Pro-rata upgrade credit
// ============================================================
import { db } from '../api/firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, increment, collection, addDoc, serverTimestamp, runTransaction } from 'firebase/firestore';

// ── Default plans ─────────────────────────────────────────────
export const DEFAULT_PLANS = {
  basic:  { name:'Basic',  emoji:'🥉', color:'#CD7F32', basePriceMonthly:99,  appLimitMonthly:-1, discount:10, freeApps:0 },
  silver: { name:'Silver', emoji:'🥈', color:'#94A3B8', basePriceMonthly:199, appLimitMonthly:-1, discount:25, freeApps:0 },
  gold:   { name:'Gold',   emoji:'🥇', color:'#F59E0B', basePriceMonthly:499, appLimitMonthly:-1, discount:40, freeApps:5 }, // MINOR-02: gold default 5 free apps
};

export const DEFAULT_TERM_DISCOUNTS   = { 1:0, 3:20, 6:30, 12:40 };
export const DEFAULT_LOCATION_PRICING = {
  UP: { type:'percent', value:0  },
  BR: { type:'percent', value:0  },
  MP: { type:'percent', value:0  },
  RJ: { type:'percent', value:0  },
  HR: { type:'percent', value:10 },
  DL: { type:'percent', value:20 },
  MH: { type:'percent', value:20 },
  GJ: { type:'percent', value:10 },
};

// Calculate adjusted price from location config
function applyLocationAdjustment(basePrice, locConfig) {
  if (!locConfig) return basePrice;
  // Old format (number) — backward compat
  if (typeof locConfig === 'number') {
    return Math.round(basePrice * locConfig);
  }
  const { type, value } = locConfig;
  if (!value || value === 0) return basePrice;
  if (type === 'flat') {
    return Math.max(1, basePrice + value);
  }
  // percent
  return Math.max(1, Math.round(basePrice * (1 + value / 100)));
}

export const DEFAULT_COVERAGE = {
  basic:  {
    gov_jobs:         { enabled:true,  categories:{ 'latest-jobs':true, 'admit-card':false, 'result':false, 'answer-key':false }},
    citizen_services: { enabled:true  },
    govt_schemes:     { enabled:false },
    students:         { enabled:true  },
    others:           { enabled:false },
  },
  silver: {
    gov_jobs:         { enabled:true,  categories:{ 'latest-jobs':true, 'admit-card':false, 'result':false, 'answer-key':false }},
    citizen_services: { enabled:true  },
    govt_schemes:     { enabled:true  },
    students:         { enabled:true  },
    others:           { enabled:true  },
  },
  gold: {
    gov_jobs:         { enabled:true,  categories:{ 'latest-jobs':true, 'admit-card':false, 'result':false, 'answer-key':false }},
    citizen_services: { enabled:true  },
    govt_schemes:     { enabled:true  },
    students:         { enabled:true  },
    others:           { enabled:true  },
  },
};

export const PLAN_ORDER = { basic:1, silver:2, gold:3 };

// ── Helpers ───────────────────────────────────────────────────
export function getDefaultConfig() {
  return {
    isEnabled: false,
    plans: DEFAULT_PLANS,
    termDiscounts: DEFAULT_TERM_DISCOUNTS,
    locationPricing: DEFAULT_LOCATION_PRICING,
    coverage: DEFAULT_COVERAGE,
  };
}

function monthKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
}

// ── Config cache — PERF-01: 5 minute cache ───────────────────
let _configCache = null;
let _configCacheTime = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function clearConfigCache() {
  _configCache = null;
  _configCacheTime = 0;
}

// ── Fetch config ──────────────────────────────────────────────
export async function getMembershipConfig() {
  // Return cached if fresh
  if (_configCache && Date.now() - _configCacheTime < CONFIG_CACHE_TTL) {
    return _configCache;
  }
  try {
    const snap = await getDoc(doc(db, 'app_config', 'membership_master'));
    if (!snap.exists()) return getDefaultConfig();
    const d = snap.data();
    _configCache = {
      isEnabled:       d.isEnabled       ?? false,
      plans:           d.plans           || DEFAULT_PLANS,
      termDiscounts:   d.termDiscounts   || DEFAULT_TERM_DISCOUNTS,
      locationPricing: d.locationPricing || DEFAULT_LOCATION_PRICING,
      coverage:        d.coverage        || DEFAULT_COVERAGE,
    };
    _configCacheTime = Date.now();
    return _configCache;
  } catch { return getDefaultConfig(); }
}

// ── Fetch user membership ─────────────────────────────────────
export async function getUserMembership(uid) {
  try {
    const snap = await getDoc(doc(db, 'user_memberships', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.endDate && new Date(data.endDate) < new Date())
      return { ...data, isActive:false, isExpired:true };
    return data;
  } catch { return null; }
}

// ── Build lockedBenefits at purchase time ─────────────────────
export function buildLockedBenefits(planKey, config, stateCode = '') {
  const plan      = (config.plans?.[planKey]) || DEFAULT_PLANS[planKey];
  const coverage  = (config.coverage?.[planKey]) || DEFAULT_COVERAGE[planKey] || {};
  const locConfig = (config.locationPricing || DEFAULT_LOCATION_PRICING)[stateCode];
  const adjMonthly = applyLocationAdjustment(plan.basePriceMonthly || 0, locConfig);
  return {
    planKey,
    planName:     plan.name,
    planEmoji:    plan.emoji,
    planColor:    plan.color,
    discount:     plan.discount     || 0,
    freeApps:     plan.freeApps     || 0,
    appLimit:     plan.appLimitMonthly ?? -1,
    processing:   planKey === 'gold' ? 'Same Day' : planKey === 'silver' ? '24 Hours' : 'Standard',
    support:      planKey === 'gold' ? 'VIP (2hr)' : planKey === 'silver' ? 'Priority (12hr)' : 'Basic (48hr)',
    whatsapp:     planKey === 'gold',
    coverage,
    stateCode,
    lockedAt:     new Date().toISOString(),
    configSnapshot: {
      basePriceMonthly: plan.basePriceMonthly,
      adjustedMonthly:  adjMonthly,
      stateCode,
      discount:         plan.discount,
      freeApps:         plan.freeApps,
    },
  };
}

// ── Calculate price ───────────────────────────────────────────
export function calcPrice(planKey, termMonths, stateCode, config) {
  const plan    = (config?.plans || DEFAULT_PLANS)[planKey];
  if (!plan) return { monthly:0, total:0, original:0, saved:0, termDisc:0 };
  const base      = plan.basePriceMonthly;
  const locConfig = (config?.locationPricing || DEFAULT_LOCATION_PRICING)[stateCode];
  const locBase   = applyLocationAdjustment(base, locConfig); // state-adjusted base
  const termDisc  = (config?.termDiscounts || DEFAULT_TERM_DISCOUNTS)[termMonths] || 0;
  const monthly   = Math.round(locBase * (1 - termDisc / 100));
  const total     = monthly * termMonths;
  const original  = locBase * termMonths;
  return { monthly, total, original, saved: original - total, termDisc };
}

// ── Pro-rata upgrade credit ───────────────────────────────────
export function calcUpgradeCredit(membership) {
  try {
    const start      = membership.startDate?.toDate?.() || new Date(membership.startDate);
    const end        = new Date(membership.endDate);
    const now        = new Date();
    const totalDays  = Math.max(1, Math.round((end - start) / (1000*60*60*24)));
    const usedDays   = Math.max(0, Math.round((now - start) / (1000*60*60*24)));
    const remaining  = Math.max(0, totalDays - usedDays);
    const dailyRate  = membership.pricePaid / totalDays;
    const credit     = Math.floor(remaining * dailyRate);
    return { credit, remaining, totalDays, usedDays, dailyRate: Math.round(dailyRate) };
  } catch { return { credit:0, remaining:0, totalDays:0, usedDays:0, dailyRate:0 }; }
}

// ── Get discount for application ──────────────────────────────
export async function getMembershipDiscount(uid, serviceFee, serviceType, category) {
  try {
    const mem = await getUserMembership(uid);
    if (!mem?.isActive) return noDiscount();

    const isTrial = mem.isTrial === true;
    const lb      = mem.lockedBenefits;

    // Fetch config — needed for isEnabled check
    const cfg = await getMembershipConfig();

    // Toggle OFF:
    //   Trial user       → discount band ho
    //   Paid user        → discount milta rahe (lockedBenefits se)
    if (!cfg.isEnabled && isTrial) return noDiscount();

    // Get plan values
    let discount, freeApps, coverage;

    if (!isTrial && lb) {
      // PAID + lockedBenefits — toggle se safe
      discount = lb.discount  ?? 0;
      freeApps = lb.freeApps != null ? Number(lb.freeApps) : 0;
      coverage = lb.coverage || DEFAULT_COVERAGE[mem.plan] || {};
    } else if (!isTrial) {
      // PAID without lockedBenefits — live config
      if (!cfg.isEnabled) return noDiscount();
      const plan = (cfg.plans?.[mem.plan]) || DEFAULT_PLANS[mem.plan];
      discount   = plan?.discount  || 0;
      freeApps   = plan?.freeApps  || 0;
      coverage   = (cfg.coverage?.[mem.plan]) || DEFAULT_COVERAGE[mem.plan] || {};
    } else {
      // TRIAL — live config (toggle OFF handled above)
      const plan = (cfg.plans?.[mem.plan]) || DEFAULT_PLANS[mem.plan];
      discount   = plan?.discount  || 0;
      freeApps   = plan?.freeApps  || 0;
      coverage   = (cfg.coverage?.[mem.plan]) || DEFAULT_COVERAGE[mem.plan] || {};
    }

    // Coverage check
    const svcCov = coverage[serviceType];
    if (!svcCov || svcCov.enabled === false) return noDiscount();
    if (category && svcCov.categories && svcCov.categories[category] === false) return noDiscount();

    // Free apps — monthly reset
    let freeLeft = 0;
    if (freeApps > 0) {
      const mk       = monthKey();
      const usSnap   = await getDoc(doc(db, 'user_memberships', uid, 'monthly_usage', mk));
      const freeUsed = usSnap.exists() ? (usSnap.data().free_used || 0) : 0;
      freeLeft       = Math.max(0, freeApps - freeUsed);
    }


    // BUG-03 Fix: lb can be null for trial users — use optional chaining
    const planName  = lb?.planName  || DEFAULT_PLANS[mem.plan]?.name  || mem.plan;
    const planEmoji = lb?.planEmoji || DEFAULT_PLANS[mem.plan]?.emoji || '⭐';
    const planColor = lb?.planColor || DEFAULT_PLANS[mem.plan]?.color || '#002855';

    if (freeLeft > 0) {
      return {
        discount:     serviceFee,
        isFree:       true,
        freeAppsLeft: freeLeft,
        discountPct:  100,
        planName, planEmoji, planColor,
      };
    }

    return {
      discount:     Math.floor(serviceFee * discount / 100),
      isFree:       false,
      freeAppsLeft: 0,
      discountPct:  discount,
      planName, planEmoji, planColor,
    };
  } catch (e) {
    console.log('getMembershipDiscount error:', e.message);
    return noDiscount();
  }
}

function noDiscount() { return { discount:0, isFree:false, freeAppsLeft:0 }; }

// ── Consume free app (monthly) — SEC-03: Transaction to prevent race condition ──
export async function consumeFreeApp(uid) {
  try {
    const mk  = monthKey();
    const ref = doc(db, 'user_memberships', uid, 'monthly_usage', mk);
    await runTransaction(db, async (transaction) => {
      const sn = await transaction.get(ref);
      if (sn.exists()) {
        transaction.update(ref, { free_used: increment(1) });
      } else {
        transaction.set(ref, { free_used:1, apps_used:0 });
      }
    });
  } catch {}
}

// ── Increment monthly usage — TD-01: transactional ──────────
export async function incrementMonthlyUsage(uid) {
  try {
    const mk  = monthKey();
    const ref = doc(db, 'user_memberships', uid, 'monthly_usage', mk);
    await runTransaction(db, async (tx) => {
      const sn = await tx.get(ref);
      if (sn.exists()) {
        tx.update(ref, { apps_used: (sn.data().apps_used || 0) + 1 });
      } else {
        tx.set(ref, { apps_used:1, free_used:0 });
      }
    });
  } catch {
    // Fallback — non-transactional
    try {
      const mk  = monthKey();
      const ref = doc(db, 'user_memberships', uid, 'monthly_usage', mk);
      await updateDoc(ref, { apps_used: increment(1) }).catch(async () => {
        await setDoc(ref, { apps_used:1, free_used:0 });
      });
    } catch {}
  }
}

// ── Check monthly limit ───────────────────────────────────────
export async function checkMonthlyLimit(uid) {
  try {
    // Always fresh — no cache for limit check
    const [memSnap, cfgSnap] = await Promise.all([
      getDoc(doc(db, 'user_memberships', uid)),
      getDoc(doc(db, 'app_config', 'membership_master')),
    ]);

    if (!memSnap.exists()) return { allowed:true };
    const mem = memSnap.data();
    if (!mem.isActive) return { allowed:true };

    // Check expiry
    if (mem.endDate && new Date(mem.endDate) < new Date())
      return { allowed:true }; // expired = no membership = unlimited

    // appLimit: LIVE from lockedBenefits (admin edit se update hota hai)
    const rawLimit = mem.lockedBenefits?.appLimit;
    const limit    = rawLimit != null ? Number(rawLimit) : -1;

    // -1 = unlimited, 0 = unlimited (as per our rule)
    if (limit === -1 || limit === 0 || limit == null)
      return { allowed:true, limit:-1 };

    // Positive limit — check monthly usage
    const mk   = monthKey();
    const sn   = await getDoc(doc(db, 'user_memberships', uid, 'monthly_usage', mk));
    const used = sn.exists() ? (sn.data().apps_used || 0) : 0;

    return {
      allowed:  used < limit,
      used,
      limit,
      remaining: Math.max(0, limit - used),
    };
  } catch { return { allowed:true }; }
}

// ── Save to history ───────────────────────────────────────────
export async function saveMembershipHistory(uid, data) {
  try {
    await addDoc(collection(db, 'user_memberships', uid, 'history'), {
      ...data,
      timestamp: serverTimestamp(),
    });
  } catch {}
}
