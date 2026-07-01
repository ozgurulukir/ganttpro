/* tree.test.js — characterization tests for pure tree-structure queries.
   Fixtures are self-contained arrays; no globals, no DOM. */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  taskById,
  getTreeLines,
  hasMilestoneDescendant,
  getRowNum,
  getTaskByRowNum,
  getVisibleRows,
  groupAllDone,
  groupBounds,
  groupProgress,
  getAllDescendants,
  isDescendant,
  getTaskDepth
} from '../src/core/tree.js';

/* Fixture: a two-level tree with a group, tasks, and milestones.
   root1 (group)
     t1  (task, 05-01..05-05, 50%, not done)
     t2  (task, 05-03..05-10, done)
     g2  (group)
       t3 (task, 05-02..05-04, 0%, not done)
       m1 (milestone, 05-06)
   m2     (milestone root, 05-20) */
const TASKS = [
  { id: 'root1', parent: null, type: 'group' },
  {
    id: 't1',
    parent: 'root1',
    type: 'task',
    start: '2026-05-01',
    end: '2026-05-05',
    progress: 50,
    done: false
  },
  {
    id: 't2',
    parent: 'root1',
    type: 'task',
    start: '2026-05-03',
    end: '2026-05-10',
    progress: 100,
    done: true
  },
  { id: 'g2', parent: 'root1', type: 'group' },
  {
    id: 't3',
    parent: 'g2',
    type: 'task',
    start: '2026-05-02',
    end: '2026-05-04',
    progress: 0,
    done: false
  },
  { id: 'm1', parent: 'g2', type: 'milestone', date: '2026-05-06' },
  { id: 'm2', parent: null, type: 'milestone', date: '2026-05-20', done: false }
];
const EMPTY = new Set();

test('taskById — finds existing and missing', () => {
  assert.equal(taskById(TASKS, 't1').start, '2026-05-01');
  assert.equal(taskById(TASKS, 'nope'), undefined);
});

test('getTaskDepth — root is 0, child 1, grandchild 2', () => {
  assert.equal(getTaskDepth(TASKS, 'root1'), 0);
  assert.equal(getTaskDepth(TASKS, 't1'), 1);
  assert.equal(getTaskDepth(TASKS, 't3'), 2);
});

test('getTaskDepth — circular reference guard terminates', () => {
  const cyclic = [
    { id: 'a', parent: 'b', type: 'task' },
    { id: 'b', parent: 'a', type: 'task' }
  ];
  // a -> b -> a (seen) -> break: depth counts a, b = 2
  assert.equal(getTaskDepth(cyclic, 'a'), 2);
});

test('isDescendant — direct, transitive, unrelated, root', () => {
  assert.equal(isDescendant(TASKS, 'root1', 't1'), true); // direct
  assert.equal(isDescendant(TASKS, 'root1', 't3'), true); // transitive via g2
  assert.equal(isDescendant(TASKS, 't1', 't3'), false); // unrelated
  assert.equal(isDescendant(TASKS, 'root1', 'm2'), false); // m2 is root
});

test('getAllDescendants — pre-order traversal of subtree', () => {
  assert.deepEqual(getAllDescendants(TASKS, 'root1'), ['t1', 't2', 'g2', 't3', 'm1']);
  assert.deepEqual(getAllDescendants(TASKS, 'g2'), ['t3', 'm1']);
  assert.deepEqual(getAllDescendants(TASKS, 't1'), []); // leaf
});

test('getVisibleRows — full tree, correct order and depth', () => {
  const rows = getVisibleRows(TASKS, EMPTY, false);
  assert.equal(rows.length, 7);
  assert.deepEqual(
    rows.map(r => [r.task.id, r.depth]),
    [
      ['root1', 0],
      ['t1', 1],
      ['t2', 1],
      ['g2', 1],
      ['t3', 2],
      ['m1', 2],
      ['m2', 0]
    ]
  );
});

test('getVisibleRows — collapsed group hides its subtree', () => {
  const rows = getVisibleRows(TASKS, new Set(['g2']), false);
  assert.deepEqual(
    rows.map(r => r.task.id),
    ['root1', 't1', 't2', 'g2', 'm2'] // t3, m1 hidden
  );
});

