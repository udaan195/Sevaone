// ============================================================
// FILE: src/screens/Main/MembershipScreen.js  
// ✅ Premium UI
// ✅ lockedBenefits se dynamic active screen
// ✅ Pro-rata upgrade credit
// ✅ Downgrade blocked (active), allowed (expired)
// ✅ Coverage from config (before purchase)
// ✅ Lock at purchase time
// ============================================================
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Modal, ActivityIndicator,
  Alert, Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { db, auth } from '../../api/firebaseConfig';
import {
  doc, getDoc, setDoc, updateDoc, addDoc,
  collection, serverTimestamp, increment,
} from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '../../context/ThemeContext';
import {
  getMembershipConfig, getDefaultConfig, DEFAULT_PLANS,
  DEFAULT_COVERAGE, getUserMembership, calcPrice,
  buildLockedBenefits, calcUpgradeCredit,
  PLAN_ORDER, saveMembershipHistory,
} from '../../utils/membershipManager';

const { width } = Dimensions.get('window');

// ── Language strings ──────────────────────────────────────────
const LANG = {
  en: {
    myMembership:    'My Membership',
    activeMember:    'Active Member',
    daysLeft:        'Days Left',
    discount:        'Discount',
    apps:            'Applications',
    freeApps:        'Free Applications This Month',
    freeLeft:        'left',
    validTill:       'Valid till',
    yourBenefits:    'Your Benefits',
    benefitsLocked:  'Benefits locked at purchase — protected from admin changes',
    serviceCoverage: 'Service Coverage',
    coverageSub:     'Where your discount applies',
    renewUpgrade:    'Renew / Upgrade Plan',
    choosePlan:      'Choose Your Plan',
    renewUpgradeTitle:'Renew / Upgrade',
    duration:        'Select Duration',
    save:            'Save',
    vsMonthly:       'vs monthly billing',
    applications:    'Applications',
    unlimitedApps:   'Unlimited — form fill karo jab chahiye',
    freeAppsDesc:    (n) => `${n} applications mein SewaOne fee zero`,
    noFreeApps:      'Sirf discount milega (free nahi)',
    discountDesc:    (n) => `${n}% off SewaOne service fee`,
    processing:      'Processing Time',
    support:         'Support',
    whatsapp:        'WhatsApp Alerts',
    govtFee:         'Government Fee',
    govtFeeVal:      'Fixed by law — discount nahi milta',
    viewCoverage:    'Service Coverage Dekho',
    hideCoverage:    'Coverage Chhupao',
    covered:         'Covered',
    notCovered:      'Not Covered',
    govtNote:        'Government fee fixed hoti hai — koi discount nahi',
    feeNote:         'Discount sirf SewaOne service fee pe milta hai. Government fee hamesha alag pay karni padegi.',
    orderSummary:    'Order Summary',
    plan:            'Plan',
    perMonth:        'Per Month',
    youSave:         'Aap Bachate Ho',
    total:           'Total',
    walletBal:       'Wallet Balance',
    lowBalance:      'Balance kam hai',
    agreeTerms:      'Maine Terms & Conditions padh li hain aur agree karta/karti hoon',
    termsLink:       'Terms & Conditions',
    subscribe:       'Subscribe Karo',
    renew:           'Renew Karo',
    termsTitle:      'Terms & Conditions',
    scrollHint:      '↓ Scroll karo — saari terms padho',
    agreeBtn:        'Agree Karta Hoon — Aage Badho',
    close:           'Band Karo',
    upgradeTitle:    (emoji, name) => `⬆ ${emoji} ${name} Pe Upgrade`,
    newPlanPrice:    'Naye plan ki kimat',
    credit:          (from, days) => `${from} ka credit (${days} din bache hain)`,
    payNow:          'Abhi Pay Karo',
    newExpiry:       'Nayi expiry date',
    upgradeWarning:  (from) => `${from} plan turant khatam ho jayega`,
    payUpgrade:      (amt) => `₹${amt} Pay Karo — Upgrade Karo`,
    cancel:          'Ruko, Nahi Karna',
    downgradeTitle:  '⛔ Downgrade Nahi Ho Sakta',
    downgradeMsg:    (name, date) => `Abhi aapka ${name} plan active hai.

Active plan pe downgrade nahi ho sakta.

Aapka plan ${date} ko khatam hoga.

Khatam hone ke baad koi bhi plan le sakte ho.`,
    ok:              'Theek Hai',
    renewPlan:       'Plan Renew Karo',
    renewNote:       'Renew karne pe latest plan config apply hogi',
    insufficientBal: 'Balance Kam Hai',
    insufficientMsg: (wallet, need) => `Aapka wallet: ₹${wallet}
Zarurat: ₹${need}

Pehle wallet mein paise daalo.`,
    addMoney:        'Paise Daalo',
    confirmSub:      'Confirm Karo',
    confirmMsg:      (emoji, name, months, total) => `${emoji} ${name} — ${months} mahine

₹${total} wallet se katenge`,
    subscribeNow:    'Subscribe Karo',
    upgradeFailed:   'Upgrade Nahi Hua',
    tryAgain:        'Dobara Try Karo',
    upgraded:        (emoji, name, date) => `${emoji} Upgrade Ho Gaya!
Ab ${name} plan pe ho!
Valid till ${date}`,
    great:           'Bahut Achha!',
    freeAppRule:     '🎁 Jab free apps bacha ho → SewaOne fee zero',
    discountRule:    '💰 Free apps khatam hone par → discount % milega',
    paidRule:        '📋 Koi bhi limit nahi — form bharte raho',
    noDiscountRule:  '💸 Fee khatam hone par → normal SewaOne fee pay karo',
  },
  hi: {
    myMembership:    'मेरी सदस्यता',
    activeMember:    'सक्रिय सदस्य',
    daysLeft:        'दिन बचे',
    discount:        'छूट',
    apps:            'आवेदन',
    freeApps:        'इस महीने के मुफ़्त आवेदन',
    freeLeft:        'बचे',
    validTill:       'वैध है',
    yourBenefits:    'आपके फायदे',
    benefitsLocked:  'खरीद के समय लॉक — admin बदलाव से सुरक्षित',
    serviceCoverage: 'सेवा कवरेज',
    coverageSub:     'कहाँ छूट मिलती है',
    renewUpgrade:    'नवीनीकरण / अपग्रेड करें',
    choosePlan:      'अपना प्लान चुनें',
    renewUpgradeTitle:'नवीनीकरण / अपग्रेड',
    duration:        'अवधि चुनें',
    save:            'बचत',
    vsMonthly:       'मासिक भुगतान से',
    applications:    'आवेदन',
    unlimitedApps:   'असीमित — जब चाहो फॉर्म भरो',
    freeAppsDesc:    (n) => `${n} आवेदनों में SewaOne शुल्क शून्य`,
    noFreeApps:      'केवल छूट मिलेगी (मुफ़्त नहीं)',
    discountDesc:    (n) => `SewaOne सेवा शुल्क पर ${n}% छूट`,
    processing:      'प्रोसेसिंग समय',
    support:         'सहायता',
    whatsapp:        'WhatsApp अलर्ट',
    govtFee:         'सरकारी शुल्क',
    govtFeeVal:      'कानून द्वारा तय — कोई छूट नहीं',
    viewCoverage:    'सेवा कवरेज देखें',
    hideCoverage:    'कवरेज छुपाएं',
    covered:         'शामिल है',
    notCovered:      'शामिल नहीं',
    govtNote:        'सरकारी शुल्क तय होता है — कोई छूट नहीं मिलती',
    feeNote:         'छूट केवल SewaOne सेवा शुल्क पर मिलती है। सरकारी शुल्क अलग से देना होगा।',
    orderSummary:    'ऑर्डर सारांश',
    plan:            'प्लान',
    perMonth:        'प्रति माह',
    youSave:         'आप बचाते हैं',
    total:           'कुल',
    walletBal:       'वॉलेट बैलेंस',
    lowBalance:      'बैलेंस कम है',
    agreeTerms:      'मैंने नियम एवं शर्तें पढ़ ली हैं और सहमत हूं',
    termsLink:       'नियम एवं शर्तें',
    subscribe:       'सदस्यता लें',
    renew:           'नवीनीकरण करें',
    termsTitle:      'नियम एवं शर्तें',
    scrollHint:      '↓ स्क्रॉल करें — सभी शर्तें पढ़ें',
    agreeBtn:        'सहमत हूं — आगे बढ़ें',
    close:           'बंद करें',
    upgradeTitle:    (emoji, name) => `⬆ ${emoji} ${name} पर अपग्रेड`,
    newPlanPrice:    'नए प्लान की कीमत',
    credit:          (from, days) => `${from} का क्रेडिट (${days} दिन बचे हैं)`,
    payNow:          'अभी भुगतान करें',
    newExpiry:       'नई समाप्ति तिथि',
    upgradeWarning:  (from) => `${from} प्लान तुरंत समाप्त हो जाएगा`,
    payUpgrade:      (amt) => `₹${amt} भुगतान करें — अपग्रेड करें`,
    cancel:          'रुको, नहीं करना',
    downgradeTitle:  '⛔ डाउनग्रेड नहीं हो सकता',
    downgradeMsg:    (name, date) => `अभी आपका ${name} प्लान चालू है।

चालू प्लान पर डाउनग्रेड नहीं हो सकता।

आपका प्लान ${date} को समाप्त होगा।

समाप्त होने के बाद कोई भी प्लान ले सकते हो।`,
    ok:              'ठीक है',
    renewPlan:       'प्लान नवीनीकरण करें',
    renewNote:       'नवीनीकरण पर नवीनतम कॉन्फ़िग लागू होगी',
    insufficientBal: 'बैलेंस कम है',
    insufficientMsg: (wallet, need) => `आपका वॉलेट: ₹${wallet}
जरूरत: ₹${need}

पहले वॉलेट में पैसे डालें।`,
    addMoney:        'पैसे डालें',
    confirmSub:      'पुष्टि करें',
    confirmMsg:      (emoji, name, months, total) => `${emoji} ${name} — ${months} महीने

₹${total} वॉलेट से कटेंगे`,
    subscribeNow:    'सदस्यता लें',
    upgradeFailed:   'अपग्रेड नहीं हुआ',
    tryAgain:        'दोबारा कोशिश करें',
    upgraded:        (emoji, name, date) => `${emoji} अपग्रेड हो गया!
अब ${name} प्लान पर हो!
वैध है ${date} तक`,
    great:           'बहुत अच्छा!',
    freeAppRule:     '🎁 जब मुफ़्त आवेदन बचा हो → SewaOne शुल्क शून्य',
    discountRule:    '💰 मुफ़्त आवेदन खत्म होने पर → छूट % मिलेगी',
    paidRule:        '📋 कोई भी सीमा नहीं — फॉर्म भरते रहो',
    noDiscountRule:  '💸 शुल्क खत्म होने पर → सामान्य SewaOne शुल्क देना होगा',
  },
};

