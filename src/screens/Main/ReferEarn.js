import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Share,
  ScrollView, SafeAreaView, ActivityIndicator,
  Alert, Linking, Clipboard, StatusBar,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { auth, db } from '../../api/firebaseConfig';
import {
  collection, query, where, onSnapshot,
  doc, getDoc, onSnapshot as onSnap,
} from 'firebase/firestore';

export default function ReferEarn({ navigation }) {
  const user = auth.currentUser;

  const [userData, setUserData]         = useState(null);
  const [referredUsers, setReferredUsers] = useState([]);
  const [referConfig, setReferConfig]   = useState({
    referrerBonus:  5,
    joineeBonus:    20,
    tierThreshold:  5,
    tierBonus:      25,
    appLink:        'https://sewaone.in',
    isActive:       true,
  });
  const [loading, setLoading]           = useState(true);
  const [copied, setCopied]             = useState(false);

  // ── Fetch user data + referral config ────────────────────
  useEffect(() => {
    if (!user) return;

    // User data (myReferralCode, walletBalance, totalReferralEarned)
    const unsubUser = onSnap(doc(db, 'users', user.uid), snap => {
      if (snap.exists()) setUserData(snap.data());
    });

    // Admin-controlled referral config from Firestore
    const unsubConfig = onSnap(doc(db, 'app_config', 'referral'), snap => {
      if (snap.exists()) {
        setReferConfig(prev => ({ ...prev, ...snap.data() }));
      }
    });

    return () => { unsubUser(); unsubConfig(); };
  }, [user]);

  // ── Fetch referred users using correct myReferralCode ────
  useEffect(() => {
    if (!userData?.myReferralCode) return;

    const q = query(
      collection(db, 'users'),
      where('usedReferralCode', '==', userData.myReferralCode)
    );
    const unsub = onSnapshot(q, snap => {
      setReferredUsers(
        snap.docs.map(d => ({
          id:   d.id,
          name: d.data().name || 'User',
          date: d.data().createdAt,
        }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, [userData?.myReferralCode]);

  // When userData loads but no referral users yet
  useEffect(() => {
    if (userData && !userData.myReferralCode) setLoading(false);
  }, [userData]);

  const myCode        = userData?.myReferralCode || '—';
  const totalEarned   = userData?.totalReferralEarned || (referredUsers.length * referConfig.referrerBonus);
  const totalReferrals = referredUsers.length;

  // ── Tier progress ─────────────────────────────────────────
  const tierProgress  = totalReferrals % referConfig.tierThreshold;
  const tiersComplete = Math.floor(totalReferrals / referConfig.tierThreshold);

  // ── Share ─────────────────────────────────────────────────
  const shareMessage =
    `🚀 SewaOne App se Sarkari Jobs ke form ghar baithe bharo!\n\n` +
    `📝 Mere referral code se join karo:\n*${myCode}*\n\n` +
    `🎁 Tumhe milega ₹${referConfig.joineeBonus} joining bonus!\n` +
    `💰 Aur mujhe milega ₹${referConfig.referrerBonus} reward!\n\n` +
    `📲 Download karo:\n${referConfig.appLink}`;

  const onShare = async () => {
    try {
      await Share.share({ message: shareMessage });
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const onWhatsApp = () => {
    const msg = encodeURIComponent(shareMessage);
    Linking.openURL(`whatsapp://send?text=${msg}`).catch(() =>
      Linking.openURL(`https://wa.me/?text=${msg}`)
    );
  };

  const onCopyCode = () => {
    Clipboard.setString(myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = ts => {
    if (!ts) return '';
    try {
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return ''; }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#002855" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Hero Banner ── */}
        <View style={s.hero}>
          <View style={s.heroIconWrap}>
            <MaterialCommunityIcons name="gift" size={44} color="#FFD700" />
          </View>
          <Text style={s.heroTitle}>Refer & Earn</Text>
          <Text style={s.heroSub}>
            Har referral pe ₹{referConfig.referrerBonus} — seedha wallet mein!
          </Text>
        </View>

        {/* ── Earnings Stats ── */}
        <View style={s.statsRow}>
          <View style={[s.statCard, { backgroundColor: '#fff' }]}>
            <MaterialCommunityIcons name="account-group" size={22} color="#3B82F6" />
            <Text style={s.statVal}>{totalReferrals}</Text>
            <Text style={s.statLbl}>Friends Joined</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: '#fff' }]}>
            <MaterialCommunityIcons name="wallet" size={22} color="#10B981" />
            <Text style={[s.statVal, { color: '#10B981' }]}>₹{totalEarned}</Text>
            <Text style={s.statLbl}>Total Earned</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: '#fff' }]}>
            <MaterialCommunityIcons name="trophy" size={22} color="#F59E0B" />
            <Text style={[s.statVal, { color: '#F59E0B' }]}>{tiersComplete}</Text>
            <Text style={s.statLbl}>Tiers Done</Text>
          </View>
        </View>

        {/* ── Tier Progress ── */}
        <View style={s.tierCard}>
          <View style={s.tierHeader}>
            <MaterialCommunityIcons name="star-circle" size={20} color="#F59E0B" />
            <Text style={s.tierTitle}>
              Next Tier Bonus — ₹{referConfig.tierBonus}
            </Text>
          </View>
          <View style={s.tierBarBg}>
            <View style={[s.tierBarFill, {
              width: `${(tierProgress / referConfig.tierThreshold) * 100}%`
            }]} />
          </View>
          <Text style={s.tierHint}>
            {tierProgress}/{referConfig.tierThreshold} referrals complete —{' '}
            {referConfig.tierThreshold - tierProgress} aur karo tier bonus ke liye!
          </Text>
        </View>

        {/* ── My Code ── */}
        <View style={s.codeCard}>
          <Text style={s.codeLabel}>YOUR REFERRAL CODE</Text>
          <View style={s.codeRow}>
            <Text style={s.codeText}>{myCode}</Text>
            <TouchableOpacity onPress={onCopyCode} style={s.copyBtn} activeOpacity={0.8}>
              <MaterialCommunityIcons
                name={copied ? 'check-circle' : 'content-copy'}
                size={20}
                color={copied ? '#10B981' : '#002855'}
              />
              <Text style={[s.copyText, copied && { color: '#10B981' }]}>
                {copied ? 'Copied!' : 'Copy'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={s.codeNote}>
            Dost ₹{referConfig.joineeBonus} joining bonus paata hai aur tumhe ₹{referConfig.referrerBonus}!
          </Text>
        </View>

        {/* ── Share Buttons ── */}
        <View style={s.shareRow}>
          <TouchableOpacity style={s.waBtn} onPress={onWhatsApp} activeOpacity={0.85}>
            <MaterialCommunityIcons name="whatsapp" size={22} color="#fff" />
            <Text style={s.waBtnText}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.shareBtn} onPress={onShare} activeOpacity={0.85}>
            <MaterialCommunityIcons name="share-variant" size={22} color="#fff" />
            <Text style={s.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* ── How it Works ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>How it Works</Text>
          {[
            { icon: 'share-variant', color: '#3B82F6', step: '1', text: `Apna code share karo — ${myCode}` },
            { icon: 'account-plus',  color: '#8B5CF6', step: '2', text: 'Dost code use karke register kare' },
            { icon: 'wallet-plus',   color: '#10B981', step: '3', text: `Dost ko ₹${referConfig.joineeBonus} + tumhe ₹${referConfig.referrerBonus} — turant!` },
            { icon: 'trophy',        color: '#F59E0B', step: '4', text: `${referConfig.tierThreshold} referrals pe extra ₹${referConfig.tierBonus} tier bonus!` },
          ].map((step, i) => (
            <View key={i} style={s.stepRow}>
              <View style={[s.stepBadge, { backgroundColor: step.color + '20' }]}>
                <Text style={[s.stepNum, { color: step.color }]}>{step.step}</Text>
              </View>
              <View style={[s.stepIconBox, { backgroundColor: step.color + '15' }]}>
                <MaterialCommunityIcons name={step.icon} size={20} color={step.color} />
              </View>
              <Text style={s.stepText}>{step.text}</Text>
            </View>
          ))}
        </View>

        {/* ── Referral History ── */}
        <View style={s.section}>
          <View style={s.histHeader}>
            <Text style={s.sectionTitle}>Referral History</Text>
            <View style={s.countBadge}>
              <Text style={s.countText}>{totalReferrals} Joined</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator color="#002855" style={{ marginTop: 20 }} />
          ) : referredUsers.length === 0 ? (
            <View style={s.emptyBox}>
              <MaterialCommunityIcons name="account-group-outline" size={52} color="#CBD5E1" />
              <Text style={s.emptyTitle}>Abhi tak koi nahi juda</Text>
              <Text style={s.emptyText}>Code share karo aur rewards kamao!</Text>
              <TouchableOpacity style={s.emptyShareBtn} onPress={onWhatsApp}>
                <MaterialCommunityIcons name="whatsapp" size={16} color="#fff" />
                <Text style={s.emptyShareText}>Share on WhatsApp</Text>
              </TouchableOpacity>
            </View>
          ) : (
            referredUsers.map((item, idx) => (
              <View key={item.id} style={s.userRow}>
                <View style={s.userAvatar}>
                  <Text style={s.avatarText}>{item.name?.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.userName}>{item.name}</Text>
                  <Text style={s.userDate}>{formatDate(item.date)}</Text>
                </View>
                <View style={s.rewardBadge}>
                  <MaterialCommunityIcons name="plus-circle" size={12} color="#166534" />
                  <Text style={s.rewardText}>₹{referConfig.referrerBonus}</Text>
                </View>
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F4FF' },

  // Hero
  hero:         { backgroundColor: '#002855', padding: 28, paddingTop: 32, alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  heroIconWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  heroTitle:    { color: '#fff', fontSize: 26, fontWeight: '900', marginBottom: 6 },
  heroSub:      { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600', textAlign: 'center' },

  // Stats
  statsRow:  { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, gap: 10 },
  statCard:  { flex: 1, alignItems: 'center', padding: 14, borderRadius: 18, elevation: 2, gap: 5 },
  statVal:   { fontSize: 20, fontWeight: '900', color: '#002855' },
  statLbl:   { fontSize: 10, fontWeight: '700', color: '#94A3B8', textAlign: 'center', textTransform: 'uppercase' },

  // Tier
  tierCard:   { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 18, elevation: 1 },
  tierHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  tierTitle:  { fontSize: 13, fontWeight: '800', color: '#002855' },
  tierBarBg:  { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  tierBarFill:{ height: '100%', backgroundColor: '#F59E0B', borderRadius: 4 },
  tierHint:   { fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 8 },

  // Code
  codeCard:  { backgroundColor: '#002855', marginHorizontal: 16, marginTop: 12, padding: 20, borderRadius: 20, elevation: 4 },
  codeLabel: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginBottom: 10 },
  codeRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeText:  { fontSize: 36, fontWeight: '900', color: '#FFD700', letterSpacing: 6 },
  copyBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  copyText:  { color: '#fff', fontWeight: '800', fontSize: 12 },
  codeNote:  { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 12, lineHeight: 18 },

  // Share
  shareRow:    { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, gap: 10 },
  waBtn:       { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#25D366', padding: 15, borderRadius: 16, elevation: 3 },
  waBtnText:   { color: '#fff', fontWeight: '900', fontSize: 15 },
  shareBtn:    { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#3B82F6', padding: 15, borderRadius: 16, elevation: 3 },
  shareBtnText:{ color: '#fff', fontWeight: '900', fontSize: 15 },

  // Steps
  section:      { marginHorizontal: 16, marginTop: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#1E293B', marginBottom: 14 },
  stepRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 16, marginBottom: 8, gap: 12, elevation: 1 },
  stepBadge:    { width: 26, height: 26, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  stepNum:      { fontSize: 13, fontWeight: '900' },
  stepIconBox:  { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  stepText:     { flex: 1, fontSize: 13, fontWeight: '700', color: '#334155' },

  // History
  histHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  countBadge:   { backgroundColor: '#EBF5FB', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  countText:    { color: '#002855', fontSize: 11, fontWeight: '800' },
  userRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 16, marginBottom: 8, elevation: 1 },
  userAvatar:   { width: 42, height: 42, borderRadius: 13, backgroundColor: '#002855', justifyContent: 'center', alignItems: 'center' },
  avatarText:   { color: '#fff', fontWeight: '900', fontSize: 16 },
  userName:     { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  userDate:     { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  rewardBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  rewardText:   { color: '#166534', fontSize: 12, fontWeight: '900' },
  emptyBox:     { alignItems: 'center', paddingVertical: 40 },
  emptyTitle:   { fontSize: 16, fontWeight: '800', color: '#94A3B8', marginTop: 14 },
  emptyText:    { fontSize: 12, color: '#CBD5E1', marginTop: 6 },
  emptyShareBtn:{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#25D366', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, marginTop: 18 },
  emptyShareText:{ color: '#fff', fontWeight: '800', fontSize: 13 },

  // Coupon share card
  couponCard:    { marginHorizontal: 16, marginTop: 14, borderRadius: 22, padding: 20, elevation: 4 },
  couponTop:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  couponTitle:   { color: '#FFD700', fontSize: 16, fontWeight: '900' },
  couponSub:     { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600', marginBottom: 14 },
  msgPreview:    { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 14, marginBottom: 14 },
  msgText:       { color: '#fff', fontSize: 12, lineHeight: 20, fontWeight: '600' },
  couponBtns:    { flexDirection: 'row', gap: 10 },
  couponWhatsApp:{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#25D366', padding: 13, borderRadius: 13 },
  couponCopy:    { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFD700', paddingHorizontal: 16, padding: 13, borderRadius: 13 },
  couponBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  couponCopyText:{ color: '#002855', fontWeight: '900', fontSize: 13 },
});
