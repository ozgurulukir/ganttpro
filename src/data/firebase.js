/* Firebase init — modular v9 SDK.
   Firebase config comes from environment variables (.env).
   Remove this file + remote.js + share.js to remove Firebase entirely. */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
const FB_CONFIG = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

let auth, db, googleProvider;

export let firebaseError = null;

try {
  const app = initializeApp(FB_CONFIG);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
} catch (e) {
  firebaseError = e;
  console.error('[Firebase] Initialization failed:', e);
}

export { auth, db, googleProvider };
