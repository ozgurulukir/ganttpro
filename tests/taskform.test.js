import { describe, it } from 'node:test';
import assert from 'node:assert';
import { depsFromParsed, startEditPatch, endEditPatch } from '../src/core/taskform.js';

describe('depsFromParsed', () => {
  it('classifies parsed tokens into the four dep arrays', () => {
    const parsed = [
      { rowNum: 2, type: 'FS', taskId: 2 },
      { rowNum: 3, type: 'SS', taskId: 3 },
      { rowNum: 4, type: 'FF', taskId: 4 },
      { rowNum: 5, type: 'SF', taskId: 5 }
    ];
    assert.deepStrictEqual(depsFromParsed(parsed), {
      deps: [2],
      sdeps: [3],
      ffdeps: [4],
      sfdeps: [5]
    });
  });

  it('dedupes repeated task ids and omits empty lags', () => {
    const parsed = [
      { rowNum: 2, type: 'FS', taskId: 2 },
      { rowNum: 2, type: 'FS', taskId: 2 },
      { rowNum: 3, type: 'FS', taskId: 3 }
    ];
    const f = depsFromParsed(parsed);
    assert.deepStrictEqual(f.deps, [2, 3]);
    assert.deepStrictEqual(f.sdeps, []);
    assert.equal('lags' in f, false);
  });

  it('keeps lags when parsed tokens carry lag days', () => {
    const parsed = [
      { rowNum: 2, type: 'FS', taskId: 2, lag: 3 },
      { rowNum: 3, type: 'SS', taskId: 3, lag: -1 }
    ];
    const f = depsFromParsed(parsed);
    assert.ok(f.lags);
    assert.equal(f.lags.FS2, 3);
    assert.equal(f.lags.SS3, -1);
  });
});

describe('startEditPatch', () => {
  const task = { start: '2026-07-06', end: '2026-07-10', wday: 5 }; // Mon–Fri

  it('extends the end when the new start passes it, pinning start', () => {
    const p = startEditPatch(task, '2026-07-20');
    assert.deepStrictEqual(p, { start: '2026-07-20', pinStart: true, end: '2026-07-20' });
    assert.equal('wday' in p, false);
  });

  it('recomputes wday when the new start stays before the end', () => {
    const p = startEditPatch(task, '2026-07-08');
    assert.deepStrictEqual(p, { start: '2026-07-08', pinStart: true, wday: 3 });
  });

  it('handles a task without an end date', () => {
    const p = startEditPatch({ start: '2026-07-06' }, '2026-07-07');
    assert.equal(p.end, '2026-07-07');
    assert.equal('wday' in p, false);
  });
});

describe('endEditPatch', () => {
  const task = { start: '2026-07-06', end: '2026-07-10', wday: 5 }; // Mon–Fri

  it('moves the start to a 1-day task when the end is pulled before it', () => {
    const p = endEditPatch(task, '2026-07-03');
    assert.deepStrictEqual(p, { end: '2026-07-03', pinStart: true, start: '2026-07-03', wday: 1 });
  });

  it('recomputes wday when the end extends or shrinks after the start', () => {
    assert.deepStrictEqual(endEditPatch(task, '2026-07-14'), {
      end: '2026-07-14',
      pinStart: true,
      wday: 7
    });
    assert.deepStrictEqual(endEditPatch(task, '2026-07-07'), {
      end: '2026-07-07',
      pinStart: true,
      wday: 2
    });
  });
});
