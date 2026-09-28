/* Pure patch builders for bar/milestone drag interactions.
 * Each returns a plain patch object for applyTaskChange — no mutation here,
 * so the drag date math is unit-testable without a DOM. */
import { addDays } from './date.js';
import { snapToWorkday, countWorkingDays, addWorkingDays } from './calendar.js';

/**
 * Patch for dragging a task bar: whole bar ('move'), right edge ('r'),
 * or left edge ('l'). Direction-aware workday snapping: dragging right
 * snaps forward to the next workday, dragging left snaps backward.
 */
export function dragTaskPatch(task, delta, mode) {
  const wd = task.wday || countWorkingDays(task.start, task.end);
  const snapDir = str => snapToWorkday(str, delta);

  if (mode === 'move') {
    const start = snapDir(addDays(task.start, delta));
    return { start, end: addWorkingDays(start, wd), pinStart: true };
  }
  if (mode === 'r') {
    let end = snapDir(addDays(task.end, delta));
    if (end < task.start) end = task.start;
    return { end, wday: countWorkingDays(task.start, end) };
  }
  let start = snapDir(addDays(task.start, delta));
  if (start > task.end) start = snapToWorkday(task.end, -1);
  return { start, wday: countWorkingDays(start, task.end), pinStart: true };
}

/** Patch for dragging a milestone diamond along the timeline spine. */
export function dragMilestonePatch(task, delta) {
  return { date: snapToWorkday(addDays(task.date, delta), delta), pinStart: true };
}
