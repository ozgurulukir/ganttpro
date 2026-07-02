/* Task panel: left-side table with name, dates, deps, actions. */
import { D } from './deps.js';
import { darkenColor, initials } from '../core/format.js';
import { countWorkingDays } from '../core/calendar.js';
import { highlightRow } from './tooltip.js';
import { renderWorkloadPanel } from './workload.js';
import { t } from '../i18n/index.js';

export function renderTaskPanel() {
  const {
    tasks, collapsed, workloadView, isReadOnly, milestoneView,
    curProj, openModal, openProjModal, reorderTask,
    toggleCollapse, avColor, groupBounds,
    openNameEditor, openStartEditor, openEndEditor, openWdayEditor, openAllDepsEditor,
    buildDepsText, taskById, getTaskDepth, getVisibleRows,
    outdentTask, indentTask, addTaskInline, confirmDeleteTask, pushHistory,
  } = D;

  const rows = getVisibleRows();
  const body = document.getElementById('taskBody');
  body.innerHTML = '';
  document.getElementById('taskCount').textContent = tasks.filter(t => t.type === 'task').length;

  // 工作量視圖：左側面板改列出負責人
  if (workloadView) { renderWorkloadPanel(body); return; }

  // 空狀態：給予明確的下一步引導
  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'panel-empty';
    const txt = document.createElement('div');
    txt.className = 'panel-empty-txt';
    txt.textContent = curProj() ? t('taskPanel.noTasks') : t('taskPanel.noProjects');
    empty.appendChild(txt);
    if (!isReadOnly && !milestoneView) {
      const cta = document.createElement('button');
      cta.className = 'btn btn-primary';
      cta.textContent = curProj() ? t('taskPanel.addTask') : t('taskPanel.createFirstProject');
      cta.onclick = () => curProj() ? openModal() : openProjModal();
      empty.appendChild(cta);
    }
    body.appendChild(empty);
  }

  rows.forEach(({ task, depth }, rowIndex) => {
    const row = document.createElement('div');
    row.className = 'task-row' + (task.type === 'group' ? ' group-row' : '');
    row.dataset.id = task.id;
    row.draggable = true;
    row.addEventListener('dragstart', e => {
      D.dragSrcId = task.id;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => row.classList.add('dragging'), 0);
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      document.querySelectorAll('.drop-above,.drop-below').forEach(r => r.classList.remove('drop-above','drop-below'));
      D.dragSrcId = null;
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      if (D.dragSrcId === task.id) return;
      document.querySelectorAll('.drop-above,.drop-below').forEach(r => r.classList.remove('drop-above','drop-below'));
      const rect = row.getBoundingClientRect();
      row.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drop-above' : 'drop-below');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-above','drop-below'));
    row.addEventListener('drop', e => {
      e.preventDefault();
      if (!D.dragSrcId || D.dragSrcId === task.id) return;
      const rect = row.getBoundingClientRect();
      reorderTask(D.dragSrcId, task.id, e.clientY < rect.top + rect.height / 2);
    });

    // Empty spacer for 28px number column
    row.appendChild(document.createElement('div'));

    // Name cell
    const nc = document.createElement('div');
    nc.className = 'name-cell';

    // Drag handle
    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '⋮⋮';
    nc.appendChild(handle);

    const ind = document.createElement('span');
    ind.className = 'indent';
    ind.style.width = (depth * 18) + 'px';
    nc.appendChild(ind);

    const hasChildren = tasks.some(c => c.parent === task.id);
    if (hasChildren) {
      const tog = document.createElement('span');
      tog.className = 'toggle' + (collapsed.has(task.id) ? ' coll' : '');
      tog.innerHTML = '▼';
      tog.onclick = e => { e.stopPropagation(); toggleCollapse(task.id); };
      nc.appendChild(tog);
    } else {
      const sp = document.createElement('span');
      sp.style.cssText = 'width:16px;flex-shrink:0;display:inline-block';
      nc.appendChild(sp);
    }

    const dot = document.createElement('span');
    dot.className = 'cdot';
    if (task.type === 'milestone') {
      const parentTask = tasks.find(t => t.id === task.parent);
      dot.style.background = parentTask ? darkenColor(parentTask.color) : darkenColor(task.color);
    } else {
      dot.style.background = task.color;
    }
    nc.appendChild(dot);

    const numSpan = document.createElement('span');
    numSpan.className = 'row-num';
    numSpan.textContent = rowIndex + 1;
    nc.appendChild(numSpan);

    const nm = document.createElement('span');
    nm.className = 'tname' + (task.type === 'group' ? ' bold' : '');
    nm.textContent = task.name;
    nm.style.cursor = 'text';
    nm.title = task.name;
    nm.addEventListener('click', e => { e.stopPropagation(); if (!isReadOnly) openNameEditor(task, nm); });
    nc.appendChild(nm);

    if (task.type === 'milestone') {
      const badge = document.createElement('span');
      badge.className = 'ms-badge';
      badge.textContent = '◆ ' + t('taskPanel.milestone');
      nc.appendChild(badge);
    }

    // 負責人頭像（縮寫 + 個人色）
    if (task.assignee) {
      const av = document.createElement('span');
      av.className = 'assignee-av';
      av.textContent = initials(task.assignee);
      av.style.background = avColor(task.assignee);
      av.title = t('taskPanel.assigneeTitle') + task.assignee;
      nc.appendChild(av);
    }

    // Strikethrough if done
    if (task.done) row.classList.add('completed');
    row.appendChild(nc);

    // Start date cell
    const sc = document.createElement('div');
    sc.className = 'date-cell' + (task.pinStart ? ' pinned' : '');
    if (task.type === 'group') {
      const gb = groupBounds(task.id);
      sc.textContent = gb.s || '';
      if (gb.s) sc.style.color = 'var(--t3)';
    } else {
      const sv = task.start || task.date || '';
      if (task.pinStart && sv) {
        sc.innerHTML = '<span class="pin-dot"></span>' + sv;
        sc.title = t('taskPanel.fixedDate');
      } else {
        sc.textContent = sv;
      }
    }
    if (task.type === 'task') {
      const hasDeps = (task.deps||[]).length || (task.sdeps||[]).length || (task.ffdeps||[]).length || (task.sfdeps||[]).length;
      if (!hasDeps) {
        sc.style.cursor = 'text';
        sc.addEventListener('click', e => { e.stopPropagation(); if (!isReadOnly) openStartEditor(task, sc); });
      }
    }
    row.appendChild(sc);

    // End date cell
    const ec = document.createElement('div');
    ec.className = 'date-cell';
    if (task.type === 'group') {
      const gb = groupBounds(task.id);
      ec.textContent = gb.e || '';
      if (gb.e) ec.style.color = 'var(--t3)';
    } else {
      ec.textContent = task.end || task.date || '';
    }
    if (task.type === 'task') {
      ec.style.cursor = 'text';
      ec.addEventListener('click', e => { e.stopPropagation(); if (!isReadOnly) openEndEditor(task, ec); });
    }
    row.appendChild(ec);

    // Working days cell
    const wc = document.createElement('div');
    wc.className = 'wday-cell';
    if (task.type === 'task' && task.start && task.end) {
      wc.textContent = countWorkingDays(task.start, task.end);
      wc.style.cursor = 'text';
      wc.addEventListener('click', e => { e.stopPropagation(); if (!isReadOnly) openWdayEditor(task, wc); });
    } else if (task.type === 'group') {
      const gb = groupBounds(task.id);
      if (gb.s && gb.e) {
        wc.textContent = countWorkingDays(gb.s, gb.e);
        wc.style.color = 'var(--t3)';
      } else {
        wc.textContent = '—';
      }
    } else {
      wc.textContent = '—';
    }
    row.appendChild(wc);

    // Unified deps cell (FS/SS/FF/SF)
    const dc = document.createElement('div');
    dc.className = 'deps-cell';
    dc.style.position = 'relative';
    const allDepsText = buildDepsText(task);
    dc.innerHTML = allDepsText
      ? `<span class="deps-nums">${allDepsText}</span>`
      : `<span style="font-size:11px;color:var(--t4)">—</span>`;
    dc.addEventListener('click', e => {
      e.stopPropagation();
      if (isReadOnly) return;
      openAllDepsEditor(task, dc);
    });
    dc.style.cursor = isReadOnly ? 'default' : 'text';
    row.appendChild(dc);

    // Checkbox cell
    const cc = document.createElement('div');
    cc.className = 'check-cell';
    if (task.type === 'task') {
      const cb = document.createElement('div');
      cb.className = 'check-box' + (task.done ? ' done' : '');
      cb.textContent = task.done ? '✓' : '';
      cb.onclick = e => {
        e.stopPropagation();
        pushHistory();
        task.done = !task.done;
        if (task.done) task.progress = 100;
        D.render();
      };
      cc.appendChild(cb);
    } else if (task.type === 'milestone') {
      const mb = document.createElement('span');
      mb.textContent = '◆';
      mb.style.cssText = `font-size:13px;color:${task.color};cursor:pointer;opacity:${task.done ? 0.3 : 1};transition:opacity .12s`;
      mb.title = task.done ? t('taskPanel.markIncomplete') : t('taskPanel.markDone');
      mb.onclick = e => {
        e.stopPropagation();
        pushHistory();
        task.done = !task.done;
        D.render();
      };
      cc.appendChild(mb);
    }
    row.appendChild(cc);

    // Action cell (4th column): outdent ← indent → add +
    const ac = document.createElement('div');
    ac.className = 'add-cell';

    const _parent = taskById(task.parent);
    const canOutdent = task.parent !== null && _parent && _parent.parent !== null;
    const _myIdx = tasks.indexOf(task);
    let _prevSib = null;
    for (let i = _myIdx - 1; i >= 0; i--) {
      if (tasks[i].parent === task.parent) { _prevSib = tasks[i]; break; }
    }
    const canIndent = _prevSib !== null && getTaskDepth(_prevSib.id) + 1 < 5;

    const outBtn = document.createElement('div');
    outBtn.className = 'row-action-btn';
    outBtn.textContent = '←';
    outBtn.title = t('taskPanel.outdent');
    if (canOutdent) outBtn.onclick = e => { e.stopPropagation(); outdentTask(task.id); };
    else outBtn.style.visibility = 'hidden';
    ac.appendChild(outBtn);

    const inBtn = document.createElement('div');
    inBtn.className = 'row-action-btn';
    inBtn.textContent = '→';
    inBtn.title = t('taskPanel.indent');
    if (canIndent) inBtn.onclick = e => { e.stopPropagation(); indentTask(task.id); };
    else inBtn.style.visibility = 'hidden';
    ac.appendChild(inBtn);

    const addBtn = document.createElement('div');
    addBtn.className = 'row-action-btn add';
    addBtn.textContent = '+';
    addBtn.title = t('taskPanel.addSubtask');
    addBtn.onclick = e => { e.stopPropagation(); addTaskInline(task.id); };
    ac.appendChild(addBtn);

    const delBtn = document.createElement('div');
    delBtn.className = 'row-action-btn del';
    delBtn.textContent = '✕';
    delBtn.title = t('taskPanel.deleteTask');
    delBtn.onclick = e => { e.stopPropagation(); confirmDeleteTask(task.id); };
    ac.appendChild(delBtn);

    row.appendChild(ac);

    // Click to edit (task/milestone only, skip toggle & checkbox)
    if (task.type !== 'group') {
      row.style.cursor = 'default';
    }

    // Hover sync
    row.addEventListener('mouseenter', () => highlightRow(task.id, true));
    row.addEventListener('mouseleave', () => highlightRow(task.id, false));

    body.appendChild(row);
  });

}
