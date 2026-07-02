/* Bar rendering: regular bars, group bars, drag interactions. */
import { D } from './deps.js';
import { darkenColor } from '../core/format.js';
import { isNonWorkday, countWorkingDays, addWorkingDays } from '../core/calendar.js';
import { showTT, moveTT, hideTT, highlightDeps } from './tooltip.js';

export function getWorkingSegs(startStr, endStr) {
  const segs = [];
  let d = new Date(startStr), end = new Date(endStr), segS = null;
  while (d < end) {
    const isOff = isNonWorkday(d);
    if (!isOff && !segS) segS = d.toISOString().slice(0, 10);
    else if (isOff && segS) { segs.push({s: segS, e: d.toISOString().slice(0, 10)}); segS = null; }
    d.setDate(d.getDate() + 1);
  }
  if (segS) segs.push({s: segS, e: endStr});
  return segs;
}

export function renderBar(row, task) {
  const { dateToX, showCriticalPath, criticalTaskIds, showBarDates, showBaseline, isReadOnly, curProj, TODAY_STR, PPD } = D;
  if (!task.start || !task.end) return;
  const x1 = dateToX(task.start);
  const visualEnd = (() => { const d = new Date(task.end); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })();
  const x2 = dateToX(visualEnd);
  const w = x2 - x1;
  if (!isFinite(w) || w <= 0) return;

  const bar = document.createElement('div');
  const isOverdue = task.type === 'task' && !task.done && task.end && task.end < TODAY_STR;
  bar.className = 'gantt-bar' + (showCriticalPath && criticalTaskIds.has(task.id) ? ' cp-critical' : '') + (isOverdue ? ' overdue' : '');
  bar.dataset.id = task.id;
  bar.style.cssText = `left:${x1}px;width:${w}px`;

  if (task.done) bar.style.opacity = '0.32';

  // Inner clip container
  const inner = document.createElement('div');
  inner.style.cssText = 'position:absolute;inset:0;overflow:hidden;';

  // Continuous bar (includes weekends)
  const bg = document.createElement('div');
  bg.className = 'bar-bg';
  bg.style.background = task.color;
  inner.appendChild(bg);

  // 進度填充（深色段）
  const prog = task.done ? 100 : (task.progress || 0);
  if (prog > 0) {
    const pf = document.createElement('div');
    pf.className = 'bar-prog';
    pf.style.cssText = `width:${prog}%;background:${darkenColor(task.color, 0.3)}`;
    inner.appendChild(pf);
  }

  const fmt = s => { const [,m,d] = s.split('-'); return `${+m}/${+d}`; };

  // Task name: centered across full bar area
  if (w > 70) {
    const lbl = document.createElement('div');
    lbl.className = 'bar-lbl';
    lbl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;padding:0 8px;z-index:2;pointer-events:none';
    const wdayStr = (task.type === 'task' && task.wday) ? ` ${task.wday}d` : '';
    lbl.textContent = (task.name || '') + wdayStr;
    inner.appendChild(lbl);
  }

  bar.appendChild(inner);

  if (showBarDates) {
    const sd = document.createElement('div');
    sd.className = 'bar-sd';
    sd.textContent = fmt(task.start);
    bar.appendChild(sd);
    const ed = document.createElement('div');
    ed.className = 'bar-ed';
    ed.textContent = fmt(task.end); // show inclusive end date
    bar.appendChild(ed);
  }

  bar.addEventListener('mouseenter', e => { showTT(e, task); highlightDeps(task.id, true); });
  bar.addEventListener('mousemove', moveTT);
  bar.addEventListener('mouseleave', e => { hideTT(); highlightDeps(task.id, false); });

  if (!isReadOnly && task.type === 'task') attachBarDrag(bar, task);

  row.appendChild(bar);

  // 基準線：顯示計畫日期（灰色細條），與現況不同時才畫
  const bl = showBaseline && (curProj()?.baseline?.dates || {})[task.id];
  if (bl && bl.s && bl.e && (bl.s !== task.start || bl.e !== task.end)) {
    const bx1 = dateToX(bl.s);
    const bx2 = dateToX((() => { const d = new Date(bl.e); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })());
    const blb = document.createElement('div');
    blb.className = 'baseline-bar';
    blb.style.cssText = `left:${bx1}px;width:${Math.max(bx2 - bx1, 3)}px;top:30px`;
    row.appendChild(blb);
  }
}

