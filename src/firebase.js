// src/firebase.js
import { initializeApp } from "firebase/app";
import { initializeAuth, browserSessionPersistence, onAuthStateChanged } from "firebase/auth";
import { initializeFirestore, memoryLocalCache } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, { persistence: browserSessionPersistence });

// FIX: persistentLocalCache (IndexedDB) crash ka source tha —
// getTargetData ke andar null state aur INTERNAL ASSERTION FAILED.
// POS me saara data live listeners se aata hai, isliye memory cache kaafi hai.
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
});

// authReady promise — App.js isko await karta hai
export const authReady = new Promise((resolve) => {
  const unsub = onAuthStateChanged(auth, (user) => {
    unsub();
    resolve(user);
  });
});