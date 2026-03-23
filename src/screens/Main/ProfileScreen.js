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
import { getUserMembership } from '../../utils/membershipManager';
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
  const [membership, setMembership]   = useState(null);
  const [membershipEnabled, setMembershipEnabled] = useState(true);
  const [monthlyUsage, setMonthlyUsage] = useState({ free_used:0 });
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

  // ── Membership ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    // Direct Firestore fetch — most reliable
    const fetchMembership = async () => {
      try {
        const { getDoc, doc: firestoreDoc } = await import('firebase/firestore');
        const { db: firestoreDb } = await import('../../api/firebaseConfig');
        const snap = await getDoc(firestoreDoc(firestoreDb, 'user_memberships', user.uid));
        if (!snap.exists()) { setMembership(null); return; }
        const data = snap.data();
        // Check expiry
        if (data.endDate && new Date(data.endDate) < new Date()) {
          setMembership({ ...data, isActive:false, isExpired:true });
          return;
        }
        // Toggle OFF — trial user ko normal show karo
        const masterSnap2 = await getDoc(
          firestoreDoc(firestoreDb, 'app_config', 'membership_master')
        );
        const isEnabled = masterSnap2.exists() ? masterSnap2.data().isEnabled : true;
        if (!isEnabled && data.isTrial) {
          setMembership({ ...data, isActive:false, isExpired:true, toggledOff:true });
          return;
        }
        // Fetch isEnabled for UI decisions
        const enabledSnap = await getDoc(
          firestoreDoc(firestoreDb, 'app_config', 'membership_master')
        );
        const enabled = enabledSnap.exists() ? enabledSnap.data().isEnabled !== false : true;
        setMembershipEnabled(enabled);
        setMembership(data);
        // Monthly usage
        if (data.isActive) {
          const now = new Date();
          const mk  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
          const usSnap = await getDoc(
            firestoreDoc(firestoreDb, 'user_memberships', user.uid, 'monthly_usage', mk)
          );
          if (usSnap.exists()) setMonthlyUsage(usSnap.data());
        }
      } catch (e) {
        console.log('Profile membership fetch error:', e.message);
        setMembership(null);
      }
    };
    fetchMembership();
  }, [user]);

  // ── Applications count (jobs + services) ─────────────────────
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

  // ── Membership helpers ────────────────────────────────────
  const isActiveMember  = membership?.isActive && !membership?.isExpired;
  const isTrial         = membership?.isTrial === true;
  const lb              = membership?.lockedBenefits || {};
  const planKey         = membership?.plan || '';
  const planName        = lb.planName  || planKey;
  const planEmoji       = lb.planEmoji || (planKey === 'gold' ? '🥇' : planKey === 'silver' ? '🥈' : planKey === 'basic' ? '🥉' : '');
  const planColor       = lb.planColor || (planKey === 'gold' ? '#F59E0B' : planKey === 'silver' ? '#94A3B8' : planKey === 'basic' ? '#CD7F32' : '#002855');
  const daysLeft        = membership?.endDate ? Math.max(0, Math.ceil((new Date(membership.endDate) - new Date()) / (1000*60*60*24))) : 0;
  const freeApps        = lb.freeApps  != null ? Number(lb.freeApps) : 0;
  const freeUsed        = monthlyUsage.free_used || 0;
  const freeLeft        = Math.max(0, freeApps - freeUsed);
  const appsUsed        = monthlyUsage.apps_used || 0;
  const appLimit        = lb.appLimit  != null ? Number(lb.appLimit) : -1;
  const appsRemaining   = (appLimit > 0) ? Math.max(0, appLimit - appsUsed) : -1;
  const discount        = lb.discount  || 0;

  // Gradient colors per plan
  const planGradient = {
    gold:   ['#F59E0B', '#D97706', '#92400E'],
    silver: ['#94A3B8', '#64748B', '#334155'],
    basic:  ['#CD7F32', '#B45309', '#78350F'],
    trial:  ['#6366F1', '#4F46E5', '#3730A3'],
  };
  const gradColors = isTrial
    ? planGradient.trial
    : planGradient[planKey] || ['#002855', '#1a3a6b', '#0f2444'];

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

        {/* ── Header — Changes based on membership ── */}
        {isActiveMember ? (
          /* MEMBER HEADER — Premium look */
          <View style={[s.memberHeader, { backgroundColor: gradColors[0] }]}>
            {/* Top strip */}
            <View style={s.memberHeaderTop}>
              <Text style={s.memberPlanBadge}>
                {isTrial ? '🎁 FREE TRIAL' : `${planEmoji} ${planName?.toUpperCase()} MEMBER`}
              </Text>
              {!isTrial && (
                <View style={s.memberVipBadge}>
                  {planKey === 'gold' && <MaterialCommunityIcons name="crown" size={12} color="#FFD700" />}
                  <Text style={[s.memberVipText, { color: planKey === 'gold' ? '#FFD700' : '#fff' }]}>
                    {planKey === 'gold' ? 'VIP' : planKey === 'silver' ? 'PRIORITY' : 'MEMBER'}
                  </Text>
                </View>
              )}
            </View>

            {/* Avatar */}
            <TouchableOpacity onPress={handlePhotoUpload} activeOpacity={0.85} style={s.memberAvatarWrap}>
              {userData?.photoURL ? (
                <Image source={{ uri: userData.photoURL }} style={s.memberAvatarImg} />
              ) : (
                <View style={[s.memberAvatarPlaceholder, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <MaterialCommunityIcons name="account-tie" size={44} color="#fff" />
                </View>
              )}
              <View style={s.memberCameraBadge}>
                {photoUploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <MaterialCommunityIcons name="camera" size={12} color="#fff" />
                }
              </View>
            </TouchableOpacity>

            <Text style={s.memberName}>{userData?.name || 'Member'}</Text>
            <Text style={s.memberEmail}>{maskEmail(userData?.email || user?.email)}</Text>

            {/* Plan stats */}
            <View style={s.memberStatsRow}>
              <View style={s.memberStat}>
                <Text style={s.memberStatVal}>{daysLeft}</Text>
                <Text style={s.memberStatLabel}>
                  {isTrial ? 'Trial Days' : 'Days Left'}
                </Text>
              </View>
              <View style={s.memberStatDiv} />
              <View style={s.memberStat}>
                <Text style={s.memberStatVal}>{discount}%</Text>
                <Text style={s.memberStatLabel}>Discount</Text>
              </View>
              <View style={s.memberStatDiv} />
              <View style={s.memberStat}>
                <Text style={s.memberStatVal}>
                  {appLimit <= 0 ? '∞' : `${appsRemaining}`}
                </Text>
                <Text style={s.memberStatLabel}>
                  {appLimit <= 0 ? 'Apps' : `Left/${appLimit}`}
                </Text>
              </View>
              {freeApps > 0 && (
                <>
                  <View style={s.memberStatDiv} />
                  <View style={s.memberStat}>
                    <Text style={[s.memberStatVal, { color: freeLeft > 0 ? '#FFD700' : 'rgba(255,255,255,0.5)' }]}>
                      {freeLeft}/{freeApps}
                    </Text>
                    <Text style={s.memberStatLabel}>Free</Text>
                  </View>
                </>
              )}
            </View>

            {/* Live usage bar — only when limit set */}
            {appLimit > 0 && (
              <View style={s.memberExpiryBar}>
                <View style={s.memberExpiryBg}>
                  <View style={[s.memberExpiryFill, {
                    width: `${Math.min(100, (appsUsed / appLimit) * 100)}%`,
                    backgroundColor: appsRemaining === 0 ? '#EF4444' : appsRemaining <= 1 ? '#F59E0B' : '#fff'
                  }]} />
                </View>
                <Text style={[s.memberExpiryText, {
                  color: appsRemaining === 0 ? '#FCA5A5' : 'rgba(255,255,255,0.8)'
                }]}>
                  {appsRemaining === 0
                    ? '⛔ Monthly limit reach ho gaya — 1st ko reset hoga'
                    : `📋 ${appsUsed}/${appLimit} applications used this month`
                  }
                </Text>
              </View>
            )}

            {/* Expiry bar */}
            {!isTrial && daysLeft > 0 && (
              <View style={s.memberExpiryBar}>
                <View style={s.memberExpiryBg}>
                  <View style={[s.memberExpiryFill, {
                    width: `${Math.min(100, (daysLeft / (membership?.term * 30 || 30)) * 100)}%`,
                    backgroundColor: daysLeft < 5 ? '#EF4444' : '#fff'
                  }]} />
                </View>
                <Text style={s.memberExpiryText}>
                  {daysLeft < 5
                    ? `⚠️ Sirf ${daysLeft} din bache!`
                    : `Valid till ${new Date(membership.endDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}`
                  }
                </Text>
              </View>
            )}
            {isTrial && (
              <View style={s.memberExpiryBar}>
                <Text style={[s.memberExpiryText, { color: daysLeft < 3 ? '#FEF08A' : 'rgba(255,255,255,0.8)' }]}>
                  {daysLeft < 3
                    ? `⚠️ Trial khatam hone wala! Abhi subscribe karo`
                    : `🎁 ${daysLeft} din ka free trial bache hain`
                  }
                </Text>
              </View>
            )}

            {/* Edit + Membership buttons */}
            <View style={s.memberBtnRow}>
              <TouchableOpacity
                style={s.memberEditBtn}
                onPress={() => navigation.navigate('EditProfile', { currentData: userData })}
              >
                <MaterialCommunityIcons name="account-edit" size={16} color="#fff" />
                <Text style={s.memberEditBtnText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.memberPlanBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                onPress={() => navigation.navigate('Membership')}
              >
                <MaterialCommunityIcons name="star" size={16} color="#FFD700" />
                <Text style={s.memberPlanBtnText}>
                  {isTrial ? 'Upgrade Plan' : 'My Plan'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* NON-MEMBER HEADER — Normal */
          <View style={[s.header, { backgroundColor: theme.card }]}>
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
        )}

        {/* ── Stats Row — only for non-members ── */}
        {!isActiveMember && (
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
        )}
        {/* Members — usage card */}
        {isActiveMember && (
          <View style={[s.memberSlimRow, { backgroundColor: theme.card }]}>
            <View style={s.memberSlimItem}>
              <MaterialCommunityIcons name="file-document-multiple" size={16} color="#3B82F6" />
              <Text style={[s.memberSlimVal, { color: theme.text }]}>{appCount}</Text>
              <Text style={[s.memberSlimLabel, { color: theme.textMuted }]}>Total Apps</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: theme.border }]} />
            <View style={s.memberSlimItem}>
              <MaterialCommunityIcons name="calendar-month" size={16} color="#F59E0B" />
              <Text style={[s.memberSlimVal, { color: theme.text }]}>
                {appLimit > 0 ? `${appsUsed}/${appLimit}` : `${appsUsed}`}
              </Text>
              <Text style={[s.memberSlimLabel, { color: theme.textMuted }]}>This Month</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: theme.border }]} />
            <View style={s.memberSlimItem}>
              <MaterialCommunityIcons name="identifier" size={16} color="#8B5CF6" />
              <Text style={[s.memberSlimVal, { color: theme.text }]}>{memberId}</Text>
              <Text style={[s.memberSlimLabel, { color: theme.textMuted }]}>Member ID</Text>
            </View>
          </View>
        )}

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

        {/* ── Membership Card ── */}
        <View style={s.section}>
          {isActiveMember && !membership?.toggledOff ? (
            <TouchableOpacity
              style={[s.activeMemberCard, { backgroundColor: gradColors[0] }]}
              onPress={() => navigation.navigate('Membership')}
              activeOpacity={0.88}
            >
              <View style={{ flex:1 }}>
                <Text style={s.activeMemberCardTitle}>
                  {planEmoji} {isTrial ? 'Free Trial Active' : `${planName} Plan Active`}
                </Text>
                <Text style={s.activeMemberCardSub}>
                  {isTrial
                    ? `${daysLeft} din bache — Upgrade karo`
                    : `${daysLeft} din bache • ${discount}% off SewaOne fee`
                  }
                </Text>
                {freeApps > 0 && (
                  <Text style={s.activeMemberCardFree}>
                    🎁 {freeLeft}/{freeApps} free apps bacha is mahine
                  </Text>
                )}
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.memberCard, { backgroundColor: membershipEnabled ? '#002855' : '#64748B' }]}
              onPress={() => membershipEnabled ? navigation.navigate('Membership') : null}
              activeOpacity={membershipEnabled ? 0.88 : 1}
            >
              <View style={{ flexDirection:'row', alignItems:'center', flex:1 }}>
                <Text style={{ fontSize: 26 }}>{membershipEnabled ? '⭐' : '🔒'}</Text>
                <View style={{ marginLeft: 12 }}>
                  <Text style={s.memberTitle}>
                    {membershipEnabled ? 'SewaOne Membership' : 'Membership Unavailable'}
                  </Text>
                  <Text style={s.memberSub}>
                    {membershipEnabled ? 'Discounts & Priority Processing' : 'Feature temporarily paused'}
                  </Text>
                </View>
              </View>
              {membershipEnabled && <MaterialCommunityIcons name="chevron-right" size={22} color="rgba(255,255,255,0.6)" />}
            </TouchableOpacity>
          )}
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
            onPress={() => navigation.navigate('HelpScreen')} />

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

    // ── Member header ─────────────────────────────────────
    memberHeader:        { alignItems:'center', paddingHorizontal:20, paddingTop:50, paddingBottom:24, borderBottomLeftRadius:36, borderBottomRightRadius:36, elevation:4 },
    memberHeaderTop:     { flexDirection:'row', justifyContent:'space-between', alignItems:'center', width:'100%', marginBottom:16 },
    memberPlanBadge:     { fontSize:11, fontWeight:'900', color:'rgba(255,255,255,0.95)', letterSpacing:1, backgroundColor:'rgba(0,0,0,0.2)', paddingHorizontal:12, paddingVertical:5, borderRadius:20 },
    memberVipBadge:      { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'rgba(0,0,0,0.2)', paddingHorizontal:10, paddingVertical:5, borderRadius:20 },
    memberVipText:       { fontSize:11, fontWeight:'900', letterSpacing:0.5 },
    memberAvatarWrap:    { position:'relative', marginBottom:12 },
    memberAvatarImg:     { width:90, height:90, borderRadius:45, borderWidth:3, borderColor:'rgba(255,255,255,0.5)' },
    memberAvatarPlaceholder: { width:90, height:90, borderRadius:45, justifyContent:'center', alignItems:'center', borderWidth:3, borderColor:'rgba(255,255,255,0.3)' },
    memberCameraBadge:   { position:'absolute', bottom:2, right:2, width:26, height:26, borderRadius:13, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center' },
    memberName:          { fontSize:22, fontWeight:'900', color:'#fff', marginBottom:4 },
    memberEmail:         { fontSize:13, color:'rgba(255,255,255,0.75)', fontWeight:'600', marginBottom:16 },
    memberStatsRow:      { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(0,0,0,0.2)', borderRadius:16, padding:14, width:'100%', marginBottom:12 },
    memberStat:          { flex:1, alignItems:'center' },
    memberStatVal:       { fontSize:16, fontWeight:'900', color:'#fff' },
    memberStatLabel:     { fontSize:9, color:'rgba(255,255,255,0.65)', fontWeight:'700', marginTop:2, textAlign:'center' },
    memberStatDiv:       { width:1, height:30, backgroundColor:'rgba(255,255,255,0.2)' },
    memberExpiryBar:     { width:'100%', marginBottom:14 },
    memberExpiryBg:      { height:6, backgroundColor:'rgba(255,255,255,0.2)', borderRadius:3, overflow:'hidden', marginBottom:4 },
    memberExpiryFill:    { height:'100%', borderRadius:3 },
    memberExpiryText:    { fontSize:11, color:'rgba(255,255,255,0.75)', fontWeight:'700', textAlign:'center' },
    memberBtnRow:        { flexDirection:'row', gap:10, width:'100%' },
    memberEditBtn:       { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, backgroundColor:'rgba(0,0,0,0.25)', paddingVertical:11, borderRadius:13 },
    memberEditBtnText:   { color:'#fff', fontWeight:'800', fontSize:13 },
    memberPlanBtn:       { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, backgroundColor:'rgba(255,255,255,0.15)', paddingVertical:11, borderRadius:13 },
    memberPlanBtnText:   { color:'#fff', fontWeight:'800', fontSize:13 },
    memberSlimRow:       { flexDirection:'row', alignItems:'center', marginHorizontal:16, marginTop:8, borderRadius:16, padding:14, elevation:1 },
    memberSlimItem:      { flex:1, alignItems:'center', gap:3 },
    memberSlimVal:       { fontSize:13, fontWeight:'900' },
    memberSlimLabel:     { fontSize:10, fontWeight:'700' },
    activeMemberCard:    { flexDirection:'row', alignItems:'center', padding:16, borderRadius:18, elevation:3 },
    activeMemberCardTitle:{ fontSize:15, fontWeight:'900', color:'#fff', marginBottom:3 },
    activeMemberCardSub: { fontSize:12, color:'rgba(255,255,255,0.8)', fontWeight:'600' },
    activeMemberCardFree:{ fontSize:11, color:'rgba(255,255,255,0.9)', fontWeight:'700', marginTop:4 },

    // Membership section card (non-member)
    memberCard:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:18, borderRadius:20, elevation:4 },
    memberTitle:   { color:'#fff', fontWeight:'900', fontSize:15 },
    memberSub:     { color:'rgba(255,255,255,0.7)', fontSize:12, fontWeight:'600', marginTop:2 },
  });
}
