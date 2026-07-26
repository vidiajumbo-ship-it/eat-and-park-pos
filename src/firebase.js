// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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