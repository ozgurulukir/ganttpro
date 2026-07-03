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

/* ─── Taiwan Public Holidays (government office calendar, 2025–2027) ─── */
export const TW_HOLIDAYS = {
  // 2025
  '2025-01-01': 'holidays.newYear',
  '2025-01-25': 'holidays.lunarNewYearHoliday',
  '2025-01-26': 'holidays.lunarNewYearHoliday',
  '2025-01-27': 'holidays.newYearsEveFlexible',
  '2025-01-28': 'holidays.newYearsEve',
  '2025-01-29': 'holidays.lunarNewYear1',
  '2025-01-30': 'holidays.lunarNewYear2',
  '2025-01-31': 'holidays.lunarNewYear3',
  '2025-02-01': 'holidays.lunarNewYearHoliday',
  '2025-02-02': 'holidays.lunarNewYearHoliday',
  '2025-02-28': 'holidays.peaceMemorialDay',
  '2025-04-03': 'holidays.childrensDayObserved',
  '2025-04-04': 'holidays.childrensTombSweeping',
  '2025-05-30': 'holidays.dragonBoatFestivalObserved',
  '2025-05-31': 'holidays.dragonBoatFestival',
  '2025-09-28': 'holidays.teachersDay',
  '2025-09-29': 'holidays.teachersDayObserved',
  '2025-10-06': 'holidays.midAutumnFestival',
  '2025-10-10': 'holidays.nationalDay',
  '2025-10-24': 'holidays.retrocessionDayObserved',
  '2025-10-25': 'holidays.retrocessionDay',
  '2025-12-25': 'holidays.constitutionDay',
  // 2026
  '2026-01-01': 'holidays.newYear',
  '2026-02-15': 'holidays.newYearsEve',
  '2026-02-16': 'holidays.newYearsEve',
  '2026-02-17': 'holidays.lunarNewYear1',
  '2026-02-18': 'holidays.lunarNewYear2',
  '2026-02-19': 'holidays.lunarNewYear3',
  '2026-02-20': 'holidays.newYearsEveObserved',
  '2026-02-27': 'holidays.peaceMemorialDayObserved',
  '2026-02-28': 'holidays.peaceMemorialDay',
  '2026-04-03': 'holidays.childrensDayObserved',
  '2026-04-04': 'holidays.childrensDay',
  '2026-04-05': 'holidays.tombSweepingDay',
  '2026-04-06': 'holidays.tombSweepingDayObserved',
  '2026-05-01': 'holidays.laborDay',
  '2026-06-19': 'holidays.dragonBoatFestival',
  '2026-09-25': 'holidays.midAutumnFestival',
  '2026-09-28': 'holidays.teachersDay',
  '2026-10-09': 'holidays.nationalDayObserved',
  '2026-10-10': 'holidays.nationalDay',
  '2026-10-25': 'holidays.retrocessionDay',
  '2026-10-26': 'holidays.retrocessionDayObserved',
  '2026-12-25': 'holidays.constitutionDay',
  // 2027
  '2027-01-01': 'holidays.newYear',
  '2027-02-04': 'holidays.newYearsEve',
  '2027-02-05': 'holidays.newYearsEve',
  '2027-02-06': 'holidays.lunarNewYear1',
  '2027-02-07': 'holidays.lunarNewYear2',
  '2027-02-08': 'holidays.lunarNewYear3',
  '2027-02-09': 'holidays.lunarNewYearObserved',
  '2027-02-10': 'holidays.lunarNewYearObserved',
  '2027-02-28': 'holidays.peaceMemorialDay',
  '2027-03-01': 'holidays.peaceMemorialDayObserved',
  '2027-04-04': 'holidays.childrensDay',
  '2027-04-05': 'holidays.tombSweepingDay',
  '2027-04-06': 'holidays.childrensDayObserved',
  '2027-04-30': 'holidays.laborDayObserved',
  '2027-05-01': 'holidays.laborDay',
  '2027-06-09': 'holidays.dragonBoatFestival',
  '2027-09-15': 'holidays.midAutumnFestival',
  '2027-09-28': 'holidays.teachersDay',
  '2027-10-10': 'holidays.nationalDay',
  '2027-10-11': 'holidays.nationalDayObserved',
  '2027-10-25': 'holidays.retrocessionDay',
  '2027-12-24': 'holidays.constitutionDayObserved',
  '2027-12-25': 'holidays.constitutionDay',
  '2027-12-31': 'holidays.newYearObserved'
};
// Make-up workdays (Saturdays that are official workdays)
export const TW_MAKEUP_WORKDAYS = new Set(['2025-02-08']);

export function dateKey(d) {
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d);
}
export function getHoliday(d) {
  return TW_HOLIDAYS[dateKey(d)] || null;
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
  if (TW_HOLIDAYS[s]) return true;
  if (TW_MAKEUP_WORKDAYS.has(s)) return false;
  if (!_workdays) _workdays = loadWorkdaysFromLS();
  return !_workdays.has(dayOfWeek(s));
}

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
  let count = 0;
  while (dn <= endDn) {
    if (!isNonWorkday(formatDate(dn))) count++;
    dn++;
  }
  return Math.max(count, 1);
}
