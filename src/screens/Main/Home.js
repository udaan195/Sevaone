import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, FlatList, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { auth, db } from '../../api/firebaseConfig';
import { doc, onSnapshot, collection, query, orderBy, where } from 'firebase/firestore'; 

const { width } = Dimensions.get('window');

// ✨ RESTORED: Ab saare targets par navigation kaam karegi
const ServiceItem = ({ icon, title, color, iconCol, target, navigation }) => (
  <TouchableOpacity 
    style={styles.serviceCard} 
    onPress={() => navigation.navigate(target)}
  >
    <View style={[styles.iconCircle, { backgroundColor: color }]}>
      <MaterialCommunityIcons name={icon} size={30} color={iconCol} />
    </View>
    <Text style={styles.serviceTitle}>{title}</Text>
  </TouchableOpacity>
);

export default function HomeScreen({ navigation }) {
  const [userData, setUserData] = useState({ name: 'User', walletBalance: 0 });
  const [banners, setBanners] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [hasNewNoti, setHasNewNoti] = useState(false);
  
  const tickerRef = useRef(null);
  const bannerRef = useRef(null);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [bannerIndex, setBannerIndex] = useState(0);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubUser = onSnapshot(doc(db, "users", auth.currentUser.uid), (snap) => {
      if (snap.exists()) setUserData(snap.data());
    });

    const qBanners = query(collection(db, "banners"), where("isActive", "==", true), orderBy("timestamp", "desc"));
    const unsubBanners = onSnapshot(qBanners, (snap) => {
      setBanners(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const qUpdates = query(collection(db, "updates"), where("timestamp", ">=", fiveDaysAgo), orderBy("timestamp", "desc"));

    const unsubUpdates = onSnapshot(qUpdates, (snap) => {
      if (!snap.empty) {
        setUpdates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setHasNewNoti(true); 
      }
    });

    return () => { unsubUser(); unsubBanners(); unsubUpdates(); };
  }, []);

  useEffect(() => {
    if (banners.length > 1) {
      const interval = setInterval(() => {
        let nextIndex = (bannerIndex + 1) % banners.length;
        setBannerIndex(nextIndex);
        bannerRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      }, 5000); 
      return () => clearInterval(interval);
    }
  }, [bannerIndex, banners]);

  useEffect(() => {
    if (updates.length > 1) {
      const interval = setInterval(() => {
        let nextIndex = (tickerIndex + 1) % updates.length;
        setTickerIndex(nextIndex);
        tickerRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      }, 4000); 
      return () => clearInterval(interval);
    }
  }, [tickerIndex, updates]);

  return (
    <View style={styles.container}>
      <View style={styles.miniHeader}>
        <Text style={styles.appTitle}>SewaOne</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => { navigation.navigate('Notifications'); setHasNewNoti(false); }}>
            <MaterialCommunityIcons name="bell-outline" size={28} color="#003366" />
            {hasNewNoti && <View style={styles.dot} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.walletBtn} onPress={() => navigation.navigate('Wallet')}>
            <MaterialCommunityIcons name="wallet-outline" size={20} color="#fff" />
            {/* ✨ RESTORED: Wallet text wapas XXX kar diya hai */}
            <Text style={styles.walletText}>₹ XXX</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeSub}>Namaste,</Text>
          <Text style={styles.userName}>{userData.name || "User"}</Text> 
        </View>

        <View style={styles.bannerWrapper}>
          <FlatList
            ref={bannerRef}
            data={banners}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEnabled={false} 
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.bannerCard}
                onPress={() => item.target && item.jobId && navigation.navigate(item.target, { jobId: item.jobId })}
              >
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                ) : (
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#003366', padding: 25 }]}>
                    <View style={styles.categoryBadge}>
                       <Text style={styles.badgeText}>🔥 NEW {item.subTitle?.toUpperCase() || 'UPDATE'}</Text>
                    </View>
                    <Text style={styles.bannerTitle} numberOfLines={2}>{item.title}</Text>
                    <View style={styles.bannerActionBtn}>
                      <Text style={styles.actionBtnText}>{item.btnText || "Check Now"}</Text>
                      <MaterialCommunityIcons name="arrow-right" size={14} color="#003366" />
                    </View>
                    <MaterialCommunityIcons name="bullhorn-variant-outline" size={80} color="rgba(255,255,255,0.15)" style={styles.bannerIcon} />
                  </View>
                )}
              </TouchableOpacity>
            )}
          />
          <View style={styles.dotContainer}>
            {banners.map((_, i) => (
              <View key={i} style={[styles.paginationDot, { backgroundColor: i === bannerIndex ? '#F59E0B' : 'rgba(255,255,255,0.3)' }]} />
            ))}
          </View>
        </View>

        <View style={styles.serviceGrid}>
          {/* ✅ Ab saare cards active hain */}
          <ServiceItem navigation={navigation} icon="briefcase-variant" title="Govt Job" color="#E3F2FD" iconCol="#1976D2" target="GovtJobs" />
          <ServiceItem navigation={navigation} icon="office-building" title="Private Job" color="#F3E5F5" iconCol="#7B1FA2" target="PrivateJobs" />
          <ServiceItem navigation={navigation} icon="account-group" title="Citizen Services" color="#E8F5E9" iconCol="#388E3C" target="CitizenServices" />
          <ServiceItem navigation={navigation} icon="bank" title="Govt Schemes" color="#FFF3E0" iconCol="#F57C00" target="GovtSchemes" />
          <ServiceItem navigation={navigation} icon="school" title="Students" color="#FCE4EC" iconCol="#C2185B" target="Students" />
          <ServiceItem navigation={navigation} icon="dots-grid" title="Other" color="#E0F7FA" iconCol="#0097A7" target="Others" />
        </View>

        <View style={styles.updateBar}>
          <FlatList
            ref={tickerRef}
            data={updates}
            horizontal
            pagingEnabled
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={{ width: width - 70, flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.updateBadge, { backgroundColor: item.type === 'new' ? '#D1FAE5' : '#FEF3C7' }]}>
                  <Text style={[styles.updateBadgeText, { color: item.type === 'new' ? '#059669' : '#B45309' }]}>
                    {item.type?.toUpperCase() || 'NEW'}
                  </Text>
                </View>
                <Text style={styles.updateText} numberOfLines={1}>{item.text}</Text>
              </View>
            )}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  miniHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff' },
  appTitle: { fontSize: 22, fontWeight: '900', color: '#003366' },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  walletBtn: { flexDirection: 'row', backgroundColor: '#003366', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginLeft: 15, alignItems: 'center' },
  walletText: { color: '#fff', marginLeft: 5, fontWeight: 'bold' },
  welcomeSection: { paddingHorizontal: 20, marginTop: 10 },
  welcomeSub: { fontSize: 16, color: '#64748B' },
  userName: { fontSize: 26, fontWeight: 'bold', color: '#1E293B' },
  bannerWrapper: { marginTop: 20, marginHorizontal: 20 },
  bannerCard: { width: width - 40, height: 160, borderRadius: 20, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  categoryBadge: { backgroundColor: 'rgba(245, 158, 11, 0.2)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 10 },
  badgeText: { color: '#F59E0B', fontSize: 10, fontWeight: '900' },
  bannerTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 15, lineHeight: 24 },
  bannerActionBtn: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
  actionBtnText: { color: '#003366', fontWeight: 'bold', fontSize: 12, marginRight: 5 },
  bannerIcon: { position: 'absolute', right: -10, bottom: -10, zIndex: 1 },
  dotContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  paginationDot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4 },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 15 },
  serviceCard: { width: '30%', alignItems: 'center', marginBottom: 20 },
  iconCircle: { width: 65, height: 65, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  serviceTitle: { marginTop: 8, fontSize: 12, fontWeight: '700', color: '#334155', textAlign: 'center' },
  updateBar: { margin: 20, backgroundColor: '#fff', padding: 15, borderRadius: 15, borderLeftWidth: 6, borderLeftColor: '#10B981', elevation: 4, overflow: 'hidden' },
  dot: { position: 'absolute', right: 2, top: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#fff' },
  updateBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 10 },
  updateBadgeText: { fontSize: 10, fontWeight: '900' },
  updateText: { fontSize: 13, color: '#1E293B', fontWeight: '700', flex: 1 }
});
