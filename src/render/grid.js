/* Grid lines (month/week/day granularity) for chart canvas. */
import { D } from './deps.js';
import { toStr } from '../core/format.js';
import { isNonWorkday } from '../core/calendar.js';
import { parseDate, formatDate, dayOfWeek } from '../core/date.js';

export function renderGrid(canvas, tw, th) {
  const { CHART_START, CHART_END, PPD, dateToX } = D;
  const startStr = toStr(CHART_START);
  const endStr = toStr(CHART_END);
  // Month lines
  let mnDn = parseDate(startStr);
  const csD = new Date(mnDn * 86400000);
  mnDn = Math.floor(Date.UTC(csD.getUTCFullYear(), csD.getUTCMonth(), 1) / 86400000);
  const endDn = parseDate(endStr);
  while (mnDn <= endDn) {
    const md = new Date(mnDn * 86400000);
    const y = md.getUTCFullYear(), m = md.getUTCMonth();
    const x = dateToX(formatDate(mnDn));
    if (x > 0) {
      const l = document.createElement('div');
      l.className = 'grid-line grid-month';
      l.style.cssText = `left:${x}px;height:${th}px`;
      canvas.appendChild(l);
    }
    mnDn = Math.floor(Date.UTC(y, m + 1, 1) / 86400000);
  }

  // Sub-grid lines based on PPD
  const gridGran = PPD >= 18 ? 'day' : PPD >= 5 ? 'week' : 'month';
  if (gridGran === 'day') {
    let dn = parseDate(startStr);
    while (dn <= endDn) {
      const x = dateToX(formatDate(dn));
      const off = isNonWorkday(formatDate(dn));
      const l = document.createElement('div');
      l.className = 'grid-line' + (off ? ' grid-wknd' : '');
      l.style.cssText = `left:${x}px;height:${th}px`;
      canvas.appendChild(l);
      if (off) {
        const bg = document.createElement('div');
        bg.className = 'wknd-bg';
        bg.style.cssText = `left:${x}px;width:${PPD}px`;
        canvas.appendChild(bg);
      }
      dn++;
    }
  } else if (gridGran === 'week') {
    let dn = parseDate(startStr);
    const dow = dayOfWeek(dn);
    dn -= (dow === 0 ? 6 : dow - 1);
    while (dn <= endDn) {
      const x = dateToX(formatDate(dn));
      if (x >= 0) {
        const l = document.createElement('div');
        l.className = 'grid-line';
        l.style.cssText = `left:${x}px;height:${th}px`;
        canvas.appendChild(l);
      }
      dn += 7;
    }
  }
}
