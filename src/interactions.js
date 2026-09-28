/* DOM setup: scroll sync, column resizers, panel resizer. */

const COL_WIDTHS = [28, null, 86, 86, 52, 130, 36, 68]; // null = 1fr

export function applyColGrid() {
  const tpl = COL_WIDTHS.map(w => (w === null ? 'minmax(320px,400px)' : w + 'px')).join(' ');
  document.documentElement.style.setProperty('--cg', tpl);
}

export function setupSync() {
  const tb = document.getElementById('taskBody');
  const cs = document.getElementById('chartScroll');
  let syncing = false;

  tb.addEventListener('scroll', () => {
    if (syncing) return;
    syncing = true;
    cs.scrollTop = tb.scrollTop;
    syncing = false;
  });
  cs.addEventListener('scroll', () => {
    if (syncing) return;
    syncing = true;
    const maxTb = Math.max(0, tb.scrollHeight - tb.clientHeight);
    const clamped = Math.min(cs.scrollTop, maxTb);
    if (cs.scrollTop !== clamped) cs.scrollTop = clamped;
    tb.scrollTop = clamped;
    syncing = false;
  });
}

export function setupColResizers() {
  applyColGrid();
  document.querySelectorAll('.col-rsz').forEach(handle => {
    const ci = +handle.dataset.ci;
    handle.addEventListener('mousedown', e => {
      e.stopPropagation();
      e.preventDefault();
      const headerCell = handle.parentElement;
      const startX = e.clientX;
      const startW = headerCell.getBoundingClientRect().width;
      if (COL_WIDTHS[ci] === null) {
        COL_WIDTHS[ci] = Math.round(startW);
        applyColGrid();
      }
      handle.classList.add('dragging');
      const minW = ci === 1 ? 120 : 48;
      const onMove = ev => {
        COL_WIDTHS[ci] = Math.max(minW, Math.round(startW + (ev.clientX - startX)));
        applyColGrid();
      };
      const onUp = () => {
        handle.classList.remove('dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

export function setupResizer() {
  const rsz = document.getElementById('resizer');
  const tp = document.getElementById('taskPanel');
  let startX, startW;

  rsz.addEventListener('mousedown', e => {
    startX = e.clientX;
    startW = tp.offsetWidth;
    rsz.classList.add('drag');
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });

  function onMove(e) {
    const maxW = window.innerWidth - 300;
    const w = Math.max(260, Math.min(maxW, startW + (e.clientX - startX)));
    tp.style.width = w + 'px';
    tp.style.minWidth = w + 'px';
  }
  function onUp() {
    rsz.classList.remove('drag');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }
}
