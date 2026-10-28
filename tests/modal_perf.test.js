import { test } from 'node:test';
import strictAssert from 'node:assert/strict';

// Global mocks must be set before modal.js module evaluation
globalThis.document = {
  getElementById: () => ({ addEventListener: () => {} }),
  querySelectorAll: () => [],
  querySelector: () => null
};
globalThis.requestAnimationFrame = fn => fn();

const { D } = await import('../src/render/deps.js');
const { addTaskInline } = await import('../src/ui/modal.js');
const { taskById } = await import('../src/core/tree.js');

test('addTaskInline performance baseline & correctness on large task tree', () => {
  // Build a tree with 5000 tasks
  // Group 0 (ref)
  //   Child groups and tasks under Group 0...
  const tasks = [];
  const totalTasks = 5000;
  tasks.push({ id: 0, name: 'Group 0', type: 'group', parent: null, color: '#000' });

  // Create deep/nested hierarchy under Group 0
  for (let i = 1; i < totalTasks; i++) {
    const parentId = Math.floor((i - 1) / 10); // 10 children per parent
    tasks.push({
      id: i,
      name: `Task ${i}`,
      type: i % 10 === 0 ? 'group' : 'task',
      parent: parentId,
      color: '#000'
    });
  }

  let nextId = 10000;
  let pushHistoryCalled = false;
  let scheduleTasksCalled = false;
  let recalcProjEndCalled = false;
  let renderCalled = false;
  let persistCalled = false;

  D.isReadOnly = false;
  D.tasks = tasks;
  D.taskById = id => taskById(D.tasks, id);
  D.TODAY_STR = '2026-05-01';
  D.pushHistory = () => {
    pushHistoryCalled = true;
  };
  D.scheduleTasks = () => {
    scheduleTasksCalled = true;
  };
  D.recalcProjEnd = () => {
    recalcProjEndCalled = true;
  };
  D.render = () => {
    renderCalled = true;
  };
  D.persist = () => {
    persistCalled = true;
  };
  D.consumeNextId = () => nextId++;

  const warmups = 5;
  const iterations = 50;

  // Measure multiple iterations
  let totalDuration = 0;

  for (let iter = 0; iter < warmups + iterations; iter++) {
    const testTasks = tasks.map(t => ({ ...t }));
    D.tasks = testTasks;
    const start = performance.now();
    addTaskInline(0);
    const end = performance.now();

    if (iter >= warmups) {
      totalDuration += end - start;
    }
  }

  const avgMs = totalDuration / iterations;
  console.log(
    `[BENCHMARK] addTaskInline average time over ${iterations} runs (${totalTasks} tasks): ${avgMs.toFixed(3)} ms`
  );

  // Correctness verification
  nextId = 10000;
  const testTasks = tasks.map(t => ({ ...t }));
  D.tasks = testTasks;
  addTaskInline(0);

  strictAssert.equal(testTasks.length, totalTasks + 1);
  const insertedTask = testTasks[totalTasks]; // Should be at index 5000 (after all descendants of Group 0)
  strictAssert.equal(insertedTask.id, 10000);
  strictAssert.equal(insertedTask.parent, 0);
  strictAssert.equal(pushHistoryCalled, true);
  strictAssert.equal(scheduleTasksCalled, true);
  strictAssert.equal(recalcProjEndCalled, true);
  strictAssert.equal(renderCalled, true);
  strictAssert.equal(persistCalled, true);
});
