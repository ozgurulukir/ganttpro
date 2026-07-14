import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateProject, validateTask, validateProjects } from '../src/core/validate.js';

describe('validateTask', () => {
  it('returns a sanitized task for valid input', () => {
    const t = validateTask({
      id: 3,
      name: 'Market Research',
      type: 'task',
      parent: 2,
      color: '#818CF8',
      start: '2026-04-01',
      end: '2026-04-14',
      wday: 10,
      done: false,
      progress: 0,
      deps: [2]
    });
    assert.equal(t.id, 3);
    assert.equal(t.name, 'Market Research');
    assert.equal(t.type, 'task');
    assert.equal(t.parent, 2);
    assert.equal(t.color, '#818CF8');
    assert.deepStrictEqual(t.deps, [2]);
  });

  it('rejects invalid id', () => {
    assert.equal(validateTask({ id: -1, name: 'x', type: 'task' }), null);
    assert.equal(validateTask({ name: 'x', type: 'task' }), null);
  });

  it('normalizes unknown type to task', () => {
    const t = validateTask({ id: 1, name: 'x', type: 'unknown' });
    assert.equal(t.type, 'task');
  });

  it('sanitizes malicious name and color', () => {
    const t = validateTask({
      id: 1,
      name: '<img src=x onerror=alert(1)>',
      type: 'task',
      color: 'url(https://evil)'
    });
    assert.equal(t.name, '<img src=x onerror=alert(1)>');
    assert.equal(t.color, '#5E6AD2');
  });

  it('truncates overly long name', () => {
    const t = validateTask({ id: 1, name: 'x'.repeat(500), type: 'task' });
    assert.equal(t.name.length, 200);
  });

  it('sanitizes dependency arrays', () => {
    const t = validateTask({
      id: 1,
      name: 'x',
      type: 'task',
      deps: [1, '2', -3, 'foo'],
      sdeps: ['a', 4]
    });
    assert.deepStrictEqual(t.deps, [1, 2]);
    assert.deepStrictEqual(t.sdeps, [4]);
  });

  it('normalizes milestone fields', () => {
    const t = validateTask({ id: 1, name: 'm', type: 'milestone', date: '2026-05-01', done: 1 });
    assert.equal(t.date, '2026-05-01');
    assert.equal(t.done, true);
    assert.equal(t.start, undefined);
  });
});

describe('validateProject', () => {
  it('returns a sanitized project and ensures root group', () => {
    const p = validateProject({
      id: 1,
      name: 'P',
      color: '#0EA5E9',
      startDate: '2026-04-01',
      endDate: '2026-07-31',
      nextId: 2,
      tasks: []
    });
    assert.equal(p.id, 1);
    assert.equal(p.name, 'P');
    assert.equal(p.tasks.length, 1);
    assert.equal(p.tasks[0].type, 'group');
    assert.equal(p.tasks[0].parent, null);
  });

  it('strips shared flags from the blob', () => {
    const p = validateProject({
      id: 1,
      name: 'P',
      color: '#0EA5E9',
      startDate: '2026-04-01',
      endDate: '2026-07-31',
      nextId: 2,
      _isShared: true,
      _permission: 'read',
      _ownerId: 'x',
      tasks: [{ id: 1, name: 'P', type: 'group', parent: null, color: '#0EA5E9' }]
    });
    assert.equal(p._isShared, undefined);
    assert.equal(p._permission, undefined);
    assert.equal(p._ownerId, undefined);
  });

  it('validates nested tasks', () => {
    const p = validateProject({
      id: 1,
      name: 'P',
      color: '#0EA5E9',
      startDate: '2026-04-01',
      endDate: '2026-07-31',
      nextId: 3,
      tasks: [
        { id: 1, name: 'P', type: 'group', parent: null, color: '#0EA5E9' },
        {
          id: 2,
          name: 'T1',
          type: 'task',
          parent: 1,
          color: '#818CF8',
          start: 'bad',
          end: '2026-04-10',
          wday: 5,
          done: false
        },
        { id: 'evil', name: 'bad', type: 'task' }
      ]
    });
    assert.equal(p.tasks.length, 2);
    assert.equal(p.tasks[1].start, '');
  });

  it('rejects invalid id', () => {
    assert.equal(validateProject({ name: 'P' }), null);
  });
});

