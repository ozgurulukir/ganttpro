/* Share link encoding + Firestore share-doc I/O. */
import { db } from './firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Projects above this size are refused a share link: browsers truncate URLs
// long before Firestore's 1 MiB doc limit, and a truncated hash silently
// yields a broken link.
export const SHARE_MAX_BYTES = 256 * 1024;

export function encodeData(obj) {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (e) {
    return null;
  }
}

export function decodeData(b64) {
  try {
    const std = b64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = std + '='.repeat((4 - (std.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bytes.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) {
    console.error('[decode]', e);
    return null;
  }
}

function randomToken() {
  // 128 bits of entropy, no semantic prefix — the old `shr_` prefix leaked
  // the Firestore collection name into every shared URL.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function getOrCreateShareToken(proj) {
  if (!proj.shareToken) {
    proj.shareToken = randomToken();
  }
  return proj.shareToken;
}

/**
 * Persist the backing doc for a share link.
 *
 * Signed-in owners: the project lives only in `gantt_shares/{token}` and the
 * URL carries just the token — Firestore rules govern access and the link can
 * be revoked by deleting the doc. Anonymous users have no Firestore write
 * permission, so the encoded project itself goes into the URL hash instead;
 * that blob is unsigned by design (whoever holds the URL holds the data) and
 * cannot be revoked.
 *
 * @returns {{ ok: boolean, encoded: string|null }} `encoded` is set only for
 *   anonymous links; `ok` is false when the Firestore write (or encoding) failed.
 */
export async function saveShareDoc(token, uid, project) {
  if (uid) {
    try {
      await setDoc(doc(db, 'gantt_shares', token), {
        token,
        owner_id: uid,
        project_data: JSON.parse(JSON.stringify(project))
      });
      return { ok: true, encoded: null };
    } catch (e) {
      console.error('saveShareDoc:', e);
      return { ok: false, encoded: null };
    }
  }
  const encoded = encodeData(project);
  return { ok: Boolean(encoded), encoded };
}

export async function loadShareDoc(token) {
  const snap = await getDoc(doc(db, 'gantt_shares', token));
  return snap.exists() ? snap.data().project_data || null : null;
}
