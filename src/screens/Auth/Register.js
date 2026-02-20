import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, useTheme, HelperText, ActivityIndicator } from 'react-native-paper';
import { auth, db } from '../../api/firebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  doc, setDoc, collection, query, where, getDocs, 
  updateDoc, increment, addDoc, serverTimestamp 
} from 'firebase/firestore';

export default function RegisterScreen({ navigation }) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [f, setF] = useState({ name: '', mob: '', email: '', state: '', city: '', pin: '', pass: '', cPass: '', ref: '' });

  // --- 🎫 REWARD LOGIC: Referral Verification & Payment ---
  const processReferralReward = async (inputCode, newUserId) => {
    if (!inputCode) return;
    try {
      // 1. Referrer ko dhoondo jiska code use hua hai
      const q = query(collection(db, "users"), where("myReferralCode", "==", inputCode.toUpperCase()));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const referrerId = snap.docs[0].id;

        // 2. Referrer ko ₹5 bhejo
        await updateDoc(doc(db, "users", referrerId), {
          walletBalance: increment(5)
        });
        await addDoc(collection(db, "transactions"), {
          userId: referrerId, amount: 5, type: 'credit',
          remark: `Referral Bonus: Friend Joined`, timestamp: serverTimestamp()
        });

        // 3. Naye User ko ₹20 Joining Bonus bhejo
        await updateDoc(doc(db, "users", newUserId), {
          walletBalance: increment(20)
        });
        await addDoc(collection(db, "transactions"), {
          userId: newUserId, amount: 20, type: 'credit',
          remark: `Joining Bonus: Referral Used`, timestamp: serverTimestamp()
        });
        
        console.log("Referral Rewards Credited Successfully!");
      }
    } catch (e) { console.log("Referral Reward Error:", e); }
  };

  const handleRegister = async () => {
    if (!f.name || f.mob.length < 10 || !f.email || f.pass.length < 6) {
      Alert.alert("Input Error", "All Field required.");
      return;
    }
    if (f.pass !== f.cPass) {
      Alert.alert("Error", " Password or Confirm Password does not match .");
      return;
    }

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
        await processReferralReward(f.ref, uid);
      }

      Alert.alert("Successfull!", "Registration Successful .");
      navigation.navigate('Login');
    } catch (e) {
      Alert.alert("Registration Failed", e.message);
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

        <Button mode="contained" onPress={handleRegister} loading={loading} style={styles.regBtn} labelStyle={styles.btnLabel}>
          REGISTER NOW
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
