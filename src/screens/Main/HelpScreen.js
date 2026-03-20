// ============================================================
// FILE: src/screens/Main/HelpScreen.js
// FEATURES:
//   ✅ WhatsApp Group — direct join
//   ✅ Call support button
//   ✅ Ticket raise with proper ID
//   ✅ Mera Tickets — user ki list
//   ✅ Real-time status update
//   ✅ Screenshot attach in ticket
//   ✅ Push notification on resolve
//   ✅ FAQ accordion
//   ✅ Professional UI
// ============================================================
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, SafeAreaView,
  Linking, Image, FlatList, Animated
} from 'react-native';
import { db, auth } from '../../api/firebaseConfig';
import {
  collection, addDoc, serverTimestamp, query,
  where, onSnapshot, orderBy, doc, getDoc
} from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Config from '../../config';

// ── Config — baad mein update karo ─────────────────────────
const WHATSAPP_GROUP = 'https://wa.me/7518640453?text=Hello%20SewaOne%20Support'; // ← Group link yahan
const CALL_NUMBER    = '+917518640453'; // ← Real number yahan
const CLOUD_NAME     = Config.cloudinary.cloudName;
const UPLOAD_PRESET  = Config.cloudinary.uploadPreset;

// ── Status config ─────────────────────────────────────────
const getStatusCfg = (status) => {
  const map = {
    'Under Review':  { color: '#F59E0B', bg: '#FEF3C7', icon: 'clock-outline' },
    'In Progress':   { color: '#3B82F6', bg: '#EFF6FF', icon: 'progress-clock' },
    'Resolved':      { color: '#10B981', bg: '#ECFDF5', icon: 'check-circle' },
    'Rejected':      { color: '#EF4444', bg: '#FEF2F2', icon: 'close-circle' },
    'Closed':        { color: '#64748B', bg: '#F1F5F9', icon: 'lock' },
  };
  return map[status] || { color: '#64748B', bg: '#F1F5F9', icon: 'dots-horizontal' };
};

