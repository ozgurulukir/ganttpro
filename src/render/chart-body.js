/* Chart body: canvas with grid, bars, milestones, arrows, today line. */
import { D } from './deps.js';
import { isNonWorkday } from '../core/calendar.js';
import { parseDate, formatDate } from '../core/date.js';
import { highlightRow } from './tooltip.js';
import { renderGrid } from './grid.js';
import { renderBar, renderGroupBar } from './bar.js';
import { renderMilestone } from './milestone.js';
import { renderArrows } from './arrows.js';
import { renderWorkloadChart } from './workload.js';

export function renderChartBody() {
  const { showCriticalPath, milestoneView, workloadView, ROW_H, PPD, TODAY_STR, CHART_START, isReadOnly, totalW, getVisibleRows, dateToX, groupBounds, updateStats, openModal } = D;
  const canvas = document.getElementById('chartCanvas');
  canvas.innerHTML = '';
  canvas.classList.toggle('cp-mode', showCriticalPath);
  const tw = totalW();

  // Milestone view: canvas is empty (timeline lives in the sticky header)
  if (milestoneView) {
    canvas.style.cssText = `width:${tw}px;height:0px`;
    updateStats();
    return;
  }

  // Workload view: per-assignee daily load heatmap
  if (workloadView) {
    renderWorkloadChart(canvas, tw);
    return;
  }

  const rows = getVisibleRows();
  const th = rows.length * ROW_H;
  canvas.style.cssText = `width:${tw}px;height:${th}px`;

  renderGrid(canvas, tw, th);

  const tx = dateToX(TODAY_STR);
  if (tx >= 0 && tx <= tw) {
    const line = document.createElement('div');
    line.className = 'today-line';
    line.style.cssText = `left:${tx}px;height:${th}px`;
    const lbl = document.createElement('div');
    lbl.className = 'today-lbl';
    lbl.textContent = '今日';
    line.appendChild(lbl);
    canvas.appendChild(line);
  }

  rows.forEach(({ task }, i) => {
    const row = document.createElement('div');
    row.className = 'chart-row' + (task.type === 'group' ? ' group-bg' : '');
    row.dataset.id = task.id;
    row.style.width = tw + 'px';

    if (task.type === 'task') {
      renderBar(row, task);
    } else if (task.type === 'milestone') {
      renderMilestone(row, task);
    } else if (task.type === 'group') {
      const bounds = groupBounds(task.id);
      if (bounds.s && bounds.e) renderGroupBar(row, task, bounds);
    }

    row.addEventListener('mouseenter', () => highlightRow(task.id, true));
    row.addEventListener('mouseleave', () => highlightRow(task.id, false));
    row.addEventListener('dblclick', e => {
      if (isReadOnly) return;
      if (e.target.closest('.gantt-bar,.group-bar,.milestone-d')) return;
      const scrollX = document.getElementById('chartScroll').scrollLeft;
      const canvasRect = canvas.getBoundingClientRect();
      const clickX = e.clientX - canvasRect.left + scrollX;
      const daysOffset = Math.floor(clickX / PPD);
      let dn = parseDate(CHART_START.toISOString().slice(0, 10)) + daysOffset;
      while (isNonWorkday(formatDate(dn))) dn++;
      const dateStr = formatDate(dn);
      openModal(null, dateStr);
    });
    canvas.appendChild(row);
  });

  renderArrows(canvas, rows, tw, th);
  updateStats();
}
