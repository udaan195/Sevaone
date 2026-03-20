import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const lightTheme = {
  mode: "light", bg: "#F8FAFC", card: "#FFFFFF", text: "#1E293B",
  textMuted: "#64748B", primary: "#003366", secondary: "#10B981",
  accent: "#F59E0B", border: "#E2E8F0", tabBar: "#FFFFFF",
  header: "#FFFFFF", inputBg: "#FFFFFF", surface: "#F1F5F9",
  danger: "#EF4444", success: "#10B981", warning: "#F59E0B",
};

export const darkTheme = {
  mode: "dark", bg: "#0F172A", card: "#1E293B", text: "#F1F5F9",
  textMuted: "#94A3B8", primary: "#4A90D9", secondary: "#10B981",
  accent: "#F59E0B", border: "#334155", tabBar: "#1E293B",
  header: "#1E293B", inputBg: "#334155", surface: "#1E293B",
  danger: "#EF4444", success: "#10B981", warning: "#F59E0B",
};

export const strings = {
  en: { home:"Home", application:"Application", forYou:"For You", help:"Help", profile:"Profile", namaste:"Namaste,", wallet:"Wallet", govtJob:"Govt Job", privateJob:"Private Job", citizenServices:"Citizen Services", govtSchemes:"Govt Schemes", students:"Students", other:"Other", login:"Login", logout:"Logout", loading:"Loading...", balance:"Available Balance", addMoney:"Add Money", changePIN:"Change PIN", recentHistory:"Recent History", depositFunds:"Deposit Funds", activateWallet:"ACTIVATE WALLET", securitySetup:"Security Setup", editProfile:"Update Profile Details", identityDetails:"Identity Details", accountSettings:"Account & Settings", myApplications:"My Application History", changePassword:"Change Password", privacyPolicy:"Privacy Policy", referEarn:"Refer & Earn", verifiedMember:"Verified SewaOne Member", pending:"Pending", approved:"Approved", rejected:"Rejected", completed:"Completed", secureLogin:"SECURE LOGIN", registerNow:"REGISTER NOW", forgotPassword:"Forgot Password?", newUser:"New User? Register", alreadyAccount:"Already have an account? Login", cancel:"Cancel", verify:"Verify" },
  hi: { home:"होम", application:"आवेदन", forYou:"आपके लिए", help:"सहायता", profile:"प्रोफाइल", namaste:"नमस्ते,", wallet:"वॉलेट", govtJob:"सरकारी नौकरी", privateJob:"प्राइवेट जॉब", citizenServices:"नागरिक सेवाएं", govtSchemes:"सरकारी योजनाएं", students:"छात्र", other:"अन्य", login:"लॉगिन", logout:"लॉगआउट", loading:"लोड हो रहा है...", balance:"उपलब्ध शेष राशि", addMoney:"पैसे जोड़ें", changePIN:"पिन बदलें", recentHistory:"हाल का इतिहास", depositFunds:"पैसे जमा करें", activateWallet:"वॉलेट सक्रिय करें", securitySetup:"सुरक्षा सेटअप", editProfile:"प्रोफाइल अपडेट करें", identityDetails:"पहचान विवरण", accountSettings:"खाता और सेटिंग", myApplications:"मेरे आवेदन", changePassword:"पासवर्ड बदलें", privacyPolicy:"गोपनीयता नीति", referEarn:"रेफर करें", verifiedMember:"सत्यापित सदस्य", pending:"लंबित", approved:"स्वीकृत", rejected:"अस्वीकृत", completed:"पूर्ण", secureLogin:"सुरक्षित लॉगिन", registerNow:"अभी रजिस्टर करें", forgotPassword:"पासवर्ड भूल गए?", newUser:"नए उपयोगकर्ता?", alreadyAccount:"पहले से खाता है?", cancel:"रद्द करें", verify:"सत्यापित करें" },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);
  const [lang, setLang]     = useState('en');
  const [loaded, setLoaded] = useState(false); // ✅ Prevent flash

  // ✅ Load saved theme + lang on startup
  useEffect(() => {
    (async () => {
      try {
        const [savedTheme, savedLang] = await Promise.all([
          AsyncStorage.getItem('appTheme'),
          AsyncStorage.getItem('appLang'),
        ]);
        if (savedTheme === 'dark') setIsDark(true);
        if (savedLang === 'hi')    setLang('hi');
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const theme = isDark ? darkTheme : lightTheme;
  const t     = strings[lang];

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem('appTheme', next ? 'dark' : 'light');
  };

  const toggleLang = async () => {
    const next = lang === 'en' ? 'hi' : 'en';
    setLang(next);
    await AsyncStorage.setItem('appLang', next);
  };

  // ✅ Don't render until theme loaded — prevents white flash
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, lang, toggleLang, t }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppTheme must be inside ThemeProvider");
  return ctx;
}
