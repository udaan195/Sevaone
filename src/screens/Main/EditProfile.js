import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView,
  Platform, Modal, FlatList, Animated, SafeAreaView, Image,
} from 'react-native';
import { db, auth } from '../../api/firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { verifyBeforeUpdateEmail } from 'firebase/auth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';

const CLOUD_NAME    = Constants?.expoConfig?.extra?.cloudinaryCloudName    || 'dxuurwexl';
const UPLOAD_PRESET = Constants?.expoConfig?.extra?.cloudinaryUploadPreset || 'edusphere_uploads';

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman & Nicobar','Chandigarh','Dadra & Nagar Haveli','Daman & Diu',
  'Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry',
];

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

// ── Floating Label Input ─────────────────────────────────
const FloatInput = ({ label, value, icon, error, ...props }) => {
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: focused || value ? 1 : 0,
      duration: 170, useNativeDriver: false,
    }).start();
  }, [focused, value]);

  return (
    <View style={fi.wrap}>
      <Animated.Text style={[fi.label, {
        top:      anim.interpolate({ inputRange:[0,1], outputRange:[17,  -9] }),
        fontSize: anim.interpolate({ inputRange:[0,1], outputRange:[15,  11] }),
        color:    anim.interpolate({ inputRange:[0,1], outputRange:['#94A3B8','#002855'] }),
      }]}>
        {label}
      </Animated.Text>
      {icon && (
        <MaterialCommunityIcons
          name={icon} size={18}
          color={focused ? '#002855' : '#94A3B8'}
          style={fi.icon}
        />
      )}
      <TextInput
        style={[fi.input, icon && { paddingLeft: 42 }, focused && fi.focused, error && fi.errBorder]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        value={value}
        {...props}
      />
      {error && <Text style={fi.err}>{error}</Text>}
    </View>
  );
};

const fi = StyleSheet.create({
  wrap:     { marginBottom: 8, paddingTop: 10 },
  label:    { position:'absolute', left:14, backgroundColor:'#F0F4FF', paddingHorizontal:5, fontWeight:'600', zIndex:1 },
  icon:     { position:'absolute', left:14, top:26, zIndex:2 },
  input:    { borderWidth:1.5, borderColor:'#E2E8F0', borderRadius:14, padding:15, fontSize:15, color:'#1E293B', backgroundColor:'#fff' },
  focused:  { borderColor:'#002855', backgroundColor:'#fff' },
  errBorder:{ borderColor:'#EF4444' },
  err:      { fontSize:11, color:'#EF4444', fontWeight:'700', marginTop:4, marginLeft:4 },
});

// ── Picker Row ───────────────────────────────────────────
const PickerRow = ({ label, value, icon, onPress, placeholder }) => (
  <TouchableOpacity style={pr.wrap} onPress={onPress} activeOpacity={0.85}>
    <View style={pr.inner}>
      {icon && <MaterialCommunityIcons name={icon} size={18} color={value ? '#002855' : '#94A3B8'} style={pr.icon} />}
      <View style={{ flex:1 }}>
        <Text style={pr.label}>{label}</Text>
        <Text style={[pr.val, !value && pr.placeholder]}>{value || placeholder}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-down" size={20} color="#94A3B8" />
    </View>
  </TouchableOpacity>
);

const pr = StyleSheet.create({
  wrap:        { marginBottom:8 },
  inner:       { flexDirection:'row', alignItems:'center', borderWidth:1.5, borderColor:'#E2E8F0', borderRadius:14, padding:14, backgroundColor:'#fff', gap:10 },
  icon:        {},
  label:       { fontSize:10, fontWeight:'800', color:'#94A3B8', textTransform:'uppercase', letterSpacing:0.3 },
  val:         { fontSize:15, fontWeight:'700', color:'#1E293B', marginTop:2 },
  placeholder: { color:'#CBD5E1' },
});

