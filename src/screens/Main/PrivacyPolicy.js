import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, StatusBar,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAppTheme } from '../../context/ThemeContext';

const APP_VERSION = Constants?.expoConfig?.version || '1.0.0';

// ── Bilingual content ─────────────────────────────────────
const CONTENT = {
  en: {
    title:        'Privacy Policy',
    subtitle:     'SewaOne Digital Services',
    updated:      'Last Updated: March 2026',
    version:      `App Version v${APP_VERSION}`,
    intro:        'SewaOne ("we", "our", "the Company") is committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and digital services.',
    sections: [
      {
        icon:  'account-details',
        title: '1. Information We Collect',
        body:  'We collect the following categories of personal information:\n\n• Identity Data: Full name, date of birth, gender\n• Contact Data: Email address, phone number, residential address, city, state, PIN code\n• Document Data: Government-issued ID copies (Aadhaar, PAN, etc.) uploaded voluntarily for service applications\n• Financial Data: UPI transaction reference numbers (UTR), wallet transaction history. We do not store your bank account or card details.\n• Device & Usage Data: Device type, OS version, app usage patterns, push notification tokens',
      },
      {
        icon:  'target',
        title: '2. How We Use Your Information',
        body:  'We use your personal information exclusively for:\n\n• Processing government job and citizen service applications on your behalf\n• Managing your SewaOne Wallet and transaction history\n• Sending important notifications about application status updates\n• Providing customer support through our grievance system\n• Improving our services through anonymous usage analytics\n• Complying with applicable legal obligations\n\nWe will never use your information for unsolicited marketing without your explicit consent.',
      },
      {
        icon:  'share-variant',
        title: '3. Information Sharing & Disclosure',
        body:  'We do not sell, trade, or rent your personal information to third parties. We may share information only in the following limited circumstances:\n\n• Government Departments: Documents and form data submitted during service applications are shared with the relevant government authority as required for processing\n• Authorized Agents: Our verified service agents access application data solely to process your requests\n• Legal Requirements: We may disclose information when required by law, court order, or governmental authority\n• Service Providers: Cloud storage (Firebase/Cloudinary) under strict data processing agreements\n\nAll third-party partners are contractually bound to maintain confidentiality.',
      },
      {
        icon:  'database-lock',
        title: '4. Data Security',
        body:  'We implement industry-standard security measures to protect your data:\n\n• 256-bit TLS/SSL encryption for all data in transit\n• AES-256 encryption for sensitive data at rest on Firebase Secure Cloud\n• SHA-256 hashing for wallet PINs (never stored in plain text)\n• Role-based access control — agents can only access assigned applications\n• Regular security audits and vulnerability assessments\n\nWhile we employ best-practice security measures, no transmission over the internet is 100% secure. We encourage you to maintain a strong password and never share your wallet PIN.',
      },
      {
        icon:  'wallet-outline',
        title: '5. Wallet & Financial Data',
        body:  'SewaOne Wallet operates as a closed-loop prepaid instrument for service fee payments within our platform.\n\n• Wallet balance is not withdrawable to external bank accounts unless a verified withdrawal request is approved by administration\n• All wallet transactions are logged with timestamp, amount, and transaction type\n• Payment screenshots uploaded for recharge verification are stored securely and reviewed only by authorized administrators\n• In case of disputed transactions, records are maintained for a minimum of 12 months',
      },
      {
        icon:  'timer-outline',
        title: '6. Data Retention',
        body:  'We retain your personal data for as long as your account remains active or as required by law:\n\n• Account data: Duration of account + 3 years\n• Application records: 7 years (as required by government document retention norms)\n• Transaction history: 5 years\n• Deleted account data: Purged within 90 days of deletion request, except where legal obligations require retention\n\nYou may request data deletion by contacting support@sewaone.in',
      },
      {
        icon:  'account-check-outline',
        title: '7. Your Rights',
        body:  'Under applicable data protection laws, you have the right to:\n\n• Access: Request a copy of the personal data we hold about you\n• Correction: Update inaccurate or incomplete information via your Profile section\n• Deletion: Request erasure of your personal data (subject to legal retention requirements)\n• Portability: Receive your data in a structured, commonly used format\n• Objection: Object to processing of your data for specific purposes\n• Withdraw Consent: Withdraw previously given consent at any time\n\nTo exercise any of these rights, contact us at support@sewaone.in',
      },
      {
        icon:  'cellphone-lock',
        title: '8. Push Notifications & Permissions',
        body:  'We request the following device permissions:\n\n• Notifications: To send application status updates, wallet alerts, and new job announcements. You can opt out from device settings at any time.\n• Storage/Media: To allow document upload for service applications. Files are uploaded to secure cloud storage and not stored locally beyond the session.\n• Camera (Optional): If you choose to capture documents directly.\n\nWe do not access contacts, location, microphone, or any other permission beyond those listed.',
      },
      {
        icon:  'baby-face-outline',
        title: '9. Children\'s Privacy',
        body:  'SewaOne services are intended for users aged 18 years and above, or minors using the platform under the supervision of a parent or legal guardian for eligible government schemes.\n\nWe do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us immediately for deletion.',
      },
      {
        icon:  'update',
        title: '10. Changes to This Policy',
        body:  'We may update this Privacy Policy periodically to reflect changes in our practices, technology, or legal requirements. We will notify you of material changes by:\n\n• Displaying a prominent notice in the app\n• Sending a push notification\n• Updating the "Last Updated" date at the top of this policy\n\nYour continued use of the app after changes constitutes acceptance of the updated policy.',
      },
      {
        icon:  'gavel',
        title: '11. Governing Law & Jurisdiction',
        body:  'This Privacy Policy is governed by the laws of India, including the Information Technology Act, 2000 and its amendments, the IT (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and the Digital Personal Data Protection Act, 2023.\n\nAny disputes arising from this policy shall be subject to the exclusive jurisdiction of courts in Uttar Pradesh, India.',
      },
      {
        icon:  'email-outline',
        title: '12. Contact Us',
        body:  'For privacy-related queries, data requests, or grievances:\n\nEmail: support@sewaone.in\nGrievance Officer: Available through the Help section in the app\nResponse Time: Within 72 hours of receiving your request\n\nRegistered Address: SewaOne Digital Services, Uttar Pradesh, India',
      },
    ],
  },

  hi: {
    title:        'गोपनीयता नीति',
    subtitle:     'सेवाOne डिजिटल सेवाएं',
    updated:      'अंतिम अपडेट: मार्च 2026',
    version:      `ऐप संस्करण v${APP_VERSION}`,
    intro:        'सेवाOne ("हम", "हमारी", "कंपनी") आपकी व्यक्तिगत जानकारी और गोपनीयता की रक्षा करने के लिए प्रतिबद्ध है। यह गोपनीयता नीति बताती है कि जब आप हमारे मोबाइल एप्लिकेशन और डिजिटल सेवाओं का उपयोग करते हैं तो हम आपकी जानकारी कैसे एकत्र करते हैं, उपयोग करते हैं और सुरक्षित रखते हैं।',
    sections: [
      {
        icon:  'account-details',
        title: '1. हम क्या जानकारी एकत्र करते हैं',
        body:  'हम निम्नलिखित व्यक्तिगत जानकारी एकत्र करते हैं:\n\n• पहचान डेटा: पूरा नाम, जन्म तिथि, लिंग\n• संपर्क डेटा: ईमेल, फोन नंबर, पता, शहर, राज्य, पिन कोड\n• दस्तावेज़ डेटा: सेवा आवेदन के लिए स्वेच्छा से अपलोड की गई सरकारी ID प्रतियां (आधार, पैन आदि)\n• वित्तीय डेटा: UPI लेनदेन संदर्भ संख्या (UTR), वॉलेट लेनदेन इतिहास। हम आपके बैंक खाते या कार्ड विवरण संग्रहीत नहीं करते।\n• डिवाइस डेटा: डिवाइस प्रकार, OS संस्करण, ऐप उपयोग',
      },
      {
        icon:  'target',
        title: '2. हम आपकी जानकारी का उपयोग कैसे करते हैं',
        body:  'हम आपकी जानकारी केवल इन उद्देश्यों के लिए उपयोग करते हैं:\n\n• सरकारी नौकरी और नागरिक सेवा आवेदन प्रक्रिया\n• सेवाOne वॉलेट और लेनदेन प्रबंधन\n• आवेदन स्थिति अपडेट की सूचनाएं भेजना\n• हेल्प सेक्शन के माध्यम से ग्राहक सहायता\n• सेवाओं में सुधार के लिए अज्ञात उपयोग विश्लेषण\n• कानूनी दायित्वों का पालन\n\nहम आपकी स्पष्ट सहमति के बिना आपकी जानकारी का उपयोग अनचाहे विपणन के लिए कभी नहीं करेंगे।',
      },
      {
        icon:  'share-variant',
        title: '3. जानकारी साझाकरण',
        body:  'हम आपकी व्यक्तिगत जानकारी तीसरे पक्ष को नहीं बेचते, व्यापार नहीं करते या किराए पर नहीं देते। हम केवल इन सीमित परिस्थितियों में जानकारी साझा कर सकते हैं:\n\n• सरकारी विभाग: सेवा आवेदन प्रक्रिया के लिए संबंधित सरकारी प्राधिकरण को\n• अधिकृत एजेंट: केवल आपके अनुरोधों को प्रक्रिया करने के लिए\n• कानूनी आवश्यकताएं: न्यायालय आदेश या सरकारी प्राधिकरण द्वारा आवश्यक होने पर\n• सेवा प्रदाता: Firebase/Cloudinary — कड़े डेटा प्रसंस्करण समझौतों के तहत',
      },
      {
        icon:  'database-lock',
        title: '4. डेटा सुरक्षा',
        body:  'हम आपके डेटा की सुरक्षा के लिए उद्योग-मानक उपाय लागू करते हैं:\n\n• ट्रांज़िट में सभी डेटा के लिए 256-bit TLS/SSL एन्क्रिप्शन\n• Firebase सुरक्षित क्लाउड पर संवेदनशील डेटा के लिए AES-256 एन्क्रिप्शन\n• वॉलेट PIN के लिए SHA-256 हैशिंग (कभी भी सादे पाठ में संग्रहीत नहीं)\n• भूमिका-आधारित पहुंच नियंत्रण\n• नियमित सुरक्षा ऑडिट\n\nहम सर्वोत्तम सुरक्षा उपाय लागू करते हैं। हम आपसे एक मजबूत पासवर्ड रखने और अपना वॉलेट PIN किसी के साथ साझा न करने का आग्रह करते हैं।',
      },
      {
        icon:  'wallet-outline',
        title: '5. वॉलेट और वित्तीय डेटा',
        body:  'सेवाOne वॉलेट हमारे प्लेटफॉर्म के भीतर सेवा शुल्क भुगतान के लिए एक प्रीपेड उपकरण के रूप में काम करता है।\n\n• वॉलेट बैलेंस बाहरी बैंक खातों में निकाला नहीं जा सकता जब तक कि प्रशासन द्वारा सत्यापित निकासी अनुरोध अनुमोदित न हो\n• सभी वॉलेट लेनदेन टाइमस्टैम्प, राशि और लेनदेन प्रकार के साथ लॉग किए जाते हैं\n• रिचार्ज सत्यापन के लिए अपलोड किए गए भुगतान स्क्रीनशॉट सुरक्षित रूप से संग्रहीत हैं',
      },
      {
        icon:  'timer-outline',
        title: '6. डेटा प्रतिधारण',
        body:  'हम आपका डेटा तब तक रखते हैं जब तक आपका खाता सक्रिय है या कानून द्वारा आवश्यक है:\n\n• खाता डेटा: खाता अवधि + 3 वर्ष\n• आवेदन रिकॉर्ड: 7 वर्ष\n• लेनदेन इतिहास: 5 वर्ष\n• हटाए गए खाते का डेटा: हटाने के अनुरोध के 90 दिनों के भीतर हटाया जाएगा\n\nडेटा हटाने के लिए: support@sewaone.in पर संपर्क करें',
      },
      {
        icon:  'account-check-outline',
        title: '7. आपके अधिकार',
        body:  'लागू डेटा संरक्षण कानूनों के तहत आपको निम्नलिखित अधिकार हैं:\n\n• पहुंच: हमारे पास आपके बारे में डेटा की एक प्रति का अनुरोध करें\n• सुधार: प्रोफाइल अनुभाग के माध्यम से गलत जानकारी अपडेट करें\n• विलोपन: व्यक्तिगत डेटा मिटाने का अनुरोध करें\n• आपत्ति: विशिष्ट उद्देश्यों के लिए डेटा प्रसंस्करण पर आपत्ति जताएं\n• सहमति वापस लें: किसी भी समय पहले दी गई सहमति वापस लें\n\nइन अधिकारों का उपयोग करने के लिए: support@sewaone.in',
      },
      {
        icon:  'cellphone-lock',
        title: '8. सूचनाएं और अनुमतियां',
        body:  'हम निम्नलिखित डिवाइस अनुमतियां मांगते हैं:\n\n• सूचनाएं: आवेदन स्थिति अपडेट, वॉलेट अलर्ट और नई नौकरी की घोषणाओं के लिए। आप कभी भी डिवाइस सेटिंग्स से ऑप्ट आउट कर सकते हैं।\n• स्टोरेज/मीडिया: सेवा आवेदन के लिए दस्तावेज़ अपलोड करने के लिए।\n• कैमरा (वैकल्पिक): यदि आप दस्तावेज़ सीधे कैप्चर करना चुनते हैं।\n\nहम सूचीबद्ध से परे किसी भी अनुमति का उपयोग नहीं करते।',
      },
      {
        icon:  'baby-face-outline',
        title: '9. बच्चों की गोपनीयता',
        body:  'सेवाOne सेवाएं 18 वर्ष और उससे अधिक आयु के उपयोगकर्ताओं के लिए हैं, या माता-पिता/कानूनी अभिभावक की देखरेख में नाबालिगों के लिए।\n\nहम 13 वर्ष से कम उम्र के बच्चों से जानबूझकर व्यक्तिगत जानकारी एकत्र नहीं करते। यदि ऐसा हुआ हो तो तुरंत हमसे संपर्क करें।',
      },
      {
        icon:  'gavel',
        title: '10. शासन कानून',
        body:  'यह गोपनीयता नीति भारत के कानूनों द्वारा शासित है, जिसमें शामिल हैं:\n\n• सूचना प्रौद्योगिकी अधिनियम, 2000 और इसके संशोधन\n• IT (उचित सुरक्षा प्रथाएं और संवेदनशील व्यक्तिगत डेटा) नियम, 2011\n• डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023\n\nकोई भी विवाद उत्तर प्रदेश, भारत के न्यायालयों के अनन्य क्षेत्राधिकार के अधीन होगा।',
      },
      {
        icon:  'email-outline',
        title: '11. संपर्क करें',
        body:  'गोपनीयता संबंधित प्रश्नों, डेटा अनुरोधों या शिकायतों के लिए:\n\nईमेल: support@sewaone.in\nशिकायत अधिकारी: ऐप के हेल्प सेक्शन में उपलब्ध\nप्रतिक्रिया समय: आपके अनुरोध प्राप्त होने के 72 घंटों के भीतर\n\nपंजीकृत पता: सेवाOne डिजिटल सेवाएं, उत्तर प्रदेश, भारत',
      },
    ],
  },
};

