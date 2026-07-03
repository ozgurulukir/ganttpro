/* Audit log: timestamped record of task/project actions. */
import { t } from '../i18n/index.js';

const LS_KEY = 'gp_audit';
const MAX_ENTRIES = 200;

export function logAudit(action, detail = '') {
  try {
    const entries = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    entries.push({
      ts: new Date().toISOString(),
      action,
      detail: String(detail).slice(0, 500)
    });
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
    localStorage.setItem(LS_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

export function getAuditLog() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearAuditLog() {
  localStorage.removeItem(LS_KEY);
}

const ACTION_LABELS = {
  taskCreated: () => t('audit.taskCreated'),
  taskEdited: () => t('audit.taskEdited'),
  taskDeleted: () => t('audit.taskDeleted'),
  versionCreated: () => t('audit.versionCreated'),
  versionRestored: () => t('audit.versionRestored'),
  projectCreated: () => t('audit.projectCreated'),
  projectDeleted: () => t('audit.projectDeleted')
};

export function renderAuditLog(container) {
  const entries = getAuditLog();
  container.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:20px;text-align:center;color:var(--t3);font-size:12px';
    empty.textContent = t('audit.noEntries');
    container.appendChild(empty);
    return;
  }
  entries
    .slice()
    .reverse()
    .forEach(entry => {
      const row = document.createElement('div');
      row.className = 'audit-row';

      const time = document.createElement('span');
      time.className = 'audit-time';
      time.textContent = new Date(entry.ts).toLocaleString();

      const action = document.createElement('span');
      action.className = 'audit-action';
      const labelFn = ACTION_LABELS[entry.action];
      action.textContent = labelFn ? labelFn() : entry.action;

      row.append(time, action);

      if (entry.detail) {
        const detail = document.createElement('span');
        detail.className = 'audit-detail';
        detail.textContent = entry.detail;
        row.appendChild(detail);
      }

      container.appendChild(row);
    });
}
