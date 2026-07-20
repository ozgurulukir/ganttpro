/* Firestore I/O wrappers — pure functions taking data, returning data.
   No app-state globals. All Firestore API calls live here.
   Collections: gantt_user_data, gantt_project_shares, gantt_allowed_users. */
import { db } from './firebase.js';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  runTransaction
} from 'firebase/firestore';

/* ── gantt_user_data ── */

export async function updateSharedProjectAtomic(ownerId, sharedProject) {
  const docRef = doc(db, 'gantt_user_data', ownerId);
  return await runTransaction(db, async transaction => {
    const docSnap = await transaction.get(docRef);
    if (!docSnap.exists()) {
      throw new Error('Owner document does not exist!');
    }
    const data = docSnap.data().data || {};
    if (!data.projects) {
      throw new Error('Owner projects not found!');
    }
    const ownerProjects = data.projects.map(p => (p.id === sharedProject.id ? sharedProject : p));
    transaction.update(docRef, {
      data: {
        ...data,
        projects: ownerProjects
      },
      updated_at: new Date().toISOString()
    });
  });
}

export async function readUserData(uid) {
  const snap = await getDoc(doc(db, 'gantt_user_data', uid));
  if (!snap.exists()) return null;
  return snap.data().data || null;
}

export async function writeUserData(uid, data) {
  await setDoc(
    doc(db, 'gantt_user_data', uid),
    { data, updated_at: new Date().toISOString() },
    { merge: true }
  );
}

export async function updateUserData(uid, data) {
  await updateDoc(doc(db, 'gantt_user_data', uid), { data, updated_at: new Date().toISOString() });
}

export function watchUserData(uid, callback) {
  return onSnapshot(doc(db, 'gantt_user_data', uid), callback);
}

/* ── gantt_project_shares ── */

export async function getProjectSharesForEmail(email) {
  const q = query(collection(db, 'gantt_project_shares'), where('shared_with_email', '==', email));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getProjectSharesForOwner(projId, uid) {
  const q = query(
    collection(db, 'gantt_project_shares'),
    where('project_id', '==', String(projId)),
    where('owner_id', '==', uid)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addProjectShare(docId, data) {
  await setDoc(doc(db, 'gantt_project_shares', docId), data);
}

export async function removeProjectShare(shareId) {
  await deleteDoc(doc(db, 'gantt_project_shares', shareId));
}

/* ── gantt_allowed_users ── */

export async function getAuthorizedUser(email) {
  const snap = await getDoc(doc(db, 'gantt_allowed_users', email));
  return snap.exists() ? snap.data() : null;
}

export async function registerUser(email, data) {
  await setDoc(doc(db, 'gantt_allowed_users', email), data);
}

export async function getAllUsers() {
  const q = query(collection(db, 'gantt_allowed_users'), orderBy('added_at', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

export async function removeUser(email) {
  await deleteDoc(doc(db, 'gantt_allowed_users', email));
}
