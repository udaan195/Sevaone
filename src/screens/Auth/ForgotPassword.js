import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, StatusBar, Animated, ActivityIndicator, Alert,
} from 'react-native';
import { auth, db } from '../../api/firebaseConfig';
import { sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ForgotPassword({ navigation }) {
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [step, setStep]         = useState(1); // 1=input, 2=sent
  const [maskedEmail, setMaskedEmail] = useState('');
  const [error, setError]       = useState('');
  const [focused, setFocused]   = useState(false);

  // Floating label anim
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: focused || input ? 1 : 0,
      duration: 160, useNativeDriver: false,
    }).start();
  }, [focused, input]);

  const maskEmail = email => {
    if (!email) return '';
    const [name, domain] = email.split('@');
    if (name.length <= 2) return `${name}***@${domain}`;
    return `${name.substring(0, 2)}***${name.slice(-1)}@${domain}`;
  };

  const handleSubmit = async () => {
    const val = input.trim();
    if (!val) return setError('Email ya phone number daalo');

    const isPhone = /^\d{10}$/.test(val);
    const isEmail = val.includes('@');

    if (!isPhone && !isEmail) {
      return setError('Valid email ya 10-digit phone number daalo');
    }

    setLoading(true);
    setError('');
    try {
      let targetEmail = val;

      // Phone number se email dhundho
      if (isPhone) {
        try {
          const q    = query(collection(db, 'users'), where('phone', '==', val));
          const snap = await getDocs(q);
          if (snap.empty) {
            setLoading(false);
            return setError('Is phone number se koi account nahi mila');
          }
          targetEmail = snap.docs[0].data().email;
        } catch (dbErr) {
          // Firestore rules allow nahi kar rahi — user ko email se try karne ko kaho
          setLoading(false);
          return setError('Phone se reset ke liye login karein aur Profile > Change Password use karein. Ya apna registered email daalo.');
        }
      }

      await sendPasswordResetEmail(auth, targetEmail);
      setMaskedEmail(maskEmail(targetEmail));
      setStep(2);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        setError('Is email se koi account registered nahi hai');
      } else if (e.code === 'auth/invalid-email') {
        setError('Email format sahi nahi hai');
      } else if (e.code === 'auth/too-many-requests') {
        setError('Bahut zyada requests. Thodi der baad try karo.');
      } else {
        setError('Kuch problem aai. Apna registered email daalo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#002855" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.backBtn}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Forgot Password</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={s.body}>

        {/* ── Step 1: Input ── */}
        {step === 1 && (
          <>
            {/* Icon */}
            <View style={s.iconWrap}>
              <MaterialCommunityIcons name="lock-question" size={52} color="#002855" />
            </View>
            <Text style={s.title}>Password Reset</Text>
            <Text style={s.subtitle}>
              Apna registered email ya phone number daalo — reset link bhej denge
            </Text>

            {/* Input */}
            <View style={s.inputCard}>
              <View style={s.floatWrap}>
                <Animated.Text style={[s.floatLabel, {
                  top:      anim.interpolate({ inputRange:[0,1], outputRange:[18,-9] }),
                  fontSize: anim.interpolate({ inputRange:[0,1], outputRange:[15,11] }),
                  color:    anim.interpolate({ inputRange:[0,1], outputRange:['#94A3B8', error ? '#EF4444' : '#002855'] }),
                }]}>
                  Email ya Phone Number
                </Animated.Text>
                <View style={[s.inputBox, focused && s.inputFocused, error && s.inputError]}>
                  <MaterialCommunityIcons
                    name={input.includes('@') ? 'email-outline' : 'phone-outline'}
                    size={18}
                    color={focused ? '#002855' : '#94A3B8'}
                  />
                  <TextInput
                    style={s.input}
                    value={input}
                    onChangeText={t => { setInput(t); setError(''); }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    keyboardType="default"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                  />
                  {input.length > 0 && (
                    <TouchableOpacity onPress={() => { setInput(''); setError(''); }}>
                      <MaterialCommunityIcons name="close-circle" size={18} color="#CBD5E1" />
                    </TouchableOpacity>
                  )}
                </View>
                {error ? (
                  <View style={s.errorRow}>
                    <MaterialCommunityIcons name="alert-circle" size={13} color="#EF4444" />
                    <Text style={s.errorText}>{error}</Text>
                  </View>
                ) : null}
              </View>

              {/* Info box */}
              <View style={s.infoBox}>
                <MaterialCommunityIcons name="information" size={14} color="#1a5276" />
                <Text style={s.infoText}>
                  Reset link aapki registered email pe bheja jaayega. Spam folder bhi check karein.
                </Text>
              </View>
            </View>

            {/* Submit button */}
            <TouchableOpacity
              style={[s.submitBtn, (!input.trim() || loading) && s.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!input.trim() || loading}
              activeOpacity={0.88}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="send" size={18} color="#fff" />
                  <Text style={s.submitBtnText}>SEND RESET LINK</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Back to login */}
            <TouchableOpacity
              style={s.backToLogin}
              onPress={() => navigation.goBack()}
            >
              <MaterialCommunityIcons name="arrow-left" size={15} color="#64748B" />
              <Text style={s.backToLoginText}>Back to Login</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Step 2: Sent ── */}
        {step === 2 && (
          <>
            <View style={s.successIconWrap}>
              <MaterialCommunityIcons name="email-check" size={56} color="#10B981" />
            </View>
            <Text style={s.successTitle}>Link Sent! ✅</Text>
            <Text style={s.successSub}>
              Password reset link bhej diya gaya:
            </Text>
            <View style={s.emailBadge}>
              <MaterialCommunityIcons name="email" size={16} color="#002855" />
              <Text style={s.emailBadgeText}>{maskedEmail}</Text>
            </View>

            <View style={s.stepsCard}>
              {[
                { icon: 'email-open-outline', text: 'Email inbox kholo' },
                { icon: 'shield-search',      text: 'Spam/Junk folder bhi check karo' },
                { icon: 'cursor-default-click', text: '"Reset Password" link pe click karo' },
                { icon: 'lock-reset',          text: 'Naya password set karo' },
              ].map((step, i) => (
                <View key={i} style={s.stepItem}>
                  <View style={s.stepNum}>
                    <Text style={s.stepNumText}>{i + 1}</Text>
                  </View>
                  <View style={[s.stepIconBox, { backgroundColor: '#EBF5FB' }]}>
                    <MaterialCommunityIcons name={step.icon} size={18} color="#002855" />
                  </View>
                  <Text style={s.stepText}>{step.text}</Text>
                </View>
              ))}
            </View>

            {/* Resend */}
            <TouchableOpacity
              style={s.resendBtn}
              onPress={() => setStep(1)}
            >
              <MaterialCommunityIcons name="refresh" size={16} color="#002855" />
              <Text style={s.resendText}>Dobara bhejo / Email change karo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.submitBtn}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.88}
            >
              <MaterialCommunityIcons name="login" size={18} color="#fff" />
              <Text style={s.submitBtnText}>BACK TO LOGIN</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#F0F4FF' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#002855', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 20 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },

  body: { flex: 1, padding: 20 },

  // Step 1
  iconWrap:  { width: 90, height: 90, borderRadius: 28, backgroundColor: '#EBF5FB', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginTop: 10, marginBottom: 18, elevation: 2 },
  title:     { fontSize: 22, fontWeight: '900', color: '#002855', textAlign: 'center', marginBottom: 8 },
  subtitle:  { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 24 },

  // Input
  inputCard:  { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width:0, height:2 }, shadowOpacity: 0.06 },
  floatWrap:  { marginBottom: 14, paddingTop: 10 },
  floatLabel: { position: 'absolute', left: 46, backgroundColor: '#fff', paddingHorizontal: 4, fontWeight: '700', zIndex: 1 },
  inputBox:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: '#fff' },
  inputFocused: { borderColor: '#002855' },
  inputError:   { borderColor: '#EF4444' },
  input:      { flex: 1, fontSize: 15, color: '#1E293B', fontWeight: '600' },
  errorRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, marginLeft: 2 },
  errorText:  { fontSize: 12, color: '#EF4444', fontWeight: '700' },
  infoBox:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EBF5FB', borderRadius: 12, padding: 12 },
  infoText:   { flex: 1, fontSize: 12, color: '#1a5276', fontWeight: '600', lineHeight: 18 },

  // Buttons
  submitBtn:         { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: '#002855', padding: 17, borderRadius: 16, elevation: 4, shadowColor: '#002855', shadowOffset: { width:0, height:4 }, shadowOpacity: 0.3 },
  submitBtnDisabled: { backgroundColor: '#94A3B8', elevation: 0, shadowOpacity: 0 },
  submitBtnText:     { color: '#fff', fontWeight: '900', fontSize: 15 },
  backToLogin:       { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 14, marginTop: 8 },
  backToLoginText:   { fontSize: 13, color: '#64748B', fontWeight: '700' },

  // Step 2
  successIconWrap: { width: 100, height: 100, borderRadius: 30, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginTop: 10, marginBottom: 16, elevation: 2 },
  successTitle:    { fontSize: 24, fontWeight: '900', color: '#002855', textAlign: 'center', marginBottom: 6 },
  successSub:      { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 14 },
  emailBadge:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EBF5FB', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, alignSelf: 'center', marginBottom: 20 },
  emailBadgeText:  { fontSize: 14, fontWeight: '800', color: '#002855' },

  stepsCard:  { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 16, elevation: 1 },
  stepItem:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  stepNum:    { width: 22, height: 22, borderRadius: 7, backgroundColor: '#002855', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  stepNumText:{ color: '#fff', fontSize: 11, fontWeight: '900' },
  stepIconBox:{ width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  stepText:   { flex: 1, fontSize: 13, color: '#334155', fontWeight: '700' },

  resendBtn:  { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: '#EBF5FB', padding: 12, borderRadius: 14, marginBottom: 14 },
  resendText: { fontSize: 13, color: '#002855', fontWeight: '800' },
});
