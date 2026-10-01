/**
 * Pure validators/sanitizers for project and task data coming from
 * Firestore, localStorage, or share links. Returns a sanitized object,
 * or null if the input is not recoverable.
 */

import { isValidHexColor, sanitizeUrl } from './format.js';

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

const APPROVAL_STATES = new Set(['pending', 'approved', 'rejected']);

// Field sanitizers. Shape fields (dep arrays, dates, wday, progress, done)
// always return a value so the output object keeps a consistent shape; the
// rest return undefined for absent/invalid input and the field is omitted.
function cleanText(max) {
  return v => {
    const s = toStr(v).normalize('NFC').replace(/\p{C}/gu, '').slice(0, max);
    return s || undefined;
  };
}

function sanitizeUrlText(max) {
  const clean = cleanText(max);
  return v => {
    const s = clean(v);
    return s ? sanitizeUrl(s) || undefined : undefined;
  };
}

function sanitizeLags(v) {
  if (!v || typeof v !== 'object') return undefined;
  const lags = {};
  for (const [k, val] of Object.entries(v)) {
    if (/^(FS|SS|FF|SF)\d+$/.test(k)) {
      const n = Math.max(-365, Math.min(365, toInt(val, 0)));
      if (Number.isFinite(n)) lags[k] = n;
    }
  }
  return Object.keys(lags).length ? lags : undefined;
}

// Task-field schema: the single source of truth for which fields survive a
// validateTask/validateProject round-trip (cloud reload, realtime snapshot,
// share link). The task modal (src/ui/modal.js submitTask) writes exactly
// these fields — a field missing here is silently stripped on the next
// round-trip. When adding a field in the modal, add it here AND to the
// round-trip tests in tests/validate.test.js.
export const TASK_FIELDS = {
  deps: { types: ['task', 'milestone'], sanitize: v => toIdArray(v) },
  sdeps: { types: ['task', 'milestone'], sanitize: v => toIdArray(v) },
  ffdeps: { types: ['task', 'milestone'], sanitize: v => toIdArray(v) },
  sfdeps: { types: ['task', 'milestone'], sanitize: v => toIdArray(v) },
  lags: { types: ['task', 'milestone'], sanitize: sanitizeLags },
  assignee: { types: ['task', 'milestone'], sanitize: cleanText(100) },
  link: { types: ['task', 'milestone', 'group'], sanitize: sanitizeUrlText(2000) },
  approval: {
    types: ['task', 'milestone', 'group'],
    sanitize: v => (APPROVAL_STATES.has(v) ? v : undefined)
  },
  evidence: { types: ['task', 'milestone', 'group'], sanitize: sanitizeUrlText(2000) },
  start: { types: ['task'], sanitize: toDateStr },
  end: { types: ['task'], sanitize: toDateStr },
  wday: { types: ['task'], sanitize: v => Math.min(3650, Math.max(1, toInt(v, 1))) },
  progress: { types: ['task'], sanitize: v => Math.max(0, Math.min(100, toInt(v, 0))) },
  done: { types: ['task', 'milestone'], sanitize: v => !!v },
  date: { types: ['milestone'], sanitize: toDateStr },
  pinStart: { types: ['task', 'milestone'], sanitize: v => (v ? true : undefined) }
};

export function validateTask(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const t = { ...raw };

  const id = toInt(t.id, null);
  if (id === null || id <= 0) return null;

  const type = TASK_TYPES.has(t.type) ? t.type : 'task';
  if (t.parent === 0 || t.parent === '0') return null;
  const p = toInt(t.parent, null);
  const parent = p === null || p <= 0 ? null : p;

  const task = {
    id,
    name: toStr(t.name).normalize('NFC').replace(/\p{C}/gu, '').slice(0, 200) || 'Untitled',
    type,
    parent,
    color: isValidHexColor(t.color) ? t.color : DEFAULT_COLOR
  };

  for (const [field, spec] of Object.entries(TASK_FIELDS)) {
    if (!spec.types.includes(type)) continue;
    const value = spec.sanitize(t[field]);
    // Omit absent/invalid optional fields entirely — an explicit undefined
    // own-property makes Firestore setDoc throw on the next cloud save.
    if (value !== undefined) task[field] = value;
  }

  // dep arrays keep their shape for every type
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
      deps: [],
      sdeps: [],
      ffdeps: [],
      sfdeps: []
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
  // Keep the share-link token across save/load round-trips — the share modal
  // and revocation depend on it surviving reloads. Strict charset: it is a
  // doc id we place into `gantt_shares/{token}` URLs, never free-form text.
  if (typeof p.shareToken === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(p.shareToken)) {
    proj.shareToken = p.shareToken;
  }

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
