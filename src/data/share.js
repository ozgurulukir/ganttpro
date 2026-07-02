/* Share link encoding + Firestore share-doc I/O. */
import { db } from './firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export function encodeData(obj) {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch(e) { return null; }
}

export function decodeData(b64) {
  try {
    const std = b64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = std + '='.repeat((4 - std.length % 4) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch(e) { console.error('[decode]', e); return null; }
}

export function getOrCreateShareToken(proj) {
  if (!proj.shareToken) {
    proj.shareToken = 'shr_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
  return proj.shareToken;
}

export function saveShareDoc(token, uid, project) {
  const encoded = encodeData(project);
  if (uid) {
    try {
      setDoc(doc(db, 'gantt_shares', token), {
        token, owner_id: uid,
        project_data: JSON.parse(JSON.stringify(project))
      });
    } catch(e) { console.error('saveShareDoc:', e); }
  }
  return encoded;
}

export async function loadShareDoc(token) {
  const snap = await getDoc(doc(db, 'gantt_shares', token));
  return snap.exists() ? (snap.data().project_data || null) : null;
}
