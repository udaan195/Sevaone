// ============================================================
// FILE: src/config.js  (App mein — Sevaone/src/config.js)
// CENTRAL CONFIG — Ek jagah se sab keys manage karo
// Sab files yahan se import karein
// ============================================================
import Constants from 'expo-constants';

const extra = Constants?.expoConfig?.extra || {};

const Config = {
  // Firebase
  firebase: {
    apiKey:            extra.firebaseApiKey            || "AIzaSyDLvZ0TBDeGO0GROYxwatjNq0Xljsc_gjU",
    authDomain:        extra.firebaseAuthDomain        || "sewaone-1122.firebaseapp.com",
    projectId:         extra.firebaseProjectId         || "sewaone-1122",
    storageBucket:     extra.firebaseStorageBucket     || "sewaone-1122.firebasestorage.app",
    messagingSenderId: extra.firebaseMessagingSenderId || "719367561240",
    appId:             extra.firebaseAppId             || "1:719367561240:web:dea07bed2be0ccdc71a36d",
  },

  // Cloudinary
  cloudinary: {
    cloudName:    extra.cloudinaryCloudName    || "dxuurwexl",
    uploadPreset: extra.cloudinaryUploadPreset || "edusphere_uploads",
    uploadUrl:    `https://api.cloudinary.com/v1_1/${extra.cloudinaryCloudName || "dxuurwexl"}`,
  },

  // Telegram
  telegram: {
    botToken: extra.telegramBotToken || "",
    chatId:   extra.telegramChatId   || "",
  },
};

export default Config;
