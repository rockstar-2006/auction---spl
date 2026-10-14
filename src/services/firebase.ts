import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyDIQkOhfIa_l4_97NT1FBb0zb3OsvCSA_A",
  authDomain: "auction-93b1a.firebaseapp.com",
  projectId: "auction-93b1a",
  storageBucket: "auction-93b1a.firebasestorage.app",
  messagingSenderId: "771300375884",
  appId: "1:771300375884:web:a0c0af08790a4652bae3e9",
  measurementId: "G-MDS58SDJVH"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
