// ============================================================
// FILE: src/screens/Auth/Register.js
// Single page — Pincode auto-fill, Free trial auto-activate
// ============================================================
import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, Alert,
  TouchableOpacity, ActivityIndicator, Text,
} from 'react-native';
import { TextInput, useTheme } from 'react-native-paper';
import { auth, db } from '../../api/firebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import {
  doc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const STATE_CODES = {
  'Andhra Pradesh':'AP','Arunachal Pradesh':'AR','Assam':'AS','Bihar':'BR',
  'Chhattisgarh':'CG','Goa':'GA','Gujarat':'GJ','Haryana':'HR',
  'Himachal Pradesh':'HP','Jharkhand':'JH','Karnataka':'KA','Kerala':'KL',
  'Madhya Pradesh':'MP','Maharashtra':'MH','Manipur':'MN','Meghalaya':'ML',
  'Mizoram':'MZ','Nagaland':'NL','Odisha':'OD','Punjab':'PB',
  'Rajasthan':'RJ','Sikkim':'SK','Tamil Nadu':'TN','Telangana':'TG',
  'Tripura':'TR','Uttar Pradesh':'UP','Uttarakhand':'UK','West Bengal':'WB',
  'Delhi':'DL','Jammu and Kashmir':'JK','Ladakh':'LA','Chandigarh':'CH',
  'Puducherry':'PY','Andaman and Nicobar Islands':'AN','Dadra and Nagar Haveli':'DN',
  'Daman and Diu':'DD','Lakshadweep':'LD',
};

// Plan config defaults
const DEFAULT_PLANS = {
  basic:  { name:'Basic',  emoji:'🥉', color:'#CD7F32', discount:10, freeApps:0, appLimitMonthly:-1 },
  silver: { name:'Silver', emoji:'🥈', color:'#94A3B8', discount:25, freeApps:0, appLimitMonthly:-1 },
  gold:   { name:'Gold',   emoji:'🥇', color:'#F59E0B', discount:40, freeApps:5, appLimitMonthly:-1 },
};

async function activateFreeTrial(uid, stateCode) {
  try {
    // Fetch trial config
    const [trialSnap, memberSnap, masterSnap] = await Promise.all([
      getDoc(doc(db, 'app_config', 'membership_trial')),
      getDoc(doc(db, 'user_memberships', uid)),
      getDoc(doc(db, 'app_config', 'membership_master')),
    ]);

    // Trial config exists?
    if (!trialSnap.exists()) return;
    const trialConfig = trialSnap.data();
    if (!trialConfig.globalEnabled) return;

    // Membership toggle OFF — trial bhi band
    const masterData2 = masterSnap.exists() ? masterSnap.data() : {};
    if (masterData2.isEnabled === false) {
      console.log('Membership toggle OFF — trial skip');
      return;
    }

    // Already has paid membership? Skip trial
    if (memberSnap.exists()) {
      const mem = memberSnap.data();
      if (mem.isActive && !mem.isTrial) {
        console.log('User already has paid membership — skip trial');
        return;
      }
    }

    // State restriction — check if trial available for this state
    let trialDays = trialConfig.defaultDays || 7;
    let trialPlan = trialConfig.defaultPlan || 'basic';

    if (trialConfig.stateOverrides?.[stateCode]) {
      const override = trialConfig.stateOverrides[stateCode];
      // If days = 0 → trial not available for this state
      if (override.days === 0) {
        console.log('Trial not available for state:', stateCode);
        return;
      }
      trialDays = override.days || trialDays;
      trialPlan = override.plan || trialPlan;
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + trialDays);
    const now = new Date();
    const mk  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    // Get plan config from master (admin configured)
    const masterData  = masterSnap.exists() ? masterSnap.data() : {};
    const cfgPlans    = masterData.plans || {};
    const plan        = cfgPlans[trialPlan] || DEFAULT_PLANS[trialPlan] || DEFAULT_PLANS.basic;

    // Build lockedBenefits — same as paid purchase
    const lockedBenefits = {
      planKey:     trialPlan,
      planName:    plan.name,
      planEmoji:   plan.emoji,
      planColor:   plan.color,
      discount:    plan.discount    || 0,
      freeApps:    plan.freeApps    != null ? plan.freeApps : 0,
      appLimit:    plan.appLimitMonthly != null ? plan.appLimitMonthly : -1,
      processing:  trialPlan === 'gold' ? 'Same Day' : trialPlan === 'silver' ? '24 Hours' : 'Standard',
      support:     trialPlan === 'gold' ? 'VIP (2hr)' : trialPlan === 'silver' ? 'Priority (12hr)' : 'Basic (48hr)',
      whatsapp:    trialPlan === 'gold',
      coverage:    masterData.coverage?.[trialPlan] || {},
      lockedAt:    new Date().toISOString(),
      isTrial:     true,
    };

    await setDoc(doc(db, 'user_memberships', uid), {
      plan:            trialPlan,
      term:            0,
      isTrial:         true,
      isActive:        true,
      startDate:       serverTimestamp(),
      endDate:         endDate.toISOString(),
      trialDays,
      pricePaid:       0,
      stateCode,
      lockedBenefits,
      freeAppsUsed:    0,
      assignedByAdmin: false,
      createdAt:       serverTimestamp(),
    });

    await setDoc(doc(db, 'user_memberships', uid, 'monthly_usage', mk),
      { apps_used:0, free_used:0 }
    );

    console.log('Trial activated:', trialPlan, trialDays, 'days for state:', stateCode);
  } catch (e) {
    console.log('Trial activation fail:', e.message);
  }
}

