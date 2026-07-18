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

function pruneInvalidDeps(tasks) {
  const validIds = new Set(tasks.map(t => t.id));
  tasks.forEach(t => {
    if (t.type === 'group') return;
    t.deps = (t.deps || []).filter(id => validIds.has(id));
    t.sdeps = (t.sdeps || []).filter(id => validIds.has(id));
    t.ffdeps = (t.ffdeps || []).filter(id => validIds.has(id));
    t.sfdeps = (t.sfdeps || []).filter(id => validIds.has(id));
    if (t.lags) {
      for (const k of Object.keys(t.lags)) {
        const idMatch = k.match(/\d+$/);
        if (idMatch && !validIds.has(Number(idMatch[0]))) {
          delete t.lags[k];
        }
      }
      if (Object.keys(t.lags).length === 0) delete t.lags;
    }
  });
}

export function validateTask(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const t = { ...raw };

  const id = toInt(t.id, null);
  if (id === null || id <= 0) return null;

  const type = TASK_TYPES.has(t.type) ? t.type : 'task';
  // Reject parent 0 explicitly because IDs are 1-based and 0 indicates corrupted relations
  if (t.parent === 0 || t.parent === '0') return null;
  const p = toInt(t.parent, null);
  const parent = p === null || p <= 0 ? null : p;

  const color = isValidHexColor(t.color) ? t.color : DEFAULT_COLOR;

  const task = {
    id,
    name: toStr(t.name).normalize('NFC').replace(/\p{C}/gu, '').slice(0, 200) || 'Untitled',
    type,
    parent,
    color
  };

  if (type === 'task' || type === 'milestone') {
    task.deps = toIdArray(t.deps);
    task.sdeps = toIdArray(t.sdeps);
    task.ffdeps = toIdArray(t.ffdeps);
    task.sfdeps = toIdArray(t.sfdeps);
    if (t.lags && typeof t.lags === 'object') {
      const lags = {};
      for (const [k, v] of Object.entries(t.lags)) {
        if (/^(FS|SS|FF|SF)\d+$/.test(k)) {
          const n = Math.max(-365, Math.min(365, toInt(v, 0)));
          if (Number.isFinite(n)) lags[k] = n;
        }
      }
      if (Object.keys(lags).length) task.lags = lags;
    }

    if (t.assignee) {
      task.assignee = toStr(t.assignee).normalize('NFC').replace(/\p{C}/gu, '').slice(0, 100);
    }

    if (type === 'task') {
      task.start = toDateStr(t.start);
      task.end = toDateStr(t.end);
      task.wday = Math.min(3650, Math.max(1, toInt(t.wday, 1)));
      task.done = !!t.done;
      task.progress = Math.max(0, Math.min(100, toInt(t.progress, 0)));
    } else {
      task.date = toDateStr(t.date);
      task.done = !!t.done;
    }
  } else if (type === 'group') {
    // no start/end/progress/done properties are assigned to group tasks
  }

  // ffdeps/sfdeps always assign for shape consistency
  if (!task.deps) task.deps = [];
  if (!task.sdeps) task.sdeps = [];
  if (!task.ffdeps) task.ffdeps = [];
  if (!task.sfdeps) task.sfdeps = [];

  return task;
}

