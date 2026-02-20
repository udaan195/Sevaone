import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { db, auth } from '../../api/firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { Platform } from 'react-native';

// Notification behavior set karna (Jab app khula ho tab bhi dikhe)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      alert('Bhai, notification permission ke bina updates nahi milenge!');
      return;
    }
    token = (await Notifications.getExpoPushTokenAsync()).data;
  } else {
    alert('Bhai, push notification ke liye real device chahiye emulator nahi.');
  }

  if (Platform.OS === 'android') {
    // Professional Channel (Zepto/Blinkit style)
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // Token ko user profile mein save karna
  if (token && auth.currentUser) {
    const userRef = doc(db, "users", auth.currentUser.uid);
    await updateDoc(userRef, { pushToken: token });
  }

  return token;
}
