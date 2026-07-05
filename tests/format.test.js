/* format.test.js — characterization tests for formatting & color helpers.
   All pure; dateToX and avColor take their config as explicit params. */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { dateToX, toStr, initials, avColor, darkenColor, hexToRgba } from '../src/core/format.js';

/* ── dateToX ── */

test('dateToX — same day is pixel 0', () => {
  assert.equal(dateToX('2026-05-04', new Date('2026-05-04'), 36), 0);
});

test('dateToX — one day later = ppd pixels', () => {
  assert.equal(dateToX('2026-05-05', new Date('2026-05-04'), 36), 36);
  assert.equal(dateToX('2026-05-05', new Date('2026-05-04'), 20), 20);
});

test('dateToX — scales with day offset', () => {
  assert.equal(dateToX('2026-05-11', new Date('2026-05-04'), 36), 252); // 7 * 36
});

/* ── toStr ── */

test('toStr — Date to YYYY-MM-DD', () => {
  assert.equal(toStr(new Date('2026-05-04')), '2026-05-04');
  assert.equal(toStr(new Date('2026-01-15')), '2026-01-15');
});

/* ── initials ── */

test('initials — two words → first + last initial', () => {
  assert.equal(initials('John Doe'), 'JD');
  assert.equal(initials('A B C'), 'AC'); // first + last word
});

test('initials — single word → first 2 chars', () => {
  assert.equal(initials('Alice'), 'AL');
  assert.equal(initials('王小明'), '王小'); // CJK, no spaces
});

test('initials — trims excess whitespace', () => {
  assert.equal(initials('  John   Smith  '), 'JS');
});

/* ── avColor ── */

test('avColor — explicit map override wins', () => {
  assert.equal(avColor('Paul', { Paul: '#123456' }), '#123456');
});

test('avColor — no map entry falls back to deterministic palette', () => {
  const c1 = avColor('Alice', {});
  const c2 = avColor('Alice', undefined);
  assert.equal(c1, c2); // deterministic
  assert.ok(c1.startsWith('#')); // a palette hex
});

test('avColor — different names can map to different colors', () => {
  const a = avColor('Alice', {});
  const b = avColor('Bob', {});
  // (hash collision is possible but these two differ)
  assert.notEqual(a, b);
});

/* ── darkenColor ── */

test('darkenColor — amount 0 is identity (full brightness)', () => {
  assert.equal(darkenColor('#FFFFFF', 0), 'rgb(255,255,255)');
});

test('darkenColor — amount 1 is full black', () => {
  assert.equal(darkenColor('#FFFFFF', 1), 'rgb(0,0,0)');
});

test('darkenColor — 50% darkening of red', () => {
  assert.equal(darkenColor('#FF0000', 0.5), 'rgb(128,0,0)');
});

test('darkenColor — default amount (0.35)', () => {
  assert.equal(darkenColor('#5E6AD2'), 'rgb(61,69,137)');
});

/* ── hexToRgba ── */

test('hexToRgba — valid hex with alpha', () => {
  assert.equal(hexToRgba('#5E6AD2', 0.5), 'rgba(94,106,210,0.5)');
  assert.equal(hexToRgba('#FF0000', 1), 'rgba(255,0,0,1)');
});

test('hexToRgba — short/invalid hex falls back to indigo', () => {
  assert.equal(hexToRgba('#FF', 0.5), 'rgba(94,106,210,0.5)');
  assert.equal(hexToRgba(null, 0.3), 'rgba(94,106,210,0.3)');
  assert.equal(hexToRgba('', 0.2), 'rgba(94,106,210,0.2)');
});
