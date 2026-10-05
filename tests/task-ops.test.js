import { describe, it, test, before } from 'node:test';
import assert from 'node:assert/strict';
import { initI18n, t } from '../src/i18n/index.js';
import { reorderTask, collectSubtree, outdentTask } from '../src/task-ops.js';

before(async () => {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };
  await initI18n();
});

function createMockDeps(overrides = {}) {
  const calls = [];
  const statusMessages = [];
  const deps = {
    taskById: id => deps._tasks.find(t => t.id === id),
    isDescendant: (srcId, targetId) => false,
    pushHistory: () => calls.push('pushHistory'),
    scheduleTasks: () => calls.push('scheduleTasks'),
    recalcProjEnd: () => calls.push('recalcProjEnd'),
    render: () => calls.push('render'),
    showStatus: msg => statusMessages.push(msg),
    _tasks: [],
    calls,
    statusMessages,
    ...overrides
  };
  return deps;
}

describe('outdentTask', () => {
  it('shows status error when task is not found', () => {
    const tasks = [{ id: 't1', parent: null, type: 'task' }];
    const deps = createMockDeps();
    deps._tasks = tasks;

    outdentTask('nonexistent', tasks, deps);

    assert.equal(deps.calls.length, 0);
    assert.equal(deps.statusMessages.length, 1);
    assert.equal(deps.statusMessages[0], t('modal.outdentLimit'));
  });

  it('shows status error when task parent is null (already top-level)', () => {
    const tasks = [{ id: 't1', parent: null, type: 'task' }];
    const deps = createMockDeps();
    deps._tasks = tasks;

    outdentTask('t1', tasks, deps);

    assert.equal(deps.calls.length, 0);
    assert.equal(deps.statusMessages.length, 1);
    assert.equal(deps.statusMessages[0], t('modal.outdentLimit'));
  });

  it('shows status error when parent task is missing or parent is top-level (parent.parent is null)', () => {
    const tasks = [
      { id: 'g1', parent: null, type: 'group' },
      { id: 't1', parent: 'g1', type: 'task' }
    ];
    const deps = createMockDeps();
    deps._tasks = tasks;

    outdentTask('t1', tasks, deps);

    assert.equal(deps.calls.length, 0);
    assert.equal(deps.statusMessages.length, 1);
    assert.equal(deps.statusMessages[0], t('modal.outdentLimit'));
  });

  it('outdents a nested task to its parent parent level and reinserts after parent subtree', () => {
    /*
      Structure:
      - g1 (parent: null)
        - g2 (parent: 'g1')
          - t1 (parent: 'g2')
          - t2 (parent: 'g2')
        - t3 (parent: 'g1')
    */
    const tasks = [
      { id: 'g1', parent: null, type: 'group' },
      { id: 'g2', parent: 'g1', type: 'group' },
      { id: 't1', parent: 'g2', type: 'task' },
      { id: 't2', parent: 'g2', type: 'task' },
      { id: 't3', parent: 'g1', type: 'task' }
    ];
    const deps = createMockDeps();
    deps._tasks = tasks;

    outdentTask('t1', tasks, deps);

    assert.equal(deps.statusMessages.length, 0);
    assert.deepEqual(deps.calls, ['pushHistory', 'scheduleTasks', 'recalcProjEnd', 'render']);

    const t1 = tasks.find(t => t.id === 't1');
    assert.equal(t1.parent, 'g1');

    assert.deepEqual(
      tasks.map(t => t.id),
      ['g1', 'g2', 't2', 't1', 't3']
    );
  });

  it('outdents a sub-group with its entire subtree', () => {
    /*
      Structure:
      - root (parent: null)
        - g1 (parent: 'root')
          - g2 (parent: 'g1')
            - t1 (parent: 'g2')
            - t2 (parent: 'g2')
          - t3 (parent: 'g1')
        - t4 (parent: 'root')
    */
    const tasks = [
      { id: 'root', parent: null, type: 'group' },
      { id: 'g1', parent: 'root', type: 'group' },
      { id: 'g2', parent: 'g1', type: 'group' },
      { id: 't1', parent: 'g2', type: 'task' },
      { id: 't2', parent: 'g2', type: 'task' },
      { id: 't3', parent: 'g1', type: 'task' },
      { id: 't4', parent: 'root', type: 'task' }
    ];
    const deps = createMockDeps();
    deps._tasks = tasks;

    outdentTask('g2', tasks, deps);

    assert.equal(deps.statusMessages.length, 0);
    assert.deepEqual(deps.calls, ['pushHistory', 'scheduleTasks', 'recalcProjEnd', 'render']);

    const g2 = tasks.find(t => t.id === 'g2');
    assert.equal(g2.parent, 'root');

    // Children of g2 retain g2 as parent
    assert.equal(tasks.find(t => t.id === 't1').parent, 'g2');
    assert.equal(tasks.find(t => t.id === 't2').parent, 'g2');

    assert.deepEqual(
      tasks.map(t => t.id),
      ['root', 'g1', 't3', 'g2', 't1', 't2', 't4']
    );
  });
});

