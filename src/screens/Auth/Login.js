import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { TextInput, Button, useTheme } from 'react-native-paper';
import { auth, db } from '../../api/firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore'; 
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function LoginScreen({ navigation }) {
  const { colors } = useTheme();
  const [userInput, setUserInput] = useState(''); 
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);      // ✅ Rate limit — fail count
  const [lockUntil, setLockUntil] = useState(null); // ✅ Lock timestamp
  const [countdown, setCountdown] = useState(0);    // ✅ Countdown timer

  // Countdown timer
  React.useEffect(() => {
    if (!lockUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.ceil((lockUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockUntil(null);
        setCountdown(0);
        setAttempts(0);
        clearInterval(interval);
      } else {
        setCountdown(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockUntil]);

  // --- ✨ Function: Email Masking (Privacy) ---
  const maskEmail = (email) => {
    if (!email) return "";
    const [name, domain] = email.split('@');
    return `${name.substring(0, 2)}***${name.substring(name.length - 1)}@${domain}`;
  };

  // --- 🚀 Function: Hybrid Login Logic ---
  const handleLogin = async () => {
    // ✅ Rate limit check — locked hai?
    if (lockUntil && Date.now() < lockUntil) {
      Alert.alert('Too Many Attempts', `Dobara try karo ${countdown} seconds baad.`);
      return;
    }
    if (!userInput.trim() || !password) {
      Alert.alert('Error', 'Email/Mobile aur Password dono bharo.');
      return;
    }

    setLoading(true);
    try {
      let finalEmail = userInput.trim();

      // Mobile number se email dhundho
      if (!finalEmail.includes('@') && finalEmail.length === 10) {
        const q = query(collection(db, 'users'), where('phone', '==', finalEmail));
        const snap = await getDocs(q);
        finalEmail = !snap.empty
          ? snap.docs[0].data().email
          : `${finalEmail}@sewaone.in`;
      }

      await signInWithEmailAndPassword(auth, finalEmail, password);
      // ✅ Success — attempts reset
      setAttempts(0);
      setLockUntil(null);
    } catch (err) {
      // ✅ Rate limiting — attempt count badao
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= 5) {
        // 5 fails — 60 second lock
        const lockTime = Date.now() + 60 * 1000;
        setLockUntil(lockTime);
        Alert.alert(
          '🔒 Account Temporarily Locked',
          '5 galat attempts ke baad 60 seconds ke liye lock ho gaya. Apna password check karo.'
        );
      } else if (newAttempts >= 3) {
        Alert.alert(
          'Login Failed ⚠️',
          `Galat credentials. ${5 - newAttempts} attempts baaki hain, phir account lock ho jayega.`
        );
      } else {
        Alert.alert('Login Failed', 'Email/Mobile ya Password galat hai.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Forgot password → dedicated screen

  return (
    <ScrollView contentContainerStyle={[styles.container, {backgroundColor: colors.background}]}>

      <View style={styles.headerSection}>
        <MaterialCommunityIcons name="shield-account" size={75} color={colors.primary} />
        <Text style={[styles.logoText, {color: colors.primary}]}>SewaOne</Text>
        <Text style={styles.subText}>Login with Mobile Number or Email ID</Text>
      </View>

      <View style={styles.card}>
        <TextInput
          label="Mobile or Email"
          value={userInput}
          onChangeText={setUserInput}
          mode="outlined"
          keyboardType="email-address" // Dono support karne ke liye full keyboard
          autoCapitalize="none"
          style={styles.input}
          activeOutlineColor={colors.primary}
          left={<TextInput.Icon icon="account-circle" color={colors.primary} />}
          placeholder="e.g. 9876543210 or name@gmail.com"
        />

        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          style={styles.input}
          activeOutlineColor={colors.primary}
          secureTextEntry={!showPass}
          left={<TextInput.Icon icon="lock" color={colors.primary} />}
          right={<TextInput.Icon icon={showPass ? "eye-off" : "eye"} onPress={()=>setShowPass(!showPass)} />}
        />

        {/* ✅ Rate limit — locked toh countdown dikho */}
        {lockUntil && (
          <View style={{ backgroundColor: '#FEE2E2', padding: 12, borderRadius: 10, marginBottom: 12, alignItems: 'center' }}>
            <Text style={{ color: '#EF4444', fontWeight: '800', fontSize: 13 }}>
              🔒 {countdown} seconds baad try karo
            </Text>
          </View>
        )}
        {attempts > 0 && !lockUntil && (
          <View style={{ backgroundColor: '#FEF3C7', padding: 8, borderRadius: 8, marginBottom: 10, alignItems: 'center' }}>
            <Text style={{ color: '#B45309', fontWeight: '700', fontSize: 12 }}>
              ⚠️ {5 - attempts} attempts baaki hain
            </Text>
          </View>
        )}
        <Button
          mode="contained"
          onPress={handleLogin}
          style={[styles.loginBtn, (loading || !!lockUntil) && { opacity: 0.6 }]}
          disabled={loading || !!lockUntil}
          loading={loading}
          labelStyle={styles.btnLabel}
        >
          {lockUntil ? `LOCKED (${countdown}s)` : 'SECURE LOGIN'}
        </Button>

        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={{color: colors.primary, fontWeight: '700'}}>Forgot Password?</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={{color: colors.primary, fontWeight:'bold'}}>New User? Register</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.trustFooter}>
        <Text style={styles.trustText}>✅ Unified Secure Login System</Text>
        <Text style={styles.subTrustText}>256-bit Encrypted Authentication</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  headerSection: { alignItems: 'center', marginBottom: 30 },
  logoText: { fontSize: 38, fontWeight: 'bold' },
  subText: { fontSize: 13, color: '#666', marginTop: 5 },
  card: { backgroundColor: '#fff', padding: 25, borderRadius: 20, elevation: 8 },
  input: { marginBottom: 15, backgroundColor: '#fff' },
  loginBtn: { borderRadius: 10, marginTop: 10, paddingVertical: 5 },
  btnLabel: { fontSize: 16, fontWeight: 'bold' },
  footerLinks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25 },
  trustFooter:  { marginTop: 50, alignItems: 'center' },
  trustText: { color: '#2e7d32', fontSize: 13, fontWeight: 'bold' },
  subTrustText: { color: '#999', fontSize: 10, marginTop: 4 }
});