export function validateProject(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const p = { ...raw };

  const id = toInt(p.id, null);
  if (id === null || id <= 0) return null;

  const tasks = Array.isArray(p.tasks) ? p.tasks.map(validateTask).filter(Boolean) : [];

  // Ensure exactly one root group exists
  let roots = tasks.filter(t => t.parent === null);

  // Guard against cycles where there are NO roots but there are tasks
  if (roots.length === 0 && tasks.length > 0) {
    const rootId = Math.max(1, ...tasks.map(t => t.id)) + 1;
    tasks.unshift({
      id: rootId,
      name: toStr(p.name).slice(0, 200) || 'Project',
      type: 'group',
      parent: null,
      color: DEFAULT_COLOR,
      deps: [], sdeps: [], ffdeps: [], sfdeps: []
    });
    // Break any circular reference, orphaned tasks, or pure cycles by tracing parent chains
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    tasks.forEach((t, i) => {
      if (i === 0) return;
      const seen = new Set();
      let cur = t;
      while (cur && cur.parent !== null) {
        if (seen.has(cur.id)) {
          t.parent = rootId;
          break;
        }
        seen.add(cur.id);
        const parent = taskMap.get(cur.parent);
        if (!parent) {
          t.parent = rootId;
          break;
        }
        cur = parent;
      }
    });
    roots = tasks.filter(t => t.parent === null);
  }

  if (roots.length !== 1) {
    if (roots.length > 1) {
      // Reparent extra roots to the first one
      const trueRoot = roots[0];
      for (let i = 1; i < roots.length; i++) {
        roots[i].parent = trueRoot.id;
      }
    } else {
      // No roots, add a synthetic one
      const rootId = Math.max(1, ...tasks.map(t => t.id)) + 1;
      tasks.unshift({
        id: rootId,
        name: toStr(p.name).slice(0, 200) || 'Project',
        type: 'group',
        parent: null,
        color: DEFAULT_COLOR
      });
      // Reparent tasks that might have had bad parents to this new root
      tasks.forEach((t, i) => {
        if (i > 0 && (t.parent === null || !tasks.some(x => x.id === t.parent))) t.parent = rootId;
      });
    }
  }

  const startDate = toDateStr(p.startDate) || '2026-04-01';
  const endDate = toDateStr(p.endDate) || '2026-07-31';

  const validIds = new Set(tasks.map(t => t.id));
  pruneInvalidDeps(tasks);

  const proj = {
    id,
    name: toStr(p.name).normalize('NFC').replace(/\p{C}/gu, '').slice(0, 200) || 'Untitled Project',
    color: isValidHexColor(p.color) ? p.color : DEFAULT_COLOR,
    startDate,
    endDate,
    nextId: Math.max(2, toInt(p.nextId, 2)),
    tasks
  };

  if (p.versions && Array.isArray(p.versions)) {
    proj.versions = p.versions
      .filter(
        v =>
          v &&
          typeof v === 'object' &&
          v.id &&
          typeof v.name === 'string' &&
          Array.isArray(v.snapshot)
      )
      .map(v => {
        const snapshotTasks = v.snapshot.map(validateTask).filter(Boolean);
        pruneInvalidDeps(snapshotTasks);
        return {
          id: toStr(v.id),
          name: toStr(v.name).normalize('NFC').replace(/\p{C}/gu, '').slice(0, 100),
          snapshot: snapshotTasks
        };
      })
      .slice(0, 100);
  }
  if (p.baseline && typeof p.baseline === 'object') {
    const b = {};
    if (typeof p.baseline.setAt === 'string') b.setAt = p.baseline.setAt.slice(0, 50);
    if (p.baseline.dates && typeof p.baseline.dates === 'object') {
      b.dates = {};
      let keys = Object.keys(p.baseline.dates).slice(0, 500);
      for (const k of keys) {
        if (/^\d+$/.test(k) && validIds.has(Number(k))) {
          const v = toDateStr(p.baseline.dates[k]);
          if (v) b.dates[k] = v;
        }
      }
    }
    proj.baseline = b;
  }
  if (p.ownerId) proj.ownerId = toStr(p.ownerId);

  delete proj.shareToken;

  return migrate(proj);
}

export function migrate(proj) {
  const CURRENT_SCHEMA = 1;
  if (!proj.schemaVersion || proj.schemaVersion < 1) {
    proj.schemaVersion = 1;
  }
  // Guard: if data from a newer client has a higher schemaVersion,
  // clamp to current so this client doesn't silently drop fields.
  if (proj.schemaVersion > CURRENT_SCHEMA) {
    console.warn(`Project ${proj.id} has newer schema version ${proj.schemaVersion}. Clamping down to ${CURRENT_SCHEMA} to avoid dropping fields.`);
    proj.schemaVersion = CURRENT_SCHEMA;
  }
  // Future migrations:
  // if (proj.schemaVersion === 1) { ...transform...; proj.schemaVersion = 2; }
  return proj;
}

export function validateProjects(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(validateProject).filter(Boolean);
}
