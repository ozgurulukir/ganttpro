/**
 * Pure-arithmetic date helpers — no Date object needed for calendar math.
 *
 * Dates in this app are 'YYYY-MM-DD' calendar strings with no time component.
 * The old code mixed UTC-parsed dates (`new Date('2026-04-01')` → UTC midnight)
 * with local-time getters (`.getDate()`, `.getDay()`), causing day-shift bugs on
 * machines west of UTC. This module eliminates the Date object entirely from
 * calendar arithmetic by operating on integer day numbers.
 *
 * Day number = days since 1970-01-01 (UTC epoch), computed via Date.UTC.
 */

const MS_PER_DAY = 86400000;

/** Parse 'YYYY-MM-DD' → integer day number (days since 1970-01-01). */
export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** Integer day number → 'YYYY-MM-DD'. */
export function formatDate(dayNum) {
  return new Date(dayNum * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Day of week: 0=Sun, 1=Mon, …, 6=Sat. Accepts string or day number. */
export function dayOfWeek(s) {
  const dn = typeof s === 'string' ? parseDate(s) : s;
  return (dn + 4) % 7; // 1970-01-01 was Thursday (4)
}

/** Add n days to a date string → new 'YYYY-MM-DD'. */
export function addDays(str, n) {
  return formatDate(parseDate(str) + n);
}

/** Integer difference: how many days from b to a (a - b). */
export function diffDays(a, b) {
  return parseDate(a) - parseDate(b);
}

/** Year (UTC) of a day number. */
export function yearOf(dn) {
  return new Date(dn * MS_PER_DAY).getUTCFullYear();
}

/** Month (0–11, UTC) of a day number. */
export function monthOf(dn) {
  return new Date(dn * MS_PER_DAY).getUTCMonth();
}

/** Day of month (1–31, UTC) of a day number. */
export function dayOfMonth(dn) {
  return new Date(dn * MS_PER_DAY).getUTCDate();
}

/** Day number of the first day of the month containing dn. */
export function startOfMonth(dn) {
  const d = new Date(dn * MS_PER_DAY);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / MS_PER_DAY);
}

/** Day number of the last day of the month containing dn. */
export function endOfMonth(dn) {
  const d = new Date(dn * MS_PER_DAY);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0) / MS_PER_DAY);
}

/** Day number n months after dn, clamped to the target month's length (Jan 31 + 1mo → Feb 28/29). */
export function addMonths(dn, n) {
  const d = new Date(dn * MS_PER_DAY);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const lastOfTarget = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Math.floor(Date.UTC(y, m, Math.min(d.getUTCDate(), lastOfTarget)) / MS_PER_DAY);
}
