import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert, ActivityIndicator, Switch, Image,
} from 'react-native';
import { db, auth } from '../../api/firebaseConfig';
import {
  doc, onSnapshot, updateDoc, setDoc,
  collection, query, where, getDocs
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';

const CLOUD_NAME    = Constants?.expoConfig?.extra?.cloudinaryCloudName    || 'dxuurwexl';
const UPLOAD_PRESET = Constants?.expoConfig?.extra?.cloudinaryUploadPreset || 'edusphere_uploads';
const APP_VERSION   = Constants?.expoConfig?.version || '1.0.0';

export default function ProfileScreen({ navigation }) {
  const { theme, isDark, toggleTheme, lang, toggleLang, t } = useAppTheme();
  const [userData, setUserData]       = useState(null);
  const [loading, setLoading]         = useState(true);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [appCount, setAppCount]       = useState(0);
  const user = auth.currentUser;

  // ── Real-time user data ──────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), snap => {
      if (snap.exists()) setUserData(snap.data());
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // ── Applications count (jobs + services) ─────────────────
  useEffect(() => {
    if (!user) return;
    const fetchCount = async () => {
      try {
        const [jobSnap, svcSnap] = await Promise.all([
          getDocs(query(collection(db, 'applications'),         where('userId', '==', user.uid))),
          getDocs(query(collection(db, 'service_applications'), where('userId', '==', user.uid))),
        ]);
        setAppCount(jobSnap.size + svcSnap.size);
      } catch {}
    };
    fetchCount();
  }, [user]);

  // ── Helpers ───────────────────────────────────────────────
  const maskEmail = email => {
    if (!email) return 'Email not set';
    const [name, domain] = email.split('@');
    if (name.length <= 2) return `${name}***@${domain}`;
    return `${name.substring(0, 2)}***${name.slice(-1)}@${domain}`;
  };

  const formatDate = ts => {
    if (!ts) return '—';
    try {
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return '—'; }
  };

  const memberId = user?.uid?.substring(0, 8).toUpperCase() || '—';

  // ── Profile Photo Upload ──────────────────────────────────
  const handlePhotoUpload = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return Alert.alert('Permission', 'Gallery access chahiye photo upload ke liye.');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      });
      if (result.canceled) return;

      setPhotoUploading(true);
      const uri  = result.assets[0].uri;
      const data = new FormData();
      data.append('file', { uri, type: 'image/jpeg', name: 'profile.jpg' });
      data.append('upload_preset', UPLOAD_PRESET);

      const res  = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: 'POST', body: data }
      );
      const json = await res.json();

      if (json.secure_url) {
        const uRef = doc(db, 'users', user.uid);
        await updateDoc(uRef, { photoURL: json.secure_url })
          .catch(async () => {
            await setDoc(uRef, { photoURL: json.secure_url }, { merge: true });
          });
        Alert.alert('✅', 'Profile photo update ho gayi!');
      } else {
        Alert.alert('Error', 'Upload failed. Try again.');
      }
    } catch (e) {
      Alert.alert('Error', 'Photo upload nahi ho saka.');
    } finally {
      setPhotoUploading(false);
    }
  };

  // ── Password Reset ────────────────────────────────────────
  // Password change → dedicated screen

  // ── Logout ────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert(t.logout || 'Logout', 'Kya aap logout karna chahte hain?', [
      { text: t.cancel || 'Cancel', style: 'cancel' },
      { text: 'Haan', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  };

  const s = makeStyles(theme);

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Header ── */}
        <View style={[s.header, { backgroundColor: theme.card }]}>

          {/* Avatar with upload */}
          <TouchableOpacity onPress={handlePhotoUpload} activeOpacity={0.85} style={s.avatarWrap}>
            {userData?.photoURL ? (
              <Image source={{ uri: userData.photoURL }} style={s.avatarImg} />
            ) : (
              <View style={[s.avatarPlaceholder, { backgroundColor: theme.primary }]}>
                <MaterialCommunityIcons name="account-tie" size={50} color="#fff" />
              </View>
            )}
            <View style={[s.cameraBadge, { backgroundColor: theme.success }]}>
              {photoUploading
                ? <ActivityIndicator size="small" color="#fff" />
                : <MaterialCommunityIcons name="camera" size={14} color="#fff" />
              }
            </View>
          </TouchableOpacity>

          <Text style={[s.userName, { color: theme.text }]}>
            {userData?.name || 'Member'}
          </Text>

          <View style={[s.verifiedBadge, { backgroundColor: isDark ? '#064e3b' : '#F0FDF4' }]}>
            <MaterialCommunityIcons name="check-decagram" size={14} color={theme.success} />
            <Text style={[s.verifiedText, { color: theme.success }]}>
              {t.verifiedMember || 'Verified Member'}
            </Text>
          </View>

          <Text style={[s.userEmail, { color: theme.textMuted }]}>
            {maskEmail(userData?.email || user?.email)}
          </Text>

          <TouchableOpacity
            style={[s.editBtn, { borderColor: theme.primary, backgroundColor: theme.surface }]}
            onPress={() => navigation.navigate('EditProfile', { currentData: userData })}
          >
            <MaterialCommunityIcons name="account-edit" size={18} color={theme.primary} />
            <Text style={[s.editBtnText, { color: theme.primary }]}>
              {t.editProfile || 'Edit Profile'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats Row ── */}
        <View style={[s.statsRow, { backgroundColor: theme.card }]}>
          <StatCard
            icon="file-document-multiple"
            value={appCount.toString()}
            label="Applications"
            color="#3B82F6"
            theme={theme}
          />
          <View style={[s.statDivider, { backgroundColor: theme.border }]} />
          <StatCard
            icon="wallet"
            value={`₹${userData?.walletBalance || 0}`}
            label="Wallet"
            color="#10B981"
            theme={theme}
            onPress={() => navigation.navigate('Home', { screen: 'Wallet' })}
          />
          <View style={[s.statDivider, { backgroundColor: theme.border }]} />
          <StatCard
            icon="identifier"
            value={memberId}
            label="Member ID"
            color="#8B5CF6"
            theme={theme}
            mono
          />
        </View>

        {/* ── Identity Details ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: theme.textMuted }]}>
            {t.identityDetails || 'IDENTITY DETAILS'}
          </Text>
          <View style={[s.card, { backgroundColor: theme.card }]}>
            <InfoRow icon="phone"      label="Phone"       value={userData?.phone   || 'Not Set'} theme={theme} />
            <InfoRow icon="map-marker" label="City & State" value={`${userData?.city || '—'}, ${userData?.state || '—'}`} theme={theme} />
            <InfoRow icon="mailbox"    label="Pincode"     value={userData?.pincode || 'Not Set'} theme={theme} />
            <InfoRow icon="calendar"   label="Member Since" value={formatDate(userData?.createdAt)} theme={theme} last />
          </View>
        </View>

        {/* ── Wallet Quick Card ── */}
        <View style={s.section}>
          <TouchableOpacity
            style={[s.walletCard, { backgroundColor: '#002855' }]}
            onPress={() => navigation.navigate('Home', { screen: 'Wallet' })}
            activeOpacity={0.88}
          >
            <View style={s.walletLeft}>
              <MaterialCommunityIcons name="wallet" size={28} color="#FFD700" />
              <View style={{ marginLeft: 14 }}>
                <Text style={s.walletLabel}>SewaOne Wallet</Text>
                <Text style={s.walletBalance}>
                  ₹{userData?.walletBalance || 0}
                </Text>
              </View>
            </View>
            <View style={s.walletRight}>
              <Text style={s.walletAdd}>+ Add Money</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(255,255,255,0.6)" />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Refer & Earn ── */}
        <View style={[s.section, { paddingBottom: 0 }]}>
          <TouchableOpacity
            style={[s.referCard, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate('ReferEarn')}
            activeOpacity={0.88}
          >
            <View style={s.referIconCircle}>
              <MaterialCommunityIcons name="gift" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.referTitle}>{t.referEarn || 'Refer & Earn'} ₹25</Text>
              <Text style={s.referSub}>Invite friends — rewards kamao!</Text>
            </View>
            <View style={[s.codeBadge, { backgroundColor: theme.success }]}>
              <Text style={s.codeBadgeText}>
                {userData?.myReferralCode || 'GET CODE'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Settings ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: theme.textMuted }]}>
            {t.accountSettings || 'ACCOUNT SETTINGS'}
          </Text>

          <MenuOption icon="history"      iconColor="#3B82F6" title={t.myApplications || 'My Applications'} theme={theme}
            onPress={() => navigation.navigate('ApplicationsScreen')} />
          <MenuOption icon="lock-reset"   iconColor="#F59E0B" title={t.changePassword  || 'Change Password'} theme={theme}
            onPress={() => navigation.navigate('ChangePassword')} />
          <MenuOption icon="shield-lock"  iconColor="#8B5CF6" title={t.privacyPolicy   || 'Privacy Policy'}  theme={theme}
            onPress={() => navigation.navigate('PrivacyPolicy')} />
          <MenuOption icon="help-circle"  iconColor="#10B981" title="Help & Support" theme={theme}
            onPress={() => navigation.navigate('Help')} />

          {/* Dark Mode */}
          <View style={[s.optionRow, { backgroundColor: theme.card }]}>
            <View style={s.optionLeft}>
              <View style={[s.optionIconBox, { backgroundColor: isDark ? '#1E3A5F' : '#EBF5FB' }]}>
                <MaterialCommunityIcons
                  name={isDark ? 'weather-night' : 'weather-sunny'}
                  size={20} color={isDark ? '#60A5FA' : '#F59E0B'}
                />
              </View>
              <Text style={[s.optionText, { color: theme.text }]}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#fff"
            />
          </View>

          {/* Language */}
          <View style={[s.optionRow, { backgroundColor: theme.card }]}>
            <View style={s.optionLeft}>
              <View style={[s.optionIconBox, { backgroundColor: '#F0FDF4' }]}>
                <MaterialCommunityIcons name="translate" size={20} color="#10B981" />
              </View>
              <Text style={[s.optionText, { color: theme.text }]}>Language / भाषा</Text>
            </View>
            <TouchableOpacity
              onPress={toggleLang}
              style={[s.langBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={s.langBtnText}>{lang === 'en' ? 'EN → हिं' : 'हिं → EN'}</Text>
            </TouchableOpacity>
          </View>

          {/* App Version */}
          <View style={[s.optionRow, { backgroundColor: theme.card }]}>
            <View style={s.optionLeft}>
              <View style={[s.optionIconBox, { backgroundColor: '#F1F5F9' }]}>
                <MaterialCommunityIcons name="information-outline" size={20} color="#64748B" />
              </View>
              <Text style={[s.optionText, { color: theme.text }]}>App Version</Text>
            </View>
            <Text style={[s.versionText, { color: theme.textMuted }]}>v{APP_VERSION}</Text>
          </View>

          {/* Logout */}
          <TouchableOpacity
            style={[s.logoutBtn, { backgroundColor: isDark ? '#450a0a' : '#FEE2E2' }]}
            onPress={handleLogout}
          >
            <MaterialCommunityIcons name="logout" size={22} color={theme.danger} />
            <Text style={[s.logoutText, { color: theme.danger }]}>Logout From Device</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub Components ────────────────────────────────────────
const StatCard = ({ icon, value, label, color, theme, onPress, mono }) => (
  <TouchableOpacity
    style={styles.statCard}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <MaterialCommunityIcons name={icon} size={20} color={color} />
    <Text style={[styles.statValue, { color: theme.text, fontFamily: mono ? 'monospace' : undefined, fontSize: mono ? 12 : 18 }]}>
      {value}
    </Text>
    <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
  </TouchableOpacity>
);

const InfoRow = ({ icon, label, value, theme, last }) => (
  <View style={[styles.infoRow, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
    <View style={[styles.infoIconBox, { backgroundColor: theme.bg || '#F0F4FF' }]}>
      <MaterialCommunityIcons name={icon} size={16} color={theme.textMuted} />
    </View>
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={[styles.infoLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text>
    </View>
  </View>
);

const MenuOption = ({ icon, iconColor, title, onPress, theme }) => (
  <TouchableOpacity
    style={[styles.menuOption, { backgroundColor: theme.card }]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <View style={styles.optionLeft}>
      <View style={[styles.optionIconBox, { backgroundColor: iconColor + '20' }]}>
        <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[styles.optionText, { color: theme.text }]}>{title}</Text>
    </View>
    <MaterialCommunityIcons name="chevron-right" size={20} color={theme.border} />
  </TouchableOpacity>
);

// Static styles (non-theme)
const styles = StyleSheet.create({
  statCard:    { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 4 },
  statValue:   { fontWeight: '900', marginTop: 4 },
  statLabel:   { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  infoRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  infoIconBox: { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  infoLabel:   { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  infoValue:   { fontSize: 14, fontWeight: '700', marginTop: 1 },
  menuOption:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 18, marginBottom: 10, elevation: 1 },
  optionLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionIconBox: { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  optionText:  { fontSize: 14, fontWeight: '700' },
});

function makeStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1 },
    center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header
    header: { alignItems: 'center', padding: 28, paddingTop: 32, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, elevation: 3 },

    // Avatar
    avatarWrap:        { position: 'relative', marginBottom: 14 },
    avatarImg:         { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: theme.primary },
    avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center' },
    cameraBadge:       { position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.card },

    userName:     { fontSize: 22, fontWeight: '900', color: theme.text },
    verifiedBadge:{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 6 },
    verifiedText: { fontSize: 11, fontWeight: '800', marginLeft: 4 },
    userEmail:    { fontSize: 12, marginTop: 4, fontWeight: '600' },
    editBtn:      { flexDirection: 'row', alignItems: 'center', marginTop: 18, paddingVertical: 9, paddingHorizontal: 20, borderRadius: 14, borderWidth: 1.5, gap: 8 },
    editBtnText:  { fontWeight: '800', fontSize: 13 },

    // Stats row
    statsRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, borderRadius: 20, elevation: 2, overflow: 'hidden' },
    statDivider: { width: 1 },

    // Sections
    section: { paddingHorizontal: 16, marginTop: 16 },
    sectionTitle: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
    card: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4, elevation: 1 },

    // Wallet card
    walletCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderRadius: 20, elevation: 4 },
    walletLeft:  { flexDirection: 'row', alignItems: 'center' },
    walletLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700' },
    walletBalance: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 2 },
    walletRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    walletAdd:   { color: '#FFD700', fontWeight: '800', fontSize: 13 },

    // Refer card
    referCard:       { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20, elevation: 3 },
    referIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    referTitle:      { color: '#fff', fontSize: 15, fontWeight: '900' },
    referSub:        { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
    codeBadge:       { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
    codeBadgeText:   { color: '#fff', fontSize: 10, fontWeight: '900' },

    // Settings
    optionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 18, marginBottom: 10, elevation: 1 },
    optionLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
    optionIconBox:{ width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
    optionText:  { fontSize: 14, fontWeight: '700' },
    langBtn:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    langBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    versionText: { fontSize: 13, fontWeight: '700' },
    logoutBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, padding: 17, borderRadius: 18, gap: 10 },
    logoutText:  { fontWeight: '900', fontSize: 15 },
  });
}
