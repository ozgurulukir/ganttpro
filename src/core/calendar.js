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
  '2025-01-01':'New Year\'s Day',
  '2025-01-25':'Lunar New Year Holiday','2025-01-26':'Lunar New Year Holiday','2025-01-27':'New Year\'s Eve (flexible holiday)','2025-01-28':'New Year\'s Eve',
  '2025-01-29':'Lunar New Year (Day 1)','2025-01-30':'Lunar New Year (Day 2)','2025-01-31':'Lunar New Year (Day 3)','2025-02-01':'Lunar New Year Holiday','2025-02-02':'Lunar New Year Holiday',
  '2025-02-28':'Peace Memorial Day',
  '2025-04-03':'Children\'s Day (observed)','2025-04-04':'Children\'s Day / Tomb Sweeping Day',
  '2025-05-30':'Dragon Boat Festival (observed)','2025-05-31':'Dragon Boat Festival',
  '2025-09-28':'Teachers\' Day','2025-09-29':'Teachers\' Day (observed)',
  '2025-10-06':'Mid-Autumn Festival',
  '2025-10-10':'National Day',
  '2025-10-24':'Retrocession Day (observed)','2025-10-25':'Retrocession Memorial Day',
  '2025-12-25':'Constitution Day',
  // 2026
  '2026-01-01':'New Year\'s Day',
  '2026-02-15':'New Year\'s Eve','2026-02-16':'New Year\'s Eve','2026-02-17':'Lunar New Year (Day 1)','2026-02-18':'Lunar New Year (Day 2)',
  '2026-02-19':'Lunar New Year (Day 3)','2026-02-20':'New Year\'s Eve (observed)',
  '2026-02-27':'Peace Memorial Day (observed)','2026-02-28':'Peace Memorial Day',
  '2026-04-03':'Children\'s Day (observed)','2026-04-04':'Children\'s Day','2026-04-05':'Tomb Sweeping Day','2026-04-06':'Tomb Sweeping Day (observed)',
  '2026-05-01':'Labor Day',
  '2026-06-19':'Dragon Boat Festival',
  '2026-09-25':'Mid-Autumn Festival','2026-09-28':'Teachers\' Day',
  '2026-10-09':'National Day (observed)','2026-10-10':'National Day',
  '2026-10-25':'Retrocession Memorial Day','2026-10-26':'Retrocession Day (observed)',
  '2026-12-25':'Constitution Day',
  // 2027
  '2027-01-01':'New Year\'s Day',
  '2027-02-04':'New Year\'s Eve','2027-02-05':'New Year\'s Eve','2027-02-06':'Lunar New Year (Day 1)','2027-02-07':'Lunar New Year (Day 2)',
  '2027-02-08':'Lunar New Year (Day 3)','2027-02-09':'Lunar New Year (observed)','2027-02-10':'Lunar New Year (observed)',
  '2027-02-28':'Peace Memorial Day','2027-03-01':'Peace Memorial Day (observed)',
  '2027-04-04':'Children\'s Day','2027-04-05':'Tomb Sweeping Day','2027-04-06':'Children\'s Day (observed)',
  '2027-04-30':'Labor Day (observed)','2027-05-01':'Labor Day',
  '2027-06-09':'Dragon Boat Festival',
  '2027-09-15':'Mid-Autumn Festival','2027-09-28':'Teachers\' Day',
  '2027-10-10':'National Day','2027-10-11':'National Day (observed)',
  '2027-10-25':'Retrocession Memorial Day',
  '2027-12-24':'Constitution Day (observed)','2027-12-25':'Constitution Day',
  '2027-12-31':'New Year\'s Day (observed)'
};
// Make-up workdays (Saturdays that are official workdays)
export const TW_MAKEUP_WORKDAYS = new Set(['2025-02-08']);

export function dateKey(d) { return d instanceof Date ? d.toISOString().slice(0, 10) : String(d); }
export function getHoliday(d) { return TW_HOLIDAYS[dateKey(d)] || null; }
export function isNonWorkday(s) {
  if (s instanceof Date) s = s.toISOString().slice(0, 10);
  if (TW_HOLIDAYS[s]) return true;
  if (TW_MAKEUP_WORKDAYS.has(s)) return false;
  return isWeekend(s);
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
