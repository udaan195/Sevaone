import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, ScrollView, Alert, ActivityIndicator,
  StatusBar, Animated,
} from 'react-native';
import { auth } from '../../api/firebaseConfig';
import {
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';

// ── Password strength calculator ─────────────────────────
const getStrength = pwd => {
  if (!pwd) return { score: 0, label: '', color: '#E2E8F0' };
  let score = 0;
  if (pwd.length >= 8)                    score++;
  if (pwd.length >= 12)                   score++;
  if (/[A-Z]/.test(pwd))                  score++;
  if (/[0-9]/.test(pwd))                  score++;
  if (/[^A-Za-z0-9]/.test(pwd))          score++;
  const map = [
    { label: '',          color: '#E2E8F0' },
    { label: 'Weak',      color: '#EF4444' },
    { label: 'Fair',      color: '#F59E0B' },
    { label: 'Good',      color: '#3B82F6' },
    { label: 'Strong',    color: '#10B981' },
    { label: 'Very Strong', color: '#059669' },
  ];
  return { score, ...map[score] };
};

// ── Requirement row ───────────────────────────────────────
const Req = ({ met, text }) => (
  <View style={r.row}>
    <MaterialCommunityIcons
      name={met ? 'check-circle' : 'circle-outline'}
      size={14}
      color={met ? '#10B981' : '#CBD5E1'}
    />
    <Text style={[r.text, met && r.textMet]}>{text}</Text>
  </View>
);
const r = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  text:    { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  textMet: { color: '#10B981' },
});

// ── Secure Input ──────────────────────────────────────────
const SecureInput = ({ label, value, onChangeText, icon, error, autoFocus }) => {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: focused || value ? 1 : 0,
      duration: 160, useNativeDriver: false,
    }).start();
  }, [focused, value]);

  return (
    <View style={si.wrap}>
      <Animated.Text style={[si.label, {
        top:      anim.interpolate({ inputRange: [0,1], outputRange: [18, -9] }),
        fontSize: anim.interpolate({ inputRange: [0,1], outputRange: [15, 11] }),
        color:    anim.interpolate({ inputRange: [0,1], outputRange: ['#94A3B8', error ? '#EF4444' : '#002855'] }),
      }]}>
        {label}
      </Animated.Text>
      <View style={[si.box, focused && si.focused, error && si.errBox]}>
        <MaterialCommunityIcons name={icon} size={18} color={focused ? '#002855' : '#94A3B8'} />
        <TextInput
          style={si.input}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity onPress={() => setShow(!show)} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
          <MaterialCommunityIcons
            name={show ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color="#94A3B8"
          />
        </TouchableOpacity>
      </View>
      {error ? <Text style={si.err}>{error}</Text> : null}
    </View>
  );
};
const si = StyleSheet.create({
  wrap:    { marginBottom: 8, paddingTop: 10 },
  label:   { position: 'absolute', left: 48, backgroundColor: '#F0F4FF', paddingHorizontal: 4, fontWeight: '700', zIndex: 1 },
  box:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: '#fff' },
  focused: { borderColor: '#002855' },
  errBox:  { borderColor: '#EF4444' },
  input:   { flex: 1, fontSize: 15, color: '#1E293B', fontWeight: '600' },
  err:     { fontSize: 11, color: '#EF4444', fontWeight: '700', marginTop: 4, marginLeft: 4 },
});

