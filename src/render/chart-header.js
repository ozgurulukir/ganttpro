/* Chart header: month labels + day/week/month sub-header. */
import { D } from './deps.js';
import { toStr } from '../core/format.js';
import { isNonWorkday, getHoliday } from '../core/calendar.js';
import {
  parseDate,
  formatDate,
  dayOfWeek,
  endOfMonth,
  startOfMonth,
  yearOf,
  monthOf,
  dayOfMonth
} from '../core/date.js';
import { renderMilestoneTimeline } from './milestone.js';
import { t } from '../i18n/index.js';

export function renderChartHeader() {
  const { CHART_START, CHART_END, PPD, TODAY, TODAY_STR, milestoneView, tasks, dateToX, totalW } =
    D;
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
  let curDn = parseDate(toStr(CHART_START));
  const endDn = parseDate(toStr(CHART_END));
  while (curDn <= endDn) {
    const y = yearOf(curDn);
    const m = monthOf(curDn);
    const clampedDn = Math.min(endOfMonth(curDn), endDn);
    const x1 = dateToX(formatDate(curDn));
    const x2 = dateToX(formatDate(clampedDn)) + PPD;
    const el = document.createElement('div');
    el.className = 'month-label';
    el.style.cssText = `left:${x1}px;width:${x2 - x1}px`;
    const mn = t('chart.months', { returnObjects: true });
    el.innerHTML = `<span class="month-label-in">${y} ${mn[m]}</span>`;
    mRow.appendChild(el);
    curDn = endOfMonth(curDn) + 1;
  }

  // Sub-header: granularity based on PPD (not viewMode)
  const gran = PPD >= 18 ? 'day' : PPD >= 5 ? 'week' : 'month';
  const dayNames = t('chart.days', { returnObjects: true });

  if (gran === 'day') {
    let dn = parseDate(toStr(CHART_START));
    while (dn <= endDn) {
      const ds = formatDate(dn);
      const x = dateToX(ds);
      const dow = dayOfWeek(dn);
      const hol = getHoliday(ds);
      const off = isNonWorkday(ds);
      const isTdy = ds === TODAY_STR;
      const el = document.createElement('div');
      const dayColor = isTdy
        ? ''
        : hol
          ? ' day-sun'
          : dow === 6
            ? ' day-sat'
            : dow === 0
              ? ' day-sun'
              : ' day-weekday';
      el.className =
        'week-cell day-cell' + dayColor + (isTdy ? ' today-wk' : '') + (off ? ' wknd-cell' : '');
      el.style.cssText = `left:${x}px;width:${PPD}px`;
      if (hol) el.title = t(hol);
      const dayDate = dayOfMonth(dn);
      el.innerHTML = `<span>${dayDate}</span><span class="day-dow">${dayNames[dow]}</span>`;
      wRow.appendChild(el);
      dn++;
    }
  } else if (gran === 'week') {
    // Align to Monday
    let dn = parseDate(toStr(CHART_START));
    const dow = dayOfWeek(dn);
    dn -= dow === 0 ? 6 : dow - 1;
    while (dn <= endDn) {
      const weDn = dn + 6;
      const ds = formatDate(dn),
        weStr = formatDate(weDn);
      const x1 = Math.max(0, dateToX(ds));
      const x2 = Math.min(tw, dateToX(weStr) + PPD);
      if (x1 < tw && x2 > 0) {
        const isTdy = parseDate(TODAY_STR) >= dn && parseDate(TODAY_STR) <= weDn;
        const el = document.createElement('div');
        el.className = 'week-cell' + (isTdy ? ' today-wk' : '');
        el.style.cssText = `left:${x1}px;width:${x2 - x1}px`;
        el.textContent = `${monthOf(dn) + 1}/${dayOfMonth(dn)}`;
        wRow.appendChild(el);
      }
      dn += 7;
    }
  } else {
    // Month granularity: show each month label
    let mnDn = startOfMonth(parseDate(toStr(CHART_START)));
    while (mnDn <= endDn) {
      const y = yearOf(mnDn);
      const m = monthOf(mnDn);
      const clampedDn = Math.min(endOfMonth(mnDn), endDn);
      const x1 = Math.max(0, dateToX(formatDate(mnDn)));
      const x2 = Math.min(tw, dateToX(formatDate(clampedDn)) + PPD);
      const todayDn = parseDate(TODAY_STR);
      const isTdyMon = yearOf(todayDn) === y && monthOf(todayDn) === m;
      const el = document.createElement('div');
      el.className = 'week-cell' + (isTdyMon ? ' today-wk' : '');
      el.style.cssText = `left:${x1}px;width:${x2 - x1}px`;
      const mn = t('chart.months', { returnObjects: true });
      el.textContent = mn[m];
      wRow.appendChild(el);
      mnDn = endOfMonth(mnDn) + 1;
    }
  }

  head.appendChild(mRow);
  head.appendChild(wRow);

  // In milestone view, append the single timeline row to the sticky header
  if (milestoneView) {
    const tlRow = document.createElement('div');
    tlRow.className = 'ms-timeline-row';
    tlRow.style.width = tw + 'px';
    const allMs = tasks
      .filter(t => t.type === 'milestone' && !t.done)
      .sort((a, b) => ((a.date || '') < (b.date || '') ? -1 : 1));
    const root = tasks.find(t => t.parent === null);
    if (root) renderMilestoneTimeline(tlRow, root, allMs);
    head.appendChild(tlRow);
  }
}