// ── FAQ Accordion Item ────────────────────────────────────
const FAQItem = ({ faq }) => {
  const [open, setOpen] = useState(false);
  const anim = useState(new Animated.Value(0))[0];

  const toggle = () => {
    setOpen(!open);
    Animated.timing(anim, {
      toValue: open ? 0 : 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  return (
    <TouchableOpacity style={s.faqItem} onPress={toggle} activeOpacity={0.85}>
      <View style={s.faqHeader}>
        <Text style={s.faqQ}>{faq.question}</Text>
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20} color="#003366"
        />
      </View>
      {open && (
        <Text style={s.faqA}>{faq.answer}</Text>
      )}
    </TouchableOpacity>
  );
};

// ── Main Component ────────────────────────────────────────
export default function HelpScreen() {
  const userId = auth.currentUser?.uid;
  const [faqs, setFaqs]               = useState([]);
  const [myTickets, setMyTickets]     = useState([]);
  const [loading, setLoading]         = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [activeTab, setActiveTab]     = useState('home'); // home | tickets | faqs

  // Ticket form
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [category, setCategory]   = useState('');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot]   = useState(null);
  const [screenshotUrl, setScreenshotUrl] = useState('');

  const categories = [
    { id: 'Payment Issue',    icon: 'credit-card',      color: '#EF4444' },
    { id: 'Document Error',   icon: 'file-alert',       color: '#F59E0B' },
    { id: 'Wallet Balance',   icon: 'wallet',           color: '#10B981' },
    { id: 'Form Status',      icon: 'file-document',    color: '#3B82F6' },
    { id: 'Agent Behavior',   icon: 'account-alert',    color: '#8B5CF6' },
    { id: 'Refund Request',   icon: 'cash-refund',      color: '#059669' },
    { id: 'Others',           icon: 'dots-horizontal',  color: '#64748B' },
  ];

  // ── Fetch FAQs ──────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'faqs'), snap => {
      setFaqs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // ── Fetch My Tickets ────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(
      query(collection(db, 'grievances'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc')
      ),
      snap => setMyTickets(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {
        // Fallback without orderBy
        onSnapshot(
          query(collection(db, 'grievances'), where('userId', '==', userId)),
          snap => setMyTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        );
      }
    );
    return () => unsub();
  }, [userId]);

  // ── Open WhatsApp Group ─────────────────────────────────
  const openWhatsAppGroup = () => {
    Linking.openURL(WHATSAPP_GROUP).catch(() =>
      Alert.alert('Error', 'WhatsApp install nahi hai ya link galat hai.')
    );
  };

  // ── Call support ────────────────────────────────────────
  const openCall = () => Linking.openURL(`tel:${CALL_NUMBER}`);

  // ── Pick screenshot ─────────────────────────────────────
  const pickScreenshot = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (!result.canceled) setScreenshot(result.assets[0].uri);
  };

  // ── Upload to Cloudinary ────────────────────────────────
  const uploadScreenshot = async (uri) => {
    const data = new FormData();
    data.append('file', { uri, type: 'image/jpeg', name: 'ticket.jpg' });
    data.append('upload_preset', UPLOAD_PRESET);
    setUploading(true);
    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: 'POST', body: data }
      );
      const json = await res.json();
      return json.secure_url;
    } catch { return null; }
    finally { setUploading(false); }
  };

  // ── Submit ticket ────────────────────────────────────────
  const handleSubmit = async () => {
    if (!category) return Alert.alert('Category select karo!');
    if (!description.trim()) return Alert.alert('Description likhna zaroori hai!');

    setLoading(true);
    try {
      let imgUrl = '';
      if (screenshot) imgUrl = await uploadScreenshot(screenshot) || '';

      // ✅ Ticket ID = timestamp based unique
      const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`;

      await addDoc(collection(db, 'grievances'), {
        ticketId,
        userId,
        category,
        description: description.trim(),
        screenshot: imgUrl,
        status: 'Under Review',
        adminNote: '',
        timestamp: serverTimestamp(),
      });

      setShowTicketModal(false);
      setCategory(''); setDescription(''); setScreenshot(''); setScreenshotUrl('');

      Alert.alert(
        '✅ Ticket Raised!',
        `Ticket ID: ${ticketId}\n\nHamari team 24 ghante mein respond karegi. "Mere Tickets" mein track karo.`,
        [{ text: 'OK' }]
      );
      setActiveTab('tickets');
    } catch {
      Alert.alert('Error', 'Ticket submit nahi ho saka. Try again.');
    } finally { setLoading(false); }
  };

  // ── RENDER ────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.headerTitle}>Help & Support</Text>
          <Text style={s.headerSub}>Hum yahan hain aapki madad ke liye</Text>
        </View>
        <View style={[s.onlineDot]} />
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        {[
          { id: 'home',    label: 'Home',       icon: 'home' },
          { id: 'tickets', label: 'Mere Tickets', icon: 'ticket-confirmation',
            badge: myTickets.filter(t => t.status === 'Under Review').length },
          { id: 'faqs',    label: 'FAQs',        icon: 'help-circle' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[s.tab, activeTab === tab.id && s.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <MaterialCommunityIcons
              name={tab.icon}
              size={18}
              color={activeTab === tab.id ? '#003366' : '#94A3B8'}
            />
            <Text style={[s.tabText, activeTab === tab.id && s.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.badge > 0 && (
              <View style={s.tabBadge}>
                <Text style={s.tabBadgeText}>{tab.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── HOME TAB ── */}
      {activeTab === 'home' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

          {/* Contact cards */}
          <View style={s.contactRow}>
            {/* WhatsApp Group */}
            <TouchableOpacity style={[s.contactCard, { backgroundColor: '#ECFDF5' }]} onPress={openWhatsAppGroup} activeOpacity={0.85}>
              <View style={[s.contactIcon, { backgroundColor: '#25D366' }]}>
                <MaterialCommunityIcons name="whatsapp" size={26} color="#fff" />
              </View>
              <Text style={[s.contactTitle, { color: '#166534' }]}>WhatsApp Group</Text>
              <Text style={s.contactSub}>Team se seedha baat karo</Text>
              <View style={[s.contactBtn, { backgroundColor: '#25D366' }]}>
                <Text style={s.contactBtnText}>Join Group →</Text>
              </View>
            </TouchableOpacity>

            {/* Call */}
            <TouchableOpacity style={[s.contactCard, { backgroundColor: '#EBF5FB' }]} onPress={openCall} activeOpacity={0.85}>
              <View style={[s.contactIcon, { backgroundColor: '#003366' }]}>
                <MaterialCommunityIcons name="phone" size={26} color="#fff" />
              </View>
              <Text style={[s.contactTitle, { color: '#1a5276' }]}>Call Support</Text>
              <Text style={s.contactSub}>Mon–Sat, 9am–6pm</Text>
              <View style={[s.contactBtn, { backgroundColor: '#003366' }]}>
                <Text style={s.contactBtnText}>Call Now →</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Raise ticket CTA */}
          <TouchableOpacity style={s.raiseTicketBtn} onPress={() => setShowTicketModal(true)} activeOpacity={0.88}>
            <View style={s.raiseTicketLeft}>
              <Text style={s.raiseTicketTitle}>Koi Problem Hai?</Text>
              <Text style={s.raiseTicketSub}>Ticket raise karo — 24 ghante mein jawab milega</Text>
            </View>
            <View style={s.raiseTicketIcon}>
              <MaterialCommunityIcons name="plus-circle" size={28} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* How to use guide */}
          <View style={s.guideCard}>
            <View style={s.guideHeader}>
              <MaterialCommunityIcons name="lightbulb-on" size={20} color="#003366" />
              <Text style={s.guideTitle}>SewaOne कैसे Use करें?</Text>
            </View>
            {[
              { n: '1', t: 'Profile bharo', d: 'Profile mein eligibility details bharo taaki sahi jobs match hon' },
              { n: '2', t: 'Job/Service chuno', d: 'Job ya Citizen Service choose karo — khud ya team se apply karo' },
              { n: '3', t: 'Wallet recharge karo', d: 'Team se apply karwane ke liye wallet mein balance rakho' },
              { n: '4', t: 'Track karo', d: 'Applications tab mein live status aur agent se chat karo' },
            ].map(step => (
              <View key={step.n} style={s.guideStep}>
                <View style={s.stepNum}>
                  <Text style={s.stepNumText}>{step.n}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitle}>{step.t}</Text>
                  <Text style={s.stepDesc}>{step.d}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Footer */}
          <View style={s.footerBox}>
            <MaterialCommunityIcons name="shield-check" size={20} color="#10B981" />
            <Text style={s.footerText}>SewaOne Verified Support System</Text>
          </View>
        </ScrollView>
      )}

      {/* ── MY TICKETS TAB ── */}
      {activeTab === 'tickets' && (
        <View style={{ flex: 1 }}>
          <View style={s.ticketsHeader}>
            <Text style={s.ticketsTitle}>Mere Tickets ({myTickets.length})</Text>
            <TouchableOpacity style={s.newTicketBtn} onPress={() => setShowTicketModal(true)}>
              <MaterialCommunityIcons name="plus" size={16} color="#fff" />
              <Text style={s.newTicketText}>Naya</Text>
            </TouchableOpacity>
          </View>

          {myTickets.length === 0 ? (
            <View style={s.emptyState}>
              <MaterialCommunityIcons name="ticket-outline" size={64} color="#CBD5E1" />
              <Text style={s.emptyTitle}>Koi ticket nahi</Text>
              <Text style={s.emptySub}>Koi problem ho toh ticket raise karo</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setShowTicketModal(true)}>
                <Text style={s.emptyBtnText}>Ticket Raise Karo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={myTickets}
              keyExtractor={t => t.id}
              contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const st = getStatusCfg(item.status);
                return (
                  <View style={[s.ticketCard, { borderLeftColor: st.color }]}>
                    {/* Top row */}
                    <View style={s.ticketTop}>
                      <View style={s.ticketCatRow}>
                        <MaterialCommunityIcons
                          name={categories.find(c => c.id === item.category)?.icon || 'help'}
                          size={16}
                          color={categories.find(c => c.id === item.category)?.color || '#64748B'}
                        />
                        <Text style={s.ticketCat}>{item.category}</Text>
                      </View>
                      <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                        <MaterialCommunityIcons name={st.icon} size={12} color={st.color} />
                        <Text style={[s.statusText, { color: st.color }]}>{item.status}</Text>
                      </View>
                    </View>

                    {/* Ticket ID */}
                    <Text style={s.ticketId}>#{item.ticketId || item.trackingId}</Text>

                    {/* Description */}
                    <Text style={s.ticketDesc} numberOfLines={2}>{item.description}</Text>

                    {/* Admin note */}
                    {item.adminNote ? (
                      <View style={s.adminNoteBox}>
                        <MaterialCommunityIcons name="account-tie" size={14} color="#003366" />
                        <Text style={s.adminNoteText}>{item.adminNote}</Text>
                      </View>
                    ) : null}

                    {/* Screenshot */}
                    {item.screenshot ? (
                      <TouchableOpacity onPress={() => Linking.openURL(item.screenshot)}>
                        <Image source={{ uri: item.screenshot }} style={s.ticketImg} />
                      </TouchableOpacity>
                    ) : null}

                    {/* Date */}
                    <Text style={s.ticketDate}>
                      {item.timestamp?.toDate?.()?.toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      }) || ''}
                    </Text>
                  </View>
                );
              }}
            />
          )}
        </View>
      )}

      {/* ── FAQs TAB ── */}
      {activeTab === 'faqs' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Text style={s.faqsTitle}>Aksar Pooche Jane Wale Sawaal</Text>
          {faqs.length === 0 ? (
            <View style={s.emptyState}>
              <MaterialCommunityIcons name="help-circle-outline" size={56} color="#CBD5E1" />
              <Text style={s.emptyTitle}>Abhi koi FAQ nahi</Text>
            </View>
          ) : (
            faqs.map(f => <FAQItem key={f.id} faq={f} />)
          )}
        </ScrollView>
      )}

      {/* ── RAISE TICKET MODAL ── */}
      <Modal visible={showTicketModal} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          {/* Modal Header */}
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowTicketModal(false)}>
              <MaterialCommunityIcons name="chevron-down" size={28} color="#003366" />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Ticket Raise Karo</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {/* Category */}
            <Text style={s.fieldLabel}>Problem Category *</Text>
            <View style={s.catGrid}>
              {categories.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[s.catPill, category === c.id && { backgroundColor: c.color, borderColor: c.color }]}
                  onPress={() => setCategory(c.id)}
                >
                  <MaterialCommunityIcons
                    name={c.icon} size={14}
                    color={category === c.id ? '#fff' : c.color}
                  />
                  <Text style={[s.catPillText, category === c.id && { color: '#fff' }]}>
                    {c.id}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Description */}
            <Text style={s.fieldLabel}>Problem ka Description *</Text>
            <TextInput
              style={s.descInput}
              multiline
              numberOfLines={5}
              placeholder="Kya problem aa rahi hai? Jitna detail mein likho utna better..."
              placeholderTextColor="#94A3B8"
              value={description}
              onChangeText={setDescription}
              maxLength={500}
            />
            <Text style={{ fontSize: 11, color: '#94A3B8', textAlign: 'right', marginTop: 4 }}>
              {description.length}/500
            </Text>

            {/* Screenshot */}
            <Text style={s.fieldLabel}>Screenshot (Optional)</Text>
            <TouchableOpacity style={s.screenshotBox} onPress={pickScreenshot}>
              {screenshot ? (
                <Image source={{ uri: screenshot }} style={s.screenshotPreview} resizeMode="cover" />
              ) : (
                <View style={s.screenshotEmpty}>
                  <MaterialCommunityIcons name="image-plus" size={32} color="#94A3B8" />
                  <Text style={s.screenshotText}>Tap to attach screenshot</Text>
                </View>
              )}
            </TouchableOpacity>
            {screenshot && (
              <TouchableOpacity onPress={() => setScreenshot(null)} style={s.removeImg}>
                <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 12 }}>✕ Remove</Text>
              </TouchableOpacity>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[s.submitBtn, (loading || uploading) && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={loading || uploading}
            >
              {loading || uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="send" size={18} color="#fff" />
                  <Text style={s.submitBtnText}>Submit Ticket</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={s.submitNote}>
              Ticket submit hone ke baad 24 ghante mein response milega
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerLeft: {},
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#003366' },
  headerSub: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' },

  // Tabs
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12, position: 'relative' },
  tabActive: { borderBottomWidth: 2.5, borderBottomColor: '#003366' },
  tabText: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  tabTextActive: { color: '#003366', fontWeight: '800' },
  tabBadge: { position: 'absolute', top: 6, right: 8, backgroundColor: '#EF4444', width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },

  // Contact cards
  contactRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  contactCard: { flex: 1, borderRadius: 20, padding: 16, alignItems: 'center' },
  contactIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  contactTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  contactSub: { fontSize: 11, color: '#64748B', marginBottom: 12, textAlign: 'center' },
  contactBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  contactBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // Raise ticket
  raiseTicketBtn: { backgroundColor: '#003366', borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, elevation: 4, shadowColor: '#003366', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  raiseTicketLeft: { flex: 1 },
  raiseTicketTitle: { fontSize: 16, fontWeight: '900', color: '#fff' },
  raiseTicketSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  raiseTicketIcon: {},

  // Guide
  guideCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#003366', elevation: 1 },
  guideHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  guideTitle: { fontSize: 15, fontWeight: '900', color: '#003366' },
  guideStep: { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'flex-start' },
  stepNum: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#EBF5FB', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  stepNumText: { fontSize: 13, fontWeight: '900', color: '#003366' },
  stepTitle: { fontSize: 13, fontWeight: '800', color: '#1E293B', marginBottom: 2 },
  stepDesc: { fontSize: 12, color: '#64748B', lineHeight: 17 },

  // Footer
  footerBox: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 20 },
  footerText: { fontSize: 12, color: '#64748B', fontWeight: '600' },

  // Tickets tab
  ticketsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  ticketsTitle: { fontSize: 16, fontWeight: '900', color: '#003366' },
  newTicketBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#003366', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  newTicketText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Ticket card
  ticketCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderLeftWidth: 4, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05 },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  ticketCatRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ticketCat: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: '800' },
  ticketId: { fontSize: 11, color: '#94A3B8', fontWeight: '700', marginBottom: 6 },
  ticketDesc: { fontSize: 13, color: '#475569', lineHeight: 19, marginBottom: 8 },
  adminNoteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#EBF5FB', padding: 10, borderRadius: 10, marginBottom: 8 },
  adminNoteText: { fontSize: 12, color: '#1a5276', fontWeight: '600', flex: 1 },
  ticketImg: { width: '100%', height: 120, borderRadius: 10, marginBottom: 8 },
  ticketDate: { fontSize: 10, color: '#CBD5E1', fontWeight: '600', textAlign: 'right' },

  // Empty state
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#94A3B8', marginTop: 16 },
  emptySub: { fontSize: 13, color: '#CBD5E1', marginTop: 6 },
  emptyBtn: { marginTop: 20, backgroundColor: '#003366', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '700' },

  // FAQs
  faqsTitle: { fontSize: 17, fontWeight: '900', color: '#003366', marginBottom: 16 },
  faqItem: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9', elevation: 1 },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQ: { fontSize: 14, fontWeight: '700', color: '#1E293B', flex: 1, marginRight: 10 },
  faqA: { fontSize: 13, color: '#64748B', marginTop: 10, lineHeight: 20 },

  // Modal
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: 17, fontWeight: '900', color: '#003366' },

  // Form
  fieldLabel: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 10, marginTop: 16 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  catPillText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  descInput: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 14, padding: 14, fontSize: 14, color: '#1E293B', textAlignVertical: 'top', minHeight: 120 },
  screenshotBox: { borderWidth: 1.5, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 14, overflow: 'hidden', marginBottom: 4 },
  screenshotEmpty: { padding: 30, alignItems: 'center', gap: 8 },
  screenshotText: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  screenshotPreview: { width: '100%', height: 160 },
  removeImg: { alignItems: 'flex-end', marginBottom: 8 },
  submitBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: '#003366', padding: 17, borderRadius: 16, marginTop: 20, elevation: 3 },
  submitBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  submitNote: { textAlign: 'center', fontSize: 12, color: '#94A3B8', marginTop: 10 },
});
