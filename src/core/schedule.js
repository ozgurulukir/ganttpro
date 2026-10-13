/**
 * Forward-pass task scheduler.
 *
 * Computes earliest start/end for every task and milestone based on the four
 * dependency types (FS/SS/FF/SF) with optional lag.  Calendar helpers come
 * from calendar.js; `groupBounds` / `buildIndex` from tree.js.  The task array
 * and project start date are passed explicitly.
 *
 * NOTE: these functions MUTATE the passed task objects (set start/end/date),
 * exactly as the original code did — this is the scheduler's job.  They are
 * deterministic and unit-testable because the inputs are explicit.
 *
 * Extracted verbatim from main.js (Phase 1.5); only the state previously read
 * as globals is now passed explicitly.
 */
import {
  countWorkingDays,
  nextWorkingDay,
  shiftWorkingDays,
  subtractWorkingDays,
  addWorkingDays,
  isNonWorkday
} from './calendar.js';
import { parseDate, formatDate } from './date.js';
import { groupBounds, buildIndex } from './tree.js';
import { wouldCreateCycle } from './deps.js';

/** Are all (transitively, through sub-groups) children of `groupId` scheduled? */
export function allGroupMembersScheduled(tasks, groupId, scheduled, index = buildIndex(tasks)) {
  return (index.byParent.get(groupId) || []).every(child => {
    if (child.type === 'group') return allGroupMembersScheduled(tasks, child.id, scheduled, index);
    return scheduled.has(child.id);
  });
}

/**
 * Schedule all tasks & milestones from `projStart` honouring FS/SS/FF/SF deps
 * with lag.  Iterates to fixpoint (max candidates*3 passes).  Mutates each
 * task's start/end (tasks) or date (milestones) in place.
 */
