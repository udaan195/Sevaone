import 'react-native-gesture-handler';
import React, { useState, useEffect, useRef } from 'react';
import { Platform, ActivityIndicator, View, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createNavigationContainerRef } from '@react-navigation/native';
import { auth, db } from './src/api/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import MaintenanceScreen from './src/screens/Main/MaintenanceScreen';
import { Provider as PaperProvider } from 'react-native-paper';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import { checkMembershipExpiry, setupNotificationHandler, requestNotificationPermission } from './src/utils/membershipNotification';

import AuthStack from './src/navigation/AuthStack';
import OfflineBanner from './src/components/OfflineBanner';
import MainTabNavigator from './src/navigation/MainTabNavigator';

const Stack = createStackNavigator();


// ✅ Global navigationRef — kahi se bhi navigate kar sako
export const navigationRef = createNavigationContainerRef();

// ✅ Deep link navigate helper
function handleNotificationNavigation(data) {
  if (!data || !navigationRef.isReady()) return;

  const screen = data.screen;
  const id = data.jobId || data.serviceId || data.trackingId || data.id;

  try {
    switch (screen) {
      case 'JobDetails':
        navigationRef.navigate('JobDetails', { jobId: id });
        break;
      case 'ServiceDetails':
        navigationRef.navigate('ServiceDetails', { serviceId: id });
        break;
      case 'Applications':
        navigationRef.navigate('Application');
        break;
      case 'Wallet':
        navigationRef.navigate('Wallet');
        break;
      case 'GovtJobs':
        navigationRef.navigate('GovtJobs');
        break;
      case 'CitizenServices':
        navigationRef.navigate('CitizenServices');
        break;
      case 'Notifications':
        navigationRef.navigate('Notifications');
        break;
      default:
        // Screen match nahi hua — Home pe jao
        break;
    }
  } catch (e) {
    console.log('Navigation error:', e);
  }
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ── Inner App ─────────────────────────────────────────────
function AppInner() {
  const { theme } = useAppTheme();
  const [user, setUser]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [maintenance, setMaintenance] = useState(null);  // null = not loaded yet
  const [features, setFeatures]       = useState({});
  const notificationListener = useRef();
  const responseListener = useRef();

  // ── App config listener (maintenance + features) ─────────
  useEffect(() => {
    const unsubMaint = onSnapshot(doc(db, 'app_config', 'maintenance'), snap => {
      setMaintenance(snap.exists() ? snap.data() : { isActive: false });
    });
    const unsubFeats = onSnapshot(doc(db, 'app_config', 'features'), snap => {
      setFeatures(snap.exists() ? snap.data() : {});
    });
    return () => { unsubMaint(); unsubFeats(); };
  }, []);

  useEffect(() => {
    // 1. Auth listener + push token save
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);

      // ✅ Login hone par token Firestore mein save karo
      if (u) {
        try {
          const token = await registerForPushNotificationsAsync();
          if (token) {
            await setDoc(doc(db, 'users', u.uid), {
              pushToken: token,
              lastSeen: new Date().toISOString(),
            }, { merge: true });
          }
        } catch (e) {
          console.log('Token save error:', e);
        }

        // ✅ FEAT-01: Membership expiry check on every login/app open
        try {
          await requestNotificationPermission();
          await checkMembershipExpiry(u.uid);
        } catch (e) {
          console.log('Expiry check error:', e.message);
        }
      }
    });

    // 2. Foreground notification
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        // Foreground mein notification — banner show hoga setNotificationHandler ki wajah se ✅
        console.log('Notification received (foreground):', notification.request.content.title);
      }
    );

    // 3. ✅ DEEP LINK — Notification tap handler
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response?.notification?.request?.content?.data;
        if (data) handleNotificationNavigation(data);
      }
    );

    // 4. ✅ App band thi aur notification tap se khuli
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response?.notification?.request?.content?.data;
        if (data) {
          // Thoda delay do taaki navigation ready ho
          setTimeout(() => handleNotificationNavigation(data), 1000);
        }
      }
    });

    return () => {
      unsubscribe();
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  const paperTheme = {
    colors: {
      primary: theme.primary,
      secondary: theme.secondary,
      background: theme.bg,
      surface: theme.card,
    },
  };

  if (loading || maintenance === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // ✅ Maintenance mode — sab rok do
  if (maintenance?.isActive) {
    return <MaintenanceScreen config={maintenance} />;
  }

  return (
    <PaperProvider theme={paperTheme}>
      <View style={{ flex: 1 }}>
        {/* ✅ Offline Banner — screen ke upar dikhta hai */}
        <OfflineBanner />
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {user ? (
              <Stack.Screen name="MainTabs" component={MainTabNavigator} />
            ) : (
              <Stack.Screen name="Auth" component={AuthStack} />
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </View>
    </PaperProvider>
  );
}

// ── Root ──────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

// ── Push Token Register ───────────────────────────────────
async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) return null;

  // ✅ Android channel — APK ke liye zaroori
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('sewaone_alerts', {
      name: 'SewaOne Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#003366',
      sound: true,
      showBadge: true,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    Alert.alert(
      'Notification Permission',
      'Notifications allow karo — job alerts aur updates milenge!',
      [{ text: 'OK' }]
    );
    return null;
  }

  // ✅ projectId REQUIRED for APK builds
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    '3429dc9b-58d9-4160-977f-ee6009930a66';

  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    return result.data;
  } catch (e) {
    console.log('Token error:', e.message);
    return null;
  }
}
