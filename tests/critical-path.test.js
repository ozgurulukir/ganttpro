/* critical-path.test.js — characterization tests for CPM backward pass.
   Dates use 2026-05 where May 4=Mon, 8=Fri, 11=Mon (no holidays in range).
   Forward pass (ES/EF = start/end) is pre-supplied — we test only the backward
   pass + float classification that computeCriticalPath owns. */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  prevWorkingDay,
  computeCriticalPath,
  getCriticalPredTaskIds
} from '../src/core/critical-path.js';

/* ── prevWorkingDay ── */

test('prevWorkingDay — backs up over a weekend', () => {
  // Mon May 11 -> Sun 10 (weekend) -> Sat 9 (weekend) -> Fri 8
  assert.equal(prevWorkingDay('2026-05-11'), '2026-05-08');
});

test('prevWorkingDay — single day back when previous is a workday', () => {
  // Wed May 6 -> Tue May 5
  assert.equal(prevWorkingDay('2026-05-06'), '2026-05-05');
});

test('prevWorkingDay — backs up over Labour Day holiday (May 1)', () => {
  // Mon May 4 -> Sun 3 -> Sat 2 -> Fri May 1 (holiday) -> Thu Apr 30
  assert.equal(prevWorkingDay('2026-05-04'), '2026-04-30');
});

/* ── computeCriticalPath ── */

test('computeCriticalPath — empty task list yields empty set', () => {
  assert.equal(computeCriticalPath([]).size, 0);
});

test('computeCriticalPath — single task is critical', () => {
  const tasks = [{ id: 'A', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-04' }];
  const c = computeCriticalPath(tasks);
  assert.ok(c.has('A'));
});

test('computeCriticalPath — linear FS chain: all critical (zero float)', () => {
  const tasks = [
    { id: 'A', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-05' },
    { id: 'B', parent: null, type: 'task', start: '2026-05-06', end: '2026-05-07', deps: ['A'] },
    { id: 'C', parent: null, type: 'task', start: '2026-05-08', end: '2026-05-08', deps: ['B'] }
  ];
  const c = computeCriticalPath(tasks);
  assert.ok(c.has('A'));
  assert.ok(c.has('B'));
  assert.ok(c.has('C'));
  assert.equal(c.size, 3);
});

test('computeCriticalPath — parallel paths: longer path critical, shorter has float', () => {
  //   A(1d) -> B(4d, May5-8) -> D(May11)
  //    \----> C(1d, May5) ----/
  // A->B->D is longer; C has float.
  const tasks = [
    { id: 'A', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-04' },
    { id: 'B', parent: null, type: 'task', start: '2026-05-05', end: '2026-05-08', deps: ['A'] },
    { id: 'C', parent: null, type: 'task', start: '2026-05-05', end: '2026-05-05', deps: ['A'] },
    { id: 'D', parent: null, type: 'task', start: '2026-05-11', end: '2026-05-11', deps: ['B', 'C'] }
  ];
  const c = computeCriticalPath(tasks);
  assert.ok(c.has('A'), 'A critical');
  assert.ok(c.has('B'), 'B critical (longer path)');
  assert.ok(c.has('D'), 'D critical');
  assert.ok(!c.has('C'), 'C has float, not critical');
  assert.equal(c.size, 3);
});

test('computeCriticalPath — milestones participate but are excluded from result', () => {
  // A(task) -> M(milestone) -> B(task); all zero-float, but M not in result
  const tasks = [
    { id: 'A', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-04' },
    { id: 'M', parent: null, type: 'milestone', date: '2026-05-05', deps: ['A'] },
    { id: 'B', parent: null, type: 'task', start: '2026-05-06', end: '2026-05-06', deps: ['M'] }
  ];
  const c = computeCriticalPath(tasks);
  assert.ok(c.has('A'));
  assert.ok(c.has('B'));
  assert.ok(!c.has('M'), 'milestone excluded from result set');
  assert.equal(c.size, 2);
});

/* ── getCriticalPredTaskIds ── */

test('getCriticalPredTaskIds — returns critical task predecessor', () => {
  const tasks = [
    { id: 'A', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-05' },
    { id: 'B', parent: null, type: 'task', start: '2026-05-06', end: '2026-05-07', deps: ['A'] },
    { id: 'C', parent: null, type: 'task', start: '2026-05-08', end: '2026-05-08', deps: ['B'] }
  ];
  const crit = computeCriticalPath(tasks);
  const preds = getCriticalPredTaskIds(tasks, crit, tasks[2]); // C's predecessors
  assert.deepEqual(preds, ['B']);
});

test('getCriticalPredTaskIds — milestone is transparent (traced through)', () => {
  const tasks = [
    { id: 'A', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-04' },
    { id: 'M', parent: null, type: 'milestone', date: '2026-05-05', deps: ['A'] },
    { id: 'B', parent: null, type: 'task', start: '2026-05-06', end: '2026-05-06', deps: ['M'] }
  ];
  const crit = computeCriticalPath(tasks); // {A, B}
  const preds = getCriticalPredTaskIds(tasks, crit, tasks[2]); // B's predecessors via M
  assert.deepEqual(preds, ['A']);
});

test('getCriticalPredTaskIds — skips non-critical predecessor', () => {
  const tasks = [
    { id: 'A', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-04' },
    { id: 'B', parent: null, type: 'task', start: '2026-05-05', end: '2026-05-08', deps: ['A'] },
    { id: 'C', parent: null, type: 'task', start: '2026-05-05', end: '2026-05-05', deps: ['A'] },
    { id: 'D', parent: null, type: 'task', start: '2026-05-11', end: '2026-05-11', deps: ['B', 'C'] }
  ];
  const crit = computeCriticalPath(tasks); // {A, B, D}
  const preds = getCriticalPredTaskIds(tasks, crit, tasks[3]); // D's predecessors
  assert.deepEqual(preds, ['B']); // C has float, excluded
});