const TERMS = `1. Membership discount applies exclusively to SewaOne service fees. Government fees remain unchanged.

2. Monthly application limits reset on 1st of each calendar month. Unused apps do not carry forward.

3. Free applications reset monthly.

4. Multi-month plans: full payment upfront at discounted rate.

5. Cancellation anytime. No refund for remaining period. Access continues till expiry.

6. Upgrades: pro-rata credit for remaining days. Downgrades not allowed on active plans.

7. On renewal: latest plan pricing and config applies.

8. SewaOne reserves right to modify benefits with 7 days notice to existing subscribers.

9. Free trial once per account only.

10. Fraud or misuse: membership may be cancelled without refund.`;

const APP_MENUS = [
  { key:'gov_jobs',         label:'Govt Jobs',        icon:'briefcase-variant',  color:'#1976D2',
    categories:[
      { key:'latest-jobs',  label:'Latest Jobs',   hasApply:true  },
      { key:'admit-card',   label:'Admit Cards',   hasApply:false },
      { key:'result',       label:'Results',       hasApply:false },
      { key:'answer-key',   label:'Answer Keys',   hasApply:false },
    ]},
  { key:'citizen_services', label:'Citizen Services', icon:'account-group',      color:'#388E3C',
    categories:[
      { key:'Identity Proof', label:'Identity Proof', hasApply:true },
      { key:'Certificates',   label:'Certificates',   hasApply:true },
      { key:'Transport',      label:'Transport',      hasApply:true },
      { key:'Legal & Police', label:'Legal & Police', hasApply:true },
      { key:'Others',         label:'Others',         hasApply:true },
    ]},
  { key:'govt_schemes',     label:'Govt Schemes',     icon:'bank',               color:'#F57C00',
    categories:[
      { key:'Farmer Schemes',  label:'Farmer Schemes',  hasApply:true },
      { key:'Health Schemes',  label:'Health Schemes',  hasApply:true },
      { key:'Housing Schemes', label:'Housing Schemes', hasApply:true },
      { key:'Women Schemes',   label:'Women Schemes',   hasApply:true },
      { key:'Business',        label:'Business Schemes',hasApply:true },
    ]},
  { key:'students',         label:'Students',         icon:'school',             color:'#C2185B',
    categories:[
      { key:'Scholarships',   label:'Scholarships',   hasApply:true  },
      { key:'Entrance Exams', label:'Entrance Exams', hasApply:true  },
      { key:'Board Results',  label:'Board Results',  hasApply:false },
      { key:'E-Learning',     label:'E-Learning',     hasApply:false },
      { key:'Skill Training', label:'Skill Training', hasApply:true  },
    ]},
  { key:'others',           label:'Others',           icon:'dots-grid',          color:'#0097A7',
    categories:[
      { key:'General Services',  label:'Utility Services',  hasApply:true },
      { key:'Business Services', label:'Business Services', hasApply:true },
      { key:'Legal Others',      label:'Legal Others',      hasApply:true },
    ]},
];

function monthKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
}

