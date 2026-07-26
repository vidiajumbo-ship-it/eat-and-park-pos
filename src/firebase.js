// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore"; // <-- Yeh zaroori hai database ke liye

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC67vNT4nVAHm31Dohgjl4K5lJ5EQS7pe4",
  authDomain: "enpmenu.firebaseapp.com",
  projectId: "enpmenu",
  storageBucket: "enpmenu.firebasestorage.app",
  messagingSenderId: "942888978604",
  appId: "1:942888978604:web:2a666ebd59ff26d0cc7709",
  measurementId: "G-6VEE32JDC8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// <-- Yeh line add karein taaki baaki files mein db use kar sakein
export const db = getFirestore(app);