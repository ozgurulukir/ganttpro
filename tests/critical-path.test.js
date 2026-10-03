/* critical-path.test.js — characterization tests for CPM backward pass.
   Dates use 2026-05 where May 4=Mon, 8=Fri, 11=Mon (no holidays in range).
   Forward pass (ES/EF = start/end) is pre-supplied — we test only the backward
   pass + float classification that computeCriticalPath owns. */
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  prevWorkingDay,
  computeCriticalPath,
  getCriticalPredTaskIds
} from '../src/core/critical-path.js';
import { loadHolidaysFromJSON } from '../src/core/calendar.js';

const holidayData = JSON.parse(
  readFileSync(new URL('../public/holidays/tw.json', import.meta.url), 'utf-8')
);
loadHolidaysFromJSON(holidayData);

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
    {
      id: 'D',
      parent: null,
      type: 'task',
      start: '2026-05-11',
      end: '2026-05-11',
      deps: ['B', 'C']
    }
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
    {
      id: 'D',
      parent: null,
      type: 'task',
      start: '2026-05-11',
      end: '2026-05-11',
      deps: ['B', 'C']
    }
  ];
  const crit = computeCriticalPath(tasks); // {A, B, D}
  const preds = getCriticalPredTaskIds(tasks, crit, tasks[3]); // D's predecessors
  assert.deepEqual(preds, ['B']); // C has float, excluded
});

