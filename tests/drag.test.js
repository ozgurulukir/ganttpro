import { describe, it } from 'node:test';
import assert from 'node:assert';
import { dragTaskPatch, dragMilestonePatch } from '../src/core/drag.js';
import { snapToWorkday } from '../src/core/calendar.js';

// Note: under node --test there is no localStorage, so isNonWorkday falls back
// to the default Mon–Fri workweek — exactly the calendar these tests assume.
// node --test runs each file in its own process, so sibling test files that
// set custom work calendars cannot leak state here.

describe('snapToWorkday', () => {
  it('keeps an already-working day unchanged', () => {
    // 2026-07-06 is a Monday
    assert.equal(snapToWorkday('2026-07-06'), '2026-07-06');
    assert.equal(snapToWorkday('2026-07-06', 1), '2026-07-06');
    assert.equal(snapToWorkday('2026-07-06', -1), '2026-07-06');
  });

  it('snaps a weekend forward to Monday by default', () => {
    // 2026-07-04 is a Saturday, 07-05 a Sunday
    assert.equal(snapToWorkday('2026-07-04'), '2026-07-06');
    assert.equal(snapToWorkday('2026-07-05'), '2026-07-06');
  });

  it('snaps a weekend backward to Friday with negative direction', () => {
    assert.equal(snapToWorkday('2026-07-04', -1), '2026-07-03');
    assert.equal(snapToWorkday('2026-07-05', -1), '2026-07-03');
  });
});

describe('dragTaskPatch', () => {
  const task = { start: '2026-07-06', end: '2026-07-10', wday: 5 }; // Mon–Fri

  it('moves the whole bar and keeps duration, pinning the start', () => {
    const p = dragTaskPatch(task, 3, 'move');
    assert.equal(p.start, '2026-07-09');
    assert.equal(p.end, '2026-07-15'); // Thu + 5 working days
    assert.equal(p.pinStart, true);
    assert.equal('wday' in p, false); // move must not touch wday
  });

  it('snaps a move landing on a weekend forward when dragging right', () => {
    // Mon + 5 = Sat 07-11 -> snap forward to Mon 07-13
    const p = dragTaskPatch(task, 5, 'move');
    assert.equal(p.start, '2026-07-13');
    assert.equal(p.end, '2026-07-17');
  });

  it('resizes the right edge and recomputes wday, no pinStart', () => {
    const p = dragTaskPatch(task, 4, 'r');
    assert.equal(p.end, '2026-07-14'); // Fri + 4 = Tue
    assert.equal(p.wday, 7);
    assert.equal('pinStart' in p, false);
    assert.equal('start' in p, false);
  });

  it('clamps right-edge resize to the start date', () => {
    const p = dragTaskPatch(task, -10, 'r');
    assert.equal(p.end, task.start);
    assert.equal(p.wday, 1);
  });

  it('resizes the left edge and recomputes wday, pinning the start', () => {
    const p = dragTaskPatch(task, -2, 'l');
    assert.equal(p.start, '2026-07-03'); // Mon - 2 = Sat -> snap back to Fri
    assert.equal(p.wday, 6);
    assert.equal(p.pinStart, true);
  });

  it('clamps left-edge resize back to the end when crossing it', () => {
    const p = dragTaskPatch(task, 10, 'l');
    assert.equal(p.start, task.end);
    assert.equal(p.wday, 1);
  });

  it('falls back to counting working days when wday is missing', () => {
    const noWday = { start: '2026-07-06', end: '2026-07-10' };
    const p = dragTaskPatch(noWday, 3, 'move');
    assert.equal(p.end, '2026-07-15');
  });
});

describe('dragMilestonePatch', () => {
  it('snaps the new date in the drag direction and pins the start', () => {
    // Sat 2026-07-04: dragging right lands on Sun, snaps forward to Mon
    assert.equal(dragMilestonePatch({ date: '2026-07-04' }, 1).date, '2026-07-06');
    // dragging left from Sun 07-05 by 1 lands on Sat, snaps back to Fri
    assert.equal(dragMilestonePatch({ date: '2026-07-05' }, -1).date, '2026-07-03');
    const p = dragMilestonePatch({ date: '2026-07-06' }, 2);
    assert.equal(p.date, '2026-07-08');
    assert.equal(p.pinStart, true);
  });
});
