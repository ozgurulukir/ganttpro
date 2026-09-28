/* Dependency arrows (SVG) — FS, SS, FF, SF + critical path. */
import { D } from './deps.js';

function arrowPath(sx, sy, tx, ty) {
  const style = D.arrowStyle || 'bezier';
  const dx = (tx - sx) / 2;
  if (style === 'straight') {
    return `M ${sx} ${sy} L ${tx} ${ty}`;
  } else if (style === 'elbow') {
    const mx = (sx + tx) / 2;
    return `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ty} L ${tx} ${ty}`;
  } else {
    return `M ${sx} ${sy} C ${sx + Math.max(dx, 20)} ${sy}, ${tx - Math.max(dx, 20)} ${ty}, ${tx} ${ty}`;
  }
}

export function renderArrows(canvas, rows, tw, th) {
  const {
    ROW_H,
    PPD,
    showCriticalPath,
    criticalTaskIds,
    dateToX,
    taskById,
    groupBounds,
    getCriticalPredTaskIds
  } = D;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', tw);
  svg.setAttribute('height', th);
  svg.setAttribute('class', 'arrows-svg');

  // Arrow markers
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  function makeMarker(id, color) {
    const mk = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    mk.setAttribute('id', id);
    mk.setAttribute('markerWidth', '7');
    mk.setAttribute('markerHeight', '7');
    mk.setAttribute('refX', '6');
    mk.setAttribute('refY', '3.5');
    mk.setAttribute('orient', 'auto');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', '0 0, 7 3.5, 0 7');
    poly.setAttribute('fill', color);
    mk.appendChild(poly);
    defs.appendChild(mk);
  }
  makeMarker('ah', '#9CA3AF');
  makeMarker('ah-ss', '#F59E0B');
  makeMarker('ah-ff', '#10B981');
  makeMarker('ah-sf', '#8B5CF6');
  makeMarker('ah-cp', '#EF4444');
  svg.appendChild(defs);

  // Row index lookup
  const ri = new Map();
  rows.forEach(({ task }, i) => ri.set(task.id, i));

  rows.forEach(({ task }) => {
    const tRow = ri.get(task.id);
    if (tRow === undefined) return;
    if (task.type === 'task' && !task.start) return;
    if (task.type === 'milestone' && !task.date) return;
    if (task.type === 'group') return;

    const tY = tRow * ROW_H + ROW_H / 2;
    const tX = task.type === 'milestone' ? dateToX(task.date) + PPD / 2 : dateToX(task.start);
    if (isNaN(tX)) return;

    // FS arrows (只在非 CP 模式顯示)
    if (!showCriticalPath) {
      (task.deps || []).forEach(depId => {
        const dep = taskById(depId);
        if (!dep) return;
        if (dep.type === 'task' && !dep.end) return;
        if (dep.type === 'milestone' && !dep.date) return;
        if (dep.type === 'group') {
          const gb = groupBounds(dep.id);
          if (!gb.e) return;
        }
        if (task.type === 'task' && !task.start) return;
        const sRow = ri.get(depId);
        if (sRow === undefined) return;
        const sY = sRow * ROW_H + ROW_H / 2;
        const depEnd = dep.type === 'group' ? groupBounds(dep.id).e : dep.end;
        const sX =
          dep.type === 'milestone' ? dateToX(dep.date) + PPD / 2 + 7 : dateToX(depEnd) + PPD;
        if (isNaN(sX)) return;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', arrowPath(sX, sY, tX, tY));
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#C4C8D8');
        path.setAttribute('stroke-width', '1.5');
        path.setAttribute('stroke-dasharray', '5 3');
        path.setAttribute('marker-end', 'url(#ah)');
        path.setAttribute('opacity', '0.7');
        svg.appendChild(path);
      });
    }

    // Critical path arrows (red elbow, trace through milestones)
    if (showCriticalPath && criticalTaskIds.has(task.id) && task.type === 'task') {
      getCriticalPredTaskIds(task).forEach(depId => {
        const dep = taskById(depId);
        if (!dep) return;
        const sRow = ri.get(depId);
        if (sRow === undefined) return;
        const sY = sRow * ROW_H + ROW_H / 2;
        const sX = dateToX(dep.end) + PPD;
        let pathD;
        if (Math.abs(sY - tY) < 2) {
          pathD = `M ${sX} ${sY} H ${tX}`; // 同行：水平
        } else {
          // 貝茲曲線：無論跨幾列都不會有垂直線
          const hdx = Math.max(Math.abs(tX - sX) / 2, 40);
          pathD = `M ${sX} ${sY} C ${sX + hdx} ${sY}, ${tX - hdx} ${tY}, ${tX} ${tY}`;
        }
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathD);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#EF4444');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('marker-end', 'url(#ah-cp)');
        svg.appendChild(path);
      });
    }

    // SS arrows (amber, dep.start → task.start)
    (task.sdeps || []).forEach(depId => {
      const dep = taskById(depId);
      if (!dep) return;
      if (dep.type === 'task' && !dep.start) return;
      if (dep.type === 'milestone' && !dep.date) return;
      if (task.type === 'task' && !task.start) return;
      const sRow = ri.get(depId);
      if (sRow === undefined) return;
      const sY = sRow * ROW_H + ROW_H / 2;
      const sX = dep.type === 'milestone' ? dateToX(dep.date) + PPD / 2 : dateToX(dep.start);
      if (isNaN(sX)) return;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', arrowPath(sX, sY, tX, tY));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#F59E0B');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-dasharray', '4 3');
      path.setAttribute('marker-end', 'url(#ah-ss)');
      path.setAttribute('opacity', '0.65');
      svg.appendChild(path);
    });

    // FF arrows (green, dep.end → task.end)
    (task.ffdeps || []).forEach(depId => {
      const dep = taskById(depId);
      if (!dep) return;
      if (dep.type === 'task' && !dep.end) return;
      if (task.type === 'task' && !task.end) return;
      const sRow = ri.get(depId);
      if (sRow === undefined) return;
      const sY = sRow * ROW_H + ROW_H / 2;
      const sX = dep.type === 'milestone' ? dateToX(dep.date) + PPD / 2 : dateToX(dep.end) + PPD;
      const ffTX =
        task.type === 'milestone' ? dateToX(task.date) + PPD / 2 : dateToX(task.end) + PPD;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', arrowPath(sX, sY, ffTX, tY));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#10B981');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-dasharray', '4 3');
      path.setAttribute('marker-end', 'url(#ah-ff)');
      path.setAttribute('opacity', '0.7');
      svg.appendChild(path);
    });

    // SF arrows (purple, dep.start → task.end)
    (task.sfdeps || []).forEach(depId => {
      const dep = taskById(depId);
      if (!dep) return;
      if (dep.type === 'task' && !dep.start) return;
      if (task.type === 'task' && !task.end) return;
      const sRow = ri.get(depId);
      if (sRow === undefined) return;
      const sY = sRow * ROW_H + ROW_H / 2;
      const sX = dep.type === 'milestone' ? dateToX(dep.date) + PPD / 2 : dateToX(dep.start);
      const sfTX =
        task.type === 'milestone' ? dateToX(task.date) + PPD / 2 : dateToX(task.end) + PPD;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', arrowPath(sX, sY, sfTX, tY));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#8B5CF6');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-dasharray', '4 3');
      path.setAttribute('marker-end', 'url(#ah-sf)');
      path.setAttribute('opacity', '0.7');
      svg.appendChild(path);
    });
  });

  canvas.appendChild(svg);
}
