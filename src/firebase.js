import { initializeApp } from "firebase/app";
import { isSupported, getAnalytics } from "firebase/analytics";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
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

isSupported().then((ok) => { if (ok) getAnalytics(app); }).catch(() => {});

let database;
try {
  database = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch (e) {
  database = getFirestore(app);
}
export const db = database;

export const auth = getAuth(app);

// Koi login nahi hai to anonymous login; staff login hai to wahi rahega
export const authReady = new Promise((resolve) => {
  onAuthStateChanged(auth, (u) => {
    if (u) resolve(u);
    else signInAnonymously(auth).catch((e) => { console.warn("Anonymous auth:", e.code); resolve(null); });
  });
  setTimeout(() => resolve(null), 5000);
});
