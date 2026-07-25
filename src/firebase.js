// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; //

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDSMZGg9JrD53aPabLkjLV6Y23f3AXpdW8",
  authDomain: "eat-and-park.firebaseapp.com",
  projectId: "eat-and-park",
  storageBucket: "eat-and-park.firebasestorage.app",
  messagingSenderId: "868395201303",
  appId: "1:868395201303:web:171425ef56a4cfeab1bd52"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app); //
