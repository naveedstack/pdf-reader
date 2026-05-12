// src/lib/firebase/config.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAWpglAFehJWJT3zV7V74s_Qky8VJVu4w8",
  authDomain: "pdf-reader-f8fea.firebaseapp.com",
  projectId: "pdf-reader-f8fea",
  storageBucket: "pdf-reader-f8fea.firebasestorage.app",
  messagingSenderId: "372032745911",
  appId: "1:372032745911:web:66dc5d30d1bba67915f832",
  measurementId: "G-81W7VDPR8F"
};

// Prevent re-initialization during hot reloads
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };