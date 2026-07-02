/* Chart header: month labels + day/week/month sub-header. */
import { D } from './deps.js';
import { toStr } from '../core/format.js';
import { isNonWorkday, getHoliday } from '../core/calendar.js';
import { renderMilestoneTimeline } from './milestone.js';

export function renderChartHeader() {
  const { CHART_START, CHART_END, PPD, TODAY, TODAY_STR, milestoneView, tasks, dateToX, totalW } = D;
  const head = document.getElementById('chartHead');
  head.innerHTML = '';
  const tw = totalW();
  head.style.width = tw + 'px';

  const mRow = document.createElement('div');
  mRow.className = 'ch-months';
  mRow.style.width = tw + 'px';
  const wRow = document.createElement('div');
  wRow.className = 'ch-weeks';
  wRow.style.width = tw + 'px';

  // Month labels
  let cur = new Date(CHART_START);
  while (cur <= CHART_END) {
    const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const clamped = monthEnd < CHART_END ? monthEnd : CHART_END;
    const x1 = dateToX(toStr(cur));
    const x2 = dateToX(toStr(clamped)) + PPD;
    const el = document.createElement('div');
    el.className = 'month-label';
    el.style.cssText = `left:${x1}px;width:${x2 - x1}px`;
    const mn = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    el.innerHTML = `<span class="month-label-in">${cur.getFullYear()} ${mn[cur.getMonth()]}</span>`;
    mRow.appendChild(el);
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }

  // Sub-header: granularity based on PPD (not viewMode)
  const gran = PPD >= 18 ? 'day' : PPD >= 5 ? 'week' : 'month';
  const dayNames = ['日','一','二','三','四','五','六'];

  if (gran === 'day') {
    let d = new Date(CHART_START);
    while (d <= CHART_END) {
      const ds = toStr(d);
      const x = dateToX(ds);
      const dow = d.getDay();
      const hol = getHoliday(ds);
      const off = isNonWorkday(ds);
      const isTdy = ds === TODAY_STR;
      const el = document.createElement('div');
      const dayColor = isTdy ? '' : hol ? ' day-sun' : dow === 6 ? ' day-sat' : dow === 0 ? ' day-sun' : ' day-weekday';
      el.className = 'week-cell day-cell' + dayColor + (isTdy ? ' today-wk' : '') + (off ? ' wknd-cell' : '');
      el.style.cssText = `left:${x}px;width:${PPD}px`;
      if (hol) el.title = hol;
      el.innerHTML = `<span>${d.getDate()}</span><span class="day-dow">${dayNames[d.getDay()]}</span>`;
      wRow.appendChild(el);
      d.setDate(d.getDate() + 1);
    }
  } else if (gran === 'week') {
    // Align to Monday
    let d = new Date(CHART_START);
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    while (d <= CHART_END) {
      const we = new Date(d); we.setDate(we.getDate() + 6);
      const x1 = Math.max(0, dateToX(toStr(d)));
      const x2 = Math.min(tw, dateToX(toStr(we)) + PPD);
      if (x1 < tw && x2 > 0) {
        const isTdy = TODAY >= d && TODAY <= we;
        const el = document.createElement('div');
        el.className = 'week-cell' + (isTdy ? ' today-wk' : '');
        el.style.cssText = `left:${x1}px;width:${x2 - x1}px`;
        el.textContent = `${d.getMonth()+1}/${d.getDate()}`;
        wRow.appendChild(el);
      }
      d.setDate(d.getDate() + 7);
    }
  } else {
    // Month granularity: show each month label
    let d = new Date(CHART_START.getFullYear(), CHART_START.getMonth(), 1);
    while (d <= CHART_END) {
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const clamped = monthEnd < CHART_END ? monthEnd : CHART_END;
      const x1 = Math.max(0, dateToX(toStr(d)));
      const x2 = Math.min(tw, dateToX(toStr(clamped)) + PPD);
      const isTdyMon = TODAY.getFullYear() === d.getFullYear() && TODAY.getMonth() === d.getMonth();
      const el = document.createElement('div');
      el.className = 'week-cell' + (isTdyMon ? ' today-wk' : '');
      el.style.cssText = `left:${x1}px;width:${x2 - x1}px`;
      const mn = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
      el.textContent = mn[d.getMonth()];
      wRow.appendChild(el);
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
  }

  head.appendChild(mRow);
  head.appendChild(wRow);

  // In milestone view, append the single timeline row to the sticky header
  if (milestoneView) {
    const tlRow = document.createElement('div');
    tlRow.className = 'ms-timeline-row';
    tlRow.style.width = tw + 'px';
    const allMs = tasks.filter(t => t.type === 'milestone' && !t.done)
      .sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1);
    const root = tasks.find(t => t.parent === null);
    if (root) renderMilestoneTimeline(tlRow, root, allMs);
    head.appendChild(tlRow);
  }
}
