/* history.test.js — pure state and snapshot undo/redo functionality tests. */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { getHistory, pushHistory, undo } from '../src/history.js';

function createMockElement(id, dataset = {}) {
  const classList = new Set();
  return {
    id,
    dataset,
    disabled: false,
    checked: false,
    textContent: '',
    classList: {
      toggle(cls, force) {
        if (force === undefined) {
          if (classList.has(cls)) classList.delete(cls);
          else classList.add(cls);
        } else if (force) {
          classList.add(cls);
        } else {
          classList.delete(cls);
        }
      },
      contains(cls) {
        return classList.has(cls);
      }
    }
  };
}

function setupMockDOM() {
  const elements = new Map();
  const queryAllResults = new Map();
  const bodyClasses = new Set();

  globalThis.document = {
    body: {
      classList: {
        toggle(cls, force) {
          if (force === undefined) {
            if (bodyClasses.has(cls)) bodyClasses.delete(cls);
            else bodyClasses.add(cls);
          } else if (force) {
            bodyClasses.add(cls);
          } else {
            bodyClasses.delete(cls);
          }
        },
        contains(cls) {
          return bodyClasses.has(cls);
        }
      }
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelectorAll(selector) {
      return queryAllResults.get(selector) || [];
    }
  };

  return { elements, queryAllResults, bodyClasses };
}

/* ── getHistory ── */

test('getHistory — returns empty array for null or undefined project', () => {
  assert.deepEqual(getHistory(null), []);
  assert.deepEqual(getHistory(undefined), []);
});

test('getHistory — initializes _history array on project if missing', () => {
  const proj = { id: 'p1' };
  const h = getHistory(proj);
  assert.ok(Array.isArray(h));
  assert.equal(h.length, 0);
  assert.strictEqual(proj._history, h);
});

test('getHistory — returns existing _history array if present', () => {
  const existingHistory = [{ snap: 1 }];
  const proj = { id: 'p1', _history: existingHistory };
  const h = getHistory(proj);
  assert.strictEqual(h, existingHistory);
  assert.equal(h.length, 1);
});

/* ── pushHistory ── */

test('pushHistory — returns early when state.curProj is missing', () => {
  setupMockDOM();
  const state = { curProj: null };
  pushHistory(state);
  // No error thrown
});

test('pushHistory — creates deep clone snapshot and appends to history', () => {
  const dom = setupMockDOM();
  const undoBtn = createMockElement('undoBtn');
  undoBtn.disabled = true;
  dom.elements.set('undoBtn', undoBtn);

  const proj = {
    id: 'p1',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    name: 'Test Proj',
    color: '#123456',
    versions: [{ v: 1 }],
    baseline: [{ id: 't1', start: '2026-01-01' }]
  };

  const tasks = [{ id: 1, name: 'Task 1' }];
  const collapsed = new Set([10, 20]);

  const state = {
    curProj: proj,
    tasks,
    nextId: 2,
    currentProjId: 'p1',
    collapsed,
    viewMode: 'day',
    showCriticalPath: true,
    showWBS: false,
    isDark: true,
    milestoneView: false,
    workloadView: false,
    showBarDates: true,
    showBaseline: false
  };

  pushHistory(state);

  const h = getHistory(proj);
  assert.equal(h.length, 1);
  const snap = h[0];

  assert.deepEqual(snap.tasks, tasks);
  assert.notStrictEqual(snap.tasks, tasks); // Deep clone
  assert.equal(snap.nextId, 2);
  assert.equal(snap.currentProjId, 'p1');
  assert.deepEqual(snap.collapsed, [10, 20]);
  assert.equal(snap.viewMode, 'day');
  assert.equal(snap.showCriticalPath, true);
  assert.equal(snap.isDark, true);
  assert.equal(snap.CHART_START, '2026-01-01');
  assert.equal(snap.CHART_END, '2026-12-31');
  assert.deepEqual(snap.versions, proj.versions);
  assert.notStrictEqual(snap.versions, proj.versions); // Deep clone
  assert.deepEqual(snap.baseline, proj.baseline);
  assert.notStrictEqual(snap.baseline, proj.baseline); // Deep clone

  // Button state updated
  assert.equal(undoBtn.disabled, false);
});

test('pushHistory — truncates history to MAX_HISTORY (50)', () => {
  setupMockDOM();
  const proj = { startDate: '2026-01-01', endDate: '2026-06-01', name: 'Proj' };
  const state = {
    curProj: proj,
    tasks: [],
    nextId: 1,
    collapsed: new Set(),
    viewMode: 'day'
  };

  for (let i = 0; i < 55; i++) {
    state.nextId = i;
    pushHistory(state);
  }

  const h = getHistory(proj);
  assert.equal(h.length, 50);
  assert.equal(h[0].nextId, 5); // Oldest 5 items shifted out
  assert.equal(h[49].nextId, 54);
});

/* ── undo ── */

test('undo — returns early if curProj is missing or history is empty', () => {
  setupMockDOM();
  let called = false;
  const deps = {
    getHistory,
    render: () => {
      called = true;
    }
  };

  undo({ curProj: null }, deps);
  assert.equal(called, false);

  const proj = { id: 'p1' };
  undo({ curProj: proj }, deps);
  assert.equal(called, false);
});

test('undo — restores project, state, and calls lifecycle deps', () => {
  const dom = setupMockDOM();

  const undoBtn = createMockElement('undoBtn');
  const darkBtn = createMockElement('darkBtn');
  const settingBarDates = createMockElement('settingBarDates');
  const settingBaseline = createMockElement('settingBaseline');
  const cpBtn = createMockElement('cpBtn');
  const wbsBtn = createMockElement('wbsBtn');

  dom.elements.set('undoBtn', undoBtn);
  dom.elements.set('darkBtn', darkBtn);
  dom.elements.set('settingBarDates', settingBarDates);
  dom.elements.set('settingBaseline', settingBaseline);
  dom.elements.set('cpBtn', cpBtn);
  dom.elements.set('wbsBtn', wbsBtn);

  const viewBtnDay = createMockElement('vBtnDay', { v: 'day' });
  const viewBtnWeek = createMockElement('vBtnWeek', { v: 'week' });
  dom.queryAllResults.set('#viewBtns .btn', [viewBtnDay, viewBtnWeek]);

  const chartViewBtnGantt = createMockElement('cvGantt', { cv: 'gantt' });
  dom.queryAllResults.set('#chartViewBtns .btn', [chartViewBtnGantt]);

  const initialTasks = [{ id: 1, name: 'Original Task' }];
  const projTasks = [
    { id: 1, name: 'Modified Task' },
    { id: 2, name: 'New Task' }
  ];

  const proj = {
    id: 'p1',
    tasks: projTasks,
    nextId: 3,
    startDate: '2026-02-01',
    endDate: '2026-11-30',
    name: 'Modified Proj',
    color: '#000000',
    versions: [{ v: 2 }],
    baseline: null,
    _history: [
      {
        tasks: initialTasks,
        nextId: 2,
        currentProjId: 'p1',
        collapsed: [10],
        viewMode: 'week',
        showCriticalPath: true,
        showWBS: true,
        isDark: true,
        CHART_START: '2026-01-01',
        CHART_END: '2026-12-31',
        milestoneView: false,
        workloadView: false,
        showBarDates: true,
        showBaseline: false,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        name: 'Original Proj',
        color: '#123456',
        versions: [{ v: 1 }],
        baseline: [{ id: 1, start: '2026-01-01' }]
      }
    ]
  };

  const collapsedSet = new Set([99]);
  const state = {
    curProj: proj,
    tasks: projTasks,
    nextId: 3,
    collapsed: collapsedSet,
    viewMode: 'day',
    PPDS: { day: 36, week: 10 },
    PPD: 36,
    showCriticalPath: false,
    showWBS: false,
    isDark: false,
    milestoneView: false,
    workloadView: false,
    showBarDates: false,
    showBaseline: true,
    criticalTaskIds: new Set()
  };

  let computeCriticalPathCalled = false;
  let updateProjUICalled = false;
  let renderVersionListCalled = false;
  let scheduleTasksCalled = false;
  let recalcProjEndCalled = false;
  let renderCalled = false;

  const deps = {
    getHistory,
    computeCriticalPath: () => {
      computeCriticalPathCalled = true;
      return new Set([1]);
    },
    updateProjUI: () => {
      updateProjUICalled = true;
    },
    renderVersionList: () => {
      renderVersionListCalled = true;
    },
    scheduleTasks: () => {
      scheduleTasksCalled = true;
    },
    recalcProjEnd: () => {
      recalcProjEndCalled = true;
    },
    render: () => {
      renderCalled = true;
    }
  };

  undo(state, deps);

  // Checks on proj restoration (SSOT invariant check: array reference preserved)
  assert.strictEqual(proj.tasks, projTasks);
  assert.deepEqual(proj.tasks, initialTasks);
  assert.equal(proj.nextId, 2);
  assert.equal(proj.startDate, '2026-01-01');
  assert.equal(proj.endDate, '2026-12-31');
  assert.equal(proj.name, 'Original Proj');
  assert.equal(proj.color, '#123456');
  assert.deepEqual(proj.versions, [{ v: 1 }]);
  assert.deepEqual(proj.baseline, [{ id: 1, start: '2026-01-01' }]);

  // State checks
  assert.equal(state.nextId, 2);
  assert.deepEqual(Array.from(state.collapsed), [10]);
  assert.equal(state.viewMode, 'week');
  assert.equal(state.PPD, 10);
  assert.equal(state.showCriticalPath, true);
  assert.equal(state.showWBS, true);
  assert.equal(state.isDark, true);
  assert.equal(state.milestoneView, false);
  assert.equal(state.workloadView, false);
  assert.equal(state.showBarDates, true);
  assert.equal(state.showBaseline, false);
  assert.deepEqual(Array.from(state.criticalTaskIds), [1]);

  // Date objects check
  assert.ok(state.CHART_START instanceof Date);
  assert.equal(state.CHART_START.toISOString().slice(0, 10), '2026-01-01');
  assert.ok(state.CHART_END instanceof Date);
  assert.equal(state.CHART_END.toISOString().slice(0, 10), '2026-12-31');

  // DOM checks
  assert.equal(dom.bodyClasses.has('dark'), true);
  assert.equal(dom.bodyClasses.has('show-wbs'), true);
  assert.equal(darkBtn.textContent, '☀️');
  assert.equal(settingBarDates.checked, true);
  assert.equal(settingBaseline.checked, false);
  assert.equal(viewBtnWeek.classList.contains('active'), true);
  assert.equal(viewBtnDay.classList.contains('active'), false);
  assert.equal(cpBtn.classList.contains('active'), true);
  assert.equal(wbsBtn.classList.contains('active'), true);

  // Remaining history check
  assert.equal(getHistory(proj).length, 0);
  assert.equal(undoBtn.disabled, true);

  // Lifecycle calls
  assert.equal(computeCriticalPathCalled, true);
  assert.equal(updateProjUICalled, true);
  assert.equal(renderVersionListCalled, true);
  assert.equal(scheduleTasksCalled, true);
  assert.equal(recalcProjEndCalled, true);
  assert.equal(renderCalled, true);
});

test('undo — handles when showCriticalPath is false (resets criticalTaskIds to empty Set)', () => {
  const dom = setupMockDOM();
  const cpBtn = createMockElement('cpBtn');
  dom.elements.set('cpBtn', cpBtn);

  const proj = {
    id: 'p1',
    tasks: [],
    _history: [
      {
        tasks: [],
        showCriticalPath: false,
        startDate: '2026-01-01',
        endDate: '2026-12-31'
      }
    ]
  };

  const state = {
    curProj: proj,
    showCriticalPath: true,
    criticalTaskIds: new Set([1, 2, 3]),
    collapsed: new Set()
  };

  let computeCriticalPathCalled = false;
  const deps = {
    getHistory,
    computeCriticalPath: () => {
      computeCriticalPathCalled = true;
      return new Set([1]);
    },
    updateProjUI: () => {},
    renderVersionList: () => {},
    scheduleTasks: () => {},
    recalcProjEnd: () => {},
    render: () => {}
  };

  undo(state, deps);

  assert.equal(computeCriticalPathCalled, false);
  assert.equal(state.showCriticalPath, false);
  assert.equal(state.criticalTaskIds.size, 0);
  assert.equal(cpBtn.classList.contains('active'), false);
});
