import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reorderTask } from '../src/task-ops.js';

function createMockDeps(overrides = {}) {
  const calls = [];
  const deps = {
    taskById: id => deps._tasks.find(t => t.id === id),
    isDescendant: (srcId, targetId) => false,
    pushHistory: () => calls.push('pushHistory'),
    scheduleTasks: () => calls.push('scheduleTasks'),
    recalcProjEnd: () => calls.push('recalcProjEnd'),
    render: () => calls.push('render'),
    _tasks: [],
    calls,
    ...overrides
  };
  return deps;
}

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
