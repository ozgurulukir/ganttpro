/* LocalStorage I/O — pure functions, no app state. */
const LS_KEY = 'ganttpro_v1';
const OWNER_KEY = 'ganttpro_owner_id';
export const WORKDAYS_KEY = 'gp_workdays';
export const HOLIDAYS_KEY = 'gp_customHolidays';

// Work-calendar settings (consumed by core/calendar.js via setters at boot
// and by ui/worktime.js for the settings modal). Holidays are {date, label}.
export function loadWorkCalendarSettings() {
  let workdays = [1, 2, 3, 4, 5];
  let holidays = [];
  try {
    workdays = JSON.parse(localStorage.getItem(WORKDAYS_KEY)) || workdays;
  } catch {}
  try {
    holidays = JSON.parse(localStorage.getItem(HOLIDAYS_KEY)) || holidays;
  } catch {}
  return { workdays, holidays };
}

export function saveToLS(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('saveToLS:', e);
    throw e;
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

// Note: OWNER_KEY assumes a one-to-one mapping between browser profile and user.
// It does not support shared devices well.
export function getOwnerId() {
  let id = localStorage.getItem(OWNER_KEY);
  if (!id) {
    id = 'own_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem(OWNER_KEY, id);
  }
  return id;
}
