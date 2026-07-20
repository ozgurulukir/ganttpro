import { countWorkingDays, nextWorkingDay } from '../core/calendar.js';
import { darkenColor } from '../core/format.js';
import { parseDate, formatDate, addDays, dayOfWeek } from '../core/date.js';
import { D } from '../render/deps.js';
import { t } from '../i18n/index.js';

export function exportPNG() {
  const {
    getVisibleRows,
    curProj,
    totalW,
    dateToX,
    groupBounds,
    milestoneView,
    ROW_H,
    MS_ROW_H,
    TODAY_STR,
    CHART_START,
    CHART_END,
    PPD,
    showBaseline,
    showCriticalPath,
    criticalTaskIds
  } = D;

  const rows = getVisibleRows();
  if (!rows.length) return;
  const proj = curProj() || {};
  const tw = totalW();
  const PANEL = 420;
  const HDR = 56;
  const THDR = 24; // table header
  const msMode = milestoneView;
  const bodyH = msMode ? Math.max(rows.length * ROW_H, MS_ROW_H) : rows.length * ROW_H;
  const totalH = HDR + THDR + bodyH;
  const totalWpx = PANEL + tw;

  const c = document.createElement('canvas');
  c.width = totalWpx;
  c.height = totalH;
  const ctx = c.getContext('2d');
  ctx.textBaseline = 'middle';

  // ─── 背景 ───
  ctx.fillStyle = '#F0F1F5';
  ctx.fillRect(0, 0, totalWpx, totalH);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, PANEL, totalH);
  ctx.fillRect(PANEL, 0, tw, totalH);

  // ─── 專案標題列 ───
  ctx.fillStyle = '#1F2937';
  ctx.font = 'bold 13px -apple-system,system-ui,sans-serif';
  ctx.fillText(proj.name || 'GanttPro', 10, HDR / 2 - 6);
  ctx.fillStyle = '#6B7280';
  ctx.font = '11px -apple-system,system-ui,sans-serif';
  ctx.fillText(
    `${t('export.exportDate')}: ${TODAY_STR}  ${t('export.tasks')}: ${rows.filter(r => r.task.type === 'task').length}  ${t('export.milestones')}: ${rows.filter(r => r.task.type === 'milestone').length}`,
    10,
    HDR / 2 + 10
  );

  // ─── 表頭列 ───
  ctx.fillStyle = '#F9FAFB';
  ctx.fillRect(0, HDR, totalWpx, THDR);
  ctx.fillStyle = '#6B7280';
  ctx.font = '600 10px -apple-system,system-ui,sans-serif';
  [
    ['#', 8],
    ['Task Name', 28],
    ['Start Date', 240],
    ['End Date', 310],
    ['Workdays', 380]
  ].forEach(([t, x]) => {
    ctx.fillText(t, x, HDR + THDR / 2);
  });
  // Gantt header: month labels
  let mnDn = parseDate(CHART_START.toISOString().slice(0, 10));
  const endDn = parseDate(CHART_END.toISOString().slice(0, 10));
  while (mnDn <= endDn) {
    const md = new Date(mnDn * 86400000);
    const y = md.getUTCFullYear(),
      m = md.getUTCMonth();
    const mx = PANEL + dateToX(formatDate(mnDn));
    if (mx >= PANEL) {
      ctx.fillStyle = '#374151';
      ctx.font = '10px -apple-system,system-ui,sans-serif';
      ctx.fillText(`${y} ${t('chart.months', { returnObjects: true })[m]}`, mx + 3, HDR + THDR / 2);
    }
    mnDn = Math.floor(Date.UTC(y, m + 1, 1) / 86400000);
  }

  // ─── 垂直格線（月） ───
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 0.5;
  let gridDn = parseDate(CHART_START.toISOString().slice(0, 10));
  const csD = new Date(gridDn * 86400000);
  gridDn = Math.floor(Date.UTC(csD.getUTCFullYear(), csD.getUTCMonth(), 1) / 86400000);
  while (gridDn <= endDn) {
    const gx = PANEL + dateToX(formatDate(gridDn));
    if (gx >= PANEL) {
      ctx.beginPath();
      ctx.moveTo(gx, HDR);
      ctx.lineTo(gx, totalH);
      ctx.stroke();
    }
    const gd = new Date(gridDn * 86400000);
    gridDn = Math.floor(Date.UTC(gd.getUTCFullYear(), gd.getUTCMonth() + 1, 1) / 86400000);
  }

  // ─── 今日線 ───
  const todayX = PANEL + dateToX(TODAY_STR);
  if (todayX >= PANEL && todayX <= totalWpx) {
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(todayX, HDR);
    ctx.lineTo(todayX, totalH);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText(t('chart.today'), todayX + 2, HDR + 6);
  }

  // ─── 任務列 ───
  rows.forEach(({ task, depth }, i) => {
    const y = HDR + THDR + i * ROW_H;

    // 列背景（里程碑模式：右側為單一時間軸，不畫列底紋）
    ctx.fillStyle = task.type === 'group' ? '#F9FAFB' : i % 2 === 0 ? '#FFFFFF' : '#FAFAFA';
    ctx.fillRect(0, y, PANEL, ROW_H);
    if (!msMode) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,.012)';
      ctx.fillRect(PANEL, y, tw, ROW_H);
    }

    // 列分隔線
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y + ROW_H);
    ctx.lineTo(msMode ? PANEL : totalWpx, y + ROW_H);
    ctx.stroke();

    // 列號
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '10px sans-serif';
    ctx.fillText(i + 1, 8, y + ROW_H / 2);

    // 色點
    const indent = depth * 10;
    ctx.fillStyle = task.color || '#5E6AD2';
    ctx.beginPath();
    ctx.arc(22 + indent, y + ROW_H / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // 任務名稱
    ctx.fillStyle = task.type === 'group' ? '#111827' : '#374151';
    ctx.font = task.type === 'group' ? 'bold 12px sans-serif' : '12px sans-serif';
    let name = task.name;
    const maxNW = 200 - indent;
    while (ctx.measureText(name).width > maxNW && name.length > 1) name = name.slice(0, -1);
    if (name !== task.name) name += '…';
    ctx.fillText(name, 32 + indent, y + ROW_H / 2);

    // 日期欄
    if (task.type === 'task' || task.type === 'milestone') {
      ctx.fillStyle = '#6B7280';
      ctx.font = '10.5px sans-serif';
      const s = task.start || task.date || '';
      const e = task.end || task.date || '';
      ctx.fillText(s.replace(/^\d{4}-/, '').replace('-', '/'), 240, y + ROW_H / 2);
      ctx.fillText(e.replace(/^\d{4}-/, '').replace('-', '/'), 310, y + ROW_H / 2);
      if (task.type === 'task') {
        const wd =
          task.wday || (task.start && task.end ? countWorkingDays(task.start, task.end) : 1);
        ctx.fillText(wd + 'd', 385, y + ROW_H / 2);
      }
    }

    // ─── 甘特 Bar ───
    if (task.type === 'task' && task.start && task.end) {
      const bx = PANEL + dateToX(task.start);
      const bw = Math.max(PANEL + dateToX(addDays(task.end, 1)) - bx, 3);
      const by = y + (ROW_H - 20) / 2;
      ctx.globalAlpha = task.done ? 0.32 : 1;
      ctx.fillStyle = task.color || '#5E6AD2';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, 20, 3);
      ctx.fill();
      const _prog = task.done ? 100 : task.progress || 0;
      if (_prog > 0 && _prog < 100) {
        ctx.fillStyle = darkenColor(task.color || '#5E6AD2', 0.3);
        ctx.beginPath();
        ctx.roundRect(bx, by, (bw * _prog) / 100, 20, 3);
        ctx.fill();
      }
      const _bl = showBaseline && (proj.baseline?.dates || {})[task.id];
      if (_bl && _bl.s && _bl.e && (_bl.s !== task.start || _bl.e !== task.end)) {
        const blx = PANEL + dateToX(_bl.s);
        const blw = Math.max(PANEL + dateToX(addDays(_bl.e, 1)) - blx, 3);
        ctx.fillStyle = '#9CA3AF';
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.roundRect(blx, y + 30, blw, 4, 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (showCriticalPath && criticalTaskIds.has(task.id)) {
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, 20, 3);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (bw > 50) {
        ctx.fillStyle = '#fff';
        ctx.font = '11px sans-serif';
        let lbl = task.name;
        while (ctx.measureText(lbl).width > bw - 12 && lbl.length > 1) lbl = lbl.slice(0, -1);
        ctx.fillText(lbl, bx + 6, by + 10);
      }
    } else if (task.type === 'milestone' && task.date && !msMode) {
      const mx = PANEL + dateToX(task.date) + PPD / 2;
      const my = y + ROW_H / 2;
      ctx.fillStyle = task.color || '#F59E0B';
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-7, -7, 14, 14);
      ctx.restore();
      // 在菱形右側繪製里程碑名稱
      ctx.fillStyle = task.color || '#F59E0B';
      ctx.font = '10px sans-serif';
      const lbl = task.name.length > 12 ? task.name.slice(0, 12) + '…' : task.name;
      ctx.fillText(lbl, mx + 11, my);
    } else if (task.type === 'group') {
      const b = groupBounds(task.id);
      if (b.s && b.e) {
        const bx = PANEL + dateToX(b.s);
        const bw = Math.max(PANEL + dateToX(nextWorkingDay(b.e)) - bx, 6);
        const by = y + (ROW_H - 8) / 2;
        ctx.fillStyle = task.color || '#5E6AD2';
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, 8, 4);
        ctx.fill();
      }
    }
  });

  // ─── 里程碑模式：單一時間軸（同 Web 版 renderMilestoneTimeline）───
  if (msMode) {
    const cy = HDR + THDR + bodyH / 2;
    const halfD = 8,
      connH = 28;
    // Spine
    ctx.strokeStyle = '#5E6AD2';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(PANEL, cy);
    ctx.lineTo(PANEL + tw, cy);
    ctx.stroke();
    ctx.globalAlpha = 1;
    const msList = rows.map(r => r.task).filter(t => t.type === 'milestone' && t.date);
    msList.forEach((m, idx) => {
      const x = PANEL + dateToX(m.date) + PPD / 2;
      const above = idx % 2 === 0;
      const col = m.color || '#5E6AD2';
      // Connector
      ctx.strokeStyle = '#C7CAD1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, above ? cy - halfD - connH : cy + halfD);
      ctx.lineTo(x, above ? cy - halfD : cy + halfD + connH);
      ctx.stroke();
      // Diamond
      ctx.fillStyle = col;
      ctx.save();
      ctx.translate(x, cy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-halfD + 1, -halfD + 1, (halfD - 1) * 2, (halfD - 1) * 2);
      ctx.restore();
      // Name + date（置中、交錯上下）
      ctx.textAlign = 'center';
      const lbl = m.name.length > 16 ? m.name.slice(0, 16) + '…' : m.name;
      const nameY = above ? cy - halfD - connH - 8 : cy + halfD + connH + 10;
      ctx.fillStyle = col;
      ctx.font = '600 11px -apple-system,system-ui,sans-serif';
      ctx.fillText(lbl, x, nameY);
      const dateY = above ? nameY - 13 : nameY + 13;
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '10px sans-serif';
      ctx.fillText(m.date, x, dateY);
      ctx.textAlign = 'left';
    });
  }

  // ─── 面板邊線 ───
  ctx.strokeStyle = '#D1D5DB';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PANEL, 0);
  ctx.lineTo(PANEL, totalH);
  ctx.stroke();
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, HDR + THDR);
  ctx.lineTo(totalWpx, HDR + THDR);
  ctx.stroke();

  // ─── 下載 ───
  const filename = `gantt-${(proj.name || 'export').replace(/\s+/g, '-')}-${TODAY_STR}.png`;
  c.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = filename;
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}
