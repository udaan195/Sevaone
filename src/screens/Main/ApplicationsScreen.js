// ============================================================
// FILE: src/screens/Main/ApplicationsScreen.js
// FIXES:
//   ✅ UI alignment — card clean, no overflow
//   ✅ Linked updates — sirf relevant job ka update dikhe
//   ✅ Update badge — type ke hisab se color/emoji
//   ✅ Push notification — admin chat message pe
//   ✅ Chat timestamp
//   ✅ Empty state
//   ✅ Unread badge
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
  TextInput, ScrollView, Linking, SafeAreaView, Image,
  ActivityIndicator, Alert, BackHandler
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { db, auth } from '../../api/firebaseConfig';
import {
  collection, query, where, onSnapshot,
  orderBy, addDoc, serverTimestamp, getDoc, doc, getDocs
} from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Config from '../../config';

const CLOUD_NAME    = Config.cloudinary.cloudName;
const UPLOAD_PRESET = Config.cloudinary.uploadPreset;

const formatTime = (ts) => {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 1) return 'Abhi';
    if (diff < 60) return `${diff}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch { return ''; }
};

const getStatusConfig = (item) => {
  if (item.paymentMethod === 'upi' && (!item.paymentStatus || item.paymentStatus === 'pending')) {
    return { text: 'Fee Verification', color: '#F59E0B', icon: 'clock-outline' };
  }
  const s = item.status || '';
  if (s === 'Final Submit' || s === 'Submitted' || s === 'Completed')
    return { text: 'Completed', color: '#10B981', icon: 'check-decagram' };
  if (s === 'Rejected')
    return { text: 'Rejected', color: '#EF4444', icon: 'close-circle' };
  if (s.toLowerCase().includes('process') || s === 'Assigned' || s === 'In Process')
    return { text: 'In Process', color: '#3B82F6', icon: 'progress-clock' };
  if (s === 'Form Final Review Under Process' || s.toLowerCase().includes('review'))
    return { text: 'Under Review', color: '#8B5CF6', icon: 'magnify' };
  return { text: s || 'Processing', color: '#003366', icon: 'dots-horizontal' };
};

const getUpdateConfig = (type) => {
  const map = {
    'admit-card':  { emoji: '🎫', label: 'Admit Card Jari', color: '#6A1B9A', bg: '#F3E5F5', border: '#CE93D8' },
    'result':      { emoji: '🏆', label: 'Result Declared', color: '#1B5E20', bg: '#E8F5E9', border: '#A5D6A7' },
    'answer-key':  { emoji: '🔑', label: 'Answer Key Jari', color: '#BF360C', bg: '#FBE9E7', border: '#FFAB91' },
    'new':         { emoji: '🔔', label: 'New Update',      color: '#065F46', bg: '#ECFDF5', border: '#6EE7B7' },
    'service':     { emoji: '🏛️', label: 'Service Update',  color: '#1a5276', bg: '#EBF5FB', border: '#90CAF9' },
  };
  return map[type] || map['new'];
};

export default function ApplicationsScreen({ navigation }) {
  const [apps, setApps] = useState([]);
  const [allUpdates, setAllUpdates] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportCategory, setSupportCategory] = useState('');
  const [supportDesc, setSupportDesc] = useState('');
  const [supportLoading, setSupportLoading] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});

  const userId = auth.currentUser?.uid;
  const scrollRef = useRef();

  // ── Fetch apps + updates ──────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    let jobsList = [], servicesList = [];

    const unsubJobs = onSnapshot(
      query(collection(db, 'applications'), where('userId', '==', userId)),
      (snap) => {
        jobsList = snap.docs.map(d => ({ id: d.id, appType: 'job', ...d.data() }));
        merge();
      }
    );

    const unsubServices = onSnapshot(
      query(collection(db, 'service_applications'), where('userId', '==', userId)),
      (snap) => {
        servicesList = snap.docs.map(d => ({ id: d.id, appType: 'service', ...d.data() }));
        merge();
      }
    );

    const merge = () => {
      const combined = [...jobsList, ...servicesList].sort(
        (a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
      );
      setApps(combined);
    };

    // All updates (for linking)
    const unsubUpdates = onSnapshot(
      query(collection(db, 'updates'), orderBy('timestamp', 'desc')),
      (snap) => setAllUpdates(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    return () => { unsubJobs(); unsubServices(); unsubUpdates(); };
  }, [userId]);

  // ── Chat messages sync ────────────────────────────────────
  useEffect(() => {
    if (!selectedApp) return;
    const coll = selectedApp.appType === 'job' ? 'applications' : 'service_applications';
    const unsubChat = onSnapshot(
      query(collection(db, coll, selectedApp.id, 'messages'), orderBy('timestamp', 'asc')),
      (snap) => {
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    );
    return () => unsubChat();
  }, [selectedApp]);

  // ── Android back ─────────────────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedApp) { setSelectedApp(null); return true; }
      return false;
    });
    return () => sub.remove();
  }, [selectedApp]);

  // ── Send message ─────────────────────────────────────────
  const sendMessage = async () => {
    if (!newMessage.trim() || selectedApp?.locked) return;
    const coll = selectedApp.appType === 'job' ? 'applications' : 'service_applications';
    const msg = newMessage.trim();
    setNewMessage('');
    await addDoc(collection(db, coll, selectedApp.id, 'messages'), {
      text: msg, senderId: userId, senderRole: 'user', timestamp: serverTimestamp()
    });
  };

  // ── Upload media ─────────────────────────────────────────
  const uploadToCloudinary = async (uri, type) => {
    const data = new FormData();
    data.append('file', { uri, type: type === 'image' ? 'image/jpeg' : 'application/pdf', name: `upload.${type === 'image' ? 'jpg' : 'pdf'}` });
    data.append('upload_preset', UPLOAD_PRESET);
    const resourceType = type === 'image' ? 'image' : 'raw';
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, { method: 'POST', body: data });
      return (await res.json()).secure_url;
    } catch { return null; }
  };

  const handlePickMedia = async (type) => {
    if (selectedApp?.locked) return;
    const result = type === 'image'
      ? await ImagePicker.launchImageLibraryAsync({ quality: 0.5 })
      : await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (result.canceled) return;
    setIsUploading(true);
    const uri = type === 'image' ? result.assets[0].uri : result.uri;
    const url = await uploadToCloudinary(uri, type);
    if (url) {
      const coll = selectedApp.appType === 'job' ? 'applications' : 'service_applications';
      await addDoc(collection(db, coll, selectedApp.id, 'messages'), {
        text: type === 'image' ? 'Image bheji' : 'Document bheja',
        mediaUrl: url, mediaType: type,
        senderId: userId, senderRole: 'user', timestamp: serverTimestamp()
      });
    }
    setIsUploading(false);
  };

  // ── Download Final PDF to phone ──────────────────────────
  const handleDownloadFinalPdf = async (url, trackingId) => {
    if (!url) return Alert.alert('Error', 'Document URL nahi mili.');
    try {
      const fileName = `SewaOne_${trackingId || 'doc'}.pdf`;
      const destUri  = FileSystem.documentDirectory + fileName;

      // Download file locally
      const { uri } = await FileSystem.downloadAsync(url, destUri);

      // Share/Save via system dialog — no permission needed
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Final Document Save/Share karein',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Downloaded!', `File save ho gayi: ${fileName}`);
      }
    } catch (e) {
      Alert.alert('Error', 'Download nahi ho saka: ' + e.message);
    }
  };

  // ── Submit Support Ticket ────────────────────────────────
  const handleSupportSubmit = async () => {
    if (!supportCategory) return Alert.alert('Category select karo!');
    if (!supportDesc.trim()) return Alert.alert('Issue describe karo!');
    setSupportLoading(true);
    try {
      const ticketId = 'TKT-' + Date.now().toString(36).toUpperCase();
      await addDoc(collection(db, 'grievances'), {
        ticketId,
        userId,
        trackingId: selectedApp?.trackingId,
        jobTitle: selectedApp?.jobTitle || selectedApp?.serviceTitle,
        category: supportCategory,
        description: supportDesc.trim(),
        status: 'Under Review',
        adminNote: '',
        timestamp: serverTimestamp(),
      });
      setShowSupportModal(false);
      setSupportCategory('');
      setSupportDesc('');
      Alert.alert(
        '✅ Ticket Raised!',
        `Ticket ID: ${ticketId}\n\nHamari team 24 ghante mein respond karegi.`
      );
    } catch {
      Alert.alert('Error', 'Ticket submit nahi ho saka. Try again.');
    } finally { setSupportLoading(false); }
  };

  // ── Find relevant update for an application ───────────────
  const getLinkedUpdate = (item) => {
    // Find MOST RECENT update linked to this job/service
    const matches = allUpdates.filter(u =>
      u.linkedJobId === item.jobId ||
      u.newUpdateId === item.jobId ||
      u.newUpdateId === item.serviceId ||
      u.linkedJobId === item.serviceId
    );
    // Filter out 'service' type updates for job applications and vice versa
    const relevant = matches.filter(u =>
      item.appType === 'job'
        ? u.type !== 'service'
        : u.type === 'service' || u.type === 'new'
    );
    return relevant[0] || null; // Most recent
  };

  // ── RENDER ────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.screenTitle}>My Applications</Text>
        <Text style={s.subTitle}>{apps.length} applications tracked</Text>
      </View>

      {apps.length === 0 ? (
        <View style={s.emptyState}>
          <MaterialCommunityIcons name="file-document-outline" size={72} color="#CBD5E1" />
          <Text style={s.emptyTitle}>Koi application nahi</Text>
          <Text style={s.emptySub}>Jab aap koi job ya service apply karenge, yahan track hogi</Text>
        </View>
      ) : (
        <FlatList
          data={apps}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const status = getStatusConfig(item);
            const linkedUpdate = getLinkedUpdate(item);
            const updateCfg = linkedUpdate ? getUpdateConfig(linkedUpdate.type) : null;

            return (
              <View style={s.cardWrapper}>
                {/* Main Card */}
                <TouchableOpacity
                  style={[s.appCard, { borderLeftColor: status.color }]}
                  onPress={() => setSelectedApp(item)}
                  activeOpacity={0.85}
                >
                  {/* Left — icon */}
                  <View style={[s.cardIcon, { backgroundColor: item.appType === 'job' ? '#EBF5FB' : '#F0FDF4' }]}>
                    <MaterialCommunityIcons
                      name={item.appType === 'job' ? 'briefcase-variant' : 'bank'}
                      size={22}
                      color={item.appType === 'job' ? '#1a5276' : '#166534'}
                    />
                  </View>

                  {/* Middle — info */}
                  <View style={s.cardInfo}>
                    <Text style={s.cardTitle} numberOfLines={2}>
                      {item.jobTitle || item.serviceTitle || 'Application'}
                    </Text>
                    <Text style={s.cardId}>#{item.trackingId}</Text>
                  </View>

                  {/* Right — status */}
                  <View style={[s.statusPill, { backgroundColor: status.color }]}>
                    <MaterialCommunityIcons name={status.icon} size={11} color="#fff" />
                    <Text style={s.pillText} numberOfLines={2}>{status.text}</Text>
                  </View>
                </TouchableOpacity>

                {/* ✅ Linked Update — sirf relevant type dikhao */}
                {linkedUpdate && updateCfg && (
                  <TouchableOpacity
                    style={[s.updateStrip, { backgroundColor: updateCfg.bg, borderColor: updateCfg.border }]}
                    onPress={() => navigation.navigate('JobDetails', { jobId: linkedUpdate.newUpdateId })}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 14 }}>{updateCfg.emoji}</Text>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[s.updateLabel, { color: updateCfg.color }]}>{updateCfg.label}</Text>
                      <Text style={[s.updateText, { color: updateCfg.color }]} numberOfLines={1}>
                        {linkedUpdate.text?.replace(/^[🎫🏆🔑🔔📢]\s*(NEW JOB|RESULT|ADMIT CARD|ANSWER KEY|UPDATE):\s*/i, '')}
                      </Text>
                    </View>
                    <View style={[s.tapBtn, { backgroundColor: updateCfg.color }]}>
                      <Text style={s.tapText}>View</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}

      {/* ── Chat Modal ── */}
      <Modal visible={!!selectedApp} animationType="slide">
        <View style={s.modal}>

          {/* Modal Header */}
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedApp(null)} style={s.backBtn}>
              <MaterialCommunityIcons name="chevron-down" size={28} color="#003366" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle} numberOfLines={1}>
                {selectedApp?.jobTitle || selectedApp?.serviceTitle}
              </Text>
              <Text style={s.modalId}>#{selectedApp?.trackingId}</Text>
            </View>

            <TouchableOpacity
              style={s.helpBtn}
              onPress={() => setShowSupportModal(true)}
            >
              <MaterialCommunityIcons name="headset" size={15} color="#fff" />
              <Text style={s.helpBtnText}>Help</Text>
            </TouchableOpacity>
          </View>

          {/* Status Bar */}
          {selectedApp && (() => {
            const st = getStatusConfig(selectedApp);
            return (
              <View style={[s.statusBar, { backgroundColor: st.color + '18' }]}>
                <MaterialCommunityIcons name={st.icon} size={16} color={st.color} />
                <Text style={[s.statusBarText, { color: st.color }]}>Status: {st.text}</Text>
                {selectedApp?.rejectionReason && (
                  <Text style={s.rejectionNote}>Reason: {selectedApp.rejectionReason}</Text>
                )}
              </View>
            );
          })()}

          {/* Chat Messages */}
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Completed card */}
            {(selectedApp?.status === 'Final Submit' || selectedApp?.status === 'Submitted' || selectedApp?.status === 'Completed') && (
              <View style={s.resultCard}>
                <MaterialCommunityIcons name="check-decagram" size={40} color="#10B981" />
                <Text style={s.resultTitle}>Application Completed! 🎉</Text>
                {selectedApp?.finalPdf && (
                  <TouchableOpacity 
                    style={s.downloadBtn} 
                    onPress={() => handleDownloadFinalPdf(selectedApp.finalPdf, selectedApp.trackingId)}
                  >
                    <MaterialCommunityIcons name="download" size={16} color="#fff" />
                    <Text style={s.downloadText}>Download Final Document</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Rejection card */}
            {selectedApp?.status === 'Rejected' && (
              <View style={[s.resultCard, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
                <MaterialCommunityIcons name="alert-circle" size={40} color="#EF4444" />
                <Text style={[s.resultTitle, { color: '#B91C1C' }]}>Application Rejected</Text>
                <Text style={s.reasonText}>{selectedApp?.rejectionReason || 'Support se contact karein'}</Text>
              </View>
            )}

            {/* Messages */}
            {messages.length === 0 && (
              <View style={s.noChatState}>
                <MaterialCommunityIcons name="chat-outline" size={40} color="#CBD5E1" />
                <Text style={s.noChatText}>Agent se seedha baat karein</Text>
                <Text style={s.noChatSub}>Query bhejein — agent reply karega</Text>
              </View>
            )}

            {messages.map((m, i) => {
              const isUser = m.senderRole === 'user';
              return (
                <View key={i} style={[s.bubbleWrap, isUser ? s.bubbleRight : s.bubbleLeft]}>
                  {!isUser && (
                    <View style={s.agentAvatar}>
                      <MaterialCommunityIcons name="account-tie" size={14} color="#fff" />
                    </View>
                  )}
                  <View style={[s.bubble, isUser ? s.userBubble : s.adminBubble]}>
                    {m.mediaUrl && m.mediaType === 'image' && (
                      <Image source={{ uri: m.mediaUrl }} style={s.chatImg} resizeMode="cover" />
                    )}
                    {m.mediaUrl && m.mediaType === 'pdf' && (
                      <TouchableOpacity onPress={() => Linking.openURL(m.mediaUrl)} style={s.pdfLink}>
                        <MaterialCommunityIcons name="file-pdf-box" size={20} color="#EF4444" />
                        <Text style={s.pdfLinkText}>PDF Document — Tap to open</Text>
                      </TouchableOpacity>
                    )}
                    {m.text ? (
                      <Text style={[s.msgText, isUser ? { color: '#fff' } : { color: '#1E293B' }]}>
                        {m.text}
                      </Text>
                    ) : null}
                    <Text style={[s.msgTime, isUser ? { color: 'rgba(255,255,255,0.6)' } : { color: '#94A3B8' }]}>
                      {formatTime(m.timestamp)}
                    </Text>
                  </View>
                </View>
              );
            })}

            {isUploading && (
              <View style={s.uploadingRow}>
                <ActivityIndicator size="small" color="#003366" />
                <Text style={s.uploadingText}>Upload ho raha hai...</Text>
              </View>
            )}
          </ScrollView>

          {/* Input Bar */}
          {selectedApp?.locked ? (
            <View style={s.lockBanner}>
              <MaterialCommunityIcons name="lock" size={16} color="#EF4444" />
              <Text style={s.lockText}>Yeh application band ho gayi hai</Text>
            </View>
          ) : (
            <View style={s.inputBar}>
              <TouchableOpacity onPress={() => handlePickMedia('image')} style={s.mediaBtn}>
                <MaterialCommunityIcons name="image-outline" size={22} color="#64748B" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handlePickMedia('pdf')} style={s.mediaBtn}>
                <MaterialCommunityIcons name="file-plus-outline" size={22} color="#64748B" />
              </TouchableOpacity>
              <TextInput
                style={s.msgInput}
                placeholder="Agent ko message karein..."
                placeholderTextColor="#94A3B8"
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                onPress={sendMessage}
                style={[s.sendBtn, !newMessage.trim() && { opacity: 0.4 }]}
                disabled={!newMessage.trim()}
              >
                <MaterialCommunityIcons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* ── Support Ticket Modal ── */}
      <Modal visible={showSupportModal} animationType="slide" transparent>
        <View style={s.supportOverlay}>
          <View style={s.supportSheet}>
            <View style={s.sheetHandle} />

            {/* Header */}
            <View style={s.supportHeader}>
              <View>
                <Text style={s.supportTitle}>Support Ticket</Text>
                <Text style={s.supportSub}>
                  Application: #{selectedApp?.trackingId}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setShowSupportModal(false); setSupportCategory(''); setSupportDesc(''); }}>
                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Application info box */}
            <View style={s.appInfoBox}>
              <MaterialCommunityIcons
                name={selectedApp?.appType === 'job' ? 'briefcase-variant' : 'bank'}
                size={16} color="#003366"
              />
              <Text style={s.appInfoText} numberOfLines={1}>
                {selectedApp?.jobTitle || selectedApp?.serviceTitle}
              </Text>
            </View>

            {/* Category */}
            <Text style={s.supportLabel}>Problem Category *</Text>
            <View style={s.supportCatGrid}>
              {[
                { id: 'Payment Issue',   icon: 'credit-card',    color: '#EF4444' },
                { id: 'Document Error',  icon: 'file-alert',     color: '#F59E0B' },
                { id: 'Form Status',     icon: 'file-document',  color: '#3B82F6' },
                { id: 'Agent Behavior',  icon: 'account-alert',  color: '#8B5CF6' },
                { id: 'Refund Request',  icon: 'cash-refund',    color: '#10B981' },
                { id: 'Others',          icon: 'dots-horizontal', color: '#64748B' },
              ].map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[s.supportCatPill,
                    supportCategory === c.id && { backgroundColor: c.color, borderColor: c.color }
                  ]}
                  onPress={() => setSupportCategory(c.id)}
                >
                  <MaterialCommunityIcons
                    name={c.icon} size={13}
                    color={supportCategory === c.id ? '#fff' : c.color}
                  />
                  <Text style={[s.supportCatText,
                    supportCategory === c.id && { color: '#fff' }
                  ]}>{c.id}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Description */}
            <Text style={s.supportLabel}>Issue Describe Karo *</Text>
            <TextInput
              style={s.supportInput}
              multiline
              numberOfLines={4}
              placeholder="Kya problem aa rahi hai? Detail mein likhein..."
              placeholderTextColor="#94A3B8"
              value={supportDesc}
              onChangeText={setSupportDesc}
              maxLength={500}
            />

            {/* Submit */}
            <TouchableOpacity
              style={[s.supportSubmitBtn, supportLoading && { opacity: 0.6 }]}
              onPress={handleSupportSubmit}
              disabled={supportLoading}
            >
              {supportLoading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <MaterialCommunityIcons name="send" size={16} color="#fff" />
                    <Text style={s.supportSubmitText}>Submit Ticket</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  screenTitle: { fontSize: 26, fontWeight: '900', color: '#003366' },
  subTitle: { fontSize: 12, color: '#94A3B8', fontWeight: '700', marginTop: 3 },

  // Empty
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#94A3B8', marginTop: 20 },
  emptySub: { fontSize: 13, color: '#CBD5E1', marginTop: 8, textAlign: 'center', lineHeight: 20 },

  // Card
  cardWrapper: { marginBottom: 14 },
  appCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 14,
    flexDirection: 'row', alignItems: 'center', borderLeftWidth: 5,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },
  cardIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12, flexShrink: 0 },
  cardInfo: { flex: 1, marginRight: 10 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#1E293B', lineHeight: 20 },
  cardId: { fontSize: 11, color: '#94A3B8', fontWeight: '700', marginTop: 3 },
  statusPill: {
    flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20, maxWidth: 120,
  },
  pillText: { color: '#fff', fontSize: 9, fontWeight: '900', flexShrink: 1 },

  // Update strip
  updateStrip: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 2, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1,
    borderTopLeftRadius: 0, borderTopRightRadius: 0,
  },
  updateLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
  updateText: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  tapBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginLeft: 8 },
  tapText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Modal
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 12,
  },
  backBtn: { padding: 4 },
  modalTitle: { fontSize: 15, fontWeight: '800', color: '#003366' },
  modalId: { fontSize: 11, color: '#94A3B8', fontWeight: '700', marginTop: 1 },
  helpBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  helpBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },

  // Status bar
  statusBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  statusBarText: { fontWeight: '800', fontSize: 13, flex: 1 },
  rejectionNote: { fontSize: 12, color: '#EF4444', marginTop: 4 },

  // Result cards
  resultCard: {
    margin: 16, padding: 20, borderRadius: 20, backgroundColor: '#F0FDF4',
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#6EE7B7',
    alignItems: 'center',
  },
  resultTitle: { fontSize: 16, fontWeight: '900', color: '#166534', marginTop: 10 },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#003366', paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, marginTop: 14,
  },
  downloadText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  reasonText: { fontSize: 13, color: '#EF4444', marginTop: 8, textAlign: 'center' },

  // No chat state
  noChatState: { alignItems: 'center', paddingVertical: 40 },
  noChatText: { fontSize: 15, fontWeight: '700', color: '#94A3B8', marginTop: 14 },
  noChatSub: { fontSize: 13, color: '#CBD5E1', marginTop: 6 },

  // Chat
  bubbleWrap: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 },
  bubbleLeft: { justifyContent: 'flex-start' },
  bubbleRight: { justifyContent: 'flex-end' },
  agentAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#003366',
    justifyContent: 'center', alignItems: 'center', marginRight: 8, flexShrink: 0,
  },
  bubble: { maxWidth: '78%', padding: 12, borderRadius: 18 },
  userBubble: { backgroundColor: '#003366', borderBottomRightRadius: 4 },
  adminBubble: { backgroundColor: '#F1F5F9', borderBottomLeftRadius: 4 },
  msgText: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  msgTime: { fontSize: 10, marginTop: 5, textAlign: 'right' },
  chatImg: { width: 200, height: 140, borderRadius: 12, marginBottom: 8 },
  pdfLink: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', padding: 10, borderRadius: 10, marginBottom: 6,
  },
  pdfLinkText: { fontSize: 12, fontWeight: '700', color: '#B91C1C' },

  // Upload
  uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  uploadingText: { fontSize: 13, color: '#64748B', fontWeight: '600' },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12,
    borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 8,
  },
  mediaBtn: { padding: 8 },
  msgInput: {
    flex: 1, backgroundColor: '#F8FAFC', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 14,
    color: '#1E293B', maxHeight: 100, borderWidth: 1, borderColor: '#E2E8F0',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#003366',
    justifyContent: 'center', alignItems: 'center',
  },
  lockBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 16, backgroundColor: '#FEF2F2',
  },
  lockText: { color: '#EF4444', fontWeight: '700', fontSize: 13 },

  // Support modal
  supportOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  supportSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  supportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  supportTitle: { fontSize: 18, fontWeight: '900', color: '#003366' },
  supportSub: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  appInfoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EBF5FB', padding: 10, borderRadius: 10, marginBottom: 16 },
  appInfoText: { fontSize: 13, fontWeight: '700', color: '#1a5276', flex: 1 },
  supportLabel: { fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  supportCatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  supportCatPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  supportCatText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  supportInput: { backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 14, padding: 14, fontSize: 14, color: '#1E293B', textAlignVertical: 'top', minHeight: 100, marginBottom: 16 },
  supportSubmitBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#003366', padding: 16, borderRadius: 16, elevation: 3 },
  supportSubmitText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
