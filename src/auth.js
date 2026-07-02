import { auth, googleProvider } from "./data/firebase.js";
import * as Remote from "./data/remote.js";
import { D } from "./render/deps.js";
import { t } from "./i18n/index.js";

const ADMIN_EMAIL = 's19800430@gmail.com';

export function isAdmin() {
  const user = D.GetCurrentUser();
  return user?.email === ADMIN_EMAIL;
}

export async function signInWithGoogle() {
  document.getElementById('loginError').style.display = 'none';
  try {
    await auth.signInWithPopup(googleProvider);
  } catch(e) {
    if (e.code !== 'auth/popup-closed-by-user') alert(t('login.registerFailed') + e.message);
  }
}

export async function signInAsGuest() {
  D.SetGuestMode(true);
  await D.initApp();
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
      email: user.email, name: nickname,
      is_admin: false, added_at: new Date().toISOString()
    });
    document.getElementById('registerPanel').style.display = 'none';
    document.getElementById('loginPanel').style.display = 'flex';
    await D.initApp();
  } catch(e) {
    errEl.textContent = t('login.registerFailed') + e.message;
    errEl.style.display = '';
  }
}

export async function signOut() {
  if (!D.IsGuestMode()) await auth.signOut();
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
