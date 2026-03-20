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
  orderBy, addDoc, serverTimestamp, getDoc, doc,
} from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Config from '../../config';
import ApplicationTimeline from '../../components/ApplicationTimeline';
import { useAppTheme } from '../../context/ThemeContext';

const CLOUD_NAME    = Config.cloudinary.cloudName;
const UPLOAD_PRESET = Config.cloudinary.uploadPreset;

const formatTime = (ts) => {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Math.floor((new Date() - d) / 60000);
    if (diff < 1)    return 'Abhi';
    if (diff < 60)   return `${diff}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch { return ''; }
};

const getStatusConfig = (item) => {
  if (item.paymentMethod === 'upi' && (!item.paymentStatus || item.paymentStatus === 'pending'))
    return { text: 'Fee Verification', color: '#F59E0B', icon: 'clock-outline' };
  const s = item.status || '';
  if (['Final Submit', 'Submitted', 'Completed'].includes(s))
    return { text: 'Completed', color: '#10B981', icon: 'check-decagram' };
  if (s === 'Rejected')
    return { text: 'Rejected', color: '#EF4444', icon: 'close-circle' };
  if (s.toLowerCase().includes('process') || s === 'Assigned' || s === 'In Process')
    return { text: 'In Process', color: '#3B82F6', icon: 'progress-clock' };
  if (s.toLowerCase().includes('review'))
    return { text: 'Under Review', color: '#8B5CF6', icon: 'magnify' };
  return { text: s || 'Processing', color: '#003366', icon: 'dots-horizontal' };
};

const getUpdateConfig = (type) => {
  const map = {
    'admit-card': { emoji: '🎫', label: 'Admit Card Jari', color: '#6A1B9A', bg: '#F3E5F5', border: '#CE93D8' },
    'result':     { emoji: '🏆', label: 'Result Declared', color: '#1B5E20', bg: '#E8F5E9', border: '#A5D6A7' },
    'answer-key': { emoji: '🔑', label: 'Answer Key Jari', color: '#BF360C', bg: '#FBE9E7', border: '#FFAB91' },
    'new':        { emoji: '🔔', label: 'New Update',      color: '#065F46', bg: '#ECFDF5', border: '#6EE7B7' },
    'service':    { emoji: '🏛️', label: 'Service Update',  color: '#1a5276', bg: '#EBF5FB', border: '#90CAF9' },
  };
  return map[type] || map['new'];
};

// Detail tab options
const DETAIL_TABS = ['Timeline', 'Chat', 'Info'];

export default function ApplicationsScreen({ navigation }) {
  const { theme } = useAppTheme();
  const [apps, setApps]           = useState([]);
  const [allUpdates, setAllUpdates] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [detailTab, setDetailTab] = useState('Timeline');
  const [messages, setMessages]   = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportCategory, setSupportCategory] = useState('');
  const [supportDesc, setSupportDesc]         = useState('');
  const [supportLoading, setSupportLoading]   = useState(false);

  const userId    = auth.currentUser?.uid;
  const scrollRef = useRef();

  // ── Fetch apps ────────────────────────────────────────────
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
    const unsubUpdates = onSnapshot(
      query(collection(db, 'updates'), orderBy('timestamp', 'desc')),
      (snap) => setAllUpdates(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubJobs(); unsubServices(); unsubUpdates(); };
  }, [userId]);

  // ── Chat messages ─────────────────────────────────────────
  useEffect(() => {
    if (!selectedApp) return;
    const coll = selectedApp.appType === 'job' ? 'applications' : 'service_applications';
    const unsub = onSnapshot(
      query(collection(db, coll, selectedApp.id, 'messages'), orderBy('timestamp', 'asc')),
      (snap) => {
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    );
    return () => unsub();
  }, [selectedApp]);

  // ── Back button ───────────────────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedApp) { setSelectedApp(null); return true; }
      return false;
    });
    return () => sub.remove();
  }, [selectedApp]);

  // ── Chat lock check ─────────────────────────────────────
  const isChatLocked = (app) => {
    if (!app) return false;
    const s = (app.status || '').toLowerCase();
    return (
      app.locked === true ||
      s === 'completed' ||
      s === 'final submit' ||
      s === 'submitted' ||
      s === 'rejected'
    );
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || isChatLocked(selectedApp)) return;
    const coll = selectedApp.appType === 'job' ? 'applications' : 'service_applications';
    const msg  = newMessage.trim();
    setNewMessage('');
    await addDoc(collection(db, coll, selectedApp.id, 'messages'), {
      text: msg, senderId: userId, senderRole: 'user', timestamp: serverTimestamp(),
    });
  };

  const uploadToCloudinary = async (uri, type) => {
    const data = new FormData();
    data.append('file', { uri, type: type === 'image' ? 'image/jpeg' : 'application/pdf', name: `upload.${type === 'image' ? 'jpg' : 'pdf'}` });
    data.append('upload_preset', UPLOAD_PRESET);
    const rt = type === 'image' ? 'image' : 'raw';
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${rt}/upload`, { method: 'POST', body: data });
      return (await res.json()).secure_url;
    } catch { return null; }
  };

  const handlePickMedia = async (type) => {
    if (isChatLocked(selectedApp)) return;
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
        senderId: userId, senderRole: 'user', timestamp: serverTimestamp(),
      });
    }
    setIsUploading(false);
  };

  const handleDownload = async (url, trackingId) => {
    if (!url) return Alert.alert('Error', 'Document URL nahi mili.');
    try {
      const dest  = FileSystem.documentDirectory + `SewaOne_${trackingId}.pdf`;
      const { uri } = await FileSystem.downloadAsync(url, dest);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Document Save/Share' });
      } else {
        Alert.alert('Downloaded!', `File save ho gayi`);
      }
    } catch (e) { Alert.alert('Error', 'Download fail: ' + e.message); }
  };

  const handleSupportSubmit = async () => {
    if (!supportCategory) return Alert.alert('', 'Category select karo!');
    if (!supportDesc.trim()) return Alert.alert('', 'Issue describe karo!');
    setSupportLoading(true);
    try {
      const ticketId = 'TKT-' + Date.now().toString(36).toUpperCase();
      await addDoc(collection(db, 'grievances'), {
        ticketId, userId,
        trackingId:  selectedApp?.trackingId,
        jobTitle:    selectedApp?.jobTitle || selectedApp?.serviceTitle,
        category:    supportCategory,
        description: supportDesc.trim(),
        status:      'Under Review',
        adminNote:   '',
        timestamp:   serverTimestamp(),
      });
      setShowSupportModal(false);
      setSupportCategory('');
      setSupportDesc('');
      Alert.alert('✅ Ticket Raised!', `Ticket ID: ${ticketId}\n\nHamari team 24 ghante mein respond karegi.`);
    } catch { Alert.alert('Error', 'Ticket submit fail. Try again.'); }
    finally { setSupportLoading(false); }
  };

  const getLinkedUpdate = (item) => {
    const matches = allUpdates.filter(u =>
      u.linkedJobId === item.jobId || u.newUpdateId === item.jobId ||
      u.newUpdateId === item.serviceId || u.linkedJobId === item.serviceId
    );
    return matches.filter(u =>
      item.appType === 'job' ? u.type !== 'service' : true
    )[0] || null;
  };

  const openApp = (item) => {
    setSelectedApp(item);
    setDetailTab('Timeline');
    setMessages([]);
  };

  // ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.bg }]}>

      {/* Header */}
      <View style={[s.header, { backgroundColor: '#002855' }]}>
        <Text style={s.headerTitle}>My Applications</Text>
        <Text style={s.headerSub}>{apps.length} applications tracked</Text>
      </View>

      {apps.length === 0 ? (
        <View style={s.empty}>
          <MaterialCommunityIcons name="file-document-outline" size={72} color="#CBD5E1" />
          <Text style={[s.emptyTitle, { color: theme.textMuted }]}>No applications yet</Text>
          <Text style={[s.emptySub, { color: theme.textMuted }]}>
            Apply for jobs or services — they'll be tracked here
          </Text>
        </View>
      ) : (
        <FlatList
          data={apps}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const status      = getStatusConfig(item);
            const linkedUpdate = getLinkedUpdate(item);
            const updateCfg   = linkedUpdate ? getUpdateConfig(linkedUpdate.type) : null;
            return (
              <View style={s.cardWrap}>
                <TouchableOpacity
                  style={[s.card, { backgroundColor: theme.card, borderLeftColor: status.color }]}
                  onPress={() => openApp(item)}
                  activeOpacity={0.85}
                >
                  <View style={[s.cardIcon, {
                    backgroundColor: item.appType === 'job' ? '#EBF5FB' : '#F0FDF4',
                  }]}>
                    <MaterialCommunityIcons
                      name={item.appType === 'job' ? 'briefcase-variant' : 'bank'}
                      size={22}
                      color={item.appType === 'job' ? '#1a5276' : '#166534'}
                    />
                  </View>
                  <View style={s.cardInfo}>
                    <Text style={[s.cardTitle, { color: theme.text }]} numberOfLines={2}>
                      {item.jobTitle || item.serviceTitle || 'Application'}
                    </Text>
                    <Text style={[s.cardId, { color: theme.textMuted }]}>
                      #{item.trackingId}
                    </Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: status.color }]}>
                    <MaterialCommunityIcons name={status.icon} size={11} color="#fff" />
                    <Text style={s.pillText} numberOfLines={1}>{status.text}</Text>
                  </View>
                </TouchableOpacity>

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
                    <View style={[s.viewBtn, { backgroundColor: updateCfg.color }]}>
                      <Text style={s.viewBtnText}>View</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}

      {/* ── Detail Modal ── */}
      <Modal visible={!!selectedApp} animationType="slide">
        <SafeAreaView style={[s.modal, { backgroundColor: theme.bg }]}>

          {/* Modal Header */}
          <View style={[s.modalHeader, { backgroundColor: '#002855' }]}>
            <TouchableOpacity style={s.modalBackBtn} onPress={() => setSelectedApp(null)}>
              <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle} numberOfLines={1}>
                {selectedApp?.jobTitle || selectedApp?.serviceTitle}
              </Text>
              <Text style={s.modalId}>#{selectedApp?.trackingId}</Text>
            </View>
            <TouchableOpacity style={s.helpBtn} onPress={() => setShowSupportModal(true)}>
              <MaterialCommunityIcons name="headset" size={15} color="#fff" />
              <Text style={s.helpBtnText}>Help</Text>
            </TouchableOpacity>
          </View>

          {/* Tab bar */}
          <View style={[s.tabBar, { backgroundColor: theme.card }]}>
            {DETAIL_TABS.map(tab => (
              <TouchableOpacity
                key={tab}
                style={[s.tab, detailTab === tab && s.tabActive]}
                onPress={() => setDetailTab(tab)}
              >
                <Text style={[s.tabText, detailTab === tab && s.tabTextActive]}>
                  {tab === 'Timeline' ? '📊 Timeline'
                    : tab === 'Chat'  ? '💬 Chat'
                    :                   'ℹ️ Info'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── TIMELINE TAB ── */}
          {detailTab === 'Timeline' && (
            <ScrollView
              contentContainerStyle={{ padding: 20 }}
              showsVerticalScrollIndicator={false}
            >
              <ApplicationTimeline app={selectedApp} theme={theme} />

              {/* Completed — download button */}
              {['Final Submit', 'Submitted', 'Completed'].includes(selectedApp?.status) && (
                <View style={[s.completedCard, { backgroundColor: '#ECFDF5' }]}>
                  <MaterialCommunityIcons name="check-decagram" size={36} color="#10B981" />
                  <Text style={s.completedTitle}>Application Complete! 🎉</Text>
                  {selectedApp?.finalPdf && (
                    <TouchableOpacity
                      style={s.downloadBtn}
                      onPress={() => handleDownload(selectedApp.finalPdf, selectedApp.trackingId)}
                    >
                      <MaterialCommunityIcons name="download" size={16} color="#fff" />
                      <Text style={s.downloadBtnText}>Download Final Document</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Rejected */}
              {selectedApp?.status === 'Rejected' && (
                <View style={[s.completedCard, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
                  <MaterialCommunityIcons name="alert-circle" size={36} color="#EF4444" />
                  <Text style={[s.completedTitle, { color: '#B91C1C' }]}>Application Rejected</Text>
                  <Text style={[s.completedSub, { color: '#EF4444' }]}>
                    {selectedApp?.rejectionReason || 'Contact support for details'}
                  </Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* ── CHAT TAB ── */}
          {detailTab === 'Chat' && (
            <>
              <ScrollView
                ref={scrollRef}
                contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
              >
                {messages.length === 0 && (
                  <View style={s.noChatWrap}>
                    <MaterialCommunityIcons name="chat-outline" size={44} color="#CBD5E1" />
                    <Text style={[s.noChatTitle, { color: theme.textMuted }]}>
                      Chat with Agent
                    </Text>
                    <Text style={[s.noChatSub, { color: theme.textMuted }]}>
                      Send a message — agent will reply
                    </Text>
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
                      <View style={[s.bubble, isUser ? s.userBubble : [s.agentBubble, { backgroundColor: theme.card }]]}>
                        {m.mediaUrl && m.mediaType === 'image' && (
                          <Image source={{ uri: m.mediaUrl }} style={s.chatImg} resizeMode="cover" />
                        )}
                        {m.mediaUrl && m.mediaType === 'pdf' && (
                          <TouchableOpacity onPress={() => Linking.openURL(m.mediaUrl)} style={s.pdfLink}>
                            <MaterialCommunityIcons name="file-pdf-box" size={20} color="#EF4444" />
                            <Text style={s.pdfText}>PDF — Tap to open</Text>
                          </TouchableOpacity>
                        )}
                        {m.text ? (
                          <Text style={[s.msgText, { color: isUser ? '#fff' : theme.text }]}>
                            {m.text}
                          </Text>
                        ) : null}
                        <Text style={[s.msgTime, { color: isUser ? 'rgba(255,255,255,0.6)' : theme.textMuted }]}>
                          {formatTime(m.timestamp)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
                {isUploading && (
                  <View style={s.uploadRow}>
                    <ActivityIndicator size="small" color="#003366" />
                    <Text style={[s.uploadText, { color: theme.textMuted }]}>Uploading...</Text>
                  </View>
                )}
              </ScrollView>

              {/* Input */}
              <View style={[s.inputBar, { backgroundColor: theme.card }]}>
                <TouchableOpacity onPress={() => handlePickMedia('image')} style={s.mediaBtn}>
                  <MaterialCommunityIcons name="image-outline" size={22} color="#64748B" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handlePickMedia('pdf')} style={s.mediaBtn}>
                  <MaterialCommunityIcons name="file-plus-outline" size={22} color="#64748B" />
                </TouchableOpacity>
                <TextInput
                  style={[s.msgInput, { backgroundColor: theme.surface, color: theme.text }]}
                  placeholder="Message agent..."
                  placeholderTextColor={theme.textMuted}
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
            </>
          )}

          {/* ── INFO TAB ── */}
          {detailTab === 'Info' && (
            <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
              <View style={[s.infoCard, { backgroundColor: theme.card }]}>
                <Text style={[s.infoSectionTitle, { color: theme.text }]}>Application Details</Text>
                {[
                  { label: 'Tracking ID',    val: selectedApp?.trackingId },
                  { label: 'Type',           val: selectedApp?.appType === 'job' ? 'Government Job' : 'Citizen Service' },
                  { label: 'Payment Method', val: selectedApp?.paymentMethod?.toUpperCase() },
                  { label: 'Amount Paid',    val: `₹${selectedApp?.feeDetails?.totalPaid || 0}` },
                  { label: 'Submitted On',   val: selectedApp?.timestamp?.toDate
                    ? selectedApp.timestamp.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
                    : '—'
                  },
                ].map((row, i) => (
                  <View key={i} style={[s.infoRow, { borderBottomColor: theme.border }]}>
                    <Text style={[s.infoLabel, { color: theme.textMuted }]}>{row.label}</Text>
                    <Text style={[s.infoVal, { color: theme.text }]}>{row.val || '—'}</Text>
                  </View>
                ))}
              </View>

              {/* Form data */}
              {selectedApp?.formData && (
                <View style={[s.infoCard, { backgroundColor: theme.card, marginTop: 12 }]}>
                  <Text style={[s.infoSectionTitle, { color: theme.text }]}>Submitted Form Data</Text>
                  {Object.entries(selectedApp.formData).map(([k, v], i) => (
                    <View key={i} style={[s.infoRow, { borderBottomColor: theme.border }]}>
                      <Text style={[s.infoLabel, { color: theme.textMuted }]}>{k}</Text>
                      <Text style={[s.infoVal, { color: theme.text }]}>{v}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          )}

        </SafeAreaView>
      </Modal>

      {/* ── Support Modal ── */}
      <Modal visible={showSupportModal} animationType="slide" transparent>
        <View style={s.supportOverlay}>
          <View style={[s.supportSheet, { backgroundColor: theme.card }]}>
            <View style={s.sheetHandle} />
            <View style={s.supportHead}>
              <View>
                <Text style={[s.supportTitle, { color: theme.text }]}>Support Ticket</Text>
                <Text style={[s.supportSub, { color: theme.textMuted }]}>#{selectedApp?.trackingId}</Text>
              </View>
              <TouchableOpacity onPress={() => { setShowSupportModal(false); setSupportCategory(''); setSupportDesc(''); }}>
                <MaterialCommunityIcons name="close" size={24} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[s.supportLabel, { color: theme.textMuted }]}>Problem Category *</Text>
            <View style={s.catGrid}>
              {[
                { id: 'Payment Issue',  icon: 'credit-card',    color: '#EF4444' },
                { id: 'Document Error', icon: 'file-alert',     color: '#F59E0B' },
                { id: 'Form Status',    icon: 'file-document',  color: '#3B82F6' },
                { id: 'Agent Behavior', icon: 'account-alert',  color: '#8B5CF6' },
                { id: 'Refund Request', icon: 'cash-refund',    color: '#10B981' },
                { id: 'Others',         icon: 'dots-horizontal', color: '#64748B' },
              ].map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[s.catPill, supportCategory === c.id && { backgroundColor: c.color, borderColor: c.color }]}
                  onPress={() => setSupportCategory(c.id)}
                >
                  <MaterialCommunityIcons name={c.icon} size={13} color={supportCategory === c.id ? '#fff' : c.color} />
                  <Text style={[s.catText, supportCategory === c.id && { color: '#fff' }]}>{c.id}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.supportLabel, { color: theme.textMuted }]}>Describe Your Issue *</Text>
            <TextInput
              style={[s.supportInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
              multiline
              numberOfLines={4}
              placeholder="What's the problem? Please describe in detail..."
              placeholderTextColor={theme.textMuted}
              value={supportDesc}
              onChangeText={setSupportDesc}
              maxLength={500}
            />

            <TouchableOpacity
              style={[s.submitBtn, supportLoading && { opacity: 0.6 }]}
              onPress={handleSupportSubmit}
              disabled={supportLoading}
            >
              {supportLoading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <MaterialCommunityIcons name="send" size={16} color="#fff" />
                    <Text style={s.submitBtnText}>Submit Ticket</Text>
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
  safe:         { flex: 1 },
  header:       { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle:  { fontSize: 24, fontWeight: '900', color: '#fff' },
  headerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '700', marginTop: 3 },

  empty:        { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle:   { fontSize: 18, fontWeight: '800', marginTop: 20 },
  emptySub:     { fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 },

  cardWrap:     { marginBottom: 14 },
  card:         { borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 5, elevation: 2 },
  cardIcon:     { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12, flexShrink: 0 },
  cardInfo:     { flex: 1, marginRight: 10 },
  cardTitle:    { fontSize: 14, fontWeight: '800', lineHeight: 20 },
  cardId:       { fontSize: 11, fontWeight: '700', marginTop: 3 },
  statusPill:   { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20, maxWidth: 110 },
  pillText:     { color: '#fff', fontSize: 9, fontWeight: '900' },

  updateStrip:  { flexDirection: 'row', alignItems: 'center', marginTop: 2, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  updateLabel:  { fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
  updateText:   { fontSize: 12, fontWeight: '600', marginTop: 1 },
  viewBtn:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginLeft: 8 },
  viewBtnText:  { color: '#fff', fontSize: 10, fontWeight: '800' },

  modal:        { flex: 1 },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  modalBackBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  modalTitle:   { fontSize: 15, fontWeight: '800', color: '#fff' },
  modalId:      { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '700', marginTop: 1 },
  helpBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  helpBtnText:  { color: '#fff', fontWeight: '900', fontSize: 12 },

  tabBar:       { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tab:          { flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center', backgroundColor: '#F1F5F9' },
  tabActive:    { backgroundColor: '#002855' },
  tabText:      { fontSize: 12, fontWeight: '700', color: '#64748B' },
  tabTextActive:{ color: '#fff', fontWeight: '900' },

  completedCard:{ borderRadius: 20, padding: 20, alignItems: 'center', marginTop: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#6EE7B7' },
  completedTitle:{ fontSize: 16, fontWeight: '900', color: '#166534', marginTop: 10 },
  completedSub: { fontSize: 13, marginTop: 6, textAlign: 'center' },
  downloadBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#002855', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 14 },
  downloadBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  noChatWrap:   { alignItems: 'center', paddingVertical: 50 },
  noChatTitle:  { fontSize: 15, fontWeight: '700', marginTop: 14 },
  noChatSub:    { fontSize: 13, marginTop: 6 },

  bubbleWrap:   { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 },
  bubbleLeft:   { justifyContent: 'flex-start' },
  bubbleRight:  { justifyContent: 'flex-end' },
  agentAvatar:  { width: 28, height: 28, borderRadius: 14, backgroundColor: '#003366', justifyContent: 'center', alignItems: 'center', marginRight: 8, flexShrink: 0 },
  bubble:       { maxWidth: '78%', padding: 12, borderRadius: 18 },
  userBubble:   { backgroundColor: '#003366', borderBottomRightRadius: 4 },
  agentBubble:  { borderBottomLeftRadius: 4 },
  msgText:      { fontSize: 14, lineHeight: 20 },
  msgTime:      { fontSize: 10, marginTop: 5, textAlign: 'right' },
  chatImg:      { width: 200, height: 140, borderRadius: 12, marginBottom: 8 },
  pdfLink:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', padding: 10, borderRadius: 10, marginBottom: 6 },
  pdfText:      { fontSize: 12, fontWeight: '700', color: '#B91C1C' },
  uploadRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  uploadText:   { fontSize: 13, fontWeight: '600' },
  inputBar:     { flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 8 },
  mediaBtn:     { padding: 8 },
  msgInput:     { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: '#E2E8F0' },
  sendBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#003366', justifyContent: 'center', alignItems: 'center' },

  infoCard:     { borderRadius: 18, padding: 16, elevation: 1 },
  infoSectionTitle: { fontSize: 14, fontWeight: '900', marginBottom: 14 },
  infoRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  infoLabel:    { fontSize: 12, fontWeight: '700' },
  infoVal:      { fontSize: 13, fontWeight: '800', textAlign: 'right', flex: 1, marginLeft: 16 },

  supportOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  supportSheet:   { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  sheetHandle:    { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  supportHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  supportTitle:   { fontSize: 18, fontWeight: '900' },
  supportSub:     { fontSize: 12, fontWeight: '600', marginTop: 2 },
  supportLabel:   { fontSize: 11, fontWeight: '800', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  catGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  catPill:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  catText:        { fontSize: 11, fontWeight: '700', color: '#475569' },
  supportInput:   { borderWidth: 1.5, borderRadius: 14, padding: 14, fontSize: 14, textAlignVertical: 'top', minHeight: 100, marginBottom: 16 },
  submitBtn:      { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#002855', padding: 16, borderRadius: 16 },
  submitBtnText:  { color: '#fff', fontWeight: '900', fontSize: 15 },
  lockBanner:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  lockText:       { color: '#EF4444', fontWeight: '700', fontSize: 13, flex: 1, textAlign: 'center' },
});
