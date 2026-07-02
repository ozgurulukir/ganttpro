/* Workload view — compute + render panel/chart for assignee workload. */
import { D } from './deps.js';
import { isNonWorkday } from '../core/calendar.js';
import { initials } from '../core/format.js';
import { parseDate, formatDate } from '../core/date.js';

export function computeWorkload() {
  const { tasks } = D;
  const byName = new Map();
  tasks.filter(t => t.type === 'task' && t.start && t.end && !t.done).forEach(t => {
    const name = t.assignee || '未指派';
    if (!byName.has(name)) byName.set(name, { days: new Map(), count: 0 });
    const rec = byName.get(name);
    rec.count++;
    let dn = parseDate(t.start);
    const endDn = parseDate(t.end);
    while (dn <= endDn) {
      const ds = formatDate(dn);
      if (!isNonWorkday(ds)) {
        rec.days.set(ds, (rec.days.get(ds) || 0) + 1);
      }
      dn++;
    }
  });
  const names = [...byName.keys()].sort((a, b) =>
    a === '未指派' ? 1 : b === '未指派' ? -1 : a.localeCompare(b, 'zh-Hant'));
  return { names, byName };
}

export function renderWorkloadPanel(body) {
  const { avColor } = D;
  const { names, byName } = computeWorkload();
  if (!names.length) {
    const empty = document.createElement('div');
    empty.className = 'panel-empty';
    const txt = document.createElement('div');
    txt.className = 'panel-empty-txt';
    txt.textContent = '沒有進行中的任務';
    empty.appendChild(txt);
    body.appendChild(empty);
    return;
  }
  names.forEach(name => {
    const row = document.createElement('div');
    row.className = 'task-row';
    row.appendChild(document.createElement('div'));
    const nc = document.createElement('div');
    nc.className = 'name-cell';
    const av = document.createElement('span');
    av.className = 'assignee-av';
    av.style.cssText = `margin-left:0;background:${avColor(name)}`;
    av.textContent = initials(name);
    nc.appendChild(av);
    const nm = document.createElement('span');
    nm.className = 'tname';
    nm.textContent = name;
    nc.appendChild(nm);
    const cnt = document.createElement('span');
    cnt.style.cssText = 'font-size:11px;color:var(--t3);margin-left:auto;margin-right:8px;flex-shrink:0';
    cnt.textContent = byName.get(name).count + ' 項進行中';
    nc.appendChild(cnt);
    row.appendChild(nc);
    body.appendChild(row);
  });
}

export function renderWorkloadChart(canvas, tw) {
  const { ROW_H, PPD, TODAY_STR, renderGrid, dateToX, updateStats } = D;
  const { names, byName } = computeWorkload();
  const th = Math.max(names.length, 1) * ROW_H;
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

  names.forEach(name => {
    const row = document.createElement('div');
    row.className = 'chart-row';
    row.style.width = tw + 'px';
    byName.get(name).days.forEach((count, day) => {
      const x = dateToX(day);
      if (x < -PPD || x > tw) return;
      const c = document.createElement('div');
      c.className = 'wl-cell';
      c.style.cssText = `left:${x}px;width:${PPD}px;background:${
        count >= 3 ? 'rgba(239,68,68,.55)' : count === 2 ? 'rgba(94,106,210,.5)' : 'rgba(94,106,210,.22)'}`;
      c.title = `${name}　${day}：${count} 項任務`;
      if (PPD >= 18) c.textContent = count;
      row.appendChild(c);
    });
    canvas.appendChild(row);
  });
  updateStats();
}
