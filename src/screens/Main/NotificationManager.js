import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { db, auth } from '../../api/firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  // ✅ Real device check
  if (!Device.isDevice) {
    return null;
  }

  // ✅ Android channel — APK ke liye zaroori
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('sewaone_alerts', {
      name: 'SewaOne Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#003366',
      sound: true,
      enableVibrate: true,
      showBadge: true,
    });
  }

  // ✅ Permission check
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  // ✅ projectId — APK ke liye REQUIRED
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    '3429dc9b-58d9-4160-977f-ee6009930a66'; // fallback hardcoded

  let token = null;
  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    token = result.data;
  } catch (e) {
    return null;
  }

  // ✅ Firestore mein save karo — merge: true taaki data na jaye
  if (token && auth.currentUser) {
    try {
      await setDoc(
        doc(db, 'users', auth.currentUser.uid),
        {
          pushToken: token,
          tokenUpdatedAt: new Date().toISOString(),
          platform: Platform.OS,
        },
        { merge: true }
      );
    } catch (e) {
    }
  }

  return token;
}
