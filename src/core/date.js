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
