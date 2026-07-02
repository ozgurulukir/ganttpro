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

/* ─── 台灣國定假日（政府行政機關辦公日曆表，民國114–116年）─── */
export const TW_HOLIDAYS = {
  // 2025（民國114年）
  '2025-01-01':'元旦',
  '2025-01-25':'春節假期','2025-01-26':'春節假期','2025-01-27':'小年夜（彈性放假）','2025-01-28':'除夕',
  '2025-01-29':'春節初一','2025-01-30':'春節初二','2025-01-31':'春節初三','2025-02-01':'春節假期','2025-02-02':'春節假期',
  '2025-02-28':'和平紀念日',
  '2025-04-03':'兒童節補假','2025-04-04':'兒童節/清明節',
  '2025-05-30':'端午節補假','2025-05-31':'端午節',
  '2025-09-28':'教師節','2025-09-29':'教師節補假',
  '2025-10-06':'中秋節',
  '2025-10-10':'國慶日',
  '2025-10-24':'光復節補假','2025-10-25':'臺灣光復紀念日',
  '2025-12-25':'行憲紀念日',
  // 2026（民國115年）
  '2026-01-01':'元旦',
  '2026-02-15':'小年夜','2026-02-16':'除夕','2026-02-17':'春節初一','2026-02-18':'春節初二',
  '2026-02-19':'春節初三','2026-02-20':'小年夜補假',
  '2026-02-27':'和平紀念日補假','2026-02-28':'和平紀念日',
  '2026-04-03':'兒童節補假','2026-04-04':'兒童節','2026-04-05':'清明節','2026-04-06':'清明節補假',
  '2026-05-01':'勞動節',
  '2026-06-19':'端午節',
  '2026-09-25':'中秋節','2026-09-28':'教師節',
  '2026-10-09':'國慶日補假','2026-10-10':'國慶日',
  '2026-10-25':'臺灣光復紀念日','2026-10-26':'光復節補假',
  '2026-12-25':'行憲紀念日',
  // 2027（民國116年）
  '2027-01-01':'元旦',
  '2027-02-04':'小年夜','2027-02-05':'除夕','2027-02-06':'春節初一','2027-02-07':'春節初二',
  '2027-02-08':'春節初三','2027-02-09':'春節補假','2027-02-10':'春節補假',
  '2027-02-28':'和平紀念日','2027-03-01':'和平紀念日補假',
  '2027-04-04':'兒童節','2027-04-05':'清明節','2027-04-06':'兒童節補假',
  '2027-04-30':'勞動節補假','2027-05-01':'勞動節',
  '2027-06-09':'端午節',
  '2027-09-15':'中秋節','2027-09-28':'教師節',
  '2027-10-10':'國慶日','2027-10-11':'國慶日補假',
  '2027-10-25':'臺灣光復紀念日',
  '2027-12-24':'行憲紀念日補假','2027-12-25':'行憲紀念日',
  '2027-12-31':'元旦補假'
};
// 補行上班的週六（2025 下半年起補班制度已廢除）
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
