/* schedule.test.js — characterization tests for the forward-pass scheduler.
   Dates use 2026-04/05 where Apr 29=Wed, 30=Thu, May 1=Labour Day (holiday),
   May 4=Mon, 6=Wed, 7=Thu, 8=Fri.  scheduleTasks MUTATES tasks in place —
   we assert the resulting start/end/date values. */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  allGroupMembersScheduled,
  scheduleTasks,
  autoScheduleFromDeps
} from '../src/core/schedule.js';

/* ── allGroupMembersScheduled ── */

test('allGroupMembersScheduled — false when any child unscheduled', () => {
  const tasks = [
    { id: 'G', parent: null, type: 'group' },
    { id: 'A', parent: 'G', type: 'task' },
    { id: 'B', parent: 'G', type: 'task' }
  ];
  assert.equal(allGroupMembersScheduled(tasks, 'G', new Set()), false);
  assert.equal(allGroupMembersScheduled(tasks, 'G', new Set(['A'])), false);
  assert.equal(allGroupMembersScheduled(tasks, 'G', new Set(['A', 'B'])), true);
});

test('allGroupMembersScheduled — recurses through sub-groups', () => {
  const tasks = [
    { id: 'G', parent: null, type: 'group' },
    { id: 'G2', parent: 'G', type: 'group' },
    { id: 'C', parent: 'G2', type: 'task' }
  ];
  assert.equal(allGroupMembersScheduled(tasks, 'G', new Set()), false);
  assert.equal(allGroupMembersScheduled(tasks, 'G', new Set(['C'])), true);
});

/* ── scheduleTasks ── */

test('scheduleTasks — null projStart is a no-op', () => {
  const tasks = [{ id: 'A', parent: null, type: 'task', start: '2020-01-01', end: '2020-01-01' }];
  scheduleTasks(tasks, null);
  assert.equal(tasks[0].start, '2020-01-01'); // unchanged
});

test('scheduleTasks — FS chain schedules sequentially', () => {
  const tasks = [
    { id: 'A', parent: null, type: 'task' },
    { id: 'B', parent: null, type: 'task', deps: ['A'] },
    { id: 'C', parent: null, type: 'task', deps: ['B'] }
  ];
  scheduleTasks(tasks, '2026-05-04');
  assert.equal(tasks[0].start, '2026-05-04');
  assert.equal(tasks[0].end, '2026-05-04');
  assert.equal(tasks[1].start, '2026-05-05');
  assert.equal(tasks[1].end, '2026-05-05');
  assert.equal(tasks[2].start, '2026-05-06');
  assert.equal(tasks[2].end, '2026-05-06');
});

test('scheduleTasks — wday>1 spans multiple working days', () => {
  const tasks = [
    { id: 'A', parent: null, type: 'task', wday: 3 },
    { id: 'B', parent: null, type: 'task', wday: 2, deps: ['A'] }
  ];
  scheduleTasks(tasks, '2026-05-04');
  assert.equal(tasks[0].start, '2026-05-04');
  assert.equal(tasks[0].end, '2026-05-06');
  assert.equal(tasks[1].start, '2026-05-07');
  assert.equal(tasks[1].end, '2026-05-08');
});

test('scheduleTasks — SS dependency starts when predecessor starts', () => {
  const tasks = [
    { id: 'X', parent: null, type: 'task', wday: 1 },
    { id: 'A', parent: null, type: 'task', wday: 1, deps: ['X'] },
    { id: 'B', parent: null, type: 'task', wday: 1, sdeps: ['A'] }
  ];
  scheduleTasks(tasks, '2026-04-29');
  // X: Apr29. A (FS on X): Apr30. B (SS on A): starts when A starts = Apr30
  assert.equal(tasks[1].start, '2026-04-30');
  assert.equal(tasks[2].start, '2026-04-30');
});

