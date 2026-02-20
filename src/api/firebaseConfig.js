import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDLvZ0TBDeGO0GROYxwatjNq0Xljsc_gjU",
  authDomain: "sewaone-1122.firebaseapp.com",
  projectId: "sewaone-1122",
  storageBucket: "sewaone-1122.firebasestorage.app",
  messagingSenderId: "719367561240",
  appId: "1:719367561240:web:dea07bed2be0ccdc71a36d"
};

// 1. Check karein ki app pehle se initialize toh nahi hai
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 2. Auth ko safely initialize karein
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
} catch (error) {
  // Agar pehle se initialized hai, toh getAuth() use karein
  auth = getAuth(app);
}

const db = getFirestore(app);

export { auth, db };
