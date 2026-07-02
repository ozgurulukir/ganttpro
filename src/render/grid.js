/* Grid lines (month/week/day granularity) for chart canvas. */
import { D } from './deps.js';
import { toStr } from '../core/format.js';
import { isNonWorkday } from '../core/calendar.js';

export function renderGrid(canvas, tw, th) {
  const { CHART_START, CHART_END, PPD, dateToX } = D;
  // Month lines
  let c = new Date(CHART_START.getFullYear(), CHART_START.getMonth(), 1);
  while (c <= CHART_END) {
    const x = dateToX(toStr(c));
    if (x > 0) {
      const l = document.createElement('div');
      l.className = 'grid-line grid-month';
      l.style.cssText = `left:${x}px;height:${th}px`;
      canvas.appendChild(l);
    }
    c = new Date(c.getFullYear(), c.getMonth() + 1, 1);
  }

  // Sub-grid lines based on PPD
  const gridGran = PPD >= 18 ? 'day' : PPD >= 5 ? 'week' : 'month';
  if (gridGran === 'day') {
    let d = new Date(CHART_START);
    while (d <= CHART_END) {
      const x = dateToX(toStr(d));
      const off = isNonWorkday(d);
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
      d.setDate(d.getDate() + 1);
    }
  } else if (gridGran === 'week') {
    let d = new Date(CHART_START);
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    while (d <= CHART_END) {
      const x = dateToX(toStr(d));
      if (x >= 0) {
        const l = document.createElement('div');
        l.className = 'grid-line';
        l.style.cssText = `left:${x}px;height:${th}px`;
        canvas.appendChild(l);
      }
      d.setDate(d.getDate() + 7);
    }
  }
}
