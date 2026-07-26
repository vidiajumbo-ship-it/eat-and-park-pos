// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDHpVkOeyemH54M_7IjQd735i0K39nckFM",
  authDomain: "eatndpark-19702.firebaseapp.com",
  databaseURL: "https://eatndpark-19702-default-rtdb.firebaseio.com",
  projectId: "eatndpark-19702",
  storageBucket: "eatndpark-19702.firebasestorage.app",
  messagingSenderId: "418398225422",
  appId: "1:418398225422:web:f81c651e9944958cf5a85f",
  measurementId: "G-XYE48M18CQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);