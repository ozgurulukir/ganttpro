/* Task panel: left-side table with name, dates, deps, actions. */
import { D } from './deps.js';
import { hasAnyDeps } from '../core/deps.js';
import { darkenColor, esc, initials, safeColor } from '../core/format.js';
import { countWorkingDays } from '../core/calendar.js';
import { highlightRow } from './tooltip.js';
import { renderWorkloadPanel } from './workload.js';
import { t } from '../i18n/index.js';
import * as Tree from '../core/tree.js';
import { showContextMenu } from '../ui/context-menu.js';

export function renderTaskPanel() {
  const {
    tasks,
    collapsed,
    workloadView,
    isReadOnly,
    milestoneView,
    curProj,
    openModal,
    openProjModal,
    reorderTask,
    toggleCollapse,
    avColor,
    groupBounds,
    openNameEditor,
    openStartEditor,
    openEndEditor,
    openWdayEditor,
    openAllDepsEditor,
    buildDepsText,
    taskById,
    getTaskDepth,
    outdentTask,
    indentTask,
    addTaskInline,
    confirmDeleteTask
  } = D;

  const body = document.getElementById('taskBody');
  body.innerHTML = '';
  const taskIndex = Tree.buildIndex(tasks);
  const rows = Tree.getVisibleRows(tasks, collapsed, milestoneView, taskIndex);
  const rowMap = new Map();
  rows.forEach(({ task }, idx) => rowMap.set(task.id, idx + 1));
  const wbsMap = D.showWBS ? Tree.getWBSMap(tasks) : null;
  document.getElementById('taskCount').textContent = tasks.filter(t => t.type === 'task').length;

  // 工作量視圖：左側面板改列出負責人
  if (workloadView) {
    renderWorkloadPanel(body);
    return;
  }

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
      cta.onclick = () => (curProj() ? openModal() : openProjModal());
      empty.appendChild(cta);
    }
    body.appendChild(empty);
  }

  rows.forEach(({ task, depth }, rowIndex) => {
    const row = document.createElement('div');
    const grpBounds = task.type === 'group' ? Tree.groupBounds(tasks, task.id, taskIndex) : null;
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
      document
        .querySelectorAll('.drop-above,.drop-below')
        .forEach(r => r.classList.remove('drop-above', 'drop-below'));
      D.dragSrcId = null;
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      if (D.dragSrcId === task.id) return;
      document
        .querySelectorAll('.drop-above,.drop-below')
        .forEach(r => r.classList.remove('drop-above', 'drop-below'));
      const rect = row.getBoundingClientRect();
      row.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drop-above' : 'drop-below');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-above', 'drop-below'));
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
    ind.style.width = depth * 18 + 'px';
    nc.appendChild(ind);

    const children = taskIndex.byParent.get(task.id);
    const hasChildren = Boolean(children && children.length > 0);
    if (hasChildren) {
      const tog = document.createElement('span');
      const isColl = collapsed.has(task.id);
      tog.className = 'toggle' + (isColl ? ' coll' : '');
      tog.innerHTML = '▼';
      tog.setAttribute('role', 'button');
      tog.setAttribute('tabindex', '0');
      tog.setAttribute('aria-expanded', isColl ? 'false' : 'true');
      tog.setAttribute(
        'aria-label',
        isColl
          ? t('taskPanel.expandTask', { name: task.name })
          : t('taskPanel.collapseTask', { name: task.name })
      );
      tog.onclick = e => {
        e.stopPropagation();
        toggleCollapse(task.id);
      };
      tog.onkeydown = e => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          toggleCollapse(task.id);
        }
      };
      nc.appendChild(tog);
    } else {
      const sp = document.createElement('span');
      sp.style.cssText = 'width:16px;flex-shrink:0;display:inline-block';
      nc.appendChild(sp);
    }

    const dot = document.createElement('span');
    dot.className = 'cdot';
    if (task.type === 'milestone') {
      const parentTask = taskIndex.byId.get(task.parent);
      dot.style.background = parentTask
        ? darkenColor(safeColor(parentTask.color))
        : darkenColor(safeColor(task.color));
    } else {
      dot.style.background = safeColor(task.color);
    }
    nc.appendChild(dot);

    if (D.showWBS) {
      const wbs = document.createElement('span');
      wbs.className = 'wbs-code';
      wbs.textContent = wbsMap.get(task.id) || '';
      nc.appendChild(wbs);
    }

    const numSpan = document.createElement('span');
    numSpan.className = 'row-num';
    numSpan.textContent = rowIndex + 1;
    nc.appendChild(numSpan);

    const nm = document.createElement('span');
    nm.className = 'tname' + (task.type === 'group' ? ' bold' : '');
    nm.textContent = task.name;
    nm.style.cursor = 'text';
    nm.title = task.name;
    nm.addEventListener('click', e => {
      e.stopPropagation();
      if (!isReadOnly) openNameEditor(task, nm);
    });
    nc.appendChild(nm);

    if (task.approval && task.approval !== '') {
      const ab = document.createElement('span');
      ab.className = 'approval-badge ' + task.approval;
      const labels = { pending: '\u23F3', approved: '\u2713', rejected: '\u2717' };
      ab.textContent = (labels[task.approval] || '') + ' ' + t('approval.' + task.approval);
      nc.appendChild(ab);
    }

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
      const gb = grpBounds;
      sc.textContent = gb.s || '';
      if (gb.s) sc.style.color = 'var(--t3)';
    } else {
      const sv = task.start || task.date || '';
      if (task.pinStart && sv) {
        sc.innerHTML = '<span class="pin-dot"></span>' + esc(sv);
        sc.title = t('taskPanel.fixedDate');
      } else {
        sc.textContent = sv;
      }
    }
    if (task.type === 'task') {
      const hasDeps = hasAnyDeps(task);
      if (!hasDeps) {
        sc.style.cursor = 'text';
        sc.addEventListener('click', e => {
          e.stopPropagation();
          if (!isReadOnly) openStartEditor(task, sc);
        });
      }
    }
    row.appendChild(sc);

    // End date cell
    const ec = document.createElement('div');
    ec.className = 'date-cell';
    if (task.type === 'group') {
      const gb = grpBounds;
      ec.textContent = gb.e || '';
      if (gb.e) ec.style.color = 'var(--t3)';
    } else {
      ec.textContent = task.end || task.date || '';
    }
    if (task.type === 'task') {
      ec.style.cursor = 'text';
      ec.addEventListener('click', e => {
        e.stopPropagation();
        if (!isReadOnly) openEndEditor(task, ec);
      });
    }
    row.appendChild(ec);

    // Working days cell
    const wc = document.createElement('div');
    wc.className = 'wday-cell';
    if (task.type === 'task' && task.start && task.end) {
      wc.textContent = countWorkingDays(task.start, task.end);
      wc.style.cursor = 'text';
      wc.addEventListener('click', e => {
        e.stopPropagation();
        if (!isReadOnly) openWdayEditor(task, wc);
      });
    } else if (task.type === 'group') {
      const gb = grpBounds;
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
    const allDepsText = buildDepsText(task, rowMap);
    dc.innerHTML = allDepsText
      ? `<span class="deps-nums">${esc(allDepsText)}</span>`
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
      cb.setAttribute('role', 'checkbox');
      cb.setAttribute('aria-checked', task.done ? 'true' : 'false');
      cb.setAttribute('tabindex', '0');
      cb.setAttribute(
        'aria-label',
        (task.done ? t('taskPanel.markIncomplete') : t('taskPanel.markDone')) + ': ' + task.name
      );
      cb.onclick = e => {
        e.stopPropagation();
        D.applyTaskChange(task, task.done ? { done: false } : { done: true, progress: 100 }, {
          schedule: false
        });
      };
      cb.onkeydown = e => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          cb.click();
        }
      };
      cc.appendChild(cb);
    } else if (task.type === 'milestone') {
      const mb = document.createElement('span');
      mb.textContent = '◆';
      mb.style.cssText = `font-size:13px;color:${safeColor(task.color)};cursor:pointer;opacity:${task.done ? 0.3 : 1};transition:opacity .12s`;
      mb.title = task.done ? t('taskPanel.markIncomplete') : t('taskPanel.markDone');
      mb.setAttribute('role', 'checkbox');
      mb.setAttribute('aria-checked', task.done ? 'true' : 'false');
      mb.setAttribute('tabindex', '0');
      mb.setAttribute(
        'aria-label',
        (task.done ? t('taskPanel.markIncomplete') : t('taskPanel.markDone')) + ': ' + task.name
      );
      mb.onclick = e => {
        e.stopPropagation();
        D.applyTaskChange(task, { done: !task.done }, { schedule: false });
      };
      mb.onkeydown = e => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          mb.click();
        }
      };
      cc.appendChild(mb);
    }
    row.appendChild(cc);

    // Action cell (4th column): outdent ← indent → add +
    const ac = document.createElement('div');
    ac.className = 'add-cell';

    const _parent = taskIndex.byId.get(task.parent);
    const canOutdent = task.parent !== null && _parent && _parent.parent !== null;
    const siblings = taskIndex.byParent.get(task.parent) || [];
    const sibIdx = siblings.indexOf(task);
    const _prevSib = sibIdx > 0 ? siblings[sibIdx - 1] : null;
    const canIndent = _prevSib !== null && Tree.getTaskDepth(tasks, _prevSib.id, taskIndex) + 1 < 5;

    const outBtn = document.createElement('div');
    outBtn.className = 'row-action-btn';
    outBtn.textContent = '←';
    outBtn.title = t('taskPanel.outdent');
    outBtn.setAttribute('aria-label', t('taskPanel.outdent'));
    outBtn.setAttribute('role', 'button');
    outBtn.setAttribute('tabindex', '0');
    if (canOutdent) {
      outBtn.onclick = e => {
        e.stopPropagation();
        outdentTask(task.id);
      };
      outBtn.onkeydown = e => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          outBtn.click();
        }
      };
    } else {
      outBtn.style.visibility = 'hidden';
      outBtn.removeAttribute('tabindex');
    }
    ac.appendChild(outBtn);

    const inBtn = document.createElement('div');
    inBtn.className = 'row-action-btn';
    inBtn.textContent = '→';
    inBtn.title = t('taskPanel.indent');
    inBtn.setAttribute('aria-label', t('taskPanel.indent'));
    inBtn.setAttribute('role', 'button');
    inBtn.setAttribute('tabindex', '0');
    if (canIndent) {
      inBtn.onclick = e => {
        e.stopPropagation();
        indentTask(task.id);
      };
      inBtn.onkeydown = e => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          inBtn.click();
        }
      };
    } else {
      inBtn.style.visibility = 'hidden';
      inBtn.removeAttribute('tabindex');
    }
    ac.appendChild(inBtn);

    const addBtn = document.createElement('div');
    addBtn.className = 'row-action-btn add';
    addBtn.textContent = '+';
    addBtn.title = t('taskPanel.addSubtask');
    addBtn.setAttribute('aria-label', t('taskPanel.addSubtask'));
    addBtn.setAttribute('role', 'button');
    addBtn.setAttribute('tabindex', '0');
    addBtn.onclick = e => {
      e.stopPropagation();
      addTaskInline(task.id);
    };
    addBtn.onkeydown = e => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        addBtn.click();
      }
    };
    ac.appendChild(addBtn);

    const delBtn = document.createElement('div');
    delBtn.className = 'row-action-btn del';
    delBtn.textContent = '✕';
    delBtn.title = t('taskPanel.deleteTask');
    delBtn.setAttribute('aria-label', t('taskPanel.deleteTask'));
    delBtn.setAttribute('role', 'button');
    delBtn.setAttribute('tabindex', '0');
    delBtn.onclick = e => {
      e.stopPropagation();
      confirmDeleteTask(task.id);
    };
    delBtn.onkeydown = e => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        delBtn.click();
      }
    };
    ac.appendChild(delBtn);

    row.appendChild(ac);

    // Click to edit (task/milestone only, skip toggle & checkbox)
    if (task.type !== 'group') {
      row.style.cursor = 'default';
    }

    // Hover sync
    row.addEventListener('mouseenter', () => highlightRow(task.id, true));
    row.addEventListener('mouseleave', () => highlightRow(task.id, false));

    // Context menu
    row.addEventListener('contextmenu', e => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, task.id);
    });

    body.appendChild(row);
  });
}
