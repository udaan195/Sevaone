import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, 
  TextInput, ScrollView, Linking, SafeAreaView, Image, ActivityIndicator, Alert 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { db, auth } from '../../api/firebaseConfig';
import { 
  collection, query, where, onSnapshot, 
  orderBy, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const CLOUD_NAME = "dxuurwexl";
const UPLOAD_PRESET = "edusphere_uploads";

export default function ApplicationsScreen({ navigation }) {
  const [apps, setApps] = useState([]);
  const [recentUpdates, setRecentUpdates] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  const userId = auth.currentUser?.uid;
  const scrollViewRef = useRef();

  // 1. Fetch Both Collections (Jobs & Services)
  useEffect(() => {
    if (!userId) return;

    // A. Jobs Collection Sync
    const qJobs = query(collection(db, "applications"), where("userId", "==", userId));
    // B. Services Collection Sync
    const qServices = query(collection(db, "service_applications"), where("userId", "==", userId));

    let jobsList = [];
    let servicesList = [];

    const unsubJobs = onSnapshot(qJobs, (snap) => {
      jobsList = snap.docs.map(doc => ({ id: doc.id, appType: 'job', ...doc.data() }));
      mergeAndSort();
    });

    const unsubServices = onSnapshot(qServices, (snap) => {
      servicesList = snap.docs.map(doc => ({ id: doc.id, appType: 'service', ...doc.data() }));
      mergeAndSort();
    });

    const mergeAndSort = () => {
      const combined = [...jobsList, ...servicesList].sort((a, b) => 
        (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
      );
      setApps(combined);
    };

    // Updates Sync
    const qUpdates = query(collection(db, "updates"), orderBy("timestamp", "desc"));
    const unsubUpdates = onSnapshot(qUpdates, (snap) => {
      setRecentUpdates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubJobs(); unsubServices(); unsubUpdates(); };
  }, [userId]);

  // 2. Dynamic Chat Sync based on App Type
  useEffect(() => {
    if (!selectedApp) return;
    const collectionName = selectedApp.appType === 'job' ? "applications" : "service_applications";
    const qChat = query(collection(db, collectionName, selectedApp.id, "messages"), orderBy("timestamp", "asc"));
    const unsubChat = onSnapshot(qChat, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubChat();
  }, [selectedApp]);

  const getStatusDisplay = (item) => {
    // Handling Payment Status first
    if (item.paymentMethod === 'upi' && (item.paymentStatus === 'pending' || !item.paymentStatus)) {
      return { text: "Fee Verification Pending", color: "#F59E0B" };
    }
    // Completed status logic for both types
    if (item.status === 'Final Submit' || item.status === 'Submitted') return { text: "Completed", color: "#10B981" };
    if (item.status === 'Rejected') return { text: "Rejected", color: "#EF4444" };
    
    return { text: (item.status || "Processing").toUpperCase(), color: "#003366" };
  };

  const uploadToCloudinary = async (uri, type) => {
    const data = new FormData();
    data.append("file", { 
      uri, 
      type: type === 'image' ? 'image/jpeg' : 'application/pdf', 
      name: `upload.${type === 'image' ? 'jpg' : 'pdf'}` 
    });
    data.append("upload_preset", UPLOAD_PRESET);
    const resourceType = type === 'image' ? 'image' : 'raw';
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, { method: "POST", body: data });
      const fileData = await res.json();
      return fileData.secure_url;
    } catch (error) { return null; }
  };

  const handlePickMedia = async (type) => {
    if (selectedApp.locked) return;
    let result = type === 'image' ? await ImagePicker.launchImageLibraryAsync({ quality: 0.5 }) : await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });

    if (!result.canceled) {
      setIsUploading(true);
      const uri = type === 'image' ? result.assets[0].uri : result.uri;
      const url = await uploadToCloudinary(uri, type);
      if (url) {
        const coll = selectedApp.appType === 'job' ? "applications" : "service_applications";
        await addDoc(collection(db, coll, selectedApp.id, "messages"), {
          text: `Sent a ${type}`, mediaUrl: url, mediaType: type,
          senderId: userId, senderRole: 'user', timestamp: serverTimestamp()
        });
      }
      setIsUploading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || selectedApp.locked) return;
    const coll = selectedApp.appType === 'job' ? "applications" : "service_applications";
    await addDoc(collection(db, coll, selectedApp.id, "messages"), {
      text: newMessage, senderId: userId, senderRole: 'user', timestamp: serverTimestamp()
    });
    setNewMessage("");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>My Portfolio</Text>
        <Text style={styles.subTitle}>Track your Job forms & Citizen services</Text>
      </View>

      <FlatList 
        data={apps}
        contentContainerStyle={{ padding: 20 }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const status = getStatusDisplay(item);
          const linkedUpdate = recentUpdates.find(u => u.linkedJobId === item.jobId || u.newUpdateId === item.serviceId);

          return (
            <View style={{ marginBottom: 15 }}>
              <TouchableOpacity style={styles.appCard} onPress={() => setSelectedApp(item)}>
                <View style={styles.cardInfo}>
                  {/* ✨ Dynamic Title for Job vs Service */}
                  <Text style={styles.jobTitle}>{item.jobTitle || item.serviceTitle}</Text>
                  <Text style={styles.trackText}>ID: #{item.trackingId} | {item.appType?.toUpperCase()}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: status.color }]}>
                  <Text style={styles.pillText}>{status.text}</Text>
                </View>
              </TouchableOpacity>

              {linkedUpdate && (
                <TouchableOpacity style={styles.linkedUpdateBox} onPress={() => navigation.navigate('Home', { screen: item.appType === 'job' ? 'JobDetails' : 'ServiceDetails', params: { jobId: linkedUpdate.newUpdateId } })}>
                  <MaterialCommunityIcons name="bell-ring" size={14} color="#10B981" />
                  <Text style={styles.linkedUpdateText}>UPDATE: {linkedUpdate.text}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />

      {/* --- LIVE TRACKING & CHAT MODAL --- */}
      <Modal visible={!!selectedApp} animationType="slide">
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedApp(null)}><MaterialCommunityIcons name="chevron-down" size={32} color="#003366" /></TouchableOpacity>
            <Text style={styles.headerTitle}>Application Desk</Text>
            <MaterialCommunityIcons name="shield-check" size={24} color="#003366" />
          </View>

          <ScrollView ref={scrollViewRef} onContentSizeChange={() => scrollViewRef.current.scrollToEnd({ animated: true })}>
            {/* Success Card */}
            {(selectedApp?.status === 'Final Submit' || selectedApp?.status === 'Submitted') && (
              <View style={styles.resultCard}>
                <MaterialCommunityIcons name="check-decagram" size={45} color="#10B981" />
                <Text style={styles.resultTitle}>Application Completed!</Text>
                <TouchableOpacity style={styles.downloadBtn} onPress={() => Linking.openURL(selectedApp.finalPdf)}>
                  <Text style={styles.downloadText}>DOWNLOAD FINAL DOCUMENT</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Rejection Card */}
            {selectedApp?.status === 'Rejected' && (
              <View style={[styles.resultCard, { backgroundColor: '#FEF2F2', borderColor: '#EF4444' }]}>
                <MaterialCommunityIcons name="alert-circle" size={45} color="#EF4444" />
                <Text style={[styles.resultTitle, { color: '#B91C1C' }]}>Application Rejected</Text>
                <Text style={styles.reasonText}>Reason: {selectedApp.rejectionReason || "Check with Support"}</Text>
              </View>
            )}

            <View style={styles.chatContainer}>
              {messages.map((m, i) => (
                <View key={i} style={[styles.bubble, m.senderRole === 'user' ? styles.userBubble : styles.adminBubble]}>
                  {m.mediaUrl && m.mediaType === 'image' && <Image source={{ uri: m.mediaUrl }} style={styles.chatImg} />}
                  {m.mediaUrl && m.mediaType === 'pdf' && (
                    <TouchableOpacity onPress={() => Linking.openURL(m.mediaUrl)} style={styles.pdfMsgLink}>
                      <MaterialCommunityIcons name="file-pdf-box" size={18} color="#003366" />
                      <Text style={styles.pdfMsgText}>View PDF Attachment</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={[styles.msgText, m.senderRole === 'user' ? { color: '#fff' } : { color: '#1E293B' }]}>{m.text}</Text>
                </View>
              ))}
              {isUploading && <ActivityIndicator color="#003366" />}
            </View>
          </ScrollView>

          {!selectedApp?.locked ? (
            <View style={styles.inputBar}>
              <TouchableOpacity onPress={() => handlePickMedia('image')} style={styles.actionBtn}><MaterialCommunityIcons name="image" size={24} color="#64748B" /></TouchableOpacity>
              <TouchableOpacity onPress={() => handlePickMedia('pdf')} style={styles.actionBtn}><MaterialCommunityIcons name="file-plus" size={24} color="#64748B" /></TouchableOpacity>
              <TextInput style={styles.textInput} placeholder="Type your query..." value={newMessage} onChangeText={setNewMessage} />
              <TouchableOpacity onPress={sendMessage}><MaterialCommunityIcons name="send" size={26} color="#003366" /></TouchableOpacity>
            </View>
          ) : (
            <View style={styles.lockBanner}><Text style={styles.lockText}>🔒 This application is now closed for chat.</Text></View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 25 },
  screenTitle: { fontSize: 28, fontWeight: '900', color: '#003366' },
  subTitle: { fontSize: 13, color: '#64748B', fontWeight: 'bold', marginTop: 5 },
  appCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, elevation: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderLeftWidth: 6, borderLeftColor: '#003366' },
  jobTitle: { fontSize: 15, fontWeight: '900', color: '#1E293B' },
  trackText: { fontSize: 9, color: '#94A3B8', fontWeight: '900', marginTop: 5 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  pillText: { color: '#fff', fontSize: 8, fontWeight: '900' },
  linkedUpdateBox: { backgroundColor: '#ECFDF5', marginHorizontal: 15, marginTop: -10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#10B981', borderStyle: 'dashed', zIndex: -1, flexDirection:'row', alignItems:'center', gap:8 },
  linkedUpdateText: { color: '#065F46', fontSize: 10, fontWeight: '900' },
  modalContent: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#F1F5F9', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#003366' },
  resultCard: { margin: 20, padding: 25, borderRadius: 25, backgroundColor: '#F0FDF4', borderStyle: 'dashed', borderWidth: 2, borderColor: '#10B981', alignItems: 'center' },
  resultTitle: { fontSize: 16, fontWeight: '900', color: '#15803D', marginTop: 10 },
  downloadBtn: { backgroundColor: '#003366', padding: 15, borderRadius: 12, width: '100%', alignItems: 'center', marginTop: 15 },
  downloadText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  chatContainer: { padding: 20 },
  bubble: { padding: 12, borderRadius: 18, marginBottom: 10, maxWidth: '85%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#003366', borderBottomRightRadius: 2 },
  adminBubble: { alignSelf: 'flex-start', backgroundColor: '#F1F5F9', borderBottomLeftRadius: 2 },
  msgText: { fontSize: 13, fontWeight: '600' },
  chatImg: { width: 200, height: 130, borderRadius: 15, marginBottom: 8 },
  pdfMsgLink: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E2E8F0', padding: 10, borderRadius: 10, marginBottom: 5 },
  pdfMsgText: { fontSize: 11, fontWeight: '800', color: '#003366', marginLeft: 8 },
  inputBar: { flexDirection: 'row', padding: 15, alignItems: 'center', borderTopWidth: 1, borderColor: '#F1F5F9' },
  actionBtn: { marginRight: 15 },
  textInput: { flex: 1, backgroundColor: '#F1F5F9', padding: 12, borderRadius: 25, paddingHorizontal: 20, fontWeight: '600', marginRight: 10 },
  lockBanner: { padding: 18, backgroundColor: '#FEF2F2', alignItems: 'center' },
  lockText: { color: '#EF4444', fontWeight: '900', fontSize: 12 }
});
