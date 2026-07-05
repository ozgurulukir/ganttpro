/**
 * Pure validators/sanitizers for project and task data coming from
 * Firestore, localStorage, or share links. Returns a sanitized object,
 * or null if the input is not recoverable.
 */

import { isValidHexColor } from './format.js';

const TASK_TYPES = new Set(['task', 'group', 'milestone']);
const DEFAULT_COLOR = '#5E6AD2';

function toStr(v) {
  return typeof v === 'string' ? v : String(v ?? '');
}

function toInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function toDateStr(v) {
  const s = toStr(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function toIdArray(v) {
  if (!Array.isArray(v)) return [];
  return v.map(x => Number(x)).filter(x => Number.isFinite(x) && x > 0);
}

export function validateTask(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const t = { ...raw };

  const id = toInt(t.id, null);
  if (id === null || id <= 0) return null;

  const type = TASK_TYPES.has(t.type) ? t.type : 'task';
  const parent = t.parent === null || t.parent === undefined ? null : toInt(t.parent, null);

  const color = isValidHexColor(t.color) ? t.color : DEFAULT_COLOR;

  const task = {
    id,
    name: toStr(t.name).slice(0, 200) || 'Untitled',
    type,
    parent,
    color
  };

  if (type === 'task') {
    task.start = toDateStr(t.start);
    task.end = toDateStr(t.end);
    task.wday = Math.max(1, toInt(t.wday, 1));
    task.done = !!t.done;
    task.progress = Math.max(0, Math.min(100, toInt(t.progress, 0)));
    if (t.assignee) task.assignee = toStr(t.assignee).slice(0, 100);
  } else if (type === 'milestone') {
    task.date = toDateStr(t.date);
    task.done = !!t.done;
    if (t.assignee) task.assignee = toStr(t.assignee).slice(0, 100);
  }

  task.deps = toIdArray(t.deps);
  task.sdeps = toIdArray(t.sdeps);
  if (t.ffdeps?.length) task.ffdeps = toIdArray(t.ffdeps);
  if (t.sfdeps?.length) task.sfdeps = toIdArray(t.sfdeps);

  if (t.lags && typeof t.lags === 'object') {
    const lags = {};
    for (const [k, v] of Object.entries(t.lags)) {
      const n = Number(v);
      if (Number.isFinite(n)) lags[k] = n;
    }
    if (Object.keys(lags).length) task.lags = lags;
  }

  return task;
}

export function validateProject(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const p = { ...raw };

  const id = toInt(p.id, null);
  if (id === null || id <= 0) return null;

  const tasks = Array.isArray(p.tasks) ? p.tasks.map(validateTask).filter(Boolean) : [];

  // Ensure at least a root group exists
  if (!tasks.length || tasks[0].parent !== null) {
    tasks.unshift({
      id: 1,
      name: toStr(p.name).slice(0, 200) || 'Project',
      type: 'group',
      parent: null,
      color: DEFAULT_COLOR
    });
  }

  const startDate = toDateStr(p.startDate) || '2026-04-01';
  const endDate = toDateStr(p.endDate) || '2026-07-31';

  const proj = {
    id,
    name: toStr(p.name).slice(0, 200) || 'Untitled Project',
    color: isValidHexColor(p.color) ? p.color : DEFAULT_COLOR,
    startDate,
    endDate,
    nextId: Math.max(2, toInt(p.nextId, 2)),
    tasks
  };

  if (p.versions && Array.isArray(p.versions)) {
    proj.versions = p.versions.filter(v => v && typeof v === 'object').slice(0, 100);
  }
  if (p.baseline && typeof p.baseline === 'object') {
    proj.baseline = p.baseline;
  }
  if (p.ownerId) proj.ownerId = toStr(p.ownerId);

  delete proj.shareToken;

  return proj;
}

export function validateProjects(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(validateProject).filter(Boolean);
}