// ── Main Screen ───────────────────────────────────────────
export default function ChangePasswordScreen({ navigation }) {
  const { lang } = useAppTheme();
  const user     = auth.currentUser;

  const [step, setStep]       = useState(1); // 1=verify, 2=new password, 3=done
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd]   = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});

  const strength = getStrength(newPwd);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: strength.score / 5,
      duration: 300, useNativeDriver: false,
    }).start();
  }, [strength.score]);

  const txt = {
    en: {
      title:        'Change Password',
      step1Title:   'Verify Identity',
      step1Sub:     'Enter your current password to continue',
      step2Title:   'New Password',
      step2Sub:     'Create a strong new password',
      currentPwd:   'Current Password',
      newPwd:       'New Password',
      confirmPwd:   'Confirm New Password',
      verify:       'VERIFY & CONTINUE',
      update:       'UPDATE PASSWORD',
      forgotLink:   'Forgot current password?',
      req1: 'At least 8 characters',
      req2: 'One uppercase letter (A-Z)',
      req3: 'One number (0-9)',
      req4: 'One special character (!@#$...)',
      strength:     'Password Strength',
      matchErr:     'Passwords do not match',
      weakErr:      'Password is too weak',
      currentErr:   'Current password is required',
      wrongPwd:     'Current password is incorrect. Try again or use "Forgot password".',
      successTitle: '✅ Password Updated!',
      successMsg:   'Your password has been changed successfully.',
      sendReset:    'Send Reset Link',
      resetSent:    'Reset link sent to your email!',
    },
    hi: {
      title:        'पासवर्ड बदलें',
      step1Title:   'पहचान सत्यापित करें',
      step1Sub:     'आगे बढ़ने के लिए वर्तमान पासवर्ड दर्ज करें',
      step2Title:   'नया पासवर्ड',
      step2Sub:     'एक मजबूत नया पासवर्ड बनाएं',
      currentPwd:   'वर्तमान पासवर्ड',
      newPwd:       'नया पासवर्ड',
      confirmPwd:   'नया पासवर्ड पुनः दर्ज करें',
      verify:       'सत्यापित करें',
      update:       'पासवर्ड अपडेट करें',
      forgotLink:   'वर्तमान पासवर्ड भूल गए?',
      req1: 'कम से कम 8 अक्षर',
      req2: 'एक बड़ा अक्षर (A-Z)',
      req3: 'एक अंक (0-9)',
      req4: 'एक विशेष वर्ण (!@#$...)',
      strength:     'पासवर्ड मजबूती',
      matchErr:     'पासवर्ड मेल नहीं खाते',
      weakErr:      'पासवर्ड बहुत कमजोर है',
      currentErr:   'वर्तमान पासवर्ड आवश्यक है',
      wrongPwd:     'वर्तमान पासवर्ड गलत है।',
      successTitle: '✅ पासवर्ड अपडेट हो गया!',
      successMsg:   'आपका पासवर्ड सफलतापूर्वक बदल दिया गया है।',
      sendReset:    'रीसेट लिंक भेजें',
      resetSent:    'रीसेट लिंक आपके ईमेल पर भेज दिया गया!',
    },
  };
  const T = txt[lang] || txt.en;

  // ── Step 1 — Verify current password ─────────────────────
  const handleVerify = async () => {
    if (!currentPwd.trim()) {
      return setErrors({ current: T.currentErr });
    }
    setLoading(true);
    setErrors({});
    try {
      const credential = EmailAuthProvider.credential(
        user.email, currentPwd
      );
      await reauthenticateWithCredential(user, credential);
      setStep(2);
    } catch (e) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setErrors({ current: T.wrongPwd });
      } else {
        setErrors({ current: e.message });
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2 — Update password ──────────────────────────────
  const handleUpdate = async () => {
    const errs = {};
    if (strength.score < 2)      errs.new     = T.weakErr;
    if (newPwd !== confirmPwd)   errs.confirm  = T.matchErr;
    if (Object.keys(errs).length) return setErrors(errs);

    setLoading(true);
    setErrors({});
    try {
      await updatePassword(user, newPwd);
      setStep(3);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot — send email reset ─────────────────────────────
  const handleForgot = async () => {
    try {
      await sendPasswordResetEmail(auth, user.email);
      Alert.alert('✅', T.resetSent);
    } catch {
      Alert.alert('Error', 'Link bhejne mein problem aai.');
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#002855" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{T.title}</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Step indicator */}
      <View style={s.stepRow}>
        {[1, 2, 3].map(n => (
          <React.Fragment key={n}>
            <View style={[s.stepCircle,
              step > n  && s.stepDone,
              step === n && s.stepActive,
            ]}>
              {step > n
                ? <MaterialCommunityIcons name="check" size={14} color="#fff" />
                : <Text style={[s.stepNum, step === n && { color: '#fff' }]}>{n}</Text>
              }
            </View>
            {n < 3 && (
              <View style={[s.stepLine, step > n && { backgroundColor: '#10B981' }]} />
            )}
          </React.Fragment>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── STEP 1: Verify ── */}
        {step === 1 && (
          <View>
            <View style={s.stepHeader}>
              <View style={s.stepIconBox}>
                <MaterialCommunityIcons name="shield-account" size={28} color="#002855" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.stepTitle}>{T.step1Title}</Text>
                <Text style={s.stepSub}>{T.step1Sub}</Text>
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.emailHint}>
                <MaterialCommunityIcons name="email-outline" size={13} color="#64748B" />
                {' '}{user?.email}
              </Text>
              <SecureInput
                label={T.currentPwd}
                icon="lock-outline"
                value={currentPwd}
                onChangeText={v => { setCurrentPwd(v); setErrors({}); }}
                error={errors.current}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[s.primaryBtn, loading && s.btnLoading]}
              onPress={handleVerify}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <MaterialCommunityIcons name="shield-check" size={18} color="#fff" />
                    <Text style={s.primaryBtnText}>{T.verify}</Text>
                  </>
              }
            </TouchableOpacity>

            <TouchableOpacity style={s.forgotBtn} onPress={handleForgot}>
              <MaterialCommunityIcons name="email-send-outline" size={15} color="#64748B" />
              <Text style={s.forgotText}>{T.forgotLink}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 2: New Password ── */}
        {step === 2 && (
          <View>
            <View style={s.stepHeader}>
              <View style={s.stepIconBox}>
                <MaterialCommunityIcons name="lock-plus" size={28} color="#002855" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.stepTitle}>{T.step2Title}</Text>
                <Text style={s.stepSub}>{T.step2Sub}</Text>
              </View>
            </View>

            <View style={s.card}>
              <SecureInput
                label={T.newPwd}
                icon="lock-outline"
                value={newPwd}
                onChangeText={v => { setNewPwd(v); setErrors({}); }}
                error={errors.new}
                autoFocus
              />

              {/* Strength bar */}
              {newPwd.length > 0 && (
                <View style={s.strengthWrap}>
                  <View style={s.strengthBarBg}>
                    <Animated.View style={[s.strengthBarFill, {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1], outputRange: ['0%', '100%']
                      }),
                      backgroundColor: strength.color,
                    }]} />
                  </View>
                  <Text style={[s.strengthLabel, { color: strength.color }]}>
                    {strength.label}
                  </Text>
                </View>
              )}

              {/* Requirements */}
              <View style={s.reqBox}>
                <Req met={newPwd.length >= 8}              text={T.req1} />
                <Req met={/[A-Z]/.test(newPwd)}            text={T.req2} />
                <Req met={/[0-9]/.test(newPwd)}            text={T.req3} />
                <Req met={/[^A-Za-z0-9]/.test(newPwd)}    text={T.req4} />
              </View>

              <SecureInput
                label={T.confirmPwd}
                icon="lock-check-outline"
                value={confirmPwd}
                onChangeText={v => { setConfirmPwd(v); setErrors({}); }}
                error={errors.confirm}
              />

              {/* Match indicator */}
              {confirmPwd.length > 0 && (
                <View style={s.matchRow}>
                  <MaterialCommunityIcons
                    name={newPwd === confirmPwd ? 'check-circle' : 'close-circle'}
                    size={14}
                    color={newPwd === confirmPwd ? '#10B981' : '#EF4444'}
                  />
                  <Text style={[s.matchText, { color: newPwd === confirmPwd ? '#10B981' : '#EF4444' }]}>
                    {newPwd === confirmPwd
                      ? (lang === 'hi' ? 'पासवर्ड मेल खाते हैं' : 'Passwords match')
                      : (lang === 'hi' ? 'पासवर्ड मेल नहीं खाते' : 'Passwords do not match')
                    }
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[
                s.primaryBtn,
                (loading || strength.score < 2 || newPwd !== confirmPwd) && s.btnLoading
              ]}
              onPress={handleUpdate}
              disabled={loading || strength.score < 2 || newPwd !== confirmPwd || !confirmPwd}
              activeOpacity={0.88}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <MaterialCommunityIcons name="lock-reset" size={18} color="#fff" />
                    <Text style={s.primaryBtnText}>{T.update}</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 3: Success ── */}
        {step === 3 && (
          <View style={s.successWrap}>
            <View style={s.successIcon}>
              <MaterialCommunityIcons name="check-circle" size={64} color="#10B981" />
            </View>
            <Text style={s.successTitle}>{T.successTitle}</Text>
            <Text style={s.successMsg}>{T.successMsg}</Text>

            <View style={s.successTips}>
              {[
                lang === 'hi' ? 'अपना पासवर्ड किसी के साथ साझा न करें' : 'Never share your password with anyone',
                lang === 'hi' ? 'हर 3 महीने में पासवर्ड बदलते रहें' : 'Change password every 3 months',
                lang === 'hi' ? 'अपने वॉलेट PIN से अलग रखें' : 'Keep it different from your wallet PIN',
              ].map((tip, i) => (
                <View key={i} style={s.tipRow}>
                  <MaterialCommunityIcons name="lightbulb-outline" size={14} color="#F59E0B" />
                  <Text style={s.tipText}>{tip}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: '#10B981' }]}
              onPress={() => navigation.goBack()}
            >
              <MaterialCommunityIcons name="arrow-left" size={18} color="#fff" />
              <Text style={s.primaryBtnText}>
                {lang === 'hi' ? 'प्रोफाइल पर वापस जाएं' : 'Back to Profile'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F4FF' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#002855', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 20 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },

  // Step indicator
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 0 },
  stepCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  stepActive: { backgroundColor: '#002855', borderColor: '#002855' },
  stepDone:   { backgroundColor: '#10B981', borderColor: '#10B981' },
  stepNum:    { fontSize: 13, fontWeight: '900', color: '#94A3B8' },
  stepLine:   { width: 60, height: 2, backgroundColor: '#E2E8F0' },

  // Step header
  stepHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  stepIconBox: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#EBF5FB', justifyContent: 'center', alignItems: 'center' },
  stepTitle:  { fontSize: 18, fontWeight: '900', color: '#002855' },
  stepSub:    { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 2 },

  // Card
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06 },
  emailHint: { fontSize: 12, color: '#64748B', fontWeight: '700', marginBottom: 14, textAlign: 'center' },

  // Strength
  strengthWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  strengthBarBg: { flex: 1, height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  strengthBarFill: { height: '100%', borderRadius: 3 },
  strengthLabel: { fontSize: 11, fontWeight: '800', minWidth: 65, textAlign: 'right' },

  // Requirements
  reqBox:   { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 14 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  matchText:{ fontSize: 11, fontWeight: '700' },

  // Buttons
  primaryBtn:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: '#002855', padding: 17, borderRadius: 16, elevation: 4, shadowColor: '#002855', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3 },
  btnLoading:     { backgroundColor: '#94A3B8', elevation: 0, shadowOpacity: 0 },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  forgotBtn:      { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 14, marginTop: 8 },
  forgotText:     { fontSize: 13, color: '#64748B', fontWeight: '700' },

  // Success
  successWrap:  { alignItems: 'center', paddingTop: 20 },
  successIcon:  { width: 100, height: 100, borderRadius: 30, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 2 },
  successTitle: { fontSize: 22, fontWeight: '900', color: '#002855', marginBottom: 8 },
  successMsg:   { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  successTips:  { backgroundColor: '#fff', borderRadius: 16, padding: 16, width: '100%', marginBottom: 24, elevation: 1 },
  tipRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  tipText:      { fontSize: 12, color: '#475569', fontWeight: '600', flex: 1, lineHeight: 18 },
});
