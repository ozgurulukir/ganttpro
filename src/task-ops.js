import { t } from './i18n/index.js';

/**
 * Collect all descendant task IDs of `tid` (including `tid` itself).
 * Returns { ids: Set, items: tasks[] }.
 */
export function collectSubtree(tid, tasks) {
  const ids = new Set();
  function walk(id) {
    ids.add(id);
    tasks.filter(c => c.parent === id).forEach(c => walk(c.id));
  }
  walk(tid);
  return { ids, items: tasks.filter(t => ids.has(t.id)) };
}

/**
 * Make a task a child of its previous sibling.
 * deps: { taskById, getTaskDepth, pushHistory, scheduleTasks, recalcProjEnd, render, showStatus }
 */
export function indentTask(id, tasks, deps) {
  const { taskById, getTaskDepth, pushHistory, scheduleTasks, recalcProjEnd, render, showStatus } =
    deps;
  const task = tasks.find(t => t.id === id);
  if (!task) {
    showStatus(t('modal.indentNoPrev'));
    return;
  }
  const myIdx = tasks.findIndex(t => t.id === id);
  let prevSibling = null;
  for (let i = myIdx - 1; i >= 0; i--) {
    if (tasks[i].parent === task.parent) {
      prevSibling = tasks[i];
      break;
    }
  }
  if (!prevSibling) {
    showStatus(t('modal.indentNoPrev'));
    return;
  }
  if (getTaskDepth(prevSibling.id) + 1 >= 5) {
    showStatus(t('modal.indentLimit'));
    return;
  }
  pushHistory();
  task.parent = prevSibling.id;
  scheduleTasks();
  recalcProjEnd();
  render();
}

/**
 * Move a task and its subtree up one level.
 * deps: { taskById, pushHistory, scheduleTasks, recalcProjEnd, render, showStatus }
 */
export function outdentTask(id, tasks, deps) {
  const { taskById, pushHistory, scheduleTasks, recalcProjEnd, render, showStatus } = deps;
  const task = taskById(id);
  if (!task) {
    showStatus(t('modal.outdentLimit'));
    return;
  }
  if (task.parent === null) {
    showStatus(t('modal.outdentLimit'));
    return;
  }
  const parent = taskById(task.parent);
  if (!parent || parent.parent === null) {
    showStatus(t('modal.outdentLimit'));
    return;
  }

  pushHistory();

  // Collect task + all its descendants (preserve order)
  const { ids: subtreeIds, items: subtree } = collectSubtree(id, tasks);

  // Remove subtree from main array
  const _remaining = tasks.filter(t => !subtreeIds.has(t.id));
  tasks.length = 0;
  tasks.push(..._remaining);

  // Find insertion point: after last descendant of parent in remaining tasks.
  // Build a Set of all descendants of `parent` first, then a single linear scan.
  const parentDescendants = new Set();
  const stack = [parent.id];
  while (stack.length) {
    const pid = stack.pop();
    for (const c of tasks) {
      if (c.parent === pid) {
        parentDescendants.add(c.id);
        stack.push(c.id);
      }
    }
  }
  const parentIdx = tasks.findIndex(t => t.id === parent.id);
  let insertIdx = parentIdx;
  for (let i = parentIdx + 1; i < tasks.length; i++) {
    if (parentDescendants.has(tasks[i].id)) insertIdx = i;
  }

  // Update parent and reinsert after parent's subtree
  task.parent = parent.parent;
  tasks.splice(insertIdx + 1, 0, ...subtree);

  scheduleTasks();
  recalcProjEnd();
  render();
}

/**
 * Drag-and-drop reorder of a task.
 * deps: { taskById, isDescendant, pushHistory, scheduleTasks, recalcProjEnd, render }
 */
export function reorderTask(srcId, targetId, insertBefore, tasks, deps) {
  const { taskById, isDescendant, pushHistory, scheduleTasks, recalcProjEnd, render } = deps;
  const src = taskById(srcId);
  const target = taskById(targetId);
  if (!src || !target) return;
  if (isDescendant(srcId, targetId)) return; // prevent cycle

  pushHistory();

  // New parent: dropping on a group row → child of that group
  //             dropping on task/milestone → sibling of target
  src.parent = target.type === 'group' && !insertBefore ? target.id : target.parent;

  // Reorder in tasks array
  const srcIdx = tasks.indexOf(src);
  tasks.splice(srcIdx, 1);
  const targetIdx = tasks.indexOf(target);
  tasks.splice(insertBefore ? targetIdx : targetIdx + 1, 0, src);

  scheduleTasks();
  recalcProjEnd();
  render();
}
