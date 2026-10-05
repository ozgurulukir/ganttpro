/* format.test.js — characterization tests for formatting & color helpers.
   All pure; dateToX and avColor take their config as explicit params. */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  dateToX,
  toStr,
  initials,
  avColor,
  darkenColor,
  hexToRgba,
  csvEsc,
  icalEsc,
  sanitizeUrl,
  esc
} from '../src/core/format.js';

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

/* ── csvEsc ── */

test('csvEsc — escapes formula injection triggers', () => {
  assert.equal(csvEsc('=SUM(1,2)'), '"\'=SUM(1,2)"');
  assert.equal(csvEsc('+100'), "'+100");
  assert.equal(csvEsc('-50'), "'-50");
  assert.equal(csvEsc('@Admin'), "'@Admin");
  assert.equal(csvEsc('\tTabPrefix'), "'\tTabPrefix");
  assert.equal(csvEsc('\rCarriageReturn'), '"\'\rCarriageReturn"');
});

test('csvEsc — escapes formula injection triggers with leading whitespace', () => {
  assert.equal(csvEsc('  =SUM(1,2)'), '"\'  =SUM(1,2)"');
  assert.equal(csvEsc('\t+100'), "'\t+100");
  assert.equal(csvEsc('  @Admin'), "'  @Admin");
});

test('csvEsc — handles standard CSV cell escaping', () => {
  assert.equal(csvEsc('Normal Task'), 'Normal Task');
  assert.equal(csvEsc('Task, with comma'), '"Task, with comma"');
  assert.equal(csvEsc('Task "with quotes"'), '"Task ""with quotes"""');
  assert.equal(csvEsc('Task\nwith newline'), '"Task\nwith newline"');
  assert.equal(csvEsc('Task\rwith carriage return'), '"Task\rwith carriage return"');
  assert.equal(csvEsc(null), '');
  assert.equal(csvEsc(123), '123');
});

/* ── sanitizeUrl ── */

test('sanitizeUrl — allows safe URLs and text', () => {
  assert.equal(sanitizeUrl('https://example.com/doc'), 'https://example.com/doc');
  assert.equal(sanitizeUrl('http://example.com'), 'http://example.com');
  assert.equal(sanitizeUrl('mailto:user@example.com'), 'mailto:user@example.com');
  assert.equal(sanitizeUrl('/relative/path'), '/relative/path');
  assert.equal(sanitizeUrl('DOC-1234'), 'DOC-1234');
});

test('sanitizeUrl — blocks dangerous URI schemes', () => {
  assert.equal(sanitizeUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeUrl('JAVASCRIPT:alert(1)'), '');
  assert.equal(sanitizeUrl('  java\0script:alert(1)  '), '');
  assert.equal(sanitizeUrl('data:text/html,<script>alert(1)</script>'), '');
  assert.equal(sanitizeUrl('vbscript:msgbox(1)'), '');
  assert.equal(sanitizeUrl(null), '');
});

/* ── esc ── */

test('esc — escapes HTML special characters to prevent XSS in template previews', () => {
  assert.equal(esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(
    esc('Phase 1 & Phase 2 "Test" \'Quote\''),
    'Phase 1 &amp; Phase 2 &quot;Test&quot; &#39;Quote&#39;'
  );
  assert.equal(esc(null), '');
});

/* ── icalEsc ── */

test('icalEsc — sanitizes TEXT fields for iCalendar exports', () => {
  assert.equal(icalEsc('Normal Task'), 'Normal Task');
  assert.equal(icalEsc('Task\\With\\Backslash'), 'Task\\\\With\\\\Backslash');
  assert.equal(icalEsc('Task\r\nWith\r\nCRLF'), 'Task  With  CRLF');
  assert.equal(icalEsc('Task, with semicolon; and comma'), 'Task  with semicolon  and comma');
  assert.equal(icalEsc(null), '');
  assert.equal(icalEsc(undefined), '');
});
