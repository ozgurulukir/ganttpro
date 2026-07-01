/**
 * Pure tree-structure queries over a flat task list.
 *
 * Every function takes `tasks` (the flat task array) as its first argument.
 * `getVisibleRows` additionally takes `collapsed` (Set of hidden group ids)
 * and `milestoneView` (boolean).  No globals are read — these are fully
 * deterministic and thus unit-testable.
 *
 * Extracted verbatim from main.js (Phase 1.2); only the state previously read
 * as globals is now passed explicitly.
 */

/** Find a single task by id. */
export function taskById(tasks, id) {
  return tasks.find(t => t.id === id);
}

/** Tree-guide-line type per ancestor column for the row at `idx`. */
export function getTreeLines(rows, idx) {
  const d = rows[idx].depth;
  if (d === 0) return [];
  const types = [];
  for (let col = 0; col < d - 1; col++) {
    let hasPipe = false;
    for (let j = idx + 1; j < rows.length; j++) {
      if (rows[j].depth <= col) break;
      if (rows[j].depth === col + 1) {
        hasPipe = true;
        break;
      }
    }
    types.push(hasPipe ? 'pipe' : 'space');
  }
  let isLast = true;
  for (let j = idx + 1; j < rows.length; j++) {
    if (rows[j].depth < d) break;
    if (rows[j].depth === d) {
      isLast = false;
      break;
    }
  }
  types.push(isLast ? 'last' : 'fork');
  return types;
}

/** Does `id` (transitively, through groups) have a milestone descendant? */
export function hasMilestoneDescendant(tasks, id) {
  for (const t of tasks.filter(t => t.parent === id)) {
    if (t.type === 'milestone') return true;
    if (t.type === 'group' && hasMilestoneDescendant(tasks, t.id)) return true;
  }
  return false;
}

/** 1-based row number of `taskId` within the currently visible rows. */
export function getRowNum(tasks, collapsed, milestoneView, taskId) {
  const rows = getVisibleRows(tasks, collapsed, milestoneView);
  const idx = rows.findIndex(r => r.task.id === taskId);
  return idx >= 0 ? idx + 1 : null;
}

/** Task at 1-based row `num`, or null. */
export function getTaskByRowNum(tasks, collapsed, milestoneView, num) {
  const rows = getVisibleRows(tasks, collapsed, milestoneView);
  return rows[num - 1]?.task ?? null;
}

/**
 * Flat list of currently visible rows as `{ task, depth }`.
 * In milestone view only non-done milestones are shown (depth 0).
 * Otherwise the tree is walked from root, skipping collapsed groups.
 */
export function getVisibleRows(tasks, collapsed, milestoneView) {
  if (milestoneView) {
    return tasks
      .filter(t => t.type === 'milestone' && !t.done)
      .sort((a, b) => ((a.date || '') < (b.date || '') ? -1 : 1))
      .map(t => ({ task: t, depth: 0 }));
  }
  const rows = [];
  function addChildren(parentId, depth) {
    tasks
      .filter(t => t.parent === parentId)
      .forEach(t => {
        rows.push({ task: t, depth });
        if (!collapsed.has(t.id) && tasks.some(c => c.parent === t.id)) {
          addChildren(t.id, depth + 1);
        }
      });
  }
  addChildren(null, 0);
  return rows;
}

/** Are all direct task children of group `id` done (≥1 required)? */
export function groupAllDone(tasks, id) {
  const children = tasks.filter(t => t.parent === id && t.type === 'task');
  return children.length > 0 && children.every(t => t.done);
}

/** Earliest start / latest end across a group's descendants (recursive). */
export function groupBounds(tasks, id) {
  let s = null,
    e = null;
  tasks
    .filter(t => t.parent === id)
    .forEach(t => {
      if (t.type === 'task') {
        if (!s || t.start < s) s = t.start;
        if (!e || t.end > e) e = t.end;
      } else if (t.type === 'milestone') {
        if (!s || t.date < s) s = t.date;
        if (!e || t.date > e) e = t.date;
      } else if (t.type === 'group') {
        const b = groupBounds(tasks, t.id);
        if (b.s && (!s || b.s < s)) s = b.s;
        if (b.e && (!e || b.e > e)) e = b.e;
      }
    });
  return { s, e };
}

/** Group overall progress: average progress of all descendant tasks. */
export function groupProgress(tasks, id) {
  const ts = getAllDescendants(tasks, id)
    .map(d => taskById(tasks, d))
    .filter(t => t && t.type === 'task');
  if (!ts.length) return 0;
  const sum = ts.reduce((a, t) => a + (t.done ? 100 : t.progress || 0), 0);
  return Math.round(sum / ts.length);
}

/** All descendant ids of `id` (recursive, pre-order). */
export function getAllDescendants(tasks, id) {
  const result = [];
  function collect(parentId) {
    tasks
      .filter(t => t.parent === parentId)
      .forEach(t => {
        result.push(t.id);
        collect(t.id);
      });
  }
  collect(id);
  return result;
}

/** Is `checkId` a (transitive) descendant of `ancestorId`? */
export function isDescendant(tasks, ancestorId, checkId) {
  const t = taskById(tasks, checkId);
  if (!t || t.parent === null) return false;
  if (t.parent === ancestorId) return true;
  return isDescendant(tasks, ancestorId, t.parent);
}

/** Depth of `id` in the tree (root = 0), with circular-reference guard. */
export function getTaskDepth(tasks, id) {
  let depth = 0,
    cur = taskById(tasks, id),
    seen = new Set();
  while (cur && cur.parent !== null) {
    if (seen.has(cur.id)) break; // circular reference guard
    seen.add(cur.id);
    depth++;
    cur = taskById(tasks, cur.parent);
  }
  return depth;
}
