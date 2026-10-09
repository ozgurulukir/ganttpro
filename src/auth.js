import { auth, googleProvider } from './data/firebase.js';
import { signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import * as Remote from './data/remote.js';
import { clearAuditLog } from './data/audit.js';
import { D } from './render/deps.js';
import { t } from './i18n/index.js';

// Read admin email from Vite env var.
// Copy .env.example to .env and set VITE_ADMIN_EMAIL to your email.
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
export const ADMIN_EMAIL = env.VITE_ADMIN_EMAIL || '';

export function isAdmin() {
  const user = D.GetCurrentUser();
  return user?.email === ADMIN_EMAIL;
}

export async function signInWithGoogle() {
  document.getElementById('loginError').style.display = 'none';
  if (!auth) {
    alert(t('login.registerFailed') + 'Firebase is not available.');
    return;
  }
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user') alert(t('login.registerFailed') + e.message);
  }
}

export async function signInAsGuest() {
  D.SetGuestMode(true);
  try {
    await Promise.race([
      D.initApp(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('initApp timeout')), 10000))
    ]);
  } catch (e) {
    console.error('Guest mode init failed:', e);
    D.revealLogin?.();
    throw e;
  }
  D.setSyncDot('local');
}

export async function checkAuthorized() {
  const user = D.GetCurrentUser();
  if (!user) return false;
  const userData = await Remote.getAuthorizedUser(user.email);
  if (!userData) {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginPanel').style.display = 'none';
    document.getElementById('registerPanel').style.display = 'flex';
    document.getElementById('registerNickname').focus();
    return false;
  }
  return true;
}

export async function submitRegister() {
  const user = D.GetCurrentUser();
  const nickname = document.getElementById('registerNickname').value.trim();
  const errEl = document.getElementById('registerError');
  if (!nickname) {
    errEl.textContent = t('login.nicknameRequired');
    errEl.style.display = '';
    return;
  }
  errEl.style.display = 'none';
  try {
    await Remote.registerUser(user.email, {
      email: user.email,
      name: nickname,
      is_admin: false,
      added_at: new Date().toISOString()
    });
    document.getElementById('registerPanel').style.display = 'none';
    document.getElementById('loginPanel').style.display = 'flex';
    await D.initApp();
  } catch (e) {
    errEl.textContent = t('login.registerFailed') + e.message;
    errEl.style.display = '';
  }
}

export async function signOut() {
  D.cleanupRealtime?.();
  // Audit entries contain task/project names — wipe them so the next user
  // on a shared device cannot read the previous session's activity.
  clearAuditLog();
  if (!D.IsGuestMode()) await firebaseSignOut(auth);
  D.SetCurrentUser(null);
  D.SetGuestMode(false);
  D.SetAppInitialized(false);
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginPanel').style.display = 'flex';
  document.getElementById('registerPanel').style.display = 'none';
  document.getElementById('registerNickname').value = '';
  document.getElementById('registerError').style.display = 'none';
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('appToolbar').style.display = 'none';
  document.getElementById('main').style.display = 'none';
  document.getElementById('userDisplay').innerHTML = '';
  document.getElementById('signOutBtn').style.display = 'none';
}