describe('reorderTask', () => {
  it('does nothing if src task is missing', () => {
    const tasks = [
      { id: 't1', parent: null, type: 'task' },
      { id: 't2', parent: null, type: 'task' }
    ];
    const deps = createMockDeps();
    deps._tasks = tasks;

    reorderTask('missing', 't2', true, tasks, deps);

    assert.equal(deps.calls.length, 0);
    assert.deepEqual(
      tasks.map(t => t.id),
      ['t1', 't2']
    );
  });

  it('does nothing if target task is missing', () => {
    const tasks = [
      { id: 't1', parent: null, type: 'task' },
      { id: 't2', parent: null, type: 'task' }
    ];
    const deps = createMockDeps();
    deps._tasks = tasks;

    reorderTask('t1', 'missing', true, tasks, deps);

    assert.equal(deps.calls.length, 0);
    assert.deepEqual(
      tasks.map(t => t.id),
      ['t1', 't2']
    );
  });

  it('prevents cycles when target is a descendant of src', () => {
    const tasks = [
      { id: 'g1', parent: null, type: 'group' },
      { id: 't1', parent: 'g1', type: 'task' }
    ];
    const deps = createMockDeps({
      isDescendant: (srcId, targetId) => srcId === 'g1' && targetId === 't1'
    });
    deps._tasks = tasks;

    reorderTask('g1', 't1', false, tasks, deps);

    assert.equal(deps.calls.length, 0);
    assert.equal(tasks[0].id, 'g1');
    assert.equal(tasks[1].id, 't1');
  });

  it('reorders task before target (insertBefore = true)', () => {
    const tasks = [
      { id: 't1', parent: 'g1', type: 'task' },
      { id: 't2', parent: 'g1', type: 'task' },
      { id: 't3', parent: 'g1', type: 'task' }
    ];
    const deps = createMockDeps();
    deps._tasks = tasks;

    // Move t3 before t1
    reorderTask('t3', 't1', true, tasks, deps);

    assert.deepEqual(
      tasks.map(t => t.id),
      ['t3', 't1', 't2']
    );
    assert.equal(tasks[0].parent, 'g1');
    assert.deepEqual(deps.calls, ['pushHistory', 'scheduleTasks', 'recalcProjEnd', 'render']);
  });

  it('reorders task after target (insertBefore = false)', () => {
    const tasks = [
      { id: 't1', parent: 'g1', type: 'task' },
      { id: 't2', parent: 'g1', type: 'task' },
      { id: 't3', parent: 'g1', type: 'task' }
    ];
    const deps = createMockDeps();
    deps._tasks = tasks;

    // Move t1 after t2
    reorderTask('t1', 't2', false, tasks, deps);

    assert.deepEqual(
      tasks.map(t => t.id),
      ['t2', 't1', 't3']
    );
    assert.equal(tasks[1].parent, 'g1');
    assert.deepEqual(deps.calls, ['pushHistory', 'scheduleTasks', 'recalcProjEnd', 'render']);
  });

  it('reorders task before group (insertBefore = true) inheriting target parent', () => {
    const tasks = [
      { id: 't1', parent: null, type: 'task' },
      { id: 'g1', parent: null, type: 'group' },
      { id: 't2', parent: 'g1', type: 'task' }
    ];
    const deps = createMockDeps();
    deps._tasks = tasks;

    // Move t2 before group g1 -> t2 gets target.parent (null)
    reorderTask('t2', 'g1', true, tasks, deps);

    assert.deepEqual(
      tasks.map(t => t.id),
      ['t1', 't2', 'g1']
    );
    assert.equal(tasks[1].parent, null);
  });

  it('makes task a child when dropping onto a group with insertBefore = false', () => {
    const tasks = [
      { id: 'g1', parent: null, type: 'group' },
      { id: 't1', parent: null, type: 'task' }
    ];
    const deps = createMockDeps();
    deps._tasks = tasks;

    // Drop t1 onto group g1 without insertBefore -> t1 parent becomes g1.id
    reorderTask('t1', 'g1', false, tasks, deps);

    assert.deepEqual(
      tasks.map(t => t.id),
      ['g1', 't1']
    );
    assert.equal(tasks[1].parent, 'g1');
  });

  it('handles moving a task forward in array when target is after src', () => {
    const tasks = [
      { id: 't1', parent: null, type: 'task' },
      { id: 't2', parent: null, type: 'task' },
      { id: 't3', parent: null, type: 'task' },
      { id: 't4', parent: null, type: 'task' }
    ];
    const deps = createMockDeps();
    deps._tasks = tasks;

    // Move t1 before t4
    reorderTask('t1', 't4', true, tasks, deps);

    assert.deepEqual(
      tasks.map(t => t.id),
      ['t2', 't3', 't1', 't4']
    );
  });
});