describe('validateProjects', () => {
  it('filters out invalid projects', () => {
    const arr = validateProjects([
      {
        id: 1,
        name: 'A',
        color: '#0EA5E9',
        startDate: '2026-04-01',
        endDate: '2026-07-31',
        nextId: 2,
        tasks: []
      },
      { name: 'bad' },
      {
        id: 2,
        name: 'B',
        color: '#10B981',
        startDate: '2026-04-01',
        endDate: '2026-07-31',
        nextId: 2,
        tasks: []
      }
    ]);
    assert.equal(arr.length, 2);
    assert.equal(arr[0].name, 'A');
    assert.equal(arr[1].name, 'B');
  });
});

describe('Issue #7 specific validation rules', () => {
  it('rejects parent: 0', () => {
    assert.equal(validateTask({ id: 1, type: 'task', parent: 0 }), null);
    assert.equal(validateTask({ id: 1, type: 'task', parent: '0' }), null);
  });

  it('strips control characters and zero-width spaces from names and assignees', () => {
    const t = validateTask({
      id: 1,
      type: 'task',
      name: 'hello\u200Bworld\x00',
      assignee: 'john\u200Bdoe\u200E'
    });
    assert.equal(t.name, 'helloworld');
    assert.equal(t.assignee, 'johndoe');
  });

  it('ensures shape consistency for deps/sdeps/ffdeps/sfdeps', () => {
    const t = validateTask({ id: 1, type: 'task' });
    assert.deepStrictEqual(t.deps, []);
    assert.deepStrictEqual(t.sdeps, []);
    assert.deepStrictEqual(t.ffdeps, []);
    assert.deepStrictEqual(t.sfdeps, []);

    const m = validateTask({ id: 2, type: 'milestone' });
    assert.deepStrictEqual(m.deps, []);
    assert.deepStrictEqual(m.sdeps, []);
    assert.deepStrictEqual(m.ffdeps, []);
    assert.deepStrictEqual(m.sfdeps, []);
  });

  it('prunes phantom dependencies in project tasks', () => {
    const p = validateProject({
      id: 1,
      tasks: [
        { id: 1, type: 'group', parent: null },
        { id: 2, type: 'task', parent: 1, deps: [3, 4], ffdeps: [99] },
        { id: 3, type: 'task', parent: 1 }
      ]
    });
    // Task 2 should only have dep 3
    assert.deepStrictEqual(p.tasks[1].deps, [3]);
    assert.deepStrictEqual(p.tasks[1].ffdeps, []);
  });

  it('prunes phantom dependencies in snapshots', () => {
    const p = validateProject({
      id: 1,
      tasks: [{ id: 1, type: 'group', parent: null }],
      versions: [
        {
          id: 'v1',
          name: 'v1',
          snapshot: [
            { id: 1, type: 'group', parent: null },
            { id: 2, type: 'task', parent: 1, deps: [99] }
          ]
        }
      ]
    });
    assert.deepStrictEqual(p.versions[0].snapshot[1].deps, []);
  });

  it('enforces baseline dates cap at 500', () => {
    const dates = {};
    const tasks = [{ id: 1, type: 'group', parent: null }];
    for (let i = 2; i <= 600; i++) {
      tasks.push({ id: i, type: 'task', parent: 1 });
      dates[i] = '2026-04-01';
    }
    const p = validateProject({
      id: 1,
      tasks,
      baseline: { dates }
    });
    assert.equal(Object.keys(p.baseline.dates).length, 500);
  });
});
