import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  SafeAreaView, Alert, ActivityIndicator 
} from 'react-native';
import { db, auth } from '../../api/firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { signOut, sendPasswordResetEmail } from 'firebase/auth';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ProfileScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      }
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const maskEmail = (email) => {
    if (!email) return "No Email Found";
    const [name, domain] = email.split('@');
    if (name.length <= 2) return `${name}***@${domain}`;
    return `${name.substring(0, 2)}***${name.substring(name.length - 1)}@${domain}`;
  };

  const handleChangePassword = () => {
    const targetEmail = userData?.email || user.email;
    const masked = maskEmail(targetEmail);
    Alert.alert(
      "Password Reset",
      `Bhai, kya hum aapki email (${masked}) par reset link bhej dein?`,
      [
        { text: "Nahi", style: "cancel" },
        { 
          text: "Haan, Bhejo", 
          onPress: () => {
            sendPasswordResetEmail(auth, targetEmail)
              .then(() => Alert.alert("Success ✅", `Link bhej diya gaya hai.`))
              .catch(() => Alert.alert("Error", "Bhai, link bhejne mein error aaya."));
          } 
        }
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Bhai, kya aap logout karna chahte hain?", [
      { text: "Nahi", style: "cancel" },
      { text: "Haan", onPress: () => signOut(auth) }
    ]);
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#003366" /></View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.avatarBox}><MaterialCommunityIcons name="account-tie" size={55} color="#fff" /></View>
          <Text style={styles.userName}>{userData?.name || "Member Name"}</Text>
          <View style={styles.verifiedBadge}>
            <MaterialCommunityIcons name="check-decagram" size={16} color="#10B981" />
            <Text style={styles.verifiedText}>Verified SewaOne Member</Text>
          </View>
          <Text style={styles.userEmail}>{userData?.email || user?.email}</Text>
          <TouchableOpacity style={styles.editProfileBtn} onPress={() => navigation.navigate('EditProfile', { currentData: userData })}>
            <MaterialCommunityIcons name="account-edit" size={20} color="#003366" /><Text style={styles.editBtnText}>Update Profile Details</Text>
          </TouchableOpacity>
        </View>

        {/* Identity Details */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Identity Details</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="phone" label="Phone" value={userData?.phone || "Not Set"} />
            <InfoRow icon="map-marker" label="City & State" value={`${userData?.city || 'Not Set'}, ${userData?.state || 'Not Set'}`} />
            <InfoRow icon="mailbox" label="Pincode" value={userData?.pincode || "Not Set"} />
          </View>
        </View>

        {/* ✨ NEW: Refer & Earn Professional Card */}
        <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
          <TouchableOpacity 
            style={styles.referCard} 
            onPress={() => navigation.navigate('ReferEarn')}
          >
            <View style={styles.referIconCircle}>
              <MaterialCommunityIcons name="gift" size={28} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={styles.referTitle}>Refer & Earn ₹25</Text>
              <Text style={styles.referSub}>Invite friends and get rewards!</Text>
            </View>
            <View style={styles.codeBadge}>
              <Text style={styles.codeBadgeText}>{userData?.myReferralCode || "GET CODE"}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Menu Options */}
        <View style={styles.menuContainer}>
          <Text style={styles.sectionTitle}>Account & Settings</Text>
          <MenuOption icon="history" title="My Application History" onPress={() => navigation.navigate('ApplicationsScreen')} />
          <MenuOption icon="lock-reset" title="Change Password" onPress={handleChangePassword} />
          <MenuOption icon="shield-lock" title="Privacy Policy" onPress={() => navigation.navigate('PrivacyPolicy')} />

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={24} color="#EF4444" />
            <Text style={styles.logoutText}>Logout From Device</Text>
          </TouchableOpacity>
        </View>
        
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Sub-components remains same
const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <MaterialCommunityIcons name={icon} size={20} color="#64748B" />
    <View style={{ marginLeft: 15 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const MenuOption = ({ icon, title, onPress }) => (
  <TouchableOpacity style={styles.optionRow} onPress={onPress}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <MaterialCommunityIcons name={icon} size={22} color="#475569" />
      <Text style={styles.optionText}>{title}</Text>
    </View>
    <MaterialCommunityIcons name="chevron-right" size={22} color="#CBD5E1" />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', padding: 30, backgroundColor: '#fff', borderBottomLeftRadius: 40, borderBottomRightRadius: 40, elevation: 2 },
  avatarBox: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#003366', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  userName: { fontSize: 22, fontWeight: '900', color: '#003366' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 8 },
  verifiedText: { color: '#10B981', fontSize: 11, fontWeight: '800', marginLeft: 5 },
  userEmail: { fontSize: 13, color: '#94A3B8', marginTop: 5, fontWeight: '700' },
  editProfileBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 20, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 15, borderWidth: 1.5, borderColor: '#003366', backgroundColor: '#F0F7FF' },
  editBtnText: { marginLeft: 10, color: '#003366', fontWeight: '800' },
  infoSection: { padding: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 15 },
  infoCard: { backgroundColor: '#fff', padding: 20, borderRadius: 25, elevation: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  infoLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '800' },
  infoValue: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  
  // ✨ Refer Card Professional Styles
  referCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#003366', padding: 20, borderRadius: 25, elevation: 3 },
  referIconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  referTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  referSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  codeBadge: { backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  codeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  menuContainer: { paddingHorizontal: 20 },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 20, marginBottom: 10, elevation: 1 },
  optionText: { marginLeft: 15, fontSize: 14, fontWeight: '700', color: '#334155' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, padding: 18, backgroundColor: '#FEE2E2', borderRadius: 20 },
  logoutText: { color: '#EF4444', fontWeight: '900', marginLeft: 10 }
});
