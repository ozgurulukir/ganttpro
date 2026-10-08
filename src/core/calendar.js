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
let _hasLoadedHolidays = false;

export function loadHolidaysFromJSON(data) {
  const entries = Array.isArray(data) ? data : [data];
  for (const entry of entries) {
    if (entry.holidays) {
      Object.assign(_loadedHolidays, entry.holidays);
      if (Object.keys(entry.holidays).length > 0) _hasLoadedHolidays = true;
    }
    if (entry.makeupWorkdays) {
      for (const d of entry.makeupWorkdays) {
        _loadedMakeupWorkdays.add(d);
      }
    }
  }
}

export function resetHolidays() {
  _loadedHolidays = {};
  _loadedMakeupWorkdays = new Set();
  _hasLoadedHolidays = false;
}

export function getHoliday(d) {
  return _loadedHolidays[dateKey(d)] || null;
}

// In-memory work-calendar settings, injected at boot from the data layer
// (see data/local.js loadWorkCalendarSettings) and updated by ui/worktime.js
// on save. Defaults: Monday–Friday, no custom holidays.
let _customHolidays = new Set(); // Set<string> of 'YYYY-MM-DD'
let _workdays = new Set([1, 2, 3, 4, 5]); // Set<number> of dayOfWeek values

export function setCustomHolidays(dates) {
  _customHolidays = new Set(dates);
}

export function setWorkDays(days) {
  _workdays = new Set(days);
}

export function isNonWorkday(s) {
  let dn;
  let str = null;
  if (typeof s === 'number') {
    dn = s;
  } else if (typeof s === 'string') {
    str = s;
    dn = parseDate(s);
  } else if (s instanceof Date) {
    str = s.toISOString().slice(0, 10);
    dn = parseDate(str);
  } else {
    str = String(s);
    dn = parseDate(str);
  }

  // Performance optimization: avoid string formatting and Set/object checks when no holidays are registered
  if (_customHolidays.size > 0 || _hasLoadedHolidays || _loadedMakeupWorkdays.size > 0) {
    if (str === null) str = formatDate(dn);
    if (_customHolidays.has(str)) return true;
    if (_loadedHolidays[str]) return true;
    if (_loadedMakeupWorkdays.has(str)) return false;
  }

  const w = ((dn % 7) + 11) % 7;
  return !_workdays.has(w);
}

/**
 * Subtracts N working days.
 * Note: unlike addWorkingDays, this is non-inclusive of the start day (count starts at 0).
 */
export function subtractWorkingDays(endStr, days) {
  let dn = parseDate(endStr);
  while (isNonWorkday(dn)) dn--;
  let count = 0;
  while (count < days) {
    dn--;
    if (!isNonWorkday(dn)) count++;
  }
  return formatDate(dn);
}

/**
 * Adds N working days.
 * Note: unlike subtractWorkingDays, this is inclusive (start is day 1).
 */
export function addWorkingDays(startStr, days) {
  let dn = parseDate(startStr);
  while (isNonWorkday(dn)) dn++;
  let count = 1; // inclusive: start is day 1
  while (count < days) {
    dn++;
    if (!isNonWorkday(dn)) count++;
  }
  return formatDate(dn);
}

export function nextWorkingDay(dateStr) {
  let dn = parseDate(dateStr) + 1;
  while (isNonWorkday(dn)) dn++;
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
    if (!isNonWorkday(dn)) count++;
    dn++;
  }
  return Math.max(count, 1);
}

// 將日期吸附到工作日：direction >= 0 時往後找、< 0 往前找；已是工作日則不變
export function snapToWorkday(dateStr, direction = 1) {
  let dn = parseDate(dateStr);
  const step = direction >= 0 ? 1 : -1;
  while (isNonWorkday(dn)) dn += step;
  return formatDate(dn);
}