test('computeCriticalPath — FS dependency with float on successor side', () => {
  // A -> B(FS). A is 1 day. B is 1 day, but starts 3 days later due to other constraints.
  // A should not be critical unless its float (B.LF - 1 - A.duration) is 0.
  const tasks = [
    { id: 'A', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-04' },
    // B's start is driven by something else to 08, not A.
    { id: 'B', parent: null, type: 'task', start: '2026-05-08', end: '2026-05-08', deps: ['A'] },
    // A parallel path that takes the whole time
    { id: 'C', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-08' }
  ];
  const c = computeCriticalPath(tasks);
  assert.ok(!c.has('A'), 'A should not be critical as it has float');
  assert.ok(c.has('B'), 'B is critical because its end determines the project end');
  assert.ok(c.has('C'), 'C is critical as it spans the whole duration');
});

test('computeCriticalPath — SS successor with idle slack does not overconstrain predecessor', () => {
  // A(1d) --SS--> M(milestone). C(6d) defines projEnd.
  // M has idle slack (LF is 05-08, ES is 05-05).
  // A's start should not be forced to 0 float by M's start date.
  const tasks = [
    { id: 'A', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-04', sdeps: ['M'] },
    { id: 'M', parent: null, type: 'milestone', date: '2026-05-05' },
    { id: 'C', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-11' } // Defines projEnd = 05-11
  ];
  const c = computeCriticalPath(tasks);
  assert.ok(!c.has('A'), 'A should not be critical because M has idle slack (SS)');
  assert.ok(!c.has('M'), 'M should not be critical');
  assert.ok(c.has('C'), 'C is critical as it spans the whole duration');
});

test('computeCriticalPath — FS successor with idle slack does not overconstrain predecessor', () => {
  // A(1d) -> M(milestone) -> D(1d). C(6d) defines projEnd.
  // M has idle slack (LF is 05-08, ES is 05-05).
  // A should not be forced to 0 float by M's start date.
  const tasks = [
    { id: 'A', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-04' },
    { id: 'M', parent: null, type: 'milestone', date: '2026-05-05', deps: ['A'] },
    { id: 'D', parent: null, type: 'task', start: '2026-05-06', end: '2026-05-06', deps: ['M'] },
    { id: 'C', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-11' } // Defines projEnd = 05-11
  ];
  const c = computeCriticalPath(tasks);
  assert.ok(!c.has('A'), 'A should not be critical because M has idle slack');
  assert.ok(!c.has('D'), 'D should not be critical');
  assert.ok(c.has('C'), 'C is critical as it spans the whole duration');
});

test('computeCriticalPath — SS (Start-to-Start) dependency on critical path', () => {
  // B depends on A via SS. A (May4-5, 2d), B (May4-8, 5d, sdeps:[A]).
  // Both start May 4 and B ends May 8 (projEnd). Float for both is 0.
  const tasks = [
    { id: 'A', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-05' },
    { id: 'B', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-08', sdeps: ['A'] }
  ];
  const c = computeCriticalPath(tasks);
  assert.ok(c.has('A'), 'A is critical via SS constraint');
  assert.ok(c.has('B'), 'B is critical');
});

test('computeCriticalPath — FF (Finish-to-Finish) dependency handling', () => {
  // B depends on A via FF.
  // B finishes May 8 (projEnd), A finishes May 8, ffdeps: [A]. Both critical.
  // C finishes May 5, ffdeps: [A]. C has float, not critical.
  const tasks = [
    { id: 'A', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-08' },
    { id: 'B', parent: null, type: 'task', start: '2026-05-06', end: '2026-05-08', ffdeps: ['A'] },
    { id: 'C', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-05', ffdeps: ['A'] }
  ];
  const c = computeCriticalPath(tasks);
  assert.ok(c.has('A'), 'A is critical');
  assert.ok(c.has('B'), 'B is critical');
  assert.ok(!c.has('C'), 'C has float');
});

test('computeCriticalPath — SF (Start-to-Finish) dependency handling', () => {
  // B depends on A via SF (B finishes after A starts).
  // A: May 4-5. B: May 6-8, sfdeps: ['A'].
  // projEnd is May 8. B determines projEnd (critical).
  const tasks = [
    { id: 'A', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-05' },
    { id: 'B', parent: null, type: 'task', start: '2026-05-06', end: '2026-05-08', sfdeps: ['A'] }
  ];
  const c = computeCriticalPath(tasks);
  assert.ok(c.has('B'), 'B is critical');
});

test('computeCriticalPath — dependency lag (lags) adjusts late finish constraint', () => {
  // B depends on A via FS with lag 2 working days.
  // A: May 4 (1d). Lag: 2d (May 5, May 6). B start: May 7, end: May 8 (2d).
  // Total path: May 4 -> lag 2d -> May 7-8. A is zero float and critical.
  const tasks = [
    { id: 'A', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-04' },
    {
      id: 'B',
      parent: null,
      type: 'task',
      start: '2026-05-07',
      end: '2026-05-08',
      deps: ['A'],
      lags: { FSA: 2 }
    }
  ];
  const c = computeCriticalPath(tasks);
  assert.ok(c.has('A'), 'A is critical with lag constraint');
  assert.ok(c.has('B'), 'B is critical');
});

test('computeCriticalPath — ignores tasks missing dates or non-task/milestone types', () => {
  // Group tasks or tasks with null dates should be filtered out safely without throwing.
  const tasks = [
    { id: 'G', parent: null, type: 'group', start: '2026-05-04', end: '2026-05-08' },
    { id: 'A', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-05' },
    { id: 'B', parent: null, type: 'task', start: null, end: null, deps: ['A'] },
    { id: 'C', parent: null, type: 'task', start: '2026-05-06', end: '2026-05-08', deps: ['A'] }
  ];
  const c = computeCriticalPath(tasks);
  assert.ok(c.has('A'));
  assert.ok(c.has('C'));
  assert.ok(!c.has('G'), 'Group type ignored');
  assert.ok(!c.has('B'), 'Task without dates ignored');
});

test('computeCriticalPath — disconnected subgraphs evaluate against global project end', () => {
  // Subgraph 1: A1 (May 4-5) -> A2 (May 6-8) -> ends May 8
  // Subgraph 2: B1 (May 4-7) -> B2 (May 8-11) -> ends May 11 (global projEnd)
  // Subgraph 2 is longer and critical; Subgraph 1 finishes earlier than projEnd, so has float.
  const tasks = [
    { id: 'A1', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-05' },
    { id: 'A2', parent: null, type: 'task', start: '2026-05-06', end: '2026-05-08', deps: ['A1'] },
    { id: 'B1', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-07' },
    { id: 'B2', parent: null, type: 'task', start: '2026-05-08', end: '2026-05-11', deps: ['B1'] }
  ];
  const c = computeCriticalPath(tasks);
  assert.ok(!c.has('A1'));
  assert.ok(!c.has('A2'));
  assert.ok(c.has('B1'));
  assert.ok(c.has('B2'));
});
