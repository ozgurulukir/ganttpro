/* Pure patch builders for task-form and inline-editor commits.
 * Consumers: ui/modal.js (submitTask, inline editors) — the DOM stays in the
 * shell; everything here is plain data-in/data-out and unit-testable. */
import { countWorkingDays } from './calendar.js';
import { lagsFromParsed } from './deps.js';

/**
 * Classify parsed dependency tokens (from Deps.parseDepInput) into the four
 * dep arrays plus lags. Arrays are deduped and always present; lags is
 * omitted when empty. This is the single classification used by both the
 * task modal and the deps cell editor.
 */
export function depsFromParsed(parsed) {
  const pick = type => [...new Set(parsed.filter(p => p.type === type).map(p => p.taskId))];
  const fields = {
    deps: pick('FS'),
    sdeps: pick('SS'),
    ffdeps: pick('FF'),
    sfdeps: pick('SF')
  };
  const lags = lagsFromParsed(parsed);
  if (Object.keys(lags).length) fields.lags = lags;
  return fields;
}

/**
 * Patch for committing the inline start-date editor: pushing the start past
 * the end extends the end; otherwise the duration (wday) is recomputed.
 */
export function startEditPatch(task, val) {
  const patch = { start: val, pinStart: true };
  if (val > (task.end || '')) patch.end = val;
  else patch.wday = countWorkingDays(val, task.end);
  return patch;
}

/**
 * Patch for committing the inline end-date editor: pulling the end before
 * the start moves the start (1-day task); otherwise the duration is
 * recomputed from the start.
 */
export function endEditPatch(task, val) {
  const patch = { end: val, pinStart: true };
  if (val < (task.start || '')) {
    patch.start = val;
    patch.wday = 1;
  } else {
    patch.wday = countWorkingDays(task.start, val);
  }
  return patch;
}
