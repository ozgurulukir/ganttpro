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

  it('bounds wday to 1..3650 and progress to 0..100', () => {
    const t1 = validateTask({ id: 1, type: 'task', wday: -5, progress: -10 });
    assert.equal(t1.wday, 1);
    assert.equal(t1.progress, 0);

    const t2 = validateTask({ id: 2, type: 'task', wday: 1e9, progress: 150 });
    assert.equal(t2.wday, 3650);
    assert.equal(t2.progress, 100);
  });

  it('strips control characters from name', () => {
    const t = validateTask({ id: 1, type: 'task', name: 'Task\x00\x1FName' });
    assert.equal(t.name, 'TaskName');
  });

  it('validates lags correctly', () => {
    const t = validateTask({
      id: 1,
      type: 'task',
      lags: {
        FS2: 400,
        SS3: -400,
        FF4: 10,
        SF5: -20,
        INVALID6: 50
      }
    });
    assert.deepStrictEqual(t.lags, {
      FS2: 365,
      SS3: -365,
      FF4: 10,
      SF5: -20
    });
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
