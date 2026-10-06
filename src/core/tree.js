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

/**
 * Parent/child + id indexes over a flat task list, replacing repeated O(n)
 * filter/find passes with O(1) lookups in the tree hot paths.
 * The maps alias the task objects: safe to share across a pass that only
 * mutates task fields; any structural change (add/remove/reparent) invalidates it.
 * @returns {{ byId: Map<number|string, object>, byParent: Map<number|string|null, object[]> }}
 */
export function buildIndex(tasks) {
  const byId = new Map();
  const byParent = new Map();
  for (const t of tasks) {
    byId.set(t.id, t);
    const siblings = byParent.get(t.parent);
    if (siblings) siblings.push(t);
    else byParent.set(t.parent, [t]);
  }
  return { byId, byParent };
}

/** Does `id` (transitively, through groups) have a milestone descendant? */
export function hasMilestoneDescendant(tasks, id, visitedOrIndex = null, indexOrVisited = null) {
  let index, visited;
  if (visitedOrIndex && typeof visitedOrIndex.byParent !== 'undefined') {
    index = visitedOrIndex;
    visited = indexOrVisited instanceof Set ? indexOrVisited : new Set();
  } else if (visitedOrIndex instanceof Set) {
    visited = visitedOrIndex;
    index =
      indexOrVisited && typeof indexOrVisited.byParent !== 'undefined'
        ? indexOrVisited
        : buildIndex(tasks);
  } else {
    index = buildIndex(tasks);
    visited = new Set();
  }
  function walk(pid) {
    if (visited.has(pid)) return false;
    visited.add(pid);
    for (const t of index.byParent.get(pid) || []) {
      if (t.type === 'milestone') return true;
      if (t.type === 'group' && walk(t.id)) return true;
    }
    return false;
  }
  return walk(id);
}

/** 1-based row number of `taskId` within the currently visible rows. */
export function getRowNum(tasks, collapsed, milestoneView, taskId, index = buildIndex(tasks)) {
  const rows = getVisibleRows(tasks, collapsed, milestoneView, index);
  const idx = rows.findIndex(r => r.task.id === taskId);
  return idx >= 0 ? idx + 1 : null;
}

/** Task at 1-based row `num`, or null. */
export function getTaskByRowNum(tasks, collapsed, milestoneView, num, index = buildIndex(tasks)) {
  const rows = getVisibleRows(tasks, collapsed, milestoneView, index);
  return rows[num - 1]?.task ?? null;
}

/**
 * Flat list of currently visible rows as `{ task, depth }`.
 * In milestone view only non-done milestones are shown (depth 0).
 * Otherwise the tree is walked from root, skipping collapsed groups.
 */
export function getVisibleRows(tasks, collapsed, milestoneView, index = buildIndex(tasks)) {
  if (milestoneView) {
    return tasks
      .filter(t => t.type === 'milestone' && !t.done)
      .sort((a, b) => ((a.date || '') < (b.date || '') ? -1 : 1))
      .map(t => ({ task: t, depth: 0 }));
  }
  const { byParent } = index;
  const rows = [];
  function addChildren(parentId, depth) {
    for (const t of byParent.get(parentId) || []) {
      rows.push({ task: t, depth });
      if (!collapsed.has(t.id) && byParent.has(t.id)) {
        addChildren(t.id, depth + 1);
      }
    }
  }
  addChildren(null, 0);
  return rows;
}

/**
 * Are all direct task children of group `id` done (≥1 required)?
 * Note: Milestones are intentionally ignored in this calculation.
 */
export function groupAllDone(tasks, id, index = buildIndex(tasks)) {
  const children = (index.byParent.get(id) || []).filter(t => t.type === 'task');
  return children.length > 0 && children.every(t => t.done);
}

