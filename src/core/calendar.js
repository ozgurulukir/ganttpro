/* ─────────────────────────────────────────────────────────────
    calendar.js — Taiwan working-day calendar
    PURE: no DOM, no global state. Extracted in Phase 1.1.
    Timezone-safe: uses integer day numbers from date.js (no Date object).
    ───────────────────────────────────────────────────────────── */
import { parseDate, formatDate, dayOfWeek } from './date.js';

export function isWeekend(s) {
  if (s instanceof Date) s = s.toISOString().slice(0, 10);
  const w = dayOfWeek(s);
  return w === 0 || w === 6;
}

export function dateKey(d) {
  return d instanceof Date
    ? d.toISOString().slice(0, 10)
    : typeof d === 'number'
      ? formatDate(d)
      : String(d); // Coerce fallback to string for non-Date/non-number inputs
}

// Dynamic holiday store (loaded from JSON via loadHolidaysFromJSON).
let _loadedHolidays = {};
let _loadedMakeupWorkdays = new Set();
let _holidaysLoaded = false;

export function loadHolidaysFromJSON(data) {
  const entries = Array.isArray(data) ? data : [data];
  for (const entry of entries) {
    if (entry.holidays) {
      Object.assign(_loadedHolidays, entry.holidays);
    }
    if (entry.makeupWorkdays) {
      for (const d of entry.makeupWorkdays) {
        _loadedMakeupWorkdays.add(d);
      }
    }
  }
  _holidaysLoaded = true;
}

export function resetHolidays() {
  _loadedHolidays = {};
  _loadedMakeupWorkdays = new Set();
  _holidaysLoaded = false;
}

export function getHoliday(d) {
  return _loadedHolidays[dateKey(d)] || null;
}

// In-memory caches for user-customizable work settings.
// Populated lazily on first isNonWorkday() call, kept in sync via setters
// from worktime.js. Avoids re-parsing localStorage on every call inside
// schedule / count working-days loops.
let _customHolidays = null; // Set<string> of 'YYYY-MM-DD'
let _workdays = null; // Set<number> of dayOfWeek values that are workdays
let _workdaysLoaded = false;

function loadWorkdaysFromLS() {
  try {
    return new Set(JSON.parse(localStorage.getItem('gp_workdays') || '[1,2,3,4,5]'));
  } catch {
    return new Set([1, 2, 3, 4, 5]);
  }
}

function loadHolidaysFromLS() {
  try {
    return new Set(JSON.parse(localStorage.getItem('gp_customHolidays') || '[]').map(h => h.date));
  } catch {
    return new Set();
  }
}

export function setCustomHolidays(dates) {
  _customHolidays = new Set(dates);
}

export function setWorkDays(days) {
  _workdays = new Set(days);
}

export function isNonWorkday(s) {
  if (s instanceof Date) s = s.toISOString().slice(0, 10);
  if (!_customHolidays) _customHolidays = loadHolidaysFromLS();
  if (_customHolidays.has(s)) return true;
  if (_loadedHolidays[s]) return true;
  if (_loadedMakeupWorkdays.has(s)) return false;
  if (!_workdays) _workdays = loadWorkdaysFromLS();
  return !_workdays.has(dayOfWeek(s));
}

/**
 * Subtracts N working days.
 * Note: unlike addWorkingDays, this is non-inclusive of the start day (count starts at 0).
 */
export function subtractWorkingDays(endStr, days) {
  let dn = parseDate(endStr);
  while (isNonWorkday(formatDate(dn))) dn--;
  let count = 0;
  while (count < days) {
    dn--;
    if (!isNonWorkday(formatDate(dn))) count++;
  }
  return formatDate(dn);
}

/**
 * Adds N working days.
 * Note: unlike subtractWorkingDays, this is inclusive (start is day 1).
 */
export function addWorkingDays(startStr, days) {
  let dn = parseDate(startStr);
  while (isNonWorkday(formatDate(dn))) dn++;
  let count = 1; // inclusive: start is day 1
  while (count < days) {
    dn++;
    if (!isNonWorkday(formatDate(dn))) count++;
  }
  return formatDate(dn);
}

export function nextWorkingDay(dateStr) {
  let dn = parseDate(dateStr) + 1;
  while (isNonWorkday(formatDate(dn))) dn++;
  return formatDate(dn);
}

// 將日期前後平移 N 個工作日（正數向後、負數向前；0 不變）
export function shiftWorkingDays(dateStr, days) {
  if (!days) return dateStr;
  return days > 0 ? addWorkingDays(dateStr, days + 1) : subtractWorkingDays(dateStr, -days);
}

export function countWorkingDays(startStr, endStr) {
  let dn = parseDate(startStr);
  const endDn = parseDate(endStr);
  if (dn > endDn) throw new Error('start cannot be after end');
  let count = 0;
  while (dn <= endDn) {
    if (!isNonWorkday(formatDate(dn))) count++;
    dn++;
  }
  return Math.max(count, 1);
}
