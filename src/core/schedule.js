/**
 * Forward-pass task scheduler.
 *
 * Computes earliest start/end for every task and milestone based on the four
 * dependency types (FS/SS/FF/SF) with optional lag.  Calendar helpers come
 * from calendar.js; `taskById` / `groupBounds` from tree.js.  The task array
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
import { taskById, groupBounds } from './tree.js';

/** Are all (transitively, through sub-groups) children of `groupId` scheduled? */
export function allGroupMembersScheduled(tasks, groupId, scheduled) {
  return tasks.filter(t => t.parent === groupId).every(child => {
    if (child.type === 'group') return allGroupMembersScheduled(tasks, child.id, scheduled);
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
  // Ensure all tasks have wday
  tasks.forEach(t => {
    if (t.type === 'task' && !t.wday)
      t.wday = (t.start && t.end) ? countWorkingDays(t.start, t.end) : 1;
  });
  const candidates = tasks.filter(t => t.type === 'task' || t.type === 'milestone');
  const scheduled = new Set();
  const MAX = candidates.length * 3;
  let iter = 0, progress = true;
  while (progress && iter++ < MAX) {
    progress = false;
    candidates.forEach(task => {
      if (scheduled.has(task.id)) return;
      // FS deps: must be scheduled first
      const deps = (task.deps || []).map(id => taskById(tasks, id)).filter(Boolean);
      const unresolvedFs = deps.filter(d => {
        if (d.type === 'group') return !allGroupMembersScheduled(tasks, d.id, scheduled);
        return !scheduled.has(d.id);
      });
      if (unresolvedFs.length) return;
      // SS deps: must be scheduled first too
      const sdeps = (task.sdeps || []).map(id => taskById(tasks, id)).filter(Boolean);
      const unresolvedSs = sdeps.filter(d => !scheduled.has(d.id));
      if (unresolvedSs.length) return;
      // FF deps: must be scheduled first
      const ffdeps = (task.ffdeps || []).map(id => taskById(tasks, id)).filter(Boolean);
      const unresolvedFf = ffdeps.filter(d => !scheduled.has(d.id));
      if (unresolvedFf.length) return;
      // SF deps: must be scheduled first
      const sfdeps = (task.sfdeps || []).map(id => taskById(tasks, id)).filter(Boolean);
      const unresolvedSf = sfdeps.filter(d => !scheduled.has(d.id));
      if (unresolvedSf.length) return;

      const depLag = (type, id) => (task.lags || {})[type + id] || 0;
      // Latest end among FS deps → task must start after this（含 lag 偏移）
      let latestFsEnd = null;
      deps.forEach(dep => {
        let e = dep.type === 'task' ? dep.end
              : dep.type === 'milestone' ? dep.date
              : dep.type === 'group' ? groupBounds(tasks, dep.id).e : null;
        if (!e) return;
        e = shiftWorkingDays(e, depLag('FS', dep.id));
        if (!latestFsEnd || e > latestFsEnd) latestFsEnd = e;
      });
      // Latest start among SS deps → task must start no earlier than this
      let latestSsStart = null;
      sdeps.forEach(dep => {
        let s = dep.type === 'task' ? dep.start : dep.type === 'milestone' ? dep.date : null;
        if (!s) return;
        s = shiftWorkingDays(s, depLag('SS', dep.id));
        if (!latestSsStart || s > latestSsStart) latestSsStart = s;
      });
      // Latest end among FF deps → backward-schedule task start so end >= dep end
      let latestFfEnd = null;
      ffdeps.forEach(dep => {
        let e = dep.type === 'task' ? dep.end : dep.type === 'milestone' ? dep.date : null;
        if (!e) return;
        e = shiftWorkingDays(e, depLag('FF', dep.id));
        if (!latestFfEnd || e > latestFfEnd) latestFfEnd = e;
      });
      // Latest start among SF deps → backward-schedule task start so end >= dep start
      let latestSfStart = null;
      sfdeps.forEach(dep => {
        let s = dep.type === 'task' ? dep.start : dep.type === 'milestone' ? dep.date : null;
        if (!s) return;
        s = shiftWorkingDays(s, depLag('SF', dep.id));
        if (!latestSfStart || s > latestSfStart) latestSfStart = s;
      });

      if (task.type === 'task') {
        let rawStart = latestFsEnd ? nextWorkingDay(latestFsEnd)
                     : (task.pinStart && task.start ? task.start : projStart);
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
        while (isNonWorkday(formatDate(s))) s++;
        task.start = formatDate(s);
        task.end   = addWorkingDays(task.start, task.wday || 1);
      } else { // milestone
        let best = latestFsEnd || latestSsStart || null;
        if (best) {
          let dn = parseDate(best);
          while (isNonWorkday(formatDate(dn))) dn++;
          task.date = formatDate(dn);
        } else if (!(task.pinStart && task.date)) {
          let dn = parseDate(projStart);
          while (isNonWorkday(formatDate(dn))) dn++;
          task.date = formatDate(dn);
        }
      }
      scheduled.add(task.id);
      progress = true;
    });
  }
}

/**
 * Re-schedule a single task from its FS/SS deps (lightweight, used on edit).
 * Only pushes the task LATER (never earlier).  Mutates task.start/end in place.
 */
export function autoScheduleFromDeps(tasks, task) {
  if (task.type !== 'task') return;
  const deps = task.deps || [];
  const sdeps = task.sdeps || [];
  if (!deps.length && !sdeps.length) return;
  let candidateStart = null;
  // FS: start after dep ends
  deps.forEach(depId => {
    const dep = taskById(tasks, depId);
    if (!dep) return;
    let depEnd = dep.type === 'task' ? dep.end
                : dep.type === 'milestone' ? dep.date
                : dep.type === 'group' ? groupBounds(tasks, dep.id).e
                : null;
    if (depEnd) {
      const s = nextWorkingDay(depEnd);
      if (!candidateStart || s > candidateStart) candidateStart = s;
    }
  });
  // SS: start no earlier than dep starts
  sdeps.forEach(depId => {
    const dep = taskById(tasks, depId);
    if (!dep) return;
    const s = dep.type === 'task' ? dep.start : dep.type === 'milestone' ? dep.date : null;
    if (s && (!candidateStart || s > candidateStart)) candidateStart = s;
  });
  if (!candidateStart) return;
  const wdays = (task.start && task.end) ? countWorkingDays(task.start, task.end) : 1;
  if (candidateStart > (task.start || '')) {
    task.start = candidateStart;
    task.end = addWorkingDays(task.start, wdays);
  }
}