export default function MembershipScreen({ navigation }) {
  const { theme } = useAppTheme();
  const uid = auth.currentUser?.uid;

  const [config, setConfig]             = useState(getDefaultConfig());
  const [membership, setMembership]     = useState(null);
  const [userData, setUserData]         = useState(null);
  const [monthlyUsage, setMonthlyUsage] = useState({ free_used:0, apps_used:0 });
  const [loading, setLoading]           = useState(true);
  const [selectedPlan, setSelectedPlan] = useState('silver');
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [showTerms, setShowTerms]       = useState(false);
  const [termsScrolled, setTermsScrolled] = useState(false);
  const [termsAgreed, setTermsAgreed]   = useState(false);
  const [paying, setPaying]             = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeDetails, setUpgradeDetails]     = useState(null);
  const [showActivePlan, setShowActivePlan]     = useState(true);
  const [lang, setLang]                         = useState('en');
  const t = LANG[lang];

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    setLoading(true);
    try {
      const [cfg, mem, userSnap] = await Promise.all([
        getMembershipConfig(),
        getUserMembership(uid),
        getDoc(doc(db, 'users', uid)),
      ]);
      setConfig(cfg);
      // Trial user + toggle OFF → treat as no membership
      if (!cfg.isEnabled && mem?.isTrial) {
        setMembership({ ...mem, isActive: false, isExpired: true, toggledOff: true });
      } else {
        setMembership(mem);
      }
      if (userSnap.exists()) setUserData(userSnap.data());
      if (mem?.isActive) {
        const usSnap = await getDoc(doc(db, 'user_memberships', uid, 'monthly_usage', monthKey()));
        if (usSnap.exists()) setMonthlyUsage(usSnap.data());
      }
    } catch {}
    setLoading(false);
  };

  const stateCode = userData?.stateCode || '';

  // ── Plan selection tap ────────────────────────────────────
  const handlePlanTap = (key) => {
    if (!config.isEnabled) {
      Alert.alert('Membership Unavailable', 'New purchases and upgrades are currently unavailable.');
      return;
    }
    const isActive   = membership?.isActive && !membership?.isTrial && !membership?.isExpired;
    const currentKey = membership?.plan;

    if (!isActive) { setSelectedPlan(key); return; }

    const currentOrder = PLAN_ORDER[currentKey] || 0;
    const newOrder     = PLAN_ORDER[key]        || 0;

    // Same plan = renew
    if (key === currentKey) { setSelectedPlan(key); setShowActivePlan(false); return; }

    // Downgrade blocked on active
    if (newOrder < currentOrder) {
      Alert.alert(
        '⛔ Downgrade Not Allowed',
        `You are currently on ${membership.lockedBenefits?.planName || currentKey} plan.\n\nDowngrade is not allowed on an active plan.\n\nYour plan expires on ${new Date(membership.endDate).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })}.\n\nAfter expiry you can choose any plan.`,
        [{ text:'OK' }]
      );
      return;
    }

    // Upgrade — show pro-rata modal
    const { credit, remaining, usedDays } = calcUpgradeCredit(membership);
    const newPrice = calcPrice(key, selectedTerm, stateCode, config);
    const payNow   = Math.max(1, newPrice.total - credit);
    setUpgradeDetails({
      fromPlan:  membership.lockedBenefits?.planName || currentKey,
      toPlan:    (config.plans?.[key] || DEFAULT_PLANS[key])?.name,
      toEmoji:   (config.plans?.[key] || DEFAULT_PLANS[key])?.emoji,
      toColor:   (config.plans?.[key] || DEFAULT_PLANS[key])?.color,
      toKey:     key,
      term:      selectedTerm, // ✅ ISSUE-02: preserve selected term
      credit,
      remaining,
      usedDays,
      newPrice:  newPrice.total,
      payNow,
      newExpiry: (() => { const d = new Date(); d.setMonth(d.getMonth() + selectedTerm); return d; })(),
    });
    setShowUpgradeModal(true);
  };

  // ── Process upgrade ───────────────────────────────────────
  const processUpgrade = async () => {
    if (!upgradeDetails) return;
    const wallet = userData?.walletBalance || 0;
    if (wallet < upgradeDetails.payNow) {
      Alert.alert(t.insufficientBal,
        `Wallet: ₹${wallet}\nRequired: ₹${upgradeDetails.payNow}`,
        [{ text:t.addMoney, onPress:() => navigation.navigate('Wallet') }, { text:t.cancel, style:'cancel' }]
      );
      return;
    }
    setPaying(true);
    try {
      // Save old plan to history
      await saveMembershipHistory(uid, {
        plan:      membership.plan,
        pricePaid: membership.pricePaid,
        startDate: membership.startDate,
        endDate:   membership.endDate,
        reason:    `upgraded_to_${upgradeDetails.toKey}`,
        creditGiven: upgradeDetails.credit,
      });

      const locked = buildLockedBenefits(upgradeDetails.toKey, config, stateCode);
      await updateDoc(doc(db, 'users', uid), {
        walletBalance:    increment(-upgradeDetails.payNow),
        membershipStatus: upgradeDetails.toKey,
      });
      await setDoc(doc(db, 'user_memberships', uid), {
        plan:           upgradeDetails.toKey,
        term:           selectedTerm,
        isTrial:        false,
        isActive:       true,
        startDate:      serverTimestamp(),
        endDate:        upgradeDetails.newExpiry.toISOString(),
        pricePaid:      upgradeDetails.payNow,
        priceMonthly:   Math.round(upgradeDetails.payNow / selectedTerm),
        upgradeCredit:  upgradeDetails.credit,
        upgradedFrom:   membership.plan,
        stateCode,
        lockedBenefits: locked,
        assignedByAdmin: false,
        renewedAt:      serverTimestamp(),
        termsVersion:   '1.0',
        termsAgreedAt:  new Date().toISOString(),
      });
      await setDoc(
        doc(db, 'user_memberships', uid, 'monthly_usage', monthKey()),
        { apps_used:0, free_used:0 }, { merge:true }
      );
      await addDoc(collection(db, 'transactions'), {
        userId: uid, amount: -upgradeDetails.payNow, type:'debit',
        remark: `Upgrade ${upgradeDetails.fromPlan} → ${upgradeDetails.toPlan}`,
        status: 'success', timestamp: serverTimestamp(),
      });
      setShowUpgradeModal(false);
      await loadData();
      Alert.alert(`${upgradeDetails.toEmoji} Upgraded!`,
        `Now on ${upgradeDetails.toPlan} plan!\nValid till ${upgradeDetails.newExpiry.toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })}`,
        [{ text:t.great }]
      );
    } catch { Alert.alert(t.upgradeFailed, t.tryAgain); }
    setPaying(false);
  };

  // ── Subscribe new ─────────────────────────────────────────
  const handleSubscribe = async () => {
    if (!config.isEnabled) {
      Alert.alert('Membership Unavailable', 'Membership feature is currently unavailable. Please try again later.');
      return;
    }
    if (!termsAgreed) { Alert.alert('Terms Required', 'Please agree to Terms & Conditions.'); return; }
    const pr     = calcPrice(selectedPlan, selectedTerm, stateCode, config);
    const wallet = userData?.walletBalance || 0;
    if (wallet < pr.total) {
      Alert.alert(t.insufficientBal,
        `Wallet: ₹${wallet}\nRequired: ₹${pr.total}`,
        [{ text:t.addMoney, onPress:() => navigation.navigate('Wallet') }, { text:t.cancel, style:'cancel' }]
      );
      return;
    }
    const pl = (config.plans?.[selectedPlan]) || DEFAULT_PLANS[selectedPlan];
    Alert.alert(`Confirm Subscription`,
      `${pl.emoji} ${pl.name} — ${selectedTerm} Month${selectedTerm>1?'s':''}\n\n₹${pr.total} from wallet`,
      [{ text:t.cancel, style:'cancel' }, { text:'Subscribe', onPress:() => processSubscribe(pr) }]
    );
  };

  const processSubscribe = async (pr) => {
    setPaying(true);
    try {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + selectedTerm);
      const locked = buildLockedBenefits(selectedPlan, config, stateCode);
      const isRenew = membership?.plan === selectedPlan;

      if (isRenew && membership?.endDate) {
        // Renew — extend existing expiry
        const oldEnd = new Date(membership.endDate);
        oldEnd.setMonth(oldEnd.getMonth() + selectedTerm);
        await saveMembershipHistory(uid, {
          plan: membership.plan, pricePaid: membership.pricePaid,
          startDate: membership.startDate, endDate: membership.endDate,
          reason: 'renewed',
        });
        await setDoc(doc(db, 'user_memberships', uid), {
          plan: selectedPlan, term: selectedTerm, isTrial:false, isActive:true,
          startDate: serverTimestamp(), endDate: oldEnd.toISOString(),
          pricePaid: pr.total, priceMonthly: pr.monthly,
          stateCode, lockedBenefits: locked,
          assignedByAdmin:false, renewedAt: serverTimestamp(),
          termsVersion:'1.0', termsAgreedAt: new Date().toISOString(),
        });
      } else {
        // New purchase or downgrade after expiry
        if (membership && !isRenew) {
          await saveMembershipHistory(uid, {
            plan: membership.plan, pricePaid: membership.pricePaid,
            startDate: membership.startDate, endDate: membership.endDate,
            reason: PLAN_ORDER[selectedPlan] < PLAN_ORDER[membership.plan] ? 'downgraded' : 'changed',
          });
        }
        await setDoc(doc(db, 'user_memberships', uid), {
          plan: selectedPlan, term: selectedTerm, isTrial:false, isActive:true,
          startDate: serverTimestamp(), endDate: endDate.toISOString(),
          pricePaid: pr.total, priceMonthly: pr.monthly,
          stateCode, lockedBenefits: locked,
          assignedByAdmin:false, renewedAt: serverTimestamp(),
          termsVersion:'1.0', termsAgreedAt: new Date().toISOString(),
        });
      }

      await updateDoc(doc(db, 'users', uid), {
        walletBalance: increment(-pr.total), membershipStatus: selectedPlan,
      });
      await setDoc(doc(db, 'user_memberships', uid, 'monthly_usage', monthKey()),
        { apps_used:0, free_used:0 }, { merge:true }
      );
      await addDoc(collection(db, 'transactions'), {
        userId: uid, amount: -pr.total, type:'debit',
        remark: `${(config.plans?.[selectedPlan])?.name} Membership — ${selectedTerm}M`,
        status:'success', timestamp: serverTimestamp(),
      });
      await loadData();
      setShowActivePlan(true);
    } catch { Alert.alert('Payment Failed', 'Try again.'); }
    setPaying(false);
  };

  const TERM_LIST  = [1, 3, 6, 12];
  const PLAN_KEYS  = ['basic', 'silver', 'gold'];

  if (loading) return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.bg }]}>
      <ActivityIndicator style={{ flex:1 }} color="#002855" size="large" />
    </SafeAreaView>
  );

  // ── ACTIVE PLAN SCREEN ────────────────────────────────────
  const isActivePaid = membership?.isActive && !membership?.isTrial && !membership?.isExpired;
  if (isActivePaid && showActivePlan) {
    const lb      = membership.lockedBenefits || {};
    const endDate = membership.endDate ? new Date(membership.endDate) : null;
    const daysLeft = endDate ? Math.max(0, Math.ceil((endDate - new Date()) / (1000*60*60*24))) : 0;
    const freeAllowed = lb.freeApps != null ? Number(lb.freeApps) : 0;
    const freeUsed    = monthlyUsage.free_used || 0;
    const freeLeft    = Math.max(0, freeAllowed - freeUsed);
    const appsUsed    = monthlyUsage.apps_used || 0;
    const appsLimit   = lb.appLimit != null ? lb.appLimit : -1;
    const planColor   = lb.planColor || '#002855';
    const coverage    = lb.coverage || DEFAULT_COVERAGE[membership.plan] || {};

    const benefits = [
      { label:t.apps, val: (appsLimit == null || appsLimit === -1 || appsLimit === 0) ? t.unlimitedApps : (lang==='en' ? `Max ${appsLimit} applications/month` : `अधिकतम ${appsLimit} आवेदन/महीना`), icon:'file-multiple', yes:true },
      { label:t.freeApps,    val: freeAllowed > 0 ? t.freeAppsDesc(freeAllowed) : t.noFreeApps, icon:'gift', yes: freeAllowed > 0 },
      { label:t.discount,   val: t.discountDesc(lb.discount || 0), icon:'percent', yes: (lb.discount||0) > 0 },
      { label:t.processing,         val: lb.processing || 'Standard', icon:'clock-fast', yes:true },
      { label:t.support,            val: lb.support || 'Basic', icon:'headset', yes:true },
      { label:t.whatsapp,    val: lb.whatsapp ? '✅ Included' : '❌ Not included', icon:'whatsapp', yes: !!lb.whatsapp },
      { label:t.govtFee,  val: t.govtFeeVal, icon:'bank', yes:false },
    ];

    return (
      <SafeAreaView style={[s.safe, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle="light-content" backgroundColor="#002855" />
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>My Membership</Text>
          <TouchableOpacity
            style={s.langToggle}
            onPress={() => setLang(l => l === 'en' ? 'hi' : 'en')}
          >
            <Text style={s.langToggleText}>{lang === 'en' ? 'हिं' : 'EN'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>

          {/* Plan Card */}
          <View style={[s.activeCard, { backgroundColor: planColor }]}>
            <View style={s.activeCardInner}>
              <Text style={s.activeEmoji}>{lb.planEmoji || '⭐'}</Text>
              <Text style={s.activeName}>{lb.planName || membership.plan} Plan</Text>
              <View style={s.activeBadge}>
                <MaterialCommunityIcons name="check-circle" size={12} color="#fff" />
                <Text style={s.activeBadgeText}>Active Member</Text>
              </View>

              <View style={s.activeStatsRow}>
                <View style={s.activeStat}>
                  <Text style={s.activeStatVal}>{daysLeft}</Text>
                  <Text style={s.activeStatLabel}>Days Left</Text>
                </View>
                <View style={s.activeStatDiv} />
                <View style={s.activeStat}>
                  <Text style={s.activeStatVal}>{lb.discount || 0}%</Text>
                  <Text style={s.activeStatLabel}>Discount</Text>
                </View>
                <View style={s.activeStatDiv} />
                <View style={s.activeStat}>
                  <Text style={s.activeStatVal}>
                    {lb.appLimit == null || lb.appLimit === -1 || lb.appLimit === 0 ? '∞' : lb.appLimit}
                  </Text>
                  <Text style={s.activeStatLabel}>Apps</Text>
                </View>
              </View>

              {/* Free apps bar */}
              {freeAllowed > 0 && (
                <View style={s.freeBar}>
                  <View style={s.freeBarTop}>
                    <Text style={s.freeBarLabel}>🎁 Free Apps This Month</Text>
                    <Text style={s.freeBarCount}>{freeLeft}/{freeAllowed} {t.freeLeft}</Text>
                  </View>
                  <View style={s.freeBarBg}>
                    <View style={[s.freeBarFill, { width: freeAllowed > 0 ? `${(freeLeft/freeAllowed)*100}%` : '0%' }]} />
                  </View>
                </View>
              )}

              <Text style={s.activeExpiry}>
                {t.validTill} {endDate?.toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })}
              </Text>
            </View>
          </View>

          {/* Benefits */}
          <View style={[s.section, { backgroundColor: theme.card }]}>
            <Text style={[s.sectionTitle, { color: theme.text }]}>Your Benefits</Text>
            <Text style={[s.sectionSub, { color: theme.textMuted }]}>
              Locked at purchase — protected from admin changes
            </Text>
            {benefits.map((b, i) => (
              <View key={i} style={[s.benefitRow, { borderBottomColor: theme.border }]}>
                <View style={[s.benefitDot, { backgroundColor: b.yes ? '#DCFCE7' : '#FEF2F2' }]}>
                  <MaterialCommunityIcons
                    name={b.yes ? 'check' : 'close'}
                    size={13} color={b.yes ? '#16A34A' : '#DC2626'}
                  />
                </View>
                <View style={{ flex:1, marginLeft:12 }}>
                  <Text style={[s.benefitLabel, { color: theme.text }]}>{b.label}</Text>
                  <Text style={[s.benefitVal, { color: b.yes ? '#16A34A' : '#94A3B8' }]}>{b.val}</Text>
                </View>
                <MaterialCommunityIcons name={b.icon} size={18} color={theme.border} />
              </View>
            ))}
          </View>

          {/* How it works */}
          <View style={[s.section, { backgroundColor: '#EBF5FB' }]}>
            <Text style={[s.sectionTitle, { color:'#002855' }]}>
              {lang === 'en' ? 'How It Works' : 'कैसे काम करता है'}
            </Text>
            {freeAllowed > 0 && (
              <Text style={s.howItWorksText}>{t.freeAppRule}</Text>
            )}
            <Text style={s.howItWorksText}>{t.discountRule}</Text>
            <Text style={s.howItWorksText}>{t.paidRule}</Text>
            <Text style={s.howItWorksText}>{t.noDiscountRule}</Text>
          </View>

          {/* Service Coverage */}
          <View style={[s.section, { backgroundColor: theme.card }]}>
            <Text style={[s.sectionTitle, { color: theme.text }]}>Service Coverage</Text>
            <Text style={[s.sectionSub, { color: theme.textMuted }]}>
              Where your discount applies
            </Text>
            {APP_MENUS.map(menu => {
              const svcCov  = coverage[menu.key];
              const enabled = svcCov?.enabled !== false;
              const cats    = svcCov?.categories;
              return (
                <View key={menu.key} style={[s.svcRow, { borderBottomColor: theme.border }]}>
                  <View style={s.svcHeader}>
                    <View style={[s.svcIcon, { backgroundColor: menu.color + '20' }]}>
                      <MaterialCommunityIcons name={menu.icon} size={16} color={menu.color} />
                    </View>
                    <Text style={[s.svcLabel, { color: theme.text }]}>{menu.label}</Text>
                    <View style={[s.covBadge, { backgroundColor: enabled ? '#DCFCE7':'#FEF2F2' }]}>
                      <MaterialCommunityIcons
                        name={enabled ? 'check-circle':'close-circle'}
                        size={13} color={enabled ? '#16A34A':'#DC2626'}
                      />
                      <Text style={[s.covBadgeText, { color: enabled ? '#16A34A':'#DC2626' }]}>
                        {enabled ? t.covered : t.notCovered}
                      </Text>
                    </View>
                  </View>
                  {enabled && cats && (
                    <View style={s.catGrid}>
                      {Object.entries(cats).map(([k, on]) => (
                        <View key={k} style={s.catItem}>
                          <MaterialCommunityIcons
                            name={on ? 'check':'close'} size={11}
                            color={on ? '#16A34A':'#DC2626'}
                          />
                          <Text style={[s.catText, {
                            color: on ? theme.text : theme.textMuted,
                            textDecorationLine: on ? 'none' : 'line-through',
                          }]}>
                            {menu.categories.find(c => c.key === k)?.label || k}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
            {/* Govt fee note */}
            <View style={s.govtNote}>
              <MaterialCommunityIcons name="information" size={14} color="#F59E0B" />
              <Text style={s.govtNoteText}>
  {t.govtNote}
              </Text>
            </View>
          </View>

          {/* Renew / Upgrade */}
          <View style={{ flexDirection:'row', gap:10, marginHorizontal:16 }}>
            <TouchableOpacity
              style={[s.renewBtn, { backgroundColor: planColor, flex:1 }]}
              onPress={() => { setShowActivePlan(false); setSelectedPlan(membership.plan); }}
            >
              <MaterialCommunityIcons name="refresh" size={18} color="#fff" />
              <Text style={s.renewBtnText}>Renew / Upgrade</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.renewBtn, { backgroundColor: theme.card, flex:0.6 }]}
              onPress={() => navigation.navigate('MembershipHistory')}
            >
              <MaterialCommunityIcons name="history" size={18} color={planColor} />
              <Text style={[s.renewBtnText, { color: planColor }]}>History</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height:40 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── PLAN SELECTION SCREEN ─────────────────────────────────
  const isActive   = membership?.isActive && !membership?.isTrial && !membership?.isExpired;
  const currentKey = membership?.plan;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor="#002855" />
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => {
          if (isActivePaid) setShowActivePlan(true);
          else navigation.goBack();
        }}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>
          {isActivePaid ? t.renewUpgradeTitle : t.choosePlan}
        </Text>
        <View style={{ width:38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Toggle OFF banner */}
        {!config.isEnabled && (
          <View style={[s.trialBanner, { backgroundColor:'#FEF2F2', borderLeftColor:'#EF4444' }]}>
            <MaterialCommunityIcons name="information" size={16} color="#DC2626" />
            <Text style={[s.trialBannerText, { color:'#DC2626' }]}>
              Membership feature abhi unavailable hai. Existing paid plans active rahenge.
            </Text>
          </View>
        )}

        {membership?.isTrial && (
          <View style={s.trialBanner}>
            <Text style={s.trialBannerText}>🎁 Free trial active — upgrade for full benefits</Text>
          </View>
        )}

        {/* Term selector */}
        <View style={[s.termWrap, { backgroundColor: theme.card }]}>
          <Text style={[s.termTitle, { color: theme.text }]}>Select Duration</Text>
          <View style={s.termRow}>
            {TERM_LIST.map(t => {
              const disc = config.termDiscounts?.[t] || 0;
              return (
                <TouchableOpacity
                  key={t}
                  style={[s.termBtn, selectedTerm === t && s.termBtnActive]}
                  onPress={() => setSelectedTerm(t)}
                >
                  <Text style={[s.termMonths, selectedTerm === t && { color:'#fff' }]}>
                    {t === 1 ? '1 Mo' : t === 12 ? '1 Yr' : `${t} Mo`}
                  </Text>
                  {disc > 0 && (
                    <Text style={[s.termDisc, selectedTerm === t && { color:'#FFD700' }]}>
                      -{disc}%
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedTerm > 1 && (
            <Text style={s.termSaving}>
              💰 Save ₹{calcPrice(selectedPlan, selectedTerm, stateCode, config).saved} vs monthly
            </Text>
          )}
        </View>

        {/* Plan cards */}
        <View style={{ paddingHorizontal:16, gap:14 }}>
          {PLAN_KEYS.map(key => {
            const pl         = (config.plans?.[key]) || DEFAULT_PLANS[key];
            const pr         = calcPrice(key, selectedTerm, stateCode, config);
            const isSelected = selectedPlan === key;
            const isPopular  = key === 'silver';
            const isExpanded = expandedPlan === key;
            const cov        = (config.coverage?.[key]) || DEFAULT_COVERAGE[key] || {};
            const freeApps   = pl.freeApps || 0;
            const isCurrent  = isActive && key === currentKey;
            const currentOrd = PLAN_ORDER[currentKey] || 0;
            const thisOrd    = PLAN_ORDER[key] || 0;
            const isDowngrade = isActive && thisOrd < currentOrd;
            const isUpgrade   = isActive && thisOrd > currentOrd;

            return (
              <TouchableOpacity
                key={key}
                style={[s.planCard, { backgroundColor: theme.card },
                  isSelected && { borderColor: pl.color, borderWidth:2.5 },
                  isCurrent  && { borderColor: pl.color + '80', borderWidth:1.5 },
                ]}
                onPress={() => { handlePlanTap(key); setSelectedPlan(key); }}
                activeOpacity={0.85}
              >
                {isPopular && !isCurrent && (
                  <View style={[s.planBadge, { backgroundColor: pl.color }]}>
                    <Text style={s.planBadgeText}>POPULAR</Text>
                  </View>
                )}
                {isCurrent && (
                  <View style={[s.planBadge, { backgroundColor: pl.color }]}>
                    <Text style={s.planBadgeText}>CURRENT PLAN</Text>
                  </View>
                )}
                {isUpgrade && (
                  <View style={[s.planBadge, { backgroundColor: '#10B981' }]}>
                    <Text style={s.planBadgeText}>⬆ UPGRADE</Text>
                  </View>
                )}
                {isDowngrade && (
                  <View style={[s.planBadge, { backgroundColor: '#94A3B8' }]}>
                    <Text style={s.planBadgeText}>🔒 LOCKED</Text>
                  </View>
                )}

                {/* Header */}
                <View style={s.planHeader}>
                  <View style={[s.planEmojiWrap, { backgroundColor: pl.color + '20' }]}>
                    <Text style={s.planEmoji}>{pl.emoji}</Text>
                  </View>
                  <View style={{ flex:1, marginLeft:14 }}>
                    <Text style={[s.planName, { color: theme.text }]}>{pl.name}</Text>
                    <View style={{ flexDirection:'row', alignItems:'baseline', gap:4 }}>
                      <Text style={[s.planPrice, { color: pl.color }]}>₹{pr.monthly}</Text>
                      <Text style={[s.planPriceSub, { color: theme.textMuted }]}>/month</Text>
                    </View>
                    {selectedTerm > 1 && (
                      <Text style={[s.planTotal, { color: theme.textMuted }]}>
                        ₹{pr.total} total  •  save ₹{pr.saved}
                      </Text>
                    )}
                  </View>
                  <View style={[s.radio, isSelected && { borderColor: pl.color }]}>
                    {isSelected && <View style={[s.radioDot, { backgroundColor: pl.color }]} />}
                  </View>
                </View>

                {/* Quick benefits */}
                <View style={s.quickBenefits}>
                  {[
                    { label: lang==='en' ? 'Unlimited applications — no cap' : 'असीमित आवेदन — कोई सीमा नहीं', yes:true },
                    { label: freeApps > 0 ? (lang==='en' ? `${freeApps} FREE — SewaOne fee zero` : `${freeApps} मुफ़्त — SewaOne शुल्क शून्य`) : (lang==='en' ? 'No free applications' : 'मुफ़्त आवेदन नहीं'), yes: freeApps > 0 },
                    { label: lang==='en' ? `${pl.discount}% off SewaOne service fee` : `SewaOne शुल्क पर ${pl.discount}% छूट`, yes: pl.discount > 0 },
                  ].map((b, i) => (
                    <View key={i} style={s.qbRow}>
                      <View style={[s.qbDot, { backgroundColor: b.yes ? '#DCFCE7':'#FEF2F2' }]}>
                        <MaterialCommunityIcons
                          name={b.yes ? 'check':'close'} size={11}
                          color={b.yes ? '#16A34A':'#DC2626'}
                        />
                      </View>
                      <Text style={[s.qbText, { color: b.yes ? theme.text : theme.textMuted }]}>
                        {b.label}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Expand coverage */}
                <TouchableOpacity
                  style={[s.expandBtn, { borderTopColor: theme.border }]}
                  onPress={() => setExpandedPlan(isExpanded ? null : key)}
                >
                  <Text style={[s.expandText, { color: pl.color }]}>
                    {isExpanded ? t.hideCoverage.split(' ')[0] : t.viewCoverage.split(' ')[0]} Service Coverage
                  </Text>
                  <MaterialCommunityIcons
                    name={isExpanded ? 'chevron-up':'chevron-down'}
                    size={16} color={pl.color}
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={[s.coverageWrap, { borderTopColor: theme.border }]}>
                    {APP_MENUS.map(menu => {
                      const sc      = cov[menu.key];
                      const enabled = sc?.enabled !== false;
                      const cats    = sc?.categories;
                      return (
                        <View key={menu.key} style={s.covMenuRow}>
                          <View style={s.covMenuHeader}>
                            <MaterialCommunityIcons name={menu.icon} size={14} color={menu.color} />
                            <Text style={[s.covMenuLabel, { color: theme.text }]}>{menu.label}</Text>
                            <View style={[s.covSmBadge, { backgroundColor: enabled ? '#DCFCE7':'#FEF2F2' }]}>
                              <Text style={{ color: enabled ? '#16A34A':'#DC2626', fontSize:11, fontWeight:'900' }}>
                                {enabled ? '✓' : '✗'}
                              </Text>
                            </View>
                          </View>
                          {enabled && cats && (
                            <View style={s.covCats}>
                              {Object.entries(cats).map(([k, on]) => (
                                <View key={k} style={s.covCatItem}>
                                  <MaterialCommunityIcons
                                    name={on ? 'check':'close'} size={10}
                                    color={on ? '#16A34A':'#DC2626'}
                                  />
                                  <Text style={[s.covCatText, {
                                    color: on ? theme.text : theme.textMuted,
                                    textDecorationLine: on ? 'none':'line-through',
                                  }]}>
                                    {menu.categories.find(c => c.key === k)?.label || k}
                                    {menu.categories.find(c => c.key === k)?.hasApply === false && (
                                      <Text style={{ color:'#94A3B8', fontSize:10 }}> (no fee)</Text>
                                    )}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                    <View style={s.govtNote}>
                      <MaterialCommunityIcons name="close-circle" size={12} color="#DC2626" />
                      <Text style={[s.govtNoteText, { color:'#DC2626' }]}>
                        Government fees — not covered (fixed by law)
                      </Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Fee note */}
        <View style={[s.feeNote, { backgroundColor: theme.card }]}>
          <MaterialCommunityIcons name="information" size={15} color="#F59E0B" />
          <Text style={[s.feeNoteText, { color: theme.textMuted }]}>
{t.feeNote}
          </Text>
        </View>

        {/* Order summary */}
        {!isActive && (
          <View style={[s.summaryCard, { backgroundColor: theme.card }]}>
            {(() => {
              const pl = (config.plans?.[selectedPlan]) || DEFAULT_PLANS[selectedPlan];
              const pr = calcPrice(selectedPlan, selectedTerm, stateCode, config);
              return (
                <>
                  <Text style={[s.summaryTitle, { color: theme.text }]}>Order Summary</Text>
                  {[
                    { label:'Plan', val:`${pl.emoji} ${pl.name} — ${selectedTerm}M` },
                    { label:'Per Month', val:`₹${pr.monthly}/month` },
                    pr.saved > 0 ? { label:'You Save', val:`₹${pr.saved}`, green:true } : null,
                  ].filter(Boolean).map((r, i) => (
                    <View key={i} style={[s.summaryRow, { borderBottomColor: theme.border }]}>
                      <Text style={[s.summaryLabel, { color: theme.textMuted }]}>{r.label}</Text>
                      <Text style={[s.summaryVal, { color: r.green ? '#16A34A' : theme.text }]}>{r.val}</Text>
                    </View>
                  ))}
                  <View style={[s.summaryRow, { borderBottomColor: theme.border, borderBottomWidth:0, paddingTop:12 }]}>
                    <Text style={[s.summaryLabel, { color: theme.text, fontWeight:'900' }]}>Total</Text>
                    <Text style={s.totalVal}>₹{pr.total}</Text>
                  </View>
                  <View style={[s.walletRow, { backgroundColor: theme.surface }]}>
                    <MaterialCommunityIcons name="wallet" size={15} color="#002855" />
                    <Text style={[s.walletText, { color: theme.textMuted }]}>
                      Wallet Balance: ₹{userData?.walletBalance || 0}
                    </Text>
                    {(userData?.walletBalance || 0) < pr.total && (
                      <Text style={s.lowBal}>Low balance</Text>
                    )}
                  </View>

                  {/* Terms */}
                  <TouchableOpacity style={s.termsRow} onPress={() => setShowTerms(true)}>
                    <View style={[s.checkbox, termsAgreed && s.checkboxOn]}>
                      {termsAgreed && <MaterialCommunityIcons name="check" size={13} color="#fff" />}
                    </View>
                    <Text style={[s.termsRowText, { color: theme.textMuted }]}>
                      I agree to the{' '}
                      <Text style={s.termsLink} onPress={() => setShowTerms(true)}>
                        Terms & Conditions
                      </Text>
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.subBtn, (!termsAgreed || paying) && { opacity:0.5 }]}
                    onPress={handleSubscribe}
                    disabled={!termsAgreed || paying}
                  >
                    {paying
                      ? <ActivityIndicator color="#fff" />
                      : <>
                          <MaterialCommunityIcons name="wallet" size={18} color="#fff" />
                          <Text style={s.subBtnText}>Subscribe — ₹{pr.total}</Text>
                        </>
                    }
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        )}

        {/* Renew same plan button for active users */}
        {isActive && selectedPlan === currentKey && (
          <View style={[s.summaryCard, { backgroundColor: theme.card }]}>
            {(() => {
              const pr = calcPrice(selectedPlan, selectedTerm, stateCode, config);
              const pl = (config.plans?.[selectedPlan]) || DEFAULT_PLANS[selectedPlan];
              return (
                <>
                  <Text style={[s.summaryTitle, { color: theme.text }]}>Renew Plan</Text>
                  <Text style={[s.sectionSub, { color: theme.textMuted }]}>
                    New config will apply at renewal
                  </Text>
                  <View style={[s.summaryRow, { borderBottomColor: theme.border, borderBottomWidth:0 }]}>
                    <Text style={[s.summaryLabel, { color: theme.text, fontWeight:'900' }]}>
                      {pl.emoji} {pl.name} — {selectedTerm}M
                    </Text>
                    <Text style={s.totalVal}>₹{pr.total}</Text>
                  </View>
                  <TouchableOpacity style={s.termsRow} onPress={() => setShowTerms(true)}>
                    <View style={[s.checkbox, termsAgreed && s.checkboxOn]}>
                      {termsAgreed && <MaterialCommunityIcons name="check" size={13} color="#fff" />}
                    </View>
                    <Text style={[s.termsRowText, { color: theme.textMuted }]}>
                      I agree to the{' '}
                      <Text style={s.termsLink}>Terms & Conditions</Text>
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.subBtn, (!termsAgreed || paying) && { opacity:0.5 }]}
                    onPress={() => { if (!termsAgreed) { Alert.alert('Terms Required'); return; } processSubscribe(pr); }}
                    disabled={!termsAgreed || paying}
                  >
                    {paying ? <ActivityIndicator color="#fff" /> :
                      <><MaterialCommunityIcons name="refresh" size={18} color="#fff" />
                        <Text style={s.subBtnText}>Renew — ₹{pr.total}</Text></>
                    }
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        )}

        <View style={{ height:40 }} />
      </ScrollView>

      {/* Upgrade modal */}
      <Modal visible={showUpgradeModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.upgradeSheet, { backgroundColor: theme.card }]}>
            <View style={s.sheetHandle} />
            <Text style={[s.sheetTitle, { color: theme.text }]}>
              ⬆ Upgrade to {upgradeDetails?.toEmoji} {upgradeDetails?.toPlan}
            </Text>
            {upgradeDetails && (
              <>
                {/* ISSUE-02 Fix: Term selector in upgrade modal */}
                <View style={[s.termWrap, { backgroundColor: theme.surface, margin:0, marginBottom:12 }]}>
                  <Text style={[s.termTitle, { color: theme.text, fontSize:13 }]}>Upgrade Duration</Text>
                  <View style={s.termRow}>
                    {[1,3,6,12].map(t => {
                      const disc = config.termDiscounts?.[t] || 0;
                      const pr   = calcPrice(upgradeDetails.toKey, t, stateCode, config);
                      const credit = upgradeDetails.credit;
                      const pay  = Math.max(1, pr.total - credit);
                      return (
                        <TouchableOpacity key={t}
                          style={[s.termBtn, selectedTerm === t && s.termBtnActive]}
                          onPress={() => {
                            setSelectedTerm(t);
                            setUpgradeDetails(prev => ({ ...prev, newPrice: pr.total, payNow: pay, newExpiry: (() => { const d = new Date(); d.setMonth(d.getMonth()+t); return d; })() }));
                          }}
                        >
                          <Text style={[s.termMonths, selectedTerm === t && { color:'#fff' }]}>
                            {t === 1 ? '1 Mo' : t === 12 ? '1 Yr' : `${t} Mo`}
                          </Text>
                          {disc > 0 && <Text style={[s.termDisc, selectedTerm === t && { color:'#FFD700' }]}>-{disc}%</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                <View style={[s.upgradeRow, { backgroundColor: theme.surface }]}>
                  <Text style={[s.upgradeLabel, { color: theme.textMuted }]}>New plan price</Text>
                  <Text style={[s.upgradeVal, { color: theme.text }]}>₹{upgradeDetails.newPrice}</Text>
                </View>
                <View style={[s.upgradeRow, { backgroundColor: theme.surface }]}>
                  <Text style={[s.upgradeLabel, { color: theme.textMuted }]}>
                    {upgradeDetails.fromPlan} credit ({upgradeDetails.remaining} days remaining)
                  </Text>
                  <Text style={[s.upgradeVal, { color:'#10B981' }]}>-₹{upgradeDetails.credit}</Text>
                </View>
                <View style={[s.upgradeTotal, { borderTopColor: theme.border }]}>
                  <Text style={[s.upgradeLabel, { color: theme.text, fontWeight:'900' }]}>Pay Now</Text>
                  <Text style={s.upgradeTotalVal}>₹{upgradeDetails.payNow}</Text>
                </View>
                <View style={[s.upgradeInfo, { backgroundColor: upgradeDetails.toColor + '15' }]}>
                  <MaterialCommunityIcons name="calendar-check" size={16} color={upgradeDetails.toColor} />
                  <Text style={[s.upgradeInfoText, { color: theme.textMuted }]}>
                    New expiry: {upgradeDetails.newExpiry?.toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })}
                  </Text>
                </View>
                <View style={[s.upgradeInfo, { backgroundColor:'#FEF3C7' }]}>
                  <MaterialCommunityIcons name="information" size={16} color="#F59E0B" />
                  <Text style={[s.upgradeInfoText, { color:'#92400E' }]}>
                    Current {upgradeDetails.fromPlan} plan will be replaced immediately
                  </Text>
                </View>
                <TouchableOpacity
                  style={[s.subBtn, { backgroundColor: upgradeDetails.toColor }, paying && { opacity:0.5 }]}
                  onPress={processUpgrade}
                  disabled={paying}
                >
                  {paying ? <ActivityIndicator color="#fff" /> :
                    <Text style={s.subBtnText}>Pay ₹{upgradeDetails.payNow} — Upgrade Now</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowUpgradeModal(false)}>
                  <Text style={[s.cancelBtnText, { color: theme.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Terms modal */}
      <Modal visible={showTerms} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.termsSheet, { backgroundColor: theme.card }]}>
            <View style={s.sheetHandle} />
            <Text style={[s.sheetTitle, { color: theme.text }]}>Terms & Conditions</Text>
            <ScrollView
              style={s.termsScroll}
              onScroll={({ nativeEvent:{ layoutMeasurement, contentOffset, contentSize } }) => {
                if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 20)
                  setTermsScrolled(true);
              }}
              scrollEventThrottle={16}
            >
              <Text style={[s.termsContent, { color: theme.text }]}>{TERMS}</Text>
              <View style={{ height:20 }} />
            </ScrollView>
            {!termsScrolled && (
              <Text style={s.scrollHint}>↓ Scroll to read all terms</Text>
            )}
            <TouchableOpacity
              style={[s.subBtn, !termsScrolled && { opacity:0.4 }]}
              onPress={() => {
                if (!termsScrolled) { Alert.alert('Please Read', 'Scroll through all terms first.'); return; }
                setTermsAgreed(true); setShowTerms(false);
              }}
            >
              <MaterialCommunityIcons name="check-circle" size={18} color="#fff" />
              <Text style={s.subBtnText}>I Agree — Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowTerms(false)}>
              <Text style={[s.cancelBtnText, { color: theme.textMuted }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex:1 },
  langToggle:  { width:38, height:38, borderRadius:12, backgroundColor:'rgba(255,255,255,0.2)', justifyContent:'center', alignItems:'center' },
  langToggleText: { color:'#fff', fontWeight:'900', fontSize:14 },
  howItWorksText: { fontSize:13, fontWeight:'600', color:'#1E293B', paddingVertical:4, paddingLeft:4 },
  header:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'#002855', paddingHorizontal:16, paddingVertical:14 },
  backBtn:     { width:38, height:38, borderRadius:12, backgroundColor:'rgba(255,255,255,0.15)', justifyContent:'center', alignItems:'center' },
  headerTitle: { color:'#fff', fontSize:17, fontWeight:'900' },

  // Active card
  activeCard:      { margin:16, borderRadius:24, elevation:6, overflow:'hidden' },
  activeCardInner: { padding:24, alignItems:'center' },
  activeEmoji:     { fontSize:52, marginBottom:8 },
  activeName:      { fontSize:26, fontWeight:'900', color:'#fff', marginBottom:6 },
  activeBadge:     { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'rgba(255,255,255,0.2)', paddingHorizontal:12, paddingVertical:4, borderRadius:20, marginBottom:20 },
  activeBadgeText: { color:'#fff', fontSize:12, fontWeight:'800' },
  activeStatsRow:  { flexDirection:'row', alignItems:'center', gap:0, marginBottom:16 },
  activeStat:      { alignItems:'center', flex:1 },
  activeStatVal:   { fontSize:26, fontWeight:'900', color:'#fff' },
  activeStatLabel: { fontSize:11, color:'rgba(255,255,255,0.7)', fontWeight:'700', marginTop:2 },
  activeStatDiv:   { width:1, height:40, backgroundColor:'rgba(255,255,255,0.2)' },
  freeBar:         { width:'100%', marginBottom:16 },
  freeBarTop:      { flexDirection:'row', justifyContent:'space-between', marginBottom:6 },
  freeBarLabel:    { color:'rgba(255,255,255,0.8)', fontSize:12, fontWeight:'700' },
  freeBarCount:    { color:'#fff', fontSize:12, fontWeight:'900' },
  freeBarBg:       { height:8, backgroundColor:'rgba(255,255,255,0.25)', borderRadius:4, overflow:'hidden' },
  freeBarFill:     { height:'100%', backgroundColor:'#fff', borderRadius:4 },
  activeExpiry:    { color:'rgba(255,255,255,0.7)', fontSize:12, fontWeight:'700' },

  // Sections
  section:      { margin:16, marginTop:0, borderRadius:18, padding:16, elevation:1 },
  sectionTitle: { fontSize:15, fontWeight:'900', marginBottom:4 },
  sectionSub:   { fontSize:12, fontWeight:'600', marginBottom:12 },

  // Benefits
  benefitRow:   { flexDirection:'row', alignItems:'center', paddingVertical:11, borderBottomWidth:1 },
  benefitDot:   { width:26, height:26, borderRadius:8, justifyContent:'center', alignItems:'center' },
  benefitLabel: { fontSize:13, fontWeight:'700' },
  benefitVal:   { fontSize:12, fontWeight:'600', marginTop:2 },

  // Service coverage
  svcRow:       { paddingVertical:12, borderBottomWidth:1 },
  svcHeader:    { flexDirection:'row', alignItems:'center', gap:10 },
  svcIcon:      { width:32, height:32, borderRadius:10, justifyContent:'center', alignItems:'center' },
  svcLabel:     { flex:1, fontSize:13, fontWeight:'800' },
  covBadge:     { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:3, borderRadius:20 },
  covBadgeText: { fontSize:11, fontWeight:'800' },
  catGrid:      { flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:8, paddingLeft:42 },
  catItem:      { flexDirection:'row', alignItems:'center', gap:4 },
  catText:      { fontSize:11, fontWeight:'600' },
  govtNote:     { flexDirection:'row', alignItems:'center', gap:6, marginTop:12, backgroundColor:'#FEF3C7', padding:10, borderRadius:10 },
  govtNoteText: { fontSize:11, fontWeight:'700', flex:1 },

  // Renew
  renewBtn:     { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, margin:16, marginTop:0, padding:15, borderRadius:16 },
  renewBtnText: { color:'#fff', fontWeight:'900', fontSize:15 },

  // Trial banner
  trialBanner:     { flexDirection:'row', margin:16, marginBottom:0, padding:12, borderRadius:12, backgroundColor:'#FEF3C7', borderLeftWidth:4, borderLeftColor:'#F59E0B' },
  trialBannerText: { fontSize:13, color:'#92400E', fontWeight:'700', flex:1 },

  // Term selector
  termWrap:     { margin:16, padding:16, borderRadius:18, elevation:1 },
  termTitle:    { fontSize:14, fontWeight:'800', marginBottom:12 },
  termRow:      { flexDirection:'row', gap:8 },
  termBtn:      { flex:1, alignItems:'center', padding:10, borderRadius:12, borderWidth:1.5, borderStyle:'solid', borderColor:'#E2E8F0', backgroundColor:'#F8FAFC' },
  termBtnActive:{ backgroundColor:'#002855', borderColor:'#002855' },
  termMonths:   { fontSize:13, fontWeight:'800', color:'#1E293B' },
  termDisc:     { fontSize:10, fontWeight:'800', color:'#10B981', marginTop:2 },
  termSaving:   { fontSize:12, color:'#10B981', fontWeight:'800', marginTop:10, textAlign:'center' },

  // Plan cards
  planCard:     { borderRadius:22, padding:18, borderWidth:1.5, borderStyle:'solid', borderColor:'#E2E8F0', elevation:2, position:'relative' },
  planBadge:    { position:'absolute', top:-1, right:16, paddingHorizontal:10, paddingVertical:4, borderRadius:20, borderTopLeftRadius:0, borderTopRightRadius:0 },
  planBadgeText:{ color:'#fff', fontSize:10, fontWeight:'900', letterSpacing:0.5 },
  planHeader:   { flexDirection:'row', alignItems:'center', marginBottom:14 },
  planEmojiWrap:{ width:52, height:52, borderRadius:16, justifyContent:'center', alignItems:'center' },
  planEmoji:    { fontSize:26 },
  planName:     { fontSize:17, fontWeight:'900' },
  planPrice:    { fontSize:24, fontWeight:'900' },
  planPriceSub: { fontSize:13, fontWeight:'600' },
  planTotal:    { fontSize:11, fontWeight:'600', marginTop:2 },
  radio:        { width:24, height:24, borderRadius:12, borderWidth:2, borderStyle:'solid', borderColor:'#E2E8F0', justifyContent:'center', alignItems:'center' },
  radioDot:     { width:13, height:13, borderRadius:7 },

  // Quick benefits
  quickBenefits:{ gap:8, marginBottom:14 },
  qbRow:        { flexDirection:'row', alignItems:'center', gap:10 },
  qbDot:        { width:22, height:22, borderRadius:7, justifyContent:'center', alignItems:'center' },
  qbText:       { fontSize:13, fontWeight:'600', flex:1 },

  // Expand
  expandBtn:    { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingTop:12, borderTopWidth:1, borderStyle:'solid' },
  expandText:   { fontSize:12, fontWeight:'800' },

  // Coverage detail
  coverageWrap:  { borderTopWidth:1, borderStyle:'solid', paddingTop:14, marginTop:4, gap:10 },
  covMenuRow:    { gap:4 },
  covMenuHeader: { flexDirection:'row', alignItems:'center', gap:8 },
  covMenuLabel:  { flex:1, fontSize:12, fontWeight:'800' },
  covSmBadge:    { width:22, height:22, borderRadius:11, justifyContent:'center', alignItems:'center' },
  covCats:       { flexDirection:'row', flexWrap:'wrap', gap:8, paddingLeft:22, marginTop:4 },
  covCatItem:    { flexDirection:'row', alignItems:'center', gap:4 },
  covCatText:    { fontSize:11, fontWeight:'600' },

  // Fee note
  feeNote:      { flexDirection:'row', alignItems:'flex-start', gap:8, margin:16, padding:14, borderRadius:14, borderLeftWidth:4, borderLeftColor:'#F59E0B' },
  feeNoteText:  { fontSize:12, fontWeight:'600', flex:1, lineHeight:18 },

  // Summary card
  summaryCard:   { margin:16, padding:18, borderRadius:20, elevation:2 },
  summaryTitle:  { fontSize:16, fontWeight:'900', marginBottom:14 },
  summaryRow:    { flexDirection:'row', justifyContent:'space-between', paddingVertical:8, borderBottomWidth:1 },
  summaryLabel:  { fontSize:13, fontWeight:'700' },
  summaryVal:    { fontSize:13, fontWeight:'800' },
  totalVal:      { fontSize:22, fontWeight:'900', color:'#002855' },
  walletRow:     { flexDirection:'row', alignItems:'center', gap:8, padding:10, borderRadius:10, marginTop:12 },
  walletText:    { fontSize:13, fontWeight:'700', flex:1 },
  lowBal:        { fontSize:11, fontWeight:'800', color:'#EF4444' },

  // Terms
  termsRow:      { flexDirection:'row', alignItems:'flex-start', gap:10, marginTop:14, marginBottom:14 },
  checkbox:      { width:22, height:22, borderRadius:6, borderWidth:2, borderStyle:'solid', borderColor:'#E2E8F0', justifyContent:'center', alignItems:'center', marginTop:1 },
  checkboxOn:    { backgroundColor:'#002855', borderColor:'#002855' },
  termsRowText:  { fontSize:13, fontWeight:'600', flex:1, lineHeight:20 },
  termsLink:     { color:'#002855', fontWeight:'800', textDecorationLine:'underline' },

  // Subscribe button
  subBtn:        { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:'#002855', padding:16, borderRadius:16, elevation:3 },
  subBtnText:    { color:'#fff', fontWeight:'900', fontSize:16 },
  cancelBtn:     { alignItems:'center', padding:14 },
  cancelBtnText: { fontSize:14, fontWeight:'700' },

  // Modals
  modalOverlay:  { flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'flex-end' },
  upgradeSheet:  { borderTopLeftRadius:28, borderTopRightRadius:28, padding:20 },
  termsSheet:    { borderTopLeftRadius:28, borderTopRightRadius:28, padding:20, maxHeight:'85%' },
  sheetHandle:   { width:40, height:4, backgroundColor:'#E2E8F0', borderRadius:2, alignSelf:'center', marginBottom:16 },
  sheetTitle:    { fontSize:18, fontWeight:'900', marginBottom:16 },
  upgradeRow:    { flexDirection:'row', justifyContent:'space-between', padding:12, borderRadius:12, marginBottom:8 },
  upgradeLabel:  { fontSize:13, fontWeight:'700', flex:1 },
  upgradeVal:    { fontSize:14, fontWeight:'900' },
  upgradeTotal:  { flexDirection:'row', justifyContent:'space-between', paddingTop:14, borderTopWidth:1, marginBottom:12 },
  upgradeTotalVal:{ fontSize:22, fontWeight:'900', color:'#002855' },
  upgradeInfo:   { flexDirection:'row', alignItems:'center', gap:8, padding:12, borderRadius:12, marginBottom:8 },
  upgradeInfoText:{ fontSize:12, fontWeight:'600', flex:1 },
  termsScroll:   { maxHeight:340 },
  termsContent:  { fontSize:13, lineHeight:22 },
  scrollHint:    { textAlign:'center', fontSize:12, color:'#F59E0B', fontWeight:'700', paddingVertical:8 },
});
