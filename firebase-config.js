// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA6QdDU531f2DCSYn6MsC7a5Tata7rZlGs",
  authDomain: "udapelis.firebaseapp.com",
  projectId: "udapelis",
  storageBucket: "udapelis.firebasestorage.app",
  messagingSenderId: "74939826463",
  appId: "1:74939826463:web:5c79a224abc52ab193b02a",
  measurementId: "G-73649W2X4F"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);

