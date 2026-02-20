import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Share, 
  ScrollView, SafeAreaView, FlatList, ActivityIndicator 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { auth, db } from '../../api/firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function ReferEarn({ navigation }) {
  const user = auth.currentUser;
  const referralCode = user?.uid?.substring(0, 6).toUpperCase() || "SEWA01";

  // --- ✨ States for Smart Tracking ---
  const [referredUsers, setReferredUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // 🔍 Query: Un users ko dhoondo jinhone iska code use kiya hai
    const q = query(
      collection(db, "users"), 
      where("usedReferralCode", "==", referralCode)
    );

    const unsub = onSnapshot(q, (snap) => {
      const users = snap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        date: doc.data().createdAt
      }));
      setReferredUsers(users);
      setLoading(false);
    });

    return () => unsub();
  }, [referralCode]);

  const onShare = async () => {
    try {
      await Share.share({
        message: `Bhai! SewaOne app download karo aur sabhi Govt Jobs ke form ghar baithe bharo. 📝\n\nMera Referral Code use karo: *${referralCode}*\n\nTumhe milenge *₹20* ka joining bonus! 💰\n\nDownload Link: https://sewaone.in/`,
      });
    } catch (error) { alert(error.message); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>
        
        {/* Top Visual Section */}
        <View style={styles.topIconBox}>
          <MaterialCommunityIcons name="gift-outline" size={80} color="#10B981" />
        </View>

        <Text style={styles.mainTitle}>Refer & Earn Rewards</Text>
        <Text style={styles.subTitle}>Apne doston ko invite karein aur har successful join par paise kamayein!</Text>

        {/* How it Works Section */}
        <View style={styles.stepsContainer}>
          <Step icon="share-variant" text="Apna Referral Code doston ko share karein." />
          <Step icon="account-plus" text="Dost aapka code use karke register karein." />
          <Step icon="wallet-giftcard" text="Dost ko ₹20 aur aapko ₹5 turant milenge!" />
        </View>

        {/* Your Code Box */}
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>YOUR REFERRAL CODE</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{referralCode}</Text>
            <TouchableOpacity onPress={onShare}>
              <MaterialCommunityIcons name="content-copy" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
          <MaterialCommunityIcons name="whatsapp" size={24} color="#fff" />
          <Text style={styles.shareBtnText}>REFER NOW</Text>
        </TouchableOpacity>

        {/* ✨ NEW: Smart Referral Tracking List ✨ */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Your Referral History</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{referredUsers.length} Joined</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color="#003366" style={{ marginTop: 20 }} />
          ) : referredUsers.length > 0 ? (
            referredUsers.map((item) => (
              <View key={item.id} style={styles.userRow}>
                <View style={styles.userAvatar}>
                  <Text style={styles.avatarText}>{item.name?.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={styles.userNameText}>{item.name}</Text>
                  <Text style={styles.statusText}>Successfully Joined</Text>
                </View>
                <View style={styles.rewardBadge}>
                  <Text style={styles.rewardText}>+₹5 Credited</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons name="account-group-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>Abhi tak koi dost nahi juda hai.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const Step = ({ icon, text }) => (
  <View style={styles.stepItem}>
    <View style={styles.iconCircle}><MaterialCommunityIcons name={icon} size={24} color="#003366" /></View>
    <Text style={styles.stepText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topIconBox: { alignItems: 'center', marginTop: 30, marginBottom: 20 },
  mainTitle: { fontSize: 24, fontWeight: '900', color: '#1E293B', textAlign: 'center' },
  subTitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginHorizontal: 20, marginTop: 10, lineHeight: 22 },
  stepsContainer: { marginVertical: 30, paddingHorizontal: 25 },
  stepItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconCircle: { width: 45, height: 45, borderRadius: 22, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  stepText: { fontSize: 13, fontWeight: '700', color: '#334155', flex: 1 },
  codeBox: { backgroundColor: '#F8FAFC', padding: 25, borderRadius: 20, borderStyle: 'dashed', borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', marginBottom: 20, marginHorizontal: 25 },
  codeLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', marginBottom: 10 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  codeText: { fontSize: 32, fontWeight: '900', color: '#003366', letterSpacing: 5 },
  shareBtn: { backgroundColor: '#10B981', padding: 18, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 5, marginHorizontal: 25 },
  shareBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, marginLeft: 10 },
  
  // ✨ History Styles
  historySection: { marginTop: 40, paddingHorizontal: 25 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  historyTitle: { fontSize: 16, fontWeight: '900', color: '#1E293B' },
  countBadge: { backgroundColor: '#E0F2FE', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  countText: { color: '#003366', fontSize: 11, fontWeight: '800' },
  userRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 15, borderRadius: 18, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  userAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#003366', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  userNameText: { fontSize: 14, fontWeight: '800', color: '#334155' },
  statusText: { fontSize: 11, color: '#10B981', fontWeight: '700' },
  rewardBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  rewardText: { color: '#166534', fontSize: 10, fontWeight: '900' },
  emptyBox: { alignItems: 'center', marginTop: 30, opacity: 0.5 },
  emptyText: { fontSize: 12, color: '#64748B', marginTop: 10, fontWeight: '600' }
});