/* Fixture task tree:
   root1 (group)
     ├─ t1 (task)
     └─ g2 (group)
          ├─ t2 (task)
          └─ m1 (milestone)
   root2 (task, unrelated)
*/
const TASKS = [
  { id: 'root1', parent: null, type: 'group' },
  { id: 't1', parent: 'root1', type: 'task' },
  { id: 'g2', parent: 'root1', type: 'group' },
  { id: 't2', parent: 'g2', type: 'task' },
  { id: 'm1', parent: 'g2', type: 'milestone' },
  { id: 'root2', parent: null, type: 'task' }
];

test('collectSubtree — collects root task and all multi-level descendants', () => {
  const result = collectSubtree('root1', TASKS);

  assert.equal(result.ids instanceof Set, true);
  assert.equal(result.ids.size, 5);
  assert.deepEqual(Array.from(result.ids).sort(), ['g2', 'm1', 'root1', 't1', 't2']);

  assert.equal(result.items.length, 5);
  assert.deepEqual(
    result.items.map(t => t.id),
    ['root1', 't1', 'g2', 't2', 'm1']
  );
});

test('collectSubtree — collects nested group and its direct/indirect descendants only', () => {
  const result = collectSubtree('g2', TASKS);

  assert.equal(result.ids.size, 3);
  assert.deepEqual(Array.from(result.ids).sort(), ['g2', 'm1', 't2']);

  assert.deepEqual(
    result.items.map(t => t.id),
    ['g2', 't2', 'm1']
  );
});

test('collectSubtree — leaf task returns set containing only target ID and target task item', () => {
  const result = collectSubtree('t1', TASKS);

  assert.equal(result.ids.size, 1);
  assert.equal(result.ids.has('t1'), true);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, 't1');
});

test('collectSubtree — non-existent tid returns set containing target ID and empty items array', () => {
  const result = collectSubtree('non-existent', TASKS);

  assert.equal(result.ids.size, 1);
  assert.equal(result.ids.has('non-existent'), true);
  assert.equal(result.items.length, 0);
});

test('collectSubtree — empty tasks array returns set containing target ID and empty items array', () => {
  const result = collectSubtree('any-id', []);

  assert.equal(result.ids.size, 1);
  assert.equal(result.ids.has('any-id'), true);
  assert.equal(result.items.length, 0);
});

test('collectSubtree — excludes unrelated sibling or parent tasks', () => {
  const result = collectSubtree('root2', TASKS);

  assert.equal(result.ids.size, 1);
  assert.equal(result.ids.has('root2'), true);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, 'root2');
});
