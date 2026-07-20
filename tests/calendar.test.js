/* calendar.test.js — characterization tests for the working-day calendar.
   Timezone-safe: uses integer day numbers from date.js (no Date object). */
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  isWeekend,
  dateKey,
  getHoliday,
  isNonWorkday,
  subtractWorkingDays,
  addWorkingDays,
  nextWorkingDay,
  shiftWorkingDays,
  countWorkingDays,
  loadHolidaysFromJSON
} from '../src/core/calendar.js';

const holidayData = JSON.parse(
  readFileSync(new URL('../public/holidays/tw.json', import.meta.url), 'utf-8')
);
loadHolidaysFromJSON(holidayData);

test('isWeekend — Saturday and Sunday are weekends', () => {
  assert.equal(isWeekend('2026-07-04'), true); // Sat
  assert.equal(isWeekend('2026-07-05'), true); // Sun
  assert.equal(isWeekend('2026-07-06'), false); // Mon
});

test('dateKey — normalizes Date and string to YYYY-MM-DD', () => {
  assert.equal(dateKey(new Date('2026-07-06')), '2026-07-06');
  assert.equal(dateKey('2026-07-06'), '2026-07-06');
});

test('getHoliday — returns TW holiday key or null', () => {
  assert.equal(getHoliday('2026-01-01'), 'holidays.newYear');
  assert.equal(getHoliday('2026-02-28'), 'holidays.peaceMemorialDay');
  assert.equal(getHoliday('2026-07-02'), null);
});

test('isNonWorkday — holiday, weekend, and makeup-workday override', () => {
  assert.equal(isNonWorkday('2026-01-01'), true); // holiday
  assert.equal(isNonWorkday('2026-07-04'), true); // Sat
  assert.equal(isNonWorkday('2026-07-06'), false); // Mon
  assert.equal(isNonWorkday('2025-02-08'), false); // Sat but makeup workday
});

test('addWorkingDays — inclusive start is day 1, skips weekends', () => {
  assert.equal(addWorkingDays('2026-07-06', 1), '2026-07-06'); // Mon stays (day 1)
  assert.equal(addWorkingDays('2026-07-06', 2), '2026-07-07'); // Mon→Tue
  assert.equal(addWorkingDays('2026-07-09', 3), '2026-07-13'); // Thu→Fri, skip, Mon
  assert.equal(addWorkingDays('2026-07-04', 1), '2026-07-06'); // Sat snaps forward to Mon
});

test('nextWorkingDay — one working day after given date', () => {
  assert.equal(nextWorkingDay('2026-07-10'), '2026-07-13'); // Fri → Mon
  assert.equal(nextWorkingDay('2026-07-06'), '2026-07-07'); // Mon → Tue
});

test('subtractWorkingDays — counts back working days', () => {
  assert.equal(subtractWorkingDays('2026-07-13', 1), '2026-07-10'); // Mon → Fri
  assert.equal(subtractWorkingDays('2026-07-06', 1), '2026-07-03'); // Mon → Fri
});

test('countWorkingDays — inclusive both ends, floors at 1', () => {
  assert.equal(countWorkingDays('2026-07-06', '2026-07-10'), 5); // Mon–Fri
  assert.equal(countWorkingDays('2026-07-06', '2026-07-13'), 6); // Mon–Fri + next Mon
  assert.equal(countWorkingDays('2026-07-06', '2026-07-06'), 1); // single day
});

test('countWorkingDays — throws on start > end', () => {
  assert.throws(() => countWorkingDays('2026-07-10', '2026-07-06'), /start cannot be after end/);
});

test('shiftWorkingDays — 0 no-op, positive forward, negative back', () => {
  assert.equal(shiftWorkingDays('2026-07-06', 0), '2026-07-06');
  assert.equal(shiftWorkingDays('2026-07-06', 2), '2026-07-08'); // Mon→Wed
  assert.equal(shiftWorkingDays('2026-07-06', -1), '2026-07-03'); // Mon→Fri
});
