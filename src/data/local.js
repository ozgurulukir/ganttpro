/* LocalStorage I/O — pure functions, no app state. */
const LS_KEY = 'ganttpro_v1';
const OWNER_KEY = 'ganttpro_owner_id';

export function saveToLS(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('saveToLS:', e);
  }
}

export function loadFromLS() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function getOwnerId() {
  let id = localStorage.getItem(OWNER_KEY);
  if (!id) {
    id = 'own_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem(OWNER_KEY, id);
  }
  return id;
}