/* ── BAR DRAG（拖移整條 / 拖拉左右緣調整起訖）── */
export function attachBarDrag(bar, task) {
  const { PPD, pushHistory, scheduleTasks, recalcProjEnd, render, saveToLS, saveToCloud, currentUser } = D;
  const hasDeps = (task.deps||[]).length || (task.sdeps||[]).length || (task.ffdeps||[]).length || (task.sfdeps||[]).length;

  // 右緣：調整結束日（永遠可用）；左緣與整條拖移：僅無依賴任務（有依賴時開始日由排程決定）
  const mkHandle = side => {
    const h = document.createElement('div');
    h.className = 'bar-rz';
    h.style.cssText = `position:absolute;top:0;bottom:0;width:7px;${side}:0;cursor:ew-resize;z-index:3`;
    bar.appendChild(h);
    return h;
  };
  const hr = mkHandle('right');
  const hl = hasDeps ? null : mkHandle('left');
  if (!hasDeps) bar.style.cursor = 'grab';

  bar.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const mode = e.target === hr ? 'r' : (hl && e.target === hl) ? 'l' : (hasDeps ? null : 'move');
    if (!mode) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const origLeft = parseFloat(bar.style.left);
    const origW = parseFloat(bar.style.width);
    let moved = false, delta = 0;
    document.body.style.userSelect = 'none';

    const onMove = ev => {
      const dx = ev.clientX - startX;
      if (!moved && Math.abs(dx) < 4) return;
      moved = true;
      hideTT();
      delta = Math.round(dx / PPD);
      if (mode === 'move') {
        bar.style.left = (origLeft + delta * PPD) + 'px';
      } else if (mode === 'r') {
        bar.style.width = Math.max(PPD, origW + delta * PPD) + 'px';
      } else {
        const w2 = Math.max(PPD, origW - delta * PPD);
        bar.style.left = (origLeft + origW - w2) + 'px';
        bar.style.width = w2 + 'px';
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      if (!moved || !delta) { render(); return; }
      pushHistory();
      const shiftCal = (str, days) => { const d = new Date(str); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
      const snapFwd = str => { const d = new Date(str); while (isNonWorkday(d)) d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
      const snapBack = str => { const d = new Date(str); while (isNonWorkday(d)) d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };
      const wd = task.wday || countWorkingDays(task.start, task.end);
      // 依拖動方向吸附到工作日（往右跳到下個工作日、往左跳回上個工作日）
      const snapDir = str => delta > 0 ? snapFwd(str) : snapBack(str);

      if (mode === 'move') {
        task.start = snapDir(shiftCal(task.start, delta));
        task.end = addWorkingDays(task.start, wd);
        task.pinStart = true;
      } else if (mode === 'r') {
        let ne = snapDir(shiftCal(task.end, delta));
        if (ne < task.start) ne = task.start;
        task.end = ne;
        task.wday = countWorkingDays(task.start, task.end);
      } else {
        let ns = snapDir(shiftCal(task.start, delta));
        if (ns > task.end) ns = snapBack(task.end);
        task.start = ns;
        task.wday = countWorkingDays(task.start, task.end);
        task.pinStart = true;
      }
      scheduleTasks();
      recalcProjEnd();
      render();
      saveToLS();
      if (currentUser) saveToCloud();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

export function renderGroupBar(row, task, bounds) {
  const { dateToX, groupProgress } = D;
  const x1 = dateToX(bounds.s);
  const x2 = dateToX((() => { const d = new Date(bounds.e); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })());
  const w = Math.max(x2 - x1, 8);

  const bar = document.createElement('div');
  bar.className = 'group-bar';
  bar.style.cssText = `left:${x1}px;width:${w}px;background:${task.color}`;
  bar.style.setProperty('--c', task.color);
  // Triangles via pseudo-elements need color from CSS var; workaround: use box-shadow
  bar.style.boxShadow = `inset 0 0 0 1px ${task.color}80`;

  // 群組整體進度填充
  const gprog = groupProgress(task.id);
  if (gprog > 0) {
    const pf = document.createElement('div');
    pf.style.cssText = `position:absolute;top:0;left:0;bottom:0;width:${gprog}%;background:${darkenColor(task.color, 0.35)};border-radius:4px 0 0 4px;pointer-events:none`;
    bar.appendChild(pf);
  }

  bar.addEventListener('mouseenter', e => showTT(e, task));
  bar.addEventListener('mousemove', moveTT);
  bar.addEventListener('mouseleave', hideTT);

  row.appendChild(bar);
}
