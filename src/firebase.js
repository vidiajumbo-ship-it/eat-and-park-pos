import { initializeApp } from "firebase/app";
import { isSupported, getAnalytics } from "firebase/analytics";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC67vNT4nVAHm31Dohgjl4K5lJ5EQS7pe4",
  authDomain: "enpmenu.firebaseapp.com",
  projectId: "enpmenu",
  storageBucket: "enpmenu.firebasestorage.app",
  messagingSenderId: "942888978604",
  appId: "1:942888978604:web:2a666ebd59ff26d0cc7709",
  measurementId: "G-6VEE32JDC8"
};

const app = initializeApp(firebaseConfig);

// Analytics kuch browsers/webview me crash karta hai, isliye check ke baad hi chalao
isSupported().then((ok) => { if (ok) getAnalytics(app); }).catch(() => {});

// Offline cache (weak internet me menu/orders turant khulte hain)
let database;
try {
  database = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch (e) {
  database = getFirestore(app); // purana firebase version ho to yahi chalega
}
export const db = database;

// Phase 2 ki taiyari: har visitor ko anonymous login (abhi koi behavior change nahi)
export const auth = getAuth(app);
signInAnonymously(auth).catch((e) => console.warn("Anonymous auth abhi off hai:", e.code));
