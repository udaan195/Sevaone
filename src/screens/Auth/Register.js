import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, useTheme, HelperText, ActivityIndicator } from 'react-native-paper';
import { auth, db } from '../../api/firebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  doc, setDoc, collection, query, where, getDocs, 
  addDoc, serverTimestamp 
} from 'firebase/firestore';

export default function RegisterScreen({ navigation }) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [registerLocked, setRegisterLocked] = useState(false);
  const [registerAttempts, setRegisterAttempts] = useState(0);
  const [showPass, setShowPass] = useState(false);
  const [f, setF] = useState({ name: '', mob: '', email: '', state: '', city: '', pin: '', pass: '', cPass: '', ref: '' });

  // --- 🎫 REWARD LOGIC: Referral Verification & Payment ---
  // ✅ SECURITY: Referral reward ab Cloud Function handle karta hai
  // onNewUser trigger — automatic, server-side, tamper-proof
  // Client se kuch karne ki zarurat nahi

  const handleRegister = async () => {
    // ✅ Rate limit check
    if (registerLocked) {
      Alert.alert('Please Wait', 'Thodi der baad try karo.');
      return;
    }
    if (!f.name || f.mob.length < 10 || !f.email || f.pass.length < 6) {
      Alert.alert('Input Error', 'Saari fields sahi se bharo — naam, mobile (10 digits), email, password (min 6).');
      return;
    }
    if (f.pass !== f.cPass) {
      Alert.alert('Error', 'Password aur Confirm Password match nahi kar rahe.');
      return;
    }

    // ✅ Duplicate check — same email ya phone already registered?
    try {
      const emailQ = query(collection(db, 'users'), where('email', '==', f.email.trim()));
      const phoneQ = query(collection(db, 'users'), where('phone', '==', f.mob.trim()));
      const [emailSnap, phoneSnap] = await Promise.all([getDocs(emailQ), getDocs(phoneQ)]);
      if (!emailSnap.empty) {
        Alert.alert('Already Registered', 'Yeh email pehle se registered hai. Login karo.');
        return;
      }
      if (!phoneSnap.empty) {
        Alert.alert('Already Registered', 'Yeh mobile number pehle se registered hai. Login karo.');
        return;
      }
    } catch {}

    setLoading(true);
    try {
      // Step 1: Create Auth Account
      const res = await createUserWithEmailAndPassword(auth, f.email, f.pass);
      const uid = res.user.uid;

      // ✨ Generate New User's Own Referral Code
      const myNewCode = uid.substring(0, 6).toUpperCase();

      // Step 2: Save to Firestore with Referral Logic
      await setDoc(doc(db, "users", uid), {
        name: f.name,
        phone: f.mob,
        email: f.email,
        state: f.state,
        city: f.city,
        pincode: f.pin,
        usedReferralCode: f.ref || "", // Jisne refer kiya uska code
        myReferralCode: myNewCode,      // Iska apna naya code
        role: 'user',
        walletBalance: 0, // Shuruat mein zero, reward baad mein judega
        createdAt: new Date().toISOString()
      });

      // Step 3: Trigger Reward if Referral Code was entered
      if (f.ref) {
        // Referral handled server-side by Cloud Function
      }

      Alert.alert("Successfull!", "Registration Successful .");
      navigation.navigate('Login');
    } catch (e) {
      const newAttempts = registerAttempts + 1;
      setRegisterAttempts(newAttempts);
      if (newAttempts >= 3) {
        // 3 fails — 30 second lock
        setRegisterLocked(true);
        setTimeout(() => {
          setRegisterLocked(false);
          setRegisterAttempts(0);
        }, 30000);
        Alert.alert('Too Many Attempts', 'Registration 30 seconds ke liye lock ho gayi. Baad mein try karo.');
      } else {
        Alert.alert('Registration Failed', e.message || 'Koi error aayi. Dobara try karo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (label, field, icon, kb='default', isPass=false) => (
    <TextInput
      label={label}
      mode="outlined"
      style={styles.input}
      value={f[field]}
      onChangeText={(v) => setF({...f, [field]: v})}
      keyboardType={kb}
      secureTextEntry={isPass && !showPass}
      activeOutlineColor={colors.primary}
      left={<TextInput.Icon icon={icon} color={colors.primary} />}
      right={isPass ? <TextInput.Icon icon={showPass ? "eye-off" : "eye"} onPress={()=>setShowPass(!showPass)} /> : null}
    />
  );

  return (
    <ScrollView style={{backgroundColor: colors.background}}>
      <View style={styles.header}>
        <Text style={[styles.title, {color: colors.primary}]}>SewaOne Registration</Text>
        <Text style={styles.subtitle}>Verified Portals & Secure System</Text>
      </View>

      <View style={styles.card}>
        {renderInput("Full Name *", "name", "account")}
        {renderInput("Mobile Number *", "mob", "phone", "numeric")}
        {renderInput("Personal Email *", "email", "email")}
        
        <View style={styles.row}>
          <View style={{flex:1, marginRight:5}}>{renderInput("State *", "state", "map")}</View>
          <View style={{flex:1, marginLeft:5}}>{renderInput("City *", "city", "city")}</View>
        </View>

        {renderInput("Pincode *", "pin", "map-marker", "numeric")}
        {renderInput("Create Password *", "pass", "lock", "default", true)}
        {renderInput("Confirm Password *", "cPass", "lock-check", "default", true)}
        {renderInput("Referral Code (Optional)", "ref", "gift")}

        <Button mode="contained" onPress={handleRegister} loading={loading}
          disabled={loading || registerLocked}
          style={[styles.regBtn, registerLocked && { opacity: 0.5 }]}
          labelStyle={styles.btnLabel}>
          {registerLocked ? 'WAIT 30s...' : 'REGISTER NOW'}
        </Button>

        <TouchableOpacity onPress={() => navigation.goBack()} style={{marginTop: 20}}>
          <Text style={{color: colors.primary, textAlign: 'center'}}>Already have an account? Login</Text>
        </TouchableOpacity>
      </View>
      <View style={{height: 40}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginTop: 50, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: '#2e7d32', fontWeight: 'bold', fontSize: 12 },
  card: { backgroundColor: '#fff', margin: 15, padding: 20, borderRadius: 20, elevation: 5 },
  input: { marginBottom: 12, backgroundColor: '#fff' },
  row: { flexDirection: 'row' },
  regBtn: { marginTop: 15, borderRadius: 10, paddingVertical: 5 },
  btnLabel: { fontWeight: 'bold', fontSize: 16 }
});
