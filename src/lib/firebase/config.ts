// src/lib/firebase/config.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Prevent re-initialization during hot reloads
const isFirebaseConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "your_firebase_api_key" && 
  firebaseConfig.apiKey !== "undefined";

if (!isFirebaseConfigured) {
  const errMsg = `
========================================================================
❌ FIREBASE CONFIGURATION ERROR
The Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) is missing or invalid.

Please do the following:
1. Copy '.env.example' to '.env.local' in the root directory:
   cp .env.example .env.local
2. Populate the variables in '.env.local' with your Firebase project credentials.
========================================================================
`;
  console.error(errMsg);
  throw new Error("Firebase API Key is missing or invalid. Check your .env.local configuration.");
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };