/* Firebase init — modular v9 SDK (replaces CDN compat scripts).
   All Firebase imports live here. Removing this file + remote.js + share.js
   removes Firebase entirely. */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const FB_CONFIG = {
  apiKey: "AIzaSyA3PDiLdRhHKlGGmkT-iY7L5bTZrsSCyhY",
  authDomain: "ganttpro-819d1.firebaseapp.com",
  projectId: "ganttpro-819d1",
  storageBucket: "ganttpro-819d1.firebasestorage.app",
  messagingSenderId: "68574649003",
  appId: "1:68574649003:web:94692e4f75bacf7669b5ee"
};

const app = initializeApp(FB_CONFIG);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