test('getVisibleRows — collapsed root group hides whole subtree', () => {
  const rows = getVisibleRows(TASKS, new Set(['root1']), false);
  assert.deepEqual(
    rows.map(r => r.task.id),
    ['root1', 'm2']
  );
});

test('getVisibleRows — milestone view shows only non-done milestones sorted by date', () => {
  const rows = getVisibleRows(TASKS, EMPTY, true);
  assert.deepEqual(
    rows.map(r => r.task.id),
    ['m1', 'm2']
  ); // 05-06 before 05-20
  assert.equal(rows[0].depth, 0);
  // a done milestone is excluded
  const withDone = [
    ...TASKS,
    { id: 'm3', parent: null, type: 'milestone', date: '2026-05-01', done: true }
  ];
  assert.deepEqual(
    getVisibleRows(withDone, EMPTY, true).map(r => r.task.id),
    ['m1', 'm2']
  );
});

test('getRowNum — 1-based position in visible rows', () => {
  // root1=1, t1=2, t2=3, g2=4, t3=5, m1=6, m2=7
  assert.equal(getRowNum(TASKS, EMPTY, false, 't3'), 5);
  assert.equal(getRowNum(TASKS, EMPTY, false, 'm2'), 7);
  assert.equal(getRowNum(TASKS, new Set(['g2']), false, 't3'), null); // hidden
});

test('getTaskByRowNum — round-trips with getRowNum', () => {
  assert.equal(getTaskByRowNum(TASKS, EMPTY, false, 5).id, 't3');
  assert.equal(getTaskByRowNum(TASKS, EMPTY, false, 1).id, 'root1');
  assert.equal(getTaskByRowNum(TASKS, EMPTY, false, 99), null); // out of range
});

test('groupAllDone — all task children done required', () => {
  assert.equal(groupAllDone(TASKS, 'root1'), false); // t1 not done
  const allDone = [
    { id: 'g', parent: null, type: 'group' },
    { id: 'a', parent: 'g', type: 'task', done: true },
    { id: 'b', parent: 'g', type: 'task', done: true }
  ];
  assert.equal(groupAllDone(allDone, 'g'), true);
  assert.equal(groupAllDone(TASKS, 'g2'), false); // t3 not done
});

test('groupBounds — earliest start / latest end across descendants', () => {
  assert.deepEqual(groupBounds(TASKS, 'g2'), { s: '2026-05-02', e: '2026-05-06' });
  assert.deepEqual(groupBounds(TASKS, 'root1'), { s: '2026-05-01', e: '2026-05-10' });
});

test('groupProgress — average of descendant task progress (done = 100)', () => {
  // g2 descendants-tasks: [t3 (0%)] -> 0
  assert.equal(groupProgress(TASKS, 'g2'), 0);
  // root1 descendant-tasks: [t1(50), t2(done=100), t3(0)] -> round(150/3)=50
  assert.equal(groupProgress(TASKS, 'root1'), 50);
});

test('hasMilestoneDescendant — group with milestone descendant is true', () => {
  assert.equal(hasMilestoneDescendant(TASKS, 'g2'), true); // direct child m1
  assert.equal(hasMilestoneDescendant(TASKS, 'root1'), true); // via g2
  assert.equal(hasMilestoneDescendant(TASKS, 't1'), false); // leaf
});

test('getTreeLines — guide-line types per ancestor column', () => {
  const rows = [
    { task: { id: 'A' }, depth: 0 },
    { task: { id: 'B' }, depth: 1 },
    { task: { id: 'C' }, depth: 2 },
    { task: { id: 'D' }, depth: 1 }
  ];
  assert.deepEqual(getTreeLines(rows, 0), []); // root
  assert.deepEqual(getTreeLines(rows, 1), ['fork']); // B: D follows at same depth
  assert.deepEqual(getTreeLines(rows, 2), ['pipe', 'last']); // C: pipe col0, last in branch
  assert.deepEqual(getTreeLines(rows, 3), ['last']); // D: final sibling
});
