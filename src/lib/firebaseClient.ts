import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export const isFirebaseConfigured = 
  !!firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'your-firebase-api-key' &&
  !!firebaseConfig.projectId;

// Initialize Firebase only if configured and not already initialized
const app = isFirebaseConfigured
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApp())
  : null;

export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;

if (!isFirebaseConfigured) {
  console.warn(
    'Firebase environment variables are missing. The productivity app will run in "Local Demo Mode" using Zustand state & localStorage persistence.'
  );
}