export function scheduleTasks(tasks, projStart) {
  if (!projStart) return;
  // The task structure is fixed for the whole pass (only start/end fields are
  // mutated below), so one index serves every dep lookup in the fixpoint loop.
  const index = buildIndex(tasks);
  // Ensure all tasks have wday
  tasks.forEach(t => {
    if (t.type === 'task' && !t.wday)
      t.wday = t.start && t.end ? countWorkingDays(t.start, t.end) : 1;
  });
  let remaining = tasks.filter(t => t.type === 'task' || t.type === 'milestone');
  const scheduled = new Set();
  const MAX = remaining.length * 3;
  let iter = 0,
    progress = true;

  // Helper check for scheduled state of a dependency (handles groups and tasks/milestones)
  const isScheduled = d =>
    d.type === 'group'
      ? allGroupMembersScheduled(tasks, d.id, scheduled, index)
      : scheduled.has(d.id);

  while (progress && iter++ < MAX && remaining.length > 0) {
    progress = false;
    const nextRemaining = [];

    // Zero-allocation loop over unscheduled tasks; short-circuits on unresolved deps
    for (let k = 0; k < remaining.length; k++) {
      const task = remaining[k];

      let unresolved = false;

      // FS deps: must be scheduled first
      if (task.deps && task.deps.length) {
        for (let i = 0; i < task.deps.length; i++) {
          const d = index.byId.get(task.deps[i]);
          if (d && !isScheduled(d)) {
            unresolved = true;
            break;
          }
        }
      }

      // SS deps: must be scheduled first
      if (!unresolved && task.sdeps && task.sdeps.length) {
        for (let i = 0; i < task.sdeps.length; i++) {
          const d = index.byId.get(task.sdeps[i]);
          if (d && !scheduled.has(d.id)) {
            unresolved = true;
            break;
          }
        }
      }

      // FF deps: must be scheduled first
      if (!unresolved && task.ffdeps && task.ffdeps.length) {
        for (let i = 0; i < task.ffdeps.length; i++) {
          const d = index.byId.get(task.ffdeps[i]);
          if (d && !scheduled.has(d.id)) {
            unresolved = true;
            break;
          }
        }
      }

      // SF deps: must be scheduled first
      if (!unresolved && task.sfdeps && task.sfdeps.length) {
        for (let i = 0; i < task.sfdeps.length; i++) {
          const d = index.byId.get(task.sfdeps[i]);
          if (d && !scheduled.has(d.id)) {
            unresolved = true;
            break;
          }
        }
      }

      if (unresolved) {
        nextRemaining.push(task);
        continue;
      }

      const lags = task.lags;

      // Latest end among FS deps → task must start after this (with lag offset)
      let latestFsEnd = null;
      if (task.deps && task.deps.length) {
        for (let i = 0; i < task.deps.length; i++) {
          const depId = task.deps[i];
          const dep = index.byId.get(depId);
          if (!dep) continue;
          let e =
            dep.type === 'task'
              ? dep.end
              : dep.type === 'milestone'
                ? dep.date
                : dep.type === 'group'
                  ? groupBounds(tasks, dep.id, index).e
                  : null;
          if (!e) continue;
          const lag = lags ? lags['FS' + depId] || 0 : 0;
          if (lag) e = shiftWorkingDays(e, lag);
          if (!latestFsEnd || e > latestFsEnd) latestFsEnd = e;
        }
      }

      // Latest start among SS deps → task must start no earlier than this
      let latestSsStart = null;
      if (task.sdeps && task.sdeps.length) {
        for (let i = 0; i < task.sdeps.length; i++) {
          const depId = task.sdeps[i];
          const dep = index.byId.get(depId);
          if (!dep) continue;
          let s = dep.type === 'task' ? dep.start : dep.type === 'milestone' ? dep.date : null;
          if (!s) continue;
          const lag = lags ? lags['SS' + depId] || 0 : 0;
          if (lag) s = shiftWorkingDays(s, lag);
          if (!latestSsStart || s > latestSsStart) latestSsStart = s;
        }
      }

      // Latest end among FF deps → backward-schedule task start so end >= dep end
      let latestFfEnd = null;
      if (task.ffdeps && task.ffdeps.length) {
        for (let i = 0; i < task.ffdeps.length; i++) {
          const depId = task.ffdeps[i];
          const dep = index.byId.get(depId);
          if (!dep) continue;
          let e = dep.type === 'task' ? dep.end : dep.type === 'milestone' ? dep.date : null;
          if (!e) continue;
          const lag = lags ? lags['FF' + depId] || 0 : 0;
          if (lag) e = shiftWorkingDays(e, lag);
          if (!latestFfEnd || e > latestFfEnd) latestFfEnd = e;
        }
      }

      // Latest start among SF deps → backward-schedule task start so end >= dep start
      let latestSfStart = null;
      if (task.sfdeps && task.sfdeps.length) {
        for (let i = 0; i < task.sfdeps.length; i++) {
          const depId = task.sfdeps[i];
          const dep = index.byId.get(depId);
          if (!dep) continue;
          let s = dep.type === 'task' ? dep.start : dep.type === 'milestone' ? dep.date : null;
          if (!s) continue;
          const lag = lags ? lags['SF' + depId] || 0 : 0;
          if (lag) s = shiftWorkingDays(s, lag);
          if (!latestSfStart || s > latestSfStart) latestSfStart = s;
        }
      }

      if (task.type === 'task') {
        let rawStart = latestFsEnd
          ? nextWorkingDay(latestFsEnd)
          : task.pinStart && task.start
            ? task.start
            : projStart;
        if (latestSsStart && latestSsStart > rawStart) rawStart = latestSsStart;
        // FF: task.end must >= latestFfEnd → push start so end lands on latestFfEnd
        if (latestFfEnd) {
          const ffStart = subtractWorkingDays(latestFfEnd, (task.wday || 1) - 1);
          if (ffStart > rawStart) rawStart = ffStart;
        }
        // SF: task.end must >= latestSfStart → same logic
        if (latestSfStart) {
          const sfStart = subtractWorkingDays(latestSfStart, (task.wday || 1) - 1);
          if (sfStart > rawStart) rawStart = sfStart;
        }
        let s = parseDate(rawStart);
        while (isNonWorkday(s)) s++;
        task.start = formatDate(s);
        task.end = addWorkingDays(task.start, task.wday || 1);
      } else {
        // milestone
        let best = latestFsEnd || latestSsStart || null;
        if (best) {
          let dn = parseDate(best);
          while (isNonWorkday(dn)) dn++;
          task.date = formatDate(dn);
        } else if (!(task.pinStart && task.date)) {
          let dn = parseDate(projStart);
          while (isNonWorkday(dn)) dn++;
          task.date = formatDate(dn);
        }
      }
      scheduled.add(task.id);
      progress = true;
    }
    remaining = nextRemaining;
  }
  if (remaining.length > 0) {
    remaining.forEach(t => {
      ['deps', 'sdeps', 'ffdeps', 'sfdeps'].forEach(depProp => {
        (t[depProp] || []).forEach(depId => {
          if (wouldCreateCycle(tasks, t.id, depId, index)) {
            console.warn(`Cycle detected between ${t.id} and ${depId}`);
          }
        });
      });
    });
  }
}

/**
 * Re-schedule a single task from its FS/SS deps (lightweight, used on edit).
 * Only pushes the task LATER (never earlier).  Mutates task.start/end in place.
 * Uses indexed task lookups O(1) instead of repeated O(N) array finds.
 */
export function autoScheduleFromDeps(tasks, task, index = buildIndex(tasks)) {
  if (task.type !== 'task') return;
  const deps = task.deps || [];
  const sdeps = task.sdeps || [];
  if (!deps.length && !sdeps.length) return;
  let candidateStart = null;
  // FS: start after dep ends
  deps.forEach(depId => {
    const dep = index.byId.get(depId);
    if (!dep) return;
    let depEnd =
      dep.type === 'task'
        ? dep.end
        : dep.type === 'milestone'
          ? dep.date
          : dep.type === 'group'
            ? groupBounds(tasks, dep.id, index).e
            : null;
    if (depEnd) {
      const s = nextWorkingDay(depEnd);
      if (!candidateStart || s > candidateStart) candidateStart = s;
    }
  });
  // SS: start no earlier than dep starts
  sdeps.forEach(depId => {
    const dep = index.byId.get(depId);
    if (!dep) return;
    const s = dep.type === 'task' ? dep.start : dep.type === 'milestone' ? dep.date : null;
    if (s && (!candidateStart || s > candidateStart)) candidateStart = s;
  });
  if (!candidateStart) return;
  const wdays =
    task.wday !== undefined
      ? task.wday
      : task.start && task.end
        ? countWorkingDays(task.start, task.end)
        : 1;
  if (candidateStart > (task.start || '')) {
    task.start = candidateStart;
    task.end = addWorkingDays(task.start, wdays);
  }
}
