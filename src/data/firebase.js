/* Firebase init — modular v9 SDK.
   Firebase config comes from environment variables (.env).
   Remove this file + remote.js + share.js to remove Firebase entirely. */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const FB_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyA3PDiLdRhHKlGGmkT-iY7L5bTZrsSCyhY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'ganttpro-819d1.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ganttpro-819d1',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'ganttpro-819d1.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID || '68574649003',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:68574649003:web:94692e4f75bacf7669b5ee'
};

const app = initializeApp(FB_CONFIG);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