/** Earliest start / latest end across a group's descendants (recursive). */
export function groupBounds(tasks, id, index = buildIndex(tasks)) {
  let s = null,
    e = null;
  for (const t of index.byParent.get(id) || []) {
    if (t.type === 'task') {
      if (!s || t.start < s) s = t.start;
      if (!e || t.end > e) e = t.end;
    } else if (t.type === 'milestone') {
      if (!s || t.date < s) s = t.date;
      if (!e || t.date > e) e = t.date;
    } else if (t.type === 'group') {
      const b = groupBounds(tasks, t.id, index);
      if (b.s && (!s || b.s < s)) s = b.s;
      if (b.e && (!e || b.e > e)) e = b.e;
    }
  }
  return { s, e };
}

/**
 * Group overall progress: average progress of all descendant tasks.
 */
export function groupProgress(tasks, id, index = buildIndex(tasks)) {
  let count = 0;
  let sum = 0;
  function collect(parentId) {
    for (const t of index.byParent.get(parentId) || []) {
      if (t.type === 'task') {
        count++;
        sum += t.done ? 100 : t.progress || 0;
      } else {
        // Recurse for group or any non-task container node (exact parity with getAllDescendants)
        collect(t.id);
      }
    }
  }
  collect(id);
  return count === 0 ? 0 : Math.round(sum / count);
}

/**
 * All descendant ids of `id` (recursive, pre-order).
 */
export function getAllDescendants(tasks, id, index = buildIndex(tasks)) {
  const result = [];
  function collect(parentId) {
    for (const t of index.byParent.get(parentId) || []) {
      result.push(t.id);
      collect(t.id);
    }
  }
  collect(id);
  return result;
}

/**
 * Is `checkId` a (transitive) descendant of `ancestorId`?
 * Uses indexed parent-chain traversal O(depth) instead of repeated O(N) array finds.
 */
export function isDescendant(tasks, ancestorId, checkId, index = buildIndex(tasks)) {
  let cur = index.byId.get(checkId);
  const seen = new Set();
  while (cur && cur.parent !== null) {
    if (seen.has(cur.id)) break; // circular reference guard
    seen.add(cur.id);
    if (cur.parent === ancestorId) return true;
    cur = index.byId.get(cur.parent);
  }
  return false;
}

/** Depth of `id` in the tree (root = 0), with circular-reference guard. */
export function getTaskDepth(tasks, id, index = buildIndex(tasks)) {
  let depth = 0,
    cur = index.byId.get(id),
    seen = new Set();
  while (cur && cur.parent !== null) {
    if (seen.has(cur.id)) break; // circular reference guard
    seen.add(cur.id);
    depth++;
    cur = index.byId.get(cur.parent);
  }
  return depth;
}

/** WBS code for a task: dot-separated path of 1-based sibling indices. */
export function getWBSCode(tasks, taskId, index = buildIndex(tasks)) {
  const { byId, byParent } = index;
  const path = [];
  let cur = byId.get(taskId);
  const seen = new Set();
  while (cur) {
    if (seen.has(cur.id)) break;
    seen.add(cur.id);
    const siblings = byParent.get(cur.parent) || [];
    const idx = siblings.indexOf(cur) + 1;
    path.unshift(idx);
    cur = cur.parent !== null ? byId.get(cur.parent) : null;
  }
  return path.join('.');
}

/**
 * Bulk WBS map for all tasks. O(n) instead of O(n² × depth) when calling
 * getWBSCode per task. Returns Map<taskId, wbsCode>.
 *
 * Algorithm: pre-group tasks by parent for O(1) sibling lookups, then walk
 * each task once using the parent chain. The sibling index for a task is its
 * 1-based position among siblings in the original `tasks` order.
 */
export function getWBSMap(tasks) {
  const { byId, byParent } = buildIndex(tasks);
  const map = new Map();
  function walk(id) {
    if (map.has(id)) return map.get(id);
    const t = byId.get(id);
    if (!t) return '';
    const siblings = byParent.get(t.parent) || [];
    const idx = siblings.indexOf(t) + 1;
    let prefix = '';
    if (t.parent !== null) {
      prefix = walk(t.parent);
      prefix = prefix ? prefix + '.' : '';
    }
    const code = prefix + idx;
    map.set(id, code);
    return code;
  }
  for (const t of tasks) walk(t.id);
  return map;
}
