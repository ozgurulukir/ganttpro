/* Milestone rendering: timeline spine + individual milestone diamonds. */
import { D } from './deps.js';
import { isNonWorkday } from '../core/calendar.js';
import { showTT, moveTT, hideTT } from './tooltip.js';

/* Single horizontal milestone timeline — all milestones on one spine */
export function renderMilestoneTimeline(row, groupTask, msList) {
  const { MS_ROW_H, PPD, TODAY_STR, dateToX } = D;
  const center  = MS_ROW_H / 2;   // 80px (spine Y)
  const halfD   = 8;               // diamond half-size
  const connH   = 28;              // connector height
  const rowW    = parseInt(row.style.width) || 9999;

  // Single spine — use accent color
  const spine = document.createElement('div');
  spine.className = 'ms-spine';
  spine.style.cssText = `background:var(--accent);opacity:0.35`;
  row.appendChild(spine);

  // Today line on the timeline
  const tx = dateToX(TODAY_STR);
  if (tx >= 0 && tx <= rowW) {
    const tl = document.createElement('div');
    tl.className = 'today-line';
    tl.style.left = tx + 'px';
    const tlbl = document.createElement('div');
    tlbl.className = 'today-lbl';
    tlbl.textContent = '今日';
    tl.appendChild(tlbl);
    row.appendChild(tl);
  }

  if (!msList.length) return;

  // Milestones already sorted by date (from getVisibleRows)
  msList.forEach((ms, idx) => {
    const x = dateToX(ms.date) + PPD / 2;
    if (x < -60 || x > rowW + 60) return;
    const above   = idx % 2 === 0;
    const msColor = ms.color || groupTask.color || '#5E6AD2';

    // Connector line
    const conn = document.createElement('div');
    conn.className = 'ms-conn';
    conn.style.cssText = above
      ? `left:${x - 0.75}px;top:${center - halfD - connH}px;height:${connH}px`
      : `left:${x - 0.75}px;top:${center + halfD}px;height:${connH}px`;
    row.appendChild(conn);

    // Diamond
    const d = document.createElement('div');
    d.className = 'ms-dot';
    d.style.cssText = `left:${x - halfD}px;top:${center - halfD}px;` +
      `width:${halfD*2}px;height:${halfD*2}px;` +
      `background:${msColor};box-shadow:0 2px 10px ${msColor}70`;
    d.addEventListener('mouseenter', e => showTT(e, ms));
    d.addEventListener('mousemove', moveTT);
    d.addEventListener('mouseleave', hideTT);
    row.appendChild(d);

    // Name label
    const nameTop = above
      ? center - halfD - connH - 14
      : center + halfD + connH + 2;
    const lbl = document.createElement('div');
    lbl.className = 'ms-lbl';
    lbl.style.cssText = `left:${x}px;top:${nameTop}px;color:${msColor};font-size:11px`;
    lbl.textContent = ms.name;
    row.appendChild(lbl);

    // Date label
    const dateTop = above ? nameTop - 12 : nameTop + 14;
    const dlbl = document.createElement('div');
    dlbl.className = 'ms-lbl-date';
    dlbl.style.cssText = `left:${x}px;top:${dateTop}px;font-size:10px`;
    dlbl.textContent = ms.date || '';
    row.appendChild(dlbl);
  });
}

export function renderMilestone(row, task) {
  const { PPD, dateToX, isReadOnly, showBaseline, curProj, pushHistory, scheduleTasks, recalcProjEnd, render, saveToLS, saveToCloud, currentUser } = D;
  const x = dateToX(task.date) + PPD / 2;
  const d = document.createElement('div');
  d.className = 'milestone-d';
  d.dataset.id = task.id;
  const col = task.color || '#5E6AD2';
  d.style.cssText = `left:${x}px;background:${col};box-shadow:0 2px 8px ${col}55`;
  d.addEventListener('mouseenter', e => showTT(e, task));
  d.addEventListener('mousemove', moveTT);
  d.addEventListener('mouseleave', hideTT);

  // 拖移里程碑（無依賴時；有依賴的日期由排程決定）
  const msDeps = (task.deps||[]).length || (task.sdeps||[]).length || (task.ffdeps||[]).length || (task.sfdeps||[]).length;
  if (!isReadOnly && !msDeps) {
    d.style.cursor = 'grab';
    d.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const origLeft = parseFloat(d.style.left);
      let moved = false, delta = 0;
      document.body.style.userSelect = 'none';
      const onMove = ev => {
        const dx = ev.clientX - startX;
        if (!moved && Math.abs(dx) < 4) return;
        moved = true;
        hideTT();
        delta = Math.round(dx / PPD);
        d.style.left = (origLeft + delta * PPD) + 'px';
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.userSelect = '';
        if (!moved || !delta) { render(); return; }
        pushHistory();
        const nd = new Date(task.date);
        nd.setDate(nd.getDate() + delta);
        while (isNonWorkday(nd)) nd.setDate(nd.getDate() + (delta > 0 ? 1 : -1));
        task.date = nd.toISOString().slice(0, 10);
        task.pinStart = true;
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

  row.appendChild(d);

  // 基準線：里程碑原定日期（空心灰菱形）
  const bl = showBaseline && (curProj()?.baseline?.dates || {})[task.id];
  if (bl && bl.d && bl.d !== task.date) {
    const g = document.createElement('div');
    g.className = 'milestone-ghost';
    g.style.cssText = `left:${dateToX(bl.d) + PPD / 2 - 5}px;top:13px`;
    row.appendChild(g);
  }
}
