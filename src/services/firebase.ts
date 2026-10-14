import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDIQkOhfIa_l4_97NT1FBb0zb3OsvCSA_A",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "auction-93b1a.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "auction-93b1a",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "auction-93b1a.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "771300375884",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:771300375884:web:a0c0af08790a4652bae3e9",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-MDS58SDJVH"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