export default function RegisterScreen({ navigation }) {
  const { colors } = useTheme();
  const [loading, setLoading]             = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [showPass, setShowPass]           = useState(false);
  const [locked, setLocked]               = useState(false);
  const [attempts, setAttempts]           = useState(0);

  const [f, setF] = useState({
    name: '', mob: '', email: '',
    state: '', stateCode: '', city: '',
    district: '', pin: '',
    pass: '', cPass: '', ref: '',
  });

  const set = (field) => (val) => setF(prev => ({ ...prev, [field]: val }));

  // ── Pincode auto-fill ─────────────────────────────────────
  const handlePincode = async (pin) => {
    setF(prev => ({ ...prev, pin, state: '', stateCode: '', city: '', district: '' }));
    if (pin.length !== 6) return;
    setPincodeLoading(true);
    try {
      const res  = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      if (data?.[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
        const po        = data[0].PostOffice[0];
        const stateName = po.State    || '';
        const district  = po.District || '';
        const city      = po.Block    || po.District || '';
        const stateCode = STATE_CODES[stateName] || stateName.substring(0,2).toUpperCase();
        setF(prev => ({ ...prev, pin, state: stateName, stateCode, city, district }));
      } else {
        Alert.alert('Pincode Not Found', 'We could not find a location for this pincode. Please double-check and try again.');
      }
    } catch {
      Alert.alert('Network Error', 'Unable to verify pincode. Please check your internet connection.');
    } finally {
      setPincodeLoading(false);
    }
  };

  // ── Register ──────────────────────────────────────────────
  const handleRegister = async () => {
    if (locked) { Alert.alert('Please Wait', 'Thodi der baad try karo.'); return; }
    // Field-level validation
    if (!f.name.trim()) {
      Alert.alert('Full Name Required', 'Please enter your full name to continue.');
      return;
    }
    if (f.mob.length < 10 || !/^[6-9]\d{9}$/.test(f.mob)) {
      Alert.alert('Invalid Mobile Number', 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!f.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) {
      Alert.alert('Invalid Email Address', 'Please enter a valid email address (e.g. name@example.com).');
      return;
    }
    if (f.pin.length !== 6 || !/^\d{6}$/.test(f.pin)) {
      Alert.alert('Invalid Pincode', 'Please enter a valid 6-digit pincode.');
      return;
    }
    if (!f.state) {
      Alert.alert('Location Not Verified', 'Your pincode could not be verified. Please re-enter a valid pincode.');
      return;
    }
    if (f.pass.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }
    if (f.pass !== f.cPass) {
      Alert.alert('Password Mismatch', 'The passwords you entered do not match. Please try again.');
      return;
    }

    setLoading(true);
    try {

      // Step 1: Create Firebase Auth account
      const res    = await createUserWithEmailAndPassword(auth, f.email.trim(), f.pass);
      const uid    = res.user.uid;
      const myCode = uid.substring(0,6).toUpperCase();

      // Step 2: Save to Firestore — separate try so auth error stays separate
      const userData = {
        name: f.name.trim(), phone: f.mob.trim(), email: f.email.trim(),
        state: f.state, stateCode: f.stateCode,
        city: f.city, district: f.district, pincode: f.pin,
        usedReferralCode: f.ref || '', myReferralCode: myCode,
        role: 'user', walletBalance: 0,
        trialActivated: false, membershipStatus: 'none',
        createdAt: serverTimestamp(),
      };

      // Non-blocking — save user data
      setDoc(doc(db, 'users', uid), userData).catch(err => {
        console.warn('User data save failed silently:', err.code);
      });

      // Trial activation — non-blocking (fail hone pe navigate block na ho)
      activateFreeTrial(uid, f.stateCode || '').catch(err => {
        console.warn('Trial activation failed silently:', err.message);
      });

      // Step 4: Navigate to Login
      navigation.navigate('Login');
    } catch (e) {
      console.error('Registration error:', e.code, e.message);
      const n = attempts + 1;
      setAttempts(n);
      if (n >= 3) {
        setLocked(true);
        setTimeout(() => { setLocked(false); setAttempts(0); }, 30000);
        Alert.alert('Too Many Attempts', 'Registration has been temporarily locked. Please try again after 30 seconds.');
        return;
      }
      if (e.code === 'auth/email-already-in-use') {
        Alert.alert('Email Already Registered', 'An account with this email already exists. Please login instead.');
      } else if (e.code === 'auth/invalid-email') {
        Alert.alert('Invalid Email Address', 'The email address you entered is not valid.');
      } else if (e.code === 'auth/weak-password') {
        Alert.alert('Weak Password', 'Please choose a stronger password with at least 6 characters.');
      } else if (e.code === 'auth/network-request-failed') {
        Alert.alert('No Internet Connection', 'Please check your internet connection and try again.');
      } else if (e.code === 'auth/operation-not-allowed') {
        Alert.alert('Registration Disabled', 'Email registration is currently disabled. Please contact support.');
      } else if (e.code === 'auth/too-many-requests') {
        Alert.alert('Too Many Attempts', 'Too many requests from this device. Please try again later.');
      } else {
        Alert.alert('Registration Failed', e.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: '#F8FAFC' }} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>SewaOne</Text>
        <Text style={s.subtitle}>Har Sarkari Kaam, Ek Jagah</Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Create Account</Text>
        <Text style={s.cardSub}>Verified Portals & Secure System</Text>

        {/* Name */}
        <TextInput label="Full Name *" mode="outlined" style={s.input}
          value={f.name} onChangeText={set('name')}
          activeOutlineColor="#002855"
          left={<TextInput.Icon icon="account" color="#002855" />}
        />

        {/* Mobile */}
        <TextInput label="Mobile Number *" mode="outlined" style={s.input}
          value={f.mob} onChangeText={set('mob')}
          keyboardType="numeric" maxLength={10}
          activeOutlineColor="#002855"
          left={<TextInput.Icon icon="phone" color="#002855" />}
        />

        {/* Email */}
        <TextInput label="Email Address *" mode="outlined" style={s.input}
          value={f.email} onChangeText={set('email')}
          keyboardType="email-address" autoCapitalize="none"
          activeOutlineColor="#002855"
          left={<TextInput.Icon icon="email" color="#002855" />}
        />

        {/* Pincode */}
        <View style={s.pincodeRow}>
          <TextInput
            label="Pincode *"
            mode="outlined"
            style={[s.input, { flex: 1, marginBottom: 0 }]}
            value={f.pin}
            onChangeText={handlePincode}
            keyboardType="numeric"
            maxLength={6}
            activeOutlineColor="#002855"
            left={<TextInput.Icon icon="map-marker" color="#002855" />}
          />
          {pincodeLoading && (
            <ActivityIndicator color="#002855" size="small" style={{ marginLeft: 12 }} />
          )}
        </View>

        {/* Location auto-fill result */}
        {f.state ? (
          <View style={s.locationBox}>
            <MaterialCommunityIcons name="check-circle" size={18} color="#10B981" />
            <Text style={s.locationText}>
              {f.city ? `${f.city}, ` : ''}{f.state}
            </Text>
          </View>
        ) : f.pin.length === 6 && !pincodeLoading ? (
          <View style={[s.locationBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
            <MaterialCommunityIcons name="alert-circle" size={18} color="#EF4444" />
            <Text style={[s.locationText, { color: '#DC2626' }]}>
              Pincode nahi mila — sahi daalo
            </Text>
          </View>
        ) : <View style={{ height: 8 }} />}

        {/* Password */}
        <TextInput label="Password *" mode="outlined" style={s.input}
          value={f.pass} onChangeText={set('pass')}
          secureTextEntry={!showPass}
          activeOutlineColor="#002855"
          left={<TextInput.Icon icon="lock" color="#002855" />}
          right={<TextInput.Icon icon={showPass ? 'eye-off' : 'eye'} onPress={() => setShowPass(v => !v)} />}
        />

        {/* Confirm Password */}
        <TextInput label="Confirm Password *" mode="outlined" style={s.input}
          value={f.cPass} onChangeText={set('cPass')}
          secureTextEntry={!showPass}
          activeOutlineColor="#002855"
          left={<TextInput.Icon icon="lock-check" color="#002855" />}
        />

        {/* Referral */}
        <TextInput label="Referral Code (Optional)" mode="outlined" style={s.input}
          value={f.ref} onChangeText={set('ref')}
          autoCapitalize="characters"
          activeOutlineColor="#002855"
          left={<TextInput.Icon icon="gift" color="#002855" />}
        />

        {/* Submit */}
        <TouchableOpacity
          style={[s.btn, { opacity: loading || locked ? 0.6 : 1 }]}
          onPress={handleRegister}
          disabled={loading || locked}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>
                {locked ? 'Wait 30s...' : 'Register Now 🎉'}
              </Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={s.loginLink}>Already have an account? Login</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  header:       { alignItems: 'center', marginTop: 50, marginBottom: 20 },
  title:        { fontSize: 30, fontWeight: '900', color: '#002855' },
  subtitle:     { color: '#64748B', fontWeight: '600', fontSize: 13, marginTop: 4 },
  card:         { backgroundColor: '#fff', margin: 16, padding: 20, borderRadius: 20, elevation: 3 },
  cardTitle:    { fontSize: 20, fontWeight: '900', color: '#002855', marginBottom: 4 },
  cardSub:      { fontSize: 12, color: '#10B981', fontWeight: '700', marginBottom: 20 },
  input:        { marginBottom: 12, backgroundColor: '#fff' },
  pincodeRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  locationBox:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#6EE7B7', gap: 8 },
  locationText: { fontSize: 13, fontWeight: '700', color: '#166534', flex: 1 },

  btn:          { backgroundColor: '#002855', paddingVertical: 15, borderRadius: 14, alignItems: 'center', elevation: 3 },
  btnText:      { color: '#fff', fontWeight: '900', fontSize: 15 },
  loginLink:    { color: '#002855', textAlign: 'center', fontWeight: '700', fontSize: 13 },
});
