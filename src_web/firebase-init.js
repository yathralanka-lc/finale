import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyABnvYQl4QzP1lHF4Ei_AzrDPYlMKoTXpA",
  authDomain: "yathralanka-2ac43.firebaseapp.com",
  projectId: "yathralanka-2ac43",
  storageBucket: "yathralanka-2ac43.firebasestorage.app",
  measurementId: "G-KXWXP8TGMS",
  appId: "1:1032179534120:web:21d200d59018319f7ca81d",
  messagingSenderId: "1032179534120"
};

console.log("Config keys being used:", firebaseConfig.projectId);
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export let analytics = null;
if (typeof window !== 'undefined') {
  isSupported().then(supported => {
    if (supported) {
      try {
        analytics = getAnalytics(app);
      } catch (e) {
        console.warn("Analytics skipped on localhost:", e);
      }
    }
  }).catch(() => {});
}

let auth;
try {
  auth = getAuth(app);
} catch (e) {
  try {
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence]
    });
  } catch (err) {
    console.warn("Firebase Auth fallback initialization:", err);
    auth = getAuth(app);
  }
}

const db = getFirestore(app);

export { app, auth, db };