// ── Main Component ───────────────────────────────────────
export default function EditProfile({ route, navigation }) {
  const { currentData } = route.params || {};
  const user = auth.currentUser;

  const [name,    setName]    = useState(currentData?.name    || '');
  const [phone,   setPhone]   = useState(currentData?.phone   || '');
  const [email,   setEmail]   = useState(currentData?.email   || '');
  const [city,    setCity]    = useState(currentData?.city    || '');
  const [pincode, setPincode] = useState(currentData?.pincode || '');
  const [state,   setState]   = useState(currentData?.state   || '');
  const [gender,  setGender]  = useState(currentData?.gender  || '');
  const [dob,     setDob]     = useState(currentData?.dob     || '');
  const [photoURL, setPhotoURL] = useState(currentData?.photoURL || '');

  const [loading,        setLoading]        = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [stateModal,     setStateModal]     = useState(false);
  const [genderModal,    setGenderModal]    = useState(false);
  const [stateSearch,    setStateSearch]    = useState('');
  const [errors,         setErrors]         = useState({});

  const filteredStates = INDIAN_STATES.filter(s =>
    s.toLowerCase().includes(stateSearch.toLowerCase())
  );

  // ── Photo Upload ─────────────────────────────────────
  const handlePhotoUpload = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return Alert.alert('Permission', 'Gallery access chahiye.');
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true, aspect: [1,1], quality: 0.6,
      });
      if (result.canceled) return;

      setPhotoUploading(true);
      const uri = result.assets[0].uri;
      const data = new FormData();
      data.append('file',           { uri, type:'image/jpeg', name:'profile.jpg' });
      data.append('upload_preset',  UPLOAD_PRESET);

      const res  = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method:'POST', body:data }
      );
      const json = await res.json();
      if (json.secure_url) {
        setPhotoURL(json.secure_url);
      } else {
        Alert.alert('Error', 'Photo upload failed.');
      }
    } catch {
      Alert.alert('Error', 'Photo upload nahi ho saka.');
    } finally {
      setPhotoUploading(false);
    }
  };

  // ── Validation ───────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!name.trim())                     e.name    = 'Name zaroori hai';
    if (!phone.trim() || phone.length < 10) e.phone  = '10 digit phone number daalo';
    if (!/\S+@\S+\.\S+/.test(email))     e.email   = 'Valid email daalo';
    if (!city.trim())                     e.city    = 'City zaroori hai';
    if (!pincode.trim() || pincode.length < 6) e.pincode = '6 digit pincode daalo';
    if (!state)                           e.state   = 'State select karo';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save ─────────────────────────────────────────────
  const handleUpdate = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      // Email change
      if (email !== user.email) {
        try {
          await verifyBeforeUpdateEmail(user, email);
          Alert.alert(
            '📧 Verify Your Email',
            `Confirmation link ${email} pe bheja gaya.\n\nSpam folder bhi check karein.`,
            [{ text: 'Theek Hai' }]
          );
        } catch (authErr) {
          if (authErr.code === 'auth/requires-recent-login') {
            Alert.alert('Security', 'Email badalne ke liye logout karke dobara login karein.');
          }
        }
      }

      await updateDoc(doc(db, 'users', user.uid), {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
        state,
        gender,
        dob: dob.trim(),
        ...(photoURL && { photoURL }),
      });

      Alert.alert('✅ Updated!', 'Profile save ho gayi!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch {
      Alert.alert('Error', 'Update nahi ho paya. Internet check karo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex:1 }}
      >
        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding:16, paddingBottom:40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Photo Section ── */}
          <View style={s.photoSection}>
            <TouchableOpacity onPress={handlePhotoUpload} style={s.avatarWrap} activeOpacity={0.85}>
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={s.avatar} />
              ) : (
                <View style={s.avatarPlaceholder}>
                  <MaterialCommunityIcons name="account-circle" size={56} color="#94A3B8" />
                </View>
              )}
              <View style={s.cameraBadge}>
                {photoUploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <MaterialCommunityIcons name="camera" size={14} color="#fff" />
                }
              </View>
            </TouchableOpacity>
            <Text style={s.photoHint}>Tap to change photo</Text>
          </View>

          {/* ── Section: Personal Info ── */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <MaterialCommunityIcons name="account" size={18} color="#002855" />
              <Text style={s.cardTitle}>Personal Information</Text>
            </View>

            <FloatInput
              label="Full Name *"
              icon="account-outline"
              value={name}
              onChangeText={t => { setName(t); setErrors(e => ({...e, name:null})); }}
              error={errors.name}
              autoCapitalize="words"
            />
            <FloatInput
              label="Date of Birth"
              icon="calendar"
              value={dob}
              onChangeText={setDob}
              placeholder="DD/MM/YYYY"
              keyboardType="numeric"
              maxLength={10}
            />
            <PickerRow
              label="Gender"
              icon="gender-male-female"
              value={gender}
              placeholder="Select gender"
              onPress={() => setGenderModal(true)}
            />
          </View>

          {/* ── Section: Contact ── */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <MaterialCommunityIcons name="phone" size={18} color="#002855" />
              <Text style={s.cardTitle}>Contact Details</Text>
            </View>

            <FloatInput
              label="Phone Number *"
              icon="phone-outline"
              value={phone}
              onChangeText={t => {
                const d = t.replace(/\D/g, '');
                setPhone(d);
                setErrors(e => ({...e, phone:null}));
              }}
              keyboardType="phone-pad"
              maxLength={10}
              error={errors.phone}
            />
            <FloatInput
              label="Email Address *"
              icon="email-outline"
              value={email}
              onChangeText={t => { setEmail(t); setErrors(e => ({...e, email:null})); }}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />
          </View>

          {/* ── Section: Address ── */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <MaterialCommunityIcons name="map-marker" size={18} color="#002855" />
              <Text style={s.cardTitle}>Address</Text>
            </View>

            <FloatInput
              label="City *"
              icon="city-variant-outline"
              value={city}
              onChangeText={t => { setCity(t); setErrors(e => ({...e, city:null})); }}
              error={errors.city}
              autoCapitalize="words"
            />
            <FloatInput
              label="Pincode *"
              icon="map-marker-outline"
              value={pincode}
              onChangeText={t => {
                const d = t.replace(/\D/g, '');
                setPincode(d);
                setErrors(e => ({...e, pincode:null}));
              }}
              keyboardType="numeric"
              maxLength={6}
              error={errors.pincode}
            />
            <PickerRow
              label="State *"
              icon="map"
              value={state}
              placeholder="Select state"
              onPress={() => setStateModal(true)}
            />
            {errors.state && (
              <Text style={{ color:'#EF4444', fontSize:11, fontWeight:'700', marginTop:2, marginLeft:4 }}>
                {errors.state}
              </Text>
            )}
          </View>

          {/* ── Save Button ── */}
          <TouchableOpacity
            style={[s.saveBtn, loading && s.saveBtnDisabled]}
            onPress={handleUpdate}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="content-save-check" size={20} color="#fff" />
                <Text style={s.saveBtnText}>SAVE CHANGES</Text>
              </>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── State Picker Modal ── */}
      <Modal visible={stateModal} transparent animationType="slide">
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.handle} />
            <Text style={m.title}>Select State</Text>
            <View style={m.searchBox}>
              <MaterialCommunityIcons name="magnify" size={18} color="#94A3B8" />
              <TextInput
                style={m.searchInput}
                placeholder="Search state..."
                placeholderTextColor="#94A3B8"
                value={stateSearch}
                onChangeText={setStateSearch}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredStates}
              keyExtractor={i => i}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[m.optionRow, state === item && m.optionRowActive]}
                  onPress={() => {
                    setState(item);
                    setErrors(e => ({...e, state:null}));
                    setStateModal(false);
                    setStateSearch('');
                  }}
                >
                  <Text style={[m.optionText, state === item && m.optionTextActive]}>{item}</Text>
                  {state === item && (
                    <MaterialCommunityIcons name="check-circle" size={18} color="#002855" />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={{ textAlign:'center', color:'#94A3B8', padding:20 }}>
                  Koi state nahi mili
                </Text>
              }
            />
            <TouchableOpacity onPress={() => { setStateModal(false); setStateSearch(''); }} style={m.cancelBtn}>
              <Text style={m.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Gender Picker Modal ── */}
      <Modal visible={genderModal} transparent animationType="slide">
        <View style={m.overlay}>
          <View style={[m.sheet, { maxHeight: 360 }]}>
            <View style={m.handle} />
            <Text style={m.title}>Select Gender</Text>
            {GENDERS.map(g => (
              <TouchableOpacity
                key={g}
                style={[m.optionRow, gender === g && m.optionRowActive]}
                onPress={() => { setGender(g); setGenderModal(false); }}
              >
                <Text style={[m.optionText, gender === g && m.optionTextActive]}>{g}</Text>
                {gender === g && (
                  <MaterialCommunityIcons name="check-circle" size={18} color="#002855" />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setGenderModal(false)} style={m.cancelBtn}>
              <Text style={m.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex:1, backgroundColor:'#F0F4FF' },
  scroll: { flex:1 },

  // Photo
  photoSection: { alignItems:'center', paddingVertical:20 },
  avatarWrap:   { position:'relative' },
  avatar:       { width:96, height:96, borderRadius:48, borderWidth:3, borderColor:'#002855' },
  avatarPlaceholder: { width:96, height:96, borderRadius:48, backgroundColor:'#F1F5F9', justifyContent:'center', alignItems:'center', borderWidth:2, borderColor:'#E2E8F0' },
  cameraBadge:  { position:'absolute', bottom:2, right:2, width:28, height:28, borderRadius:14, backgroundColor:'#002855', justifyContent:'center', alignItems:'center', borderWidth:2, borderColor:'#F0F4FF' },
  photoHint:    { marginTop:8, fontSize:12, color:'#94A3B8', fontWeight:'600' },

  // Cards
  card:       { backgroundColor:'#fff', borderRadius:20, padding:16, marginBottom:14, elevation:2, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06 },
  cardHeader: { flexDirection:'row', alignItems:'center', gap:8, marginBottom:14, paddingBottom:12, borderBottomWidth:1, borderBottomColor:'#F1F5F9' },
  cardTitle:  { fontSize:14, fontWeight:'900', color:'#002855' },

  // Save button
  saveBtn:         { flexDirection:'row', justifyContent:'center', alignItems:'center', gap:10, backgroundColor:'#002855', padding:18, borderRadius:16, marginTop:8, elevation:4, shadowColor:'#002855', shadowOffset:{width:0,height:4}, shadowOpacity:0.3 },
  saveBtnDisabled: { backgroundColor:'#94A3B8' },
  saveBtnText:     { color:'#fff', fontWeight:'900', fontSize:16 },
});

// Modal styles
const m = StyleSheet.create({
  overlay:    { flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'flex-end' },
  sheet:      { backgroundColor:'#fff', borderTopLeftRadius:28, borderTopRightRadius:28, padding:20, paddingBottom:34, maxHeight:'80%' },
  handle:     { width:40, height:4, backgroundColor:'#E2E8F0', borderRadius:2, alignSelf:'center', marginBottom:16 },
  title:      { fontSize:18, fontWeight:'900', color:'#002855', textAlign:'center', marginBottom:16 },
  searchBox:  { flexDirection:'row', alignItems:'center', backgroundColor:'#F8FAFC', borderRadius:12, paddingHorizontal:12, marginBottom:12, gap:8 },
  searchInput:{ flex:1, fontSize:14, fontWeight:'600', color:'#1E293B', paddingVertical:11 },
  optionRow:       { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:15, borderRadius:12, marginBottom:4 },
  optionRowActive: { backgroundColor:'#EBF5FB' },
  optionText:      { fontSize:15, fontWeight:'600', color:'#334155' },
  optionTextActive:{ color:'#002855', fontWeight:'800' },
  cancelBtn:  { padding:14, alignItems:'center', marginTop:8 },
  cancelText: { color:'#94A3B8', fontWeight:'700', fontSize:14 },
});
