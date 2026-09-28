/**
 * Pure dependency (predecessor) parsing & cycle detection.
 *
 * Stateful resolvers (taskById, getRowNum, getTaskByRowNum) come from tree.js;
 * the task array and view state are passed explicitly so these are testable.
 *
 * Extracted verbatim from main.js (Phase 1.3); only the state previously read
 * as globals is now passed explicitly.
 */
import { taskById, getRowNum, getTaskByRowNum } from './tree.js';

/**
 * Would adding `taskId -> newDepId` (taskId depends on newDepId) create a cycle?
 * Walks the dependency graph forward from newDepId; if it reaches taskId, the
 * new edge would close a loop.  `visited` guards against pre-existing cycles.
 */
export function wouldCreateCycle(tasks, taskId, newDepId) {
  const visited = new Set();
  function dfs(id) {
    if (id === taskId) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    const t = taskById(tasks, id);
    if (!t) return false;
    const all = [...(t.deps || []), ...(t.sdeps || []), ...(t.ffdeps || []), ...(t.sfdeps || [])];
    return all.some(dfs);
  }
  return dfs(newDepId);
}

/** Render a task's four dependency arrays as editable text, e.g. "2FS, 3SS+1". */
export function buildDepsText(tasks, collapsed, milestoneView, task) {
  const parts = [];
  const lagSfx = (type, id) => {
    const l = (task.lags || {})[type + id] || 0;
    return l ? (l > 0 ? '+' + l : String(l)) : '';
  };
  (task.deps || []).forEach(id => {
    const n = getRowNum(tasks, collapsed, milestoneView, id);
    if (n) parts.push(n + 'FS' + lagSfx('FS', id));
  });
  (task.sdeps || []).forEach(id => {
    const n = getRowNum(tasks, collapsed, milestoneView, id);
    if (n) parts.push(n + 'SS' + lagSfx('SS', id));
  });
  (task.ffdeps || []).forEach(id => {
    const n = getRowNum(tasks, collapsed, milestoneView, id);
    if (n) parts.push(n + 'FF' + lagSfx('FF', id));
  });
  (task.sfdeps || []).forEach(id => {
    const n = getRowNum(tasks, collapsed, milestoneView, id);
    if (n) parts.push(n + 'SF' + lagSfx('SF', id));
  });
  return parts.join(', ');
}

/**
 * Parse a free-text dependency string into structured entries.
 * Each entry is either a success `{ rowNum, type, lag, taskId, raw }` or an
 * error `{ raw, err }`.  Validates format, row existence, self-reference, and
 * cycles.  Empty/blank input yields [].
 */
export function parseDepInput(val, taskId, tasks, collapsed, milestoneView) {
  if (!val || typeof val !== 'string' || !val.trim()) return [];
  return val
    .split(',')
    .map(s => {
      s = s.trim();
      if (!s) return null;
      const m = s.toUpperCase().match(/^(\d+)\s*(FS|SS|FF|SF)?\s*([+-]\d+)?$/);
      if (!m) return { raw: s, err: 'Invalid format (expected: 2FS, 3SS, or 2FS+3)' };
      const rowNum = parseInt(m[1]);
      const type = m[2] || 'FS';
      const lag = m[3] ? parseInt(m[3]) : 0;
      const depTask = getTaskByRowNum(tasks, collapsed, milestoneView, rowNum);
      if (!depTask) return { raw: s, err: `Row ${rowNum} not found` };
      if (depTask.id === taskId) return { raw: s, err: 'Cannot depend on itself' };
      if (taskId != null && wouldCreateCycle(tasks, taskId, depTask.id))
        return { raw: s, err: 'Circular dependency detected' };
      return { rowNum, type, lag, taskId: depTask.id, raw: s };
    })
    .filter(Boolean);
}

/** Build the `lags` map (key = type+predecessorId, e.g. "FS12") from parsed input. */
export function lagsFromParsed(parsed) {
  const lags = {};
  parsed.forEach(p => {
    if (p.lag) lags[p.type + p.taskId] = p.lag;
  });
  return lags;
}
