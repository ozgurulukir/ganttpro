/* date.test.js — pure-arithmetic date helpers.
   These must pass identically in ANY timezone (no local-time dependence). */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  parseDate,
  formatDate,
  dayOfWeek,
  addDays,
  diffDays,
  yearOf,
  monthOf,
  dayOfMonth,
  startOfMonth,
  endOfMonth,
  addMonths
} from '../src/core/date.js';

test('parseDate — YYYY-MM-DD to day number', () => {
  assert.equal(parseDate('1970-01-01'), 0);
  assert.equal(parseDate('1970-01-02'), 1);
  assert.equal(parseDate('1970-01-31'), 30);
});

test('formatDate — day number to YYYY-MM-DD', () => {
  assert.equal(formatDate(0), '1970-01-01');
  assert.equal(formatDate(1), '1970-01-02');
  assert.equal(formatDate(30), '1970-01-31');
});

test('parseDate / formatDate — round-trip', () => {
  const dates = ['2026-01-01', '2026-04-15', '2026-07-31', '2025-12-31', '2027-02-28'];
  dates.forEach(d => assert.equal(formatDate(parseDate(d)), d));
});

test('dayOfWeek — 0=Sun … 6=Sat', () => {
  assert.equal(dayOfWeek('2026-07-05'), 0); // Sun
  assert.equal(dayOfWeek('2026-07-06'), 1); // Mon
  assert.equal(dayOfWeek('2026-07-04'), 6); // Sat
  assert.equal(dayOfWeek('1970-01-01'), 4); // Thursday
  // Accepts day number too
  assert.equal(dayOfWeek(0), 4); // 1970-01-01 = Thursday
});

test('addDays — forward and backward', () => {
  assert.equal(addDays('2026-07-06', 1), '2026-07-07');
  assert.equal(addDays('2026-07-06', 7), '2026-07-13');
  assert.equal(addDays('2026-07-06', -1), '2026-07-05');
  assert.equal(addDays('2026-07-06', 0), '2026-07-06');
  // Cross month boundary
  assert.equal(addDays('2026-07-31', 1), '2026-08-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('diffDays — integer difference a minus b', () => {
  assert.equal(diffDays('2026-07-07', '2026-07-06'), 1);
  assert.equal(diffDays('2026-07-06', '2026-07-13'), -7);
  assert.equal(diffDays('2026-07-06', '2026-07-06'), 0);
  // Cross month
  assert.equal(diffDays('2026-08-01', '2026-07-31'), 1);
});

test('cross-month/year arithmetic is correct', () => {
  assert.equal(addDays('2025-12-31', 1), '2026-01-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(diffDays('2026-01-01', '2025-12-31'), 1);
});

test('month component helpers read UTC parts of a day number', () => {
  const dn = parseDate('2026-07-15');
  assert.equal(yearOf(dn), 2026);
  assert.equal(monthOf(dn), 6); // 0-based: July = 6
  assert.equal(dayOfMonth(dn), 15);
});

test('startOfMonth and endOfMonth bound the containing month', () => {
  assert.equal(formatDate(startOfMonth(parseDate('2026-07-15'))), '2026-07-01');
  assert.equal(formatDate(endOfMonth(parseDate('2026-07-15'))), '2026-07-31');
  assert.equal(formatDate(endOfMonth(parseDate('2026-02-10'))), '2026-02-28');
  assert.equal(formatDate(endOfMonth(parseDate('2028-02-10'))), '2028-02-29');
  // already at a month boundary
  assert.equal(startOfMonth(parseDate('2026-07-01')), parseDate('2026-07-01'));
  assert.equal(endOfMonth(parseDate('2026-07-31')), parseDate('2026-07-31'));
});

test('addMonths clamps to the target month length', () => {
  const jan31 = parseDate('2026-01-31');
  assert.equal(formatDate(addMonths(jan31, 1)), '2026-02-28');
  assert.equal(formatDate(addMonths(jan31, 13)), '2027-02-28');
  assert.equal(formatDate(addMonths(parseDate('2026-01-15'), 1)), '2026-02-15');
  assert.equal(formatDate(addMonths(parseDate('2026-03-31'), -1)), '2026-02-28');
  assert.equal(formatDate(addMonths(parseDate('2026-12-15'), 2)), '2027-02-15');
});
