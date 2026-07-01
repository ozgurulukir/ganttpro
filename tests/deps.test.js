/* deps.test.js — characterization tests for dependency parsing & cycle detection.
   Fixture is a flat root-level tree so row numbers = array index + 1. */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  wouldCreateCycle,
  buildDepsText,
  parseDepInput,
  lagsFromParsed
} from '../src/core/deps.js';

/*   A (row 1) — no deps
 *   B (row 2) — deps: [A]
 *   C (row 3) — deps: [B], sdeps: [A]
 *   D (row 4) — ffdeps: [A], sfdeps: [B]            */
const TASKS = [
  { id: 'A', parent: null, type: 'task', start: '2026-05-01', end: '2026-05-05' },
  { id: 'B', parent: null, type: 'task', start: '2026-05-02', end: '2026-05-06', deps: ['A'] },
  {
    id: 'C',
    parent: null,
    type: 'task',
    start: '2026-05-03',
    end: '2026-05-07',
    deps: ['B'],
    sdeps: ['A']
  },
  {
    id: 'D',
    parent: null,
    type: 'task',
    start: '2026-05-04',
    end: '2026-05-08',
    ffdeps: ['A'],
    sfdeps: ['B']
  }
];
const EMPTY = new Set();
const MS = false;

test('wouldCreateCycle — direct back-edge creates cycle', () => {
  // B already depends on A, so A depending on B would loop
  assert.equal(wouldCreateCycle(TASKS, 'A', 'B'), true);
});

test('wouldCreateCycle — forward edge is safe', () => {
  // A depends on nothing, so D depending on A is fine
  assert.equal(wouldCreateCycle(TASKS, 'D', 'A'), false);
});

test('wouldCreateCycle — transitive back-edge creates cycle', () => {
  // C -> B -> A, so A depending on C would loop
  assert.equal(wouldCreateCycle(TASKS, 'A', 'C'), true);
});

test('wouldCreateCycle — cycle via sfdeps', () => {
  // D sfdeps B, so B depending on D would loop
  assert.equal(wouldCreateCycle(TASKS, 'B', 'D'), true);
});

test('wouldCreateCycle — pre-existing cycle does not hang (visited guard)', () => {
  const cyclic = [
    { id: 'X', parent: null, type: 'task', deps: ['Y'] },
    { id: 'Y', parent: null, type: 'task', deps: ['X'] }
  ];
  // Z is unreachable from the X<->Y cycle, so no cycle to Z
  assert.equal(wouldCreateCycle(cyclic, 'Z', 'X'), false);
});

test('lagsFromParsed — maps nonzero lags, drops zero', () => {
  const parsed = [
    { type: 'FS', taskId: 'A', lag: 3 },
    { type: 'SS', taskId: 'B', lag: 0 },
    { type: 'FF', taskId: 'C', lag: -2 }
  ];
  assert.deepEqual(lagsFromParsed(parsed), { FSA: 3, FFC: -2 });
  assert.deepEqual(lagsFromParsed([]), {});
});

test('parseDepInput — empty string yields []', () => {
  assert.deepEqual(parseDepInput('', 'C', TASKS, EMPTY, MS), []);
  assert.deepEqual(parseDepInput('   ', 'C', TASKS, EMPTY, MS), []);
});

test('parseDepInput — valid FS entry with explicit type', () => {
  const r = parseDepInput('1FS', 'C', TASKS, EMPTY, MS);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0], { rowNum: 1, type: 'FS', lag: 0, taskId: 'A', raw: '1FS' });
});

test('parseDepInput — defaults type to FS, parses +lag', () => {
  const r = parseDepInput('3SS+2', 'D', TASKS, EMPTY, MS);
  assert.deepEqual(r[0], { rowNum: 3, type: 'SS', lag: 2, taskId: 'C', raw: '3SS+2' });
});

test('parseDepInput — self-reference is an error', () => {
  const r = parseDepInput('1', 'A', TASKS, EMPTY, MS);
  assert.equal(r[0].err, '不能設定自己為前置任務');
});

test('parseDepInput — nonexistent row is an error', () => {
  const r = parseDepInput('99', 'A', TASKS, EMPTY, MS);
  assert.equal(r[0].err, '找不到第 99 列任務');
});

test('parseDepInput — bad format is an error', () => {
  const r = parseDepInput('xyz', 'A', TASKS, EMPTY, MS);
  assert.equal(r[0].err, '格式錯誤（應為：2FS、3SS 或 2FS+3）');
});

test('parseDepInput — cycle is detected and reported', () => {
  // A depending on B (row 2) would cycle since B already deps A
  const r = parseDepInput('2', 'A', TASKS, EMPTY, MS);
  assert.equal(r[0].err, '循環依賴：對方已依賴此任務');
});

test('parseDepInput — multiple valid entries separated by comma', () => {
  const r = parseDepInput('1FS, 2SS', 'D', TASKS, EMPTY, MS);
  assert.equal(r.length, 2);
  assert.equal(r[0].taskId, 'A');
  assert.equal(r[1].taskId, 'B');
});

test('parseDepInput — mixed valid and errors in one input', () => {
  const r = parseDepInput('1FS, xyz, 99', 'D', TASKS, EMPTY, MS);
  assert.equal(r.length, 3);
  assert.ok(!r[0].err); // 1FS ok
  assert.equal(r[1].err, '格式錯誤（應為：2FS、3SS 或 2FS+3）');
  assert.equal(r[2].err, '找不到第 99 列任務');
});

test('buildDepsText — renders FS and SS with row numbers', () => {
  const C = TASKS[2];
  assert.equal(buildDepsText(TASKS, EMPTY, MS, C), '2FS, 1SS');
});

test('buildDepsText — renders FF and SF', () => {
  const D = TASKS[3];
  assert.equal(buildDepsText(TASKS, EMPTY, MS, D), '1FF, 2SF');
});

test('buildDepsText — no deps yields empty string', () => {
  assert.equal(buildDepsText(TASKS, EMPTY, MS, TASKS[0]), '');
});

test('buildDepsText — positive and negative lag suffixes', () => {
  const posLag = { id: 'E', parent: null, type: 'task', deps: ['A'], lags: { FSA: 3 } };
  assert.equal(buildDepsText(TASKS, EMPTY, MS, posLag), '1FS+3');
  const negLag = { id: 'E', parent: null, type: 'task', deps: ['A'], lags: { FSA: -2 } };
  assert.equal(buildDepsText(TASKS, EMPTY, MS, negLag), '1FS-2');
});

test('buildDepsText — lag 0 produces no suffix', () => {
  const zeroLag = { id: 'E', parent: null, type: 'task', deps: ['A'], lags: { FSA: 0 } };
  assert.equal(buildDepsText(TASKS, EMPTY, MS, zeroLag), '1FS');
});
