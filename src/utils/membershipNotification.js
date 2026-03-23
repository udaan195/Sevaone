// ============================================================
// FILE: src/utils/membershipNotification.js
// Expiry check on app open — NO Cloud Functions needed (Spark safe)
// Uses expo-notifications for local notifications
// ============================================================
import * as Notifications from 'expo-notifications';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../api/firebaseConfig';

// ── Setup notification handler ────────────────────────────────
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  false,
    }),
  });
}

// ── Request permission ────────────────────────────────────────
export async function requestNotificationPermission() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch { return false; }
}

// ── Schedule local notification ───────────────────────────────
async function scheduleLocalNotification(title, body) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: { screen: 'Membership' }, // tap pe Membership screen open
      },
      trigger: { seconds: 2 }, // 2 second delay — reliable on all devices
    });
  } catch (e) {
    console.log('Notification schedule error:', e.message);
  }
}

// ── Main check — call on every app open ──────────────────────
export async function checkMembershipExpiry(uid) {
  if (!uid) return;
  try {
    const memSnap = await getDoc(doc(db, 'user_memberships', uid));
    if (!memSnap.exists()) return;
    const mem = memSnap.data();
    if (!mem.isActive || !mem.endDate) return;

    const endDate  = new Date(mem.endDate);
    const now      = new Date();
    const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

    // Check if already notified today
    const today = now.toISOString().split('T')[0];
    const lastNotifSnap = await getDoc(
      doc(db, 'user_memberships', uid, 'monthly_usage', 'notif_meta')
    ).catch(() => null);

    const lastNotifDate = lastNotifSnap?.exists()
      ? lastNotifSnap.data().lastNotifDate
      : null;

    // Already notified today — skip
    if (lastNotifDate === today) return;

    const plan      = mem.lockedBenefits?.planName || mem.plan || 'Plan';
    const planEmoji = mem.lockedBenefits?.planEmoji || '⭐';
    const isTrial   = mem.isTrial === true;

    let title = '';
    let body  = '';
    let shouldNotify = false;

    if (isTrial) {
      // Trial notifications
      if (daysLeft <= 0) {
        title = '⏰ Trial Khatam Ho Gaya!';
        body  = `Aapka free trial khatam ho gaya. Abhi plan subscribe karo aur discount paate raho!`;
        shouldNotify = true;
      } else if (daysLeft <= 1) {
        title = '⚠️ Kal Trial Khatam!';
        body  = `${planEmoji} Aapka trial kal khatam ho jayega. Plan lene ka sahi waqt hai!`;
        shouldNotify = true;
      } else if (daysLeft <= 3) {
        title = `🎁 ${daysLeft} Din Bacha Trial`;
        body  = `Aapka free trial sirf ${daysLeft} dinon mein khatam ho jayega. Abhi upgrade karo!`;
        shouldNotify = true;
      }
    } else {
      // Paid plan notifications
      if (daysLeft <= 0) {
        title = '⏰ Membership Khatam!';
        body  = `Aapka ${planEmoji} ${plan} plan khatam ho gaya. Renew karo aur discount paate raho!`;
        shouldNotify = true;
      } else if (daysLeft <= 1) {
        title = '🚨 Aakhri Din!';
        body  = `${planEmoji} ${plan} plan kal khatam ho jayega. Abhi renew karo!`;
        shouldNotify = true;
      } else if (daysLeft === 3) {
        title = `⚠️ 3 Din Bache Hain`;
        body  = `${planEmoji} Aapka ${plan} plan 3 dinon mein expire hoga. Renew karo!`;
        shouldNotify = true;
      } else if (daysLeft === 7) {
        title = `📅 7 Din Bacha Plan`;
        body  = `${planEmoji} ${plan} plan 7 dinon mein expire hoga. Renew karke benefits jari rakho!`;
        shouldNotify = true;
      }
    }

    if (shouldNotify) {
      await scheduleLocalNotification(title, body);
      // Save last notif date
      await setDoc(
        doc(db, 'user_memberships', uid, 'monthly_usage', 'notif_meta'),
        { lastNotifDate: today, lastDaysLeft: daysLeft, lastTitle: title },
        { merge: true }
      ).catch(() => {});
    }

  } catch (e) {
    console.log('Membership expiry check error:', e.message);
  }
}

// ── TEST FUNCTION — Development mein use karo ────────────────
// App mein kisi button se call karo:
// import { testMembershipNotification } from './membershipNotification';
// <Button onPress={() => testMembershipNotification()} title="Test Notif" />
export async function testMembershipNotification() {
  const granted = await requestNotificationPermission();
  if (!granted) {
    console.log('❌ Notification permission nahi mili');
    return false;
  }
  await scheduleLocalNotification(
    '🥉 Test: Basic Plan Expiry',
    'Yeh ek test notification hai. Membership system sahi kaam kar raha hai!'
  );
  console.log('✅ Test notification scheduled — 2 seconds mein aayegi');
  return true;
}