test('scheduleTasks — FF dependency finishes when predecessor finishes', () => {
  const tasks = [
    { id: 'A', parent: null, type: 'task', wday: 3 },
    { id: 'B', parent: null, type: 'task', wday: 2, ffdeps: ['A'] }
  ];
  scheduleTasks(tasks, '2026-04-29');
  // A: Apr29..May4 (3wd skipping holiday). B FF on A → B.end = A.end = May4
  assert.equal(tasks[0].end, '2026-05-04');
  assert.equal(tasks[1].end, '2026-05-04');
});

test('scheduleTasks — milestone date from FS dep end; no-dep milestone = projStart', () => {
  const tasks = [
    { id: 'A', parent: null, type: 'task', wday: 3 },
    { id: 'M', parent: null, type: 'milestone', deps: ['A'] },
    { id: 'M2', parent: null, type: 'milestone' }
  ];
  scheduleTasks(tasks, '2026-04-29');
  assert.equal(tasks[0].end, '2026-05-04');
  assert.equal(tasks[1].date, '2026-05-04'); // M = A.end
  assert.equal(tasks[2].date, '2026-04-29'); // M2 = projStart
});

test('scheduleTasks — positive FS lag pushes successor later', () => {
  const tasks = [
    { id: 'A', parent: null, type: 'task', wday: 1 },
    { id: 'B', parent: null, type: 'task', wday: 1, deps: ['A'], lags: { FSA: 2 } }
  ];
  scheduleTasks(tasks, '2026-05-04');
  // A ends May4. +2 lag → May6. B starts nextWorkingDay(May6) = May7
  assert.equal(tasks[0].end, '2026-05-04');
  assert.equal(tasks[1].start, '2026-05-07');
});

test('scheduleTasks — group dependency uses group bounds', () => {
  const tasks = [
    { id: 'G', parent: null, type: 'group' },
    { id: 'A', parent: 'G', type: 'task', wday: 3 },
    { id: 'B', parent: 'G', type: 'task', wday: 1 },
    { id: 'C', parent: null, type: 'task', wday: 1, deps: ['G'] }
  ];
  scheduleTasks(tasks, '2026-05-04');
  // group bounds end = max(A.end=May6, B.end=May4) = May6
  // C starts nextWorkingDay(May6) = May7
  assert.equal(tasks[0 + 0].end || tasks.find(t => t.id === 'A').end, '2026-05-06');
  assert.equal(tasks.find(t => t.id === 'C').start, '2026-05-07');
});

/* ── autoScheduleFromDeps ── */

test('autoScheduleFromDeps — pushes task later to follow FS dep', () => {
  const tasks = [
    { id: 'A', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-04' },
    { id: 'B', parent: null, type: 'task', start: '2026-04-29', end: '2026-04-29', deps: ['A'] }
  ];
  autoScheduleFromDeps(tasks, tasks[1]);
  assert.equal(tasks[1].start, '2026-05-05'); // nextWorkingDay(A.end)
  assert.equal(tasks[1].end, '2026-05-05');
});

test('autoScheduleFromDeps — no change if already later than dep', () => {
  const tasks = [
    { id: 'A', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-04' },
    { id: 'B', parent: null, type: 'task', start: '2026-05-10', end: '2026-05-10', deps: ['A'] }
  ];
  autoScheduleFromDeps(tasks, tasks[1]);
  assert.equal(tasks[1].start, '2026-05-10'); // unchanged
});

test('autoScheduleFromDeps — milestone is a no-op', () => {
  const tasks = [
    { id: 'A', parent: null, type: 'task', start: '2026-05-04', end: '2026-05-04' },
    { id: 'M', parent: null, type: 'milestone', date: '2026-01-01', deps: ['A'] }
  ];
  autoScheduleFromDeps(tasks, tasks[1]);
  assert.equal(tasks[1].date, '2026-01-01'); // unchanged
});

test('autoScheduleFromDeps — task with no deps is a no-op', () => {
  const tasks = [{ id: 'T', parent: null, type: 'task', start: '2026-04-29', end: '2026-04-29' }];
  autoScheduleFromDeps(tasks, tasks[0]);
  assert.equal(tasks[0].start, '2026-04-29'); // unchanged
});