// ── Component ─────────────────────────────────────────────
export default function PrivacyPolicy({ navigation }) {
  const { lang, toggleLang } = useAppTheme();
  const [expanded, setExpanded] = useState(null);
  const content = CONTENT[lang] || CONTENT.en;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#002855" />

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <MaterialCommunityIcons name="shield-check" size={32} color="#FFD700" />
          <View style={{ marginLeft: 12 }}>
            <Text style={s.headerTitle}>{content.title}</Text>
            <Text style={s.headerSub}>{content.subtitle}</Text>
          </View>
        </View>
        {/* Language toggle */}
        <TouchableOpacity style={s.langBtn} onPress={toggleLang}>
          <MaterialCommunityIcons name="translate" size={16} color="#fff" />
          <Text style={s.langText}>{lang === 'en' ? 'हिंदी' : 'English'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
      >
        {/* Meta info */}
        <View style={s.metaRow}>
          <View style={s.metaChip}>
            <MaterialCommunityIcons name="calendar" size={12} color="#64748B" />
            <Text style={s.metaText}>{content.updated}</Text>
          </View>
          <View style={s.metaChip}>
            <MaterialCommunityIcons name="cellphone" size={12} color="#64748B" />
            <Text style={s.metaText}>{content.version}</Text>
          </View>
        </View>

        {/* Intro */}
        <View style={s.introCard}>
          <MaterialCommunityIcons name="information" size={18} color="#1a5276" />
          <Text style={s.introText}>{content.intro}</Text>
        </View>

        {/* Sections — accordion */}
        {content.sections.map((sec, i) => (
          <TouchableOpacity
            key={i}
            style={[s.sectionCard, expanded === i && s.sectionCardOpen]}
            onPress={() => setExpanded(expanded === i ? null : i)}
            activeOpacity={0.88}
          >
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconBox, expanded === i && { backgroundColor: '#002855' }]}>
                <MaterialCommunityIcons
                  name={sec.icon}
                  size={18}
                  color={expanded === i ? '#FFD700' : '#002855'}
                />
              </View>
              <Text style={[s.sectionTitle, expanded === i && { color: '#002855' }]} numberOfLines={expanded === i ? 0 : 1}>
                {sec.title}
              </Text>
              <MaterialCommunityIcons
                name={expanded === i ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#94A3B8"
              />
            </View>
            {expanded === i && (
              <View style={s.sectionBody}>
                <View style={s.bodyDivider} />
                <Text style={s.sectionText}>{sec.body}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* Footer */}
        <View style={s.footer}>
          <MaterialCommunityIcons name="shield-lock" size={28} color="#10B981" />
          <Text style={s.footerTitle}>
            {lang === 'en' ? 'Your data is safe with us' : 'आपका डेटा हमारे पास सुरक्षित है'}
          </Text>
          <Text style={s.footerSub}>support@sewaone.in</Text>
          <Text style={s.footerNote}>
            {lang === 'en'
              ? 'By using SewaOne, you agree to this Privacy Policy'
              : 'सेवाOne का उपयोग करके आप इस गोपनीयता नीति से सहमत हैं'}
          </Text>
        </View>

        <TouchableOpacity style={s.agreeBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="check-circle" size={18} color="#fff" />
          <Text style={s.agreeBtnText}>
            {lang === 'en' ? 'I UNDERSTAND & AGREE' : 'मैं समझता/समझती हूं और सहमत हूं'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F4FF' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#002855', padding: 20, paddingTop: 24 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  langBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  langText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  metaRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, elevation: 1 },
  metaText: { fontSize: 11, color: '#64748B', fontWeight: '700' },

  introCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#EBF5FB', borderRadius: 16, padding: 14, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: '#1a5276' },
  introText: { flex: 1, fontSize: 13, color: '#1a5276', lineHeight: 20, fontWeight: '500' },

  sectionCard: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 10, overflow: 'hidden', elevation: 1 },
  sectionCardOpen: { elevation: 3, borderWidth: 1, borderColor: '#BFDBFE' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  sectionIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EBF5FB', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  sectionTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: '#334155' },
  sectionBody: { paddingHorizontal: 14, paddingBottom: 16 },
  bodyDivider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 12 },
  sectionText: { fontSize: 13, color: '#475569', lineHeight: 22, fontWeight: '500' },

  footer: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 24, marginTop: 10, marginBottom: 16, elevation: 1 },
  footerTitle: { fontSize: 16, fontWeight: '900', color: '#002855', marginTop: 10 },
  footerSub: { fontSize: 14, color: '#10B981', fontWeight: '900', marginTop: 4 },
  footerNote: { fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 10, lineHeight: 17 },

  agreeBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: '#002855', padding: 18, borderRadius: 16, elevation: 4, shadowColor: '#002855', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3 },
  agreeBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
