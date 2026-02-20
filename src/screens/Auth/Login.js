import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { TextInput, Button, useTheme } from 'react-native-paper';
import { auth, db } from '../../api/firebaseConfig';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'; 
import { collection, query, where, getDocs } from 'firebase/firestore'; 
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function LoginScreen({ navigation }) {
  const { colors } = useTheme();
  const [userInput, setUserInput] = useState(''); 
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- ✨ Function: Email Masking (Privacy) ---
  const maskEmail = (email) => {
    if (!email) return "";
    const [name, domain] = email.split('@');
    return `${name.substring(0, 2)}***${name.substring(name.length - 1)}@${domain}`;
  };

  // --- 🚀 Function: Hybrid Login Logic ---
  const handleLogin = async () => {
  setLoading(true);
  try {
    let finalEmail = userInput.trim();

    // 1. Agar Mobile dala hai (10 digits)
    if (!finalEmail.includes('@') && finalEmail.length === 10) {
      const q = query(collection(db, "users"), where("phone", "==", finalEmail));
      const snap = await getDocs(q);

      if (!snap.empty) {
        // 🔥 Database se sahi email uthao jo Auth mein registered hai
        finalEmail = snap.docs[0].data().email;
      } else {
        // Fallback agar Firestore mein user nahi mila
        finalEmail = `${finalEmail}@sewaone.com`;
      }
    }

    // 2. Auth Login
    await signInWithEmailAndPassword(auth, finalEmail, password);
  } catch (err) {
    Alert.alert("Login Failed", "Aleart, Please Enter Valid Email/Mobile or Password.");
  } finally { setLoading(false); }
};

  // --- 🔑 Function: Forgot Password Logic ---
  const handleForgotPassword = async () => {
    if (!userInput) {
      Alert.alert("Input Error", "Please Enter Your Registered Email/Mobile.");
      return;
    }

    setLoading(true);
    try {
      let targetEmail = userInput.trim();

      if (!targetEmail.includes('@') && targetEmail.length === 10) {
        const q = query(collection(db, "users"), where("phone", "==", targetEmail));
        const snap = await getDocs(q);
        targetEmail = !snap.empty ? snap.docs[0].data().email : `${targetEmail}@sewaone.com`;
      }

      await sendPasswordResetEmail(auth, targetEmail);
      const masked = maskEmail(targetEmail);
      Alert.alert("Link Sent ✅", `Password reset link  Send to this email (${masked}) Check mail to update Your Password.`);
    } catch (err) {
      Alert.alert("Error", "Password reset link not send Please check Credentieal.");
    } finally {
      setLoading(false);
    }
  };

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

        <Button 
          mode="contained" 
          onPress={handleLogin} 
          style={styles.loginBtn}
          loading={loading}
          labelStyle={styles.btnLabel}
        >
          SECURE LOGIN
        </Button>

        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={handleForgotPassword}>
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
  trustFooter: { marginTop: 50, alignItems: 'center' },
  trustText: { color: '#2e7d32', fontSize: 13, fontWeight: 'bold' },
  subTrustText: { color: '#999', fontSize: 10, marginTop: 4 }
});
