import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform 
} from 'react-native';
import { db, auth } from '../../api/firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { verifyBeforeUpdateEmail } from 'firebase/auth';


export default function EditProfile({ route, navigation }) {
  const { currentData } = route.params;

  // ✨ States initialization standardized keys ke saath
  const [name, setName] = useState(currentData?.name || '');
  const [phone, setPhone] = useState(currentData?.phone || '');
  const [email, setEmail] = useState(currentData?.email || ''); 
  const [state, setState] = useState(currentData?.state || '');
  const [city, setCity] = useState(currentData?.city || '');
  const [pincode, setPincode] = useState(currentData?.pincode || '');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
  if (!name || !phone || !email || !city || !pincode) {
    return Alert.alert("Input Error", "Bhai, saari details bharna zaruri hai!");
  }
  
  setLoading(true);
  try {
    const user = auth.currentUser;

    // ✨ Step 1: Email Update Alert & Verification
    if (email !== user.email) {
      try {
        // User ko pehle hi bata rahe hain ki Spam check karna hai
        await verifyBeforeUpdateEmail(user, email);
        
        Alert.alert(
          "Action Required! 📧",
          `Bhai, humne aapki nayi email (${email}) par ek confirmation link bheja hai. \n\nZaruri: Kripya apna SPAM FOLDER check karein aur link par click karke verify karein, tabhi login update hoga.`,
          [{ text: "Theek Hai, Samajh Gaya" }]
        );
      } catch (authErr) {
        console.log("Auth update skip:", authErr.message);
        // Agar re-login mang raha ho toh error handle karein
        if (authErr.code === 'auth/requires-recent-login') {
            Alert.alert("Security", "Email badalne ke liye ek baar logout karke login karein.");
        }
      }
    }

    // ✨ Step 2: Database Update (Ye turant ho jayega)
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      name: name,
      phone: phone,
      email: email, 
      city: city,
      pincode: pincode,
      state: state
    });

    // Email change na ho toh sirf ye success dikhega
    if (email === user.email) {
        Alert.alert("Success ✅", "Aapki profile details update ho gayi hain!");
        navigation.goBack();
    } else {
        // Agar email badli hai toh alert upar wala dikh chuka hai
        navigation.goBack();
    }

  } catch (e) {
    console.error(e);
    Alert.alert("Error", "Bhai, update nahi ho paya. Ek baar internet check karein.");
  } finally {
    setLoading(false);
  }
};

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={{ flex: 1 }}
    >
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.headerText}>Personal Information</Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Enter Name" />

        <Text style={styles.label}>Official Email Address</Text>
        <TextInput 
          style={styles.input} value={email} onChangeText={setEmail} 
          placeholder="example@gmail.com" keyboardType="email-address" autoCapitalize="none" 
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} />

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.label}>City</Text>
            <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Noida" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Pincode</Text>
            <TextInput style={styles.input} value={pincode} onChangeText={setPincode} keyboardType="number-pad" maxLength={6} />
          </View>
        </View>

        <Text style={styles.label}>State</Text>
        <TextInput style={styles.input} value={state} onChangeText={setState} placeholder="Uttar Pradesh" />

        <TouchableOpacity style={styles.btn} onPress={handleUpdate} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>SAVE CHANGES</Text>}
        </TouchableOpacity>
        
        <View style={{ height: 50 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  headerText: { fontSize: 18, fontWeight: '900', color: '#003366', marginBottom: 20 },
  label: { fontWeight: 'bold', color: '#64748B', marginBottom: 6, marginTop: 15, fontSize: 13 },
  input: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', fontWeight: '600', color: '#1E293B' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  btn: { backgroundColor: '#003366', padding: 16, borderRadius: 12, marginTop: 35, alignItems: 'center', elevation: 3 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
