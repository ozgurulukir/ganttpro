/* Tooltip + row highlighting — pure DOM + dep lookups for state/functions. */
import { D } from './deps.js';
import { allDepIds, allSuccIds as coreAllSuccIds } from '../core/deps.js';
import { countWorkingDays } from '../core/calendar.js';
import { esc, safeColor } from '../core/format.js';
import { t } from '../i18n/index.js';
import { buildIndex } from '../core/tree.js';

export function highlightRow(id, on) {
  document.querySelectorAll(`[data-id="${id}"]`).forEach(el => {
    el.classList.toggle('hi', on);
  });
}

function getPredIds(task) {
  return allDepIds(task);
}

function getSuccIds(id) {
  const { tasks } = D;
  return coreAllSuccIds(tasks, id);
}

export function highlightDeps(id, on) {
  const { taskById } = D;
  if (!on) {
    document.querySelectorAll('.dep-pred,.dep-succ').forEach(el => {
      el.classList.remove('dep-pred', 'dep-succ');
    });
    return;
  }
  const task = taskById(id);
  if (!task) return;
  getPredIds(task).forEach(predId => {
    document.querySelectorAll(`[data-id="${predId}"]`).forEach(el => el.classList.add('dep-pred'));
  });
  getSuccIds(id).forEach(succId => {
    document.querySelectorAll(`[data-id="${succId}"]`).forEach(el => el.classList.add('dep-succ'));
  });
}

export function showTT(e, task) {
  const { TODAY_STR, curProj, groupBounds, groupProgress, tasks } = D;
  const tt = document.getElementById('tooltip');
  let h = `<div class="tt-h">${esc(task.name)}</div>`;
  if (task.type === 'task') {
    const wdays = task.wday || countWorkingDays(task.start, task.end);
    const tprog = task.done ? 100 : task.progress || 0;
    h += `<div class="tt-r"><span>${esc(t('tooltip.start'))}</span><span>${esc(task.start)}</span></div>`;
    h += `<div class="tt-r"><span>${esc(t('tooltip.end'))}</span><span>${esc(task.end)}</span></div>`;
    h += `<div class="tt-r"><span>${esc(t('tooltip.workdays'))}</span><span>${esc(wdays)}d</span></div>`;
    h += `<div class="tt-r"><span>${esc(t('tooltip.progress'))}</span><span>${esc(tprog)}%</span></div>`;
    if (task.assignee)
      h += `<div class="tt-r"><span>${esc(t('tooltip.assignee'))}</span><span>${esc(task.assignee)}</span></div>`;
    const _bl = (curProj()?.baseline?.dates || {})[task.id];
    if (_bl && _bl.e && task.end && _bl.e !== task.end) {
      const late = task.end > _bl.e;
      const dd = countWorkingDays(late ? _bl.e : task.end, late ? task.end : _bl.e) - 1;
      h += `<div class="tt-r"><span>${esc(t('tooltip.baselineDrift'))}</span><span style="color:${late ? '#EF4444' : '#10B981'}">${late ? '+' : '-'}${esc(dd)} workdays</span></div>`;
    }
    h += `<div class="tt-pb"><div class="tt-pf" style="width:${esc(tprog)}%;background:${safeColor(task.color)}"></div></div>`;
    const _ovd = !task.done && task.end && task.end < TODAY_STR;
    const statusText = task.done
      ? t('tooltip.done')
      : _ovd
        ? t('tooltip.overdue')
        : t('tooltip.pending');
    h += `<div class="tt-r"><span>${esc(t('tooltip.status'))}</span><span style="color:${task.done ? '#10B981' : _ovd ? '#EF4444' : '#9CA3AF'}">${esc(statusText)}</span></div>`;
    if ((task.deps || []).length)
      h += `<div class="tt-r"><span>${esc(t('tooltip.fsDep'))}</span><span>${esc(task.deps.length)}</span></div>`;
    if ((task.sdeps || []).length)
      h += `<div class="tt-r"><span>${esc(t('tooltip.ssDep'))}</span><span style="color:#F59E0B">${esc(task.sdeps.length)}</span></div>`;
    if ((task.ffdeps || []).length)
      h += `<div class="tt-r"><span>${esc(t('tooltip.ffDep'))}</span><span style="color:#10B981">${esc(task.ffdeps.length)}</span></div>`;
    if ((task.sfdeps || []).length)
      h += `<div class="tt-r"><span>${esc(t('tooltip.sfDep'))}</span><span style="color:#8B5CF6">${esc(task.sfdeps.length)}</span></div>`;
  } else if (task.type === 'milestone') {
    h += `<div class="tt-r"><span>${esc(t('tooltip.date'))}</span><span>${esc(task.date)}</span></div>`;
    h += `<div class="tt-r"><span>${esc(t('tooltip.assignee'))}</span><span>${esc(task.assignee) || '—'}</span></div>`;
    h += `<div class="tt-r"><span>${esc(t('tooltip.fsDep'))}</span><span>${esc((task.deps || []).length)}</span></div>`;
  } else if (task.type === 'group') {
    const taskIndex = buildIndex(tasks);
    const b = groupBounds(task.id, taskIndex);
    const prog = groupProgress(task.id, taskIndex);
    if (b.s)
      h += `<div class="tt-r"><span>${esc(t('tooltip.start'))}</span><span>${esc(b.s)}</span></div>`;
    if (b.e)
      h += `<div class="tt-r"><span>${esc(t('tooltip.end'))}</span><span>${esc(b.e)}</span></div>`;
    const subTaskCount = tasks.filter(tk => tk.parent === task.id && tk.type === 'task').length;
    h += `<div class="tt-r"><span>${esc(t('tooltip.subTasks'))}</span><span>${esc(subTaskCount)}</span></div>`;
    h += `<div class="tt-r"><span>${esc(t('tooltip.overallProgress'))}</span><span>${esc(prog)}%</span></div>`;
    h += `<div class="tt-pb"><div class="tt-pf" style="width:${esc(prog)}%;background:${safeColor(task.color)}"></div></div>`;
  }
  tt.innerHTML = h;
  tt.classList.add('show');
  moveTT(e);
}

export function moveTT(e) {
  const tt = document.getElementById('tooltip');
  let x = e.clientX + 15,
    y = e.clientY - 12;
  if (x + 210 > window.innerWidth) x = e.clientX - 215;
  if (y + 160 > window.innerHeight) y = e.clientY - 150;
  tt.style.cssText += `;left:${x}px;top:${y}px`;
}

export function hideTT() {
  document.getElementById('tooltip').classList.remove('show');
}
