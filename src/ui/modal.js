/* Task editing modal: create/edit/delete tasks, inline cell editors, deps picker. */
import { D } from '../render/deps.js';
import { countWorkingDays, addWorkingDays } from '../core/calendar.js';
import { lagsFromParsed } from '../core/deps.js';

/* Modal-local state (moved from main.js — only used here). */
let editingTaskId = null;
let selectedDeps = new Set();
let depsExcludeId = null;
let selectedSdeps = new Set();
let _deleteTargetId = null;

export function populateModal(excludeId = null, checkedDeps = [], presetParent = null, isDone = false) {
  const { tasks, projects, getAllDescendants } = D;
  // Parent groups（含「無」選項；編輯時排除自己與後代避免循環）
  const sel = document.getElementById('fParent');
  sel.innerHTML = '';
  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = '— None (top level) —';
  sel.appendChild(noneOpt);
  const excludeSet = excludeId !== null ? new Set([excludeId, ...getAllDescendants(excludeId)]) : new Set();
  tasks.filter(t => t.type === 'group' && !excludeSet.has(t.id)).forEach(t => {
    const o = document.createElement('option');
    o.value = t.id;
    o.textContent = t.name;
    if (presetParent && t.id === presetParent) o.selected = true;
    sel.appendChild(o);
  });

  // Assignee suggestions（現有專案中出現過的負責人）
  const dl = document.getElementById('assigneeList');
  dl.innerHTML = '';
  [...new Set(projects.flatMap(p => p.tasks || []).map(t => t.assignee).filter(Boolean))].forEach(n => {
    const o = document.createElement('option');
    o.value = n;
    dl.appendChild(o);
  });

  // Deps picker
  depsExcludeId = excludeId;
  selectedDeps = new Set(checkedDeps);
  selectedSdeps = new Set();

  // Done checkbox
  const fd = document.getElementById('fDone');
  fd.classList.toggle('done', isDone);
  fd.textContent = isDone ? '✓' : '';
}

export function syncWday() {
  const s = document.getElementById('fStart').value;
  const e = document.getElementById('fEnd').value;
  if (s && e) document.getElementById('fWday').value = countWorkingDays(s, e);
}
export function syncEndFromWday() {
  const s = document.getElementById('fStart').value;
  const d = parseInt(document.getElementById('fWday').value);
  if (s && d >= 1) document.getElementById('fEnd').value = addWorkingDays(s, d);
}

// Wire up modal date ↔ workday sync once on page load
(function() {
  document.getElementById('fStart').addEventListener('change', syncWday);
  document.getElementById('fEnd').addEventListener('change', syncWday);
  document.getElementById('fWday').addEventListener('change', syncEndFromWday);
  document.getElementById('fWday').addEventListener('keyup', syncEndFromWday);
})();

export function updateModalForType() {
  const t = document.getElementById('fType').value;
  const isMs = t === 'milestone', isGrp = t === 'group';
  document.getElementById('rowDates').style.display = isGrp ? 'none' : '';
  document.getElementById('colEnd').style.display   = isMs ? 'none' : '';
  document.getElementById('colWday').style.display  = isMs ? 'none' : '';
  document.getElementById('lblStart').textContent   = isMs ? 'Date' : 'Start Date';
  document.getElementById('rowDone').style.display  = (isMs || isGrp) ? 'none' : 'flex';
  document.getElementById('rowDeps').style.display  = isGrp ? 'none' : '';
  document.getElementById('rowAssignee').style.display = isGrp ? 'none' : '';
}

export function setupDepsInputListener(excludeId) {
  const { parseDepInput, taskById } = D;
  const inp = document.getElementById('fDeps');
  const tip = document.getElementById('fDepsTip');
  const list = document.getElementById('fDepsList');
  if (!inp) return;

  function updateTip() {
    const val = inp.value;
    if (!val.trim()) { tip.innerHTML = ''; return; }
    const parsed = parseDepInput(val, excludeId);
    tip.innerHTML = parsed.map(p => {
      if (p.err) return `<span style="color:var(--red)">✕ ${p.raw}: ${p.err}</span>`;
      const dt = taskById(p.taskId);
      return `<span style="color:#10B981">✓ ${p.rowNum}${p.type} - ${dt ? dt.name : ''}</span>`;
    }).join('&nbsp;&nbsp;');
  }

  inp.oninput = () => { updateTip(); renderDepsDropdown(excludeId); };
  inp.onfocus = () => { renderDepsDropdown(excludeId); if (list) list.style.display = 'block'; };
  inp.onblur  = () => { setTimeout(() => { if (list) list.style.display = 'none'; }, 150); };
  updateTip();
}

export function renderDepsDropdown(excludeId) {
  const { parseDepInput, getVisibleRows } = D;
  const list = document.getElementById('fDepsList');
  const inp  = document.getElementById('fDeps');
  if (!list || !inp) return;

  const parsed = parseDepInput(inp.value, excludeId);
  const selMap = {};
  parsed.filter(p => !p.err).forEach(p => { selMap[p.rowNum] = p.type; });

  const rows = getVisibleRows().filter(({task}) =>
    task.type !== 'group' && task.id !== excludeId
  );

  if (!rows.length) { list.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--t4);text-align:center">No tasks available</div>'; return; }

  list.innerHTML = rows.map(({task}, i) => {
    const rowNum = i + 1;
    const selType = selMap[rowNum] || '';
    const isSel = !!selType;
    const typeBtns = ['FS','SS','FF','SF'].map(t =>
      `<button class="dep-type-btn${selType===t?' active':''}" data-action="add-dep" data-row="${rowNum}" data-type="${t}" data-exclude="${excludeId}">${t}</button>`
    ).join('');
    return `<div class="dep-li${isSel?' dep-sel':''}">
      <span class="dep-li-num">#${rowNum}</span>
      <span class="dep-li-name" title="${task.name}">${task.name}</span>
      <div class="dep-type-btns">${typeBtns}</div>
    </div>`;
  }).join('');
}

export function addDepToInput(rowNum, type, excludeId) {
  const { parseDepInput } = D;
  const inp = document.getElementById('fDeps');
  if (!inp) return;
  const parsed = parseDepInput(inp.value, excludeId);
  const existing = parsed.filter(p => !p.err);
  const same = existing.find(p => p.rowNum === rowNum);

  let parts;
  if (same && same.type === type) {
    // 已選且同類型 → 取消
    parts = existing.filter(p => p.rowNum !== rowNum).map(p => `${p.rowNum}${p.type}`);
  } else {
    // 新增或換類型
    const others = existing.filter(p => p.rowNum !== rowNum).map(p => `${p.rowNum}${p.type}`);
    others.push(`${rowNum}${type}`);
    parts = others;
  }

  inp.value = parts.join(', ');
  inp.dispatchEvent(new Event('input'));
  inp.focus();
}

export function openModal(unused, prefillDate) {
  const { isReadOnly, curProj, openProjModal, TODAY_STR } = D;
  if (isReadOnly) return;
  if (!curProj()) { openProjModal(); return; }
  editingTaskId = null;
  document.getElementById('modal-title').textContent = '+ Add Task';
  document.getElementById('modal-submit').textContent = 'Add Task';
  document.getElementById('fName').value = '';
  const startDate = prefillDate || TODAY_STR;
  document.getElementById('fStart').value = startDate;
  document.getElementById('fEnd').value = startDate;
  document.getElementById('fWday').value = 1;
  document.getElementById('fType').value = 'task';
  document.getElementById('fDeps').value = '';
  document.getElementById('fDepsTip').textContent = '';
  document.getElementById('fProgress').value = 0;
  document.getElementById('fAssignee').value = '';
  populateModal();
  updateModalForType();
  document.getElementById('overlay').classList.add('open');
  setupDepsInputListener(null);
  setTimeout(() => document.getElementById('fName').focus(), 50);
}

export function openNameEditor(task, cell, isNew = false) {
  const { tasks, pushHistory, recalcProjEnd, render } = D;
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'inline-input';
  inp.value = task.name;
  inp.placeholder = 'Enter task name...';
  inp.style.cssText = 'width:100%;min-width:80px';
  cell.innerHTML = '';
  cell.style.overflow = 'visible';
  cell.appendChild(inp);
  inp.focus(); inp.select();
  let committed = false;
  function commit() {
    if (committed) return; committed = true;
    const name = inp.value.trim();
    if (!isNew) pushHistory();
    task.name = name || 'New Task';
    recalcProjEnd(); render();
  }
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
    if (e.key === 'Escape') {
      committed = true;
      if (isNew) { const _f = tasks.filter(t => t.id !== task.id); tasks.length = 0; tasks.push(..._f); }
      render();
    }
  });
}

export function addTaskInline(refTaskId) {
  const { isReadOnly, tasks, taskById, TODAY_STR, pushHistory, render, consumeNextId } = D;
  if (isReadOnly) return;
  const ref = taskById(refTaskId);
  if (!ref) return;
  // Group: new task goes inside (as child); leaf task: new task goes after (as sibling)
  const parentId = ref.type === 'group' ? ref.id : ref.parent;
  const parent = taskById(parentId);
  const newTask = {
    id: consumeNextId(),
    name: 'New Task',
    type: 'task',
    parent: parentId,
    color: parent ? parent.color : ref.color || '#5E6AD2',
    wday: 1,
    start: TODAY_STR,
    end: TODAY_STR,
    done: false,
    deps: []
  };
  // Insert: after last child of group, or after ref for leaf
  let insertIdx = tasks.indexOf(ref);
  if (ref.type === 'group') {
    // Find last descendant of this group
    for (let i = insertIdx + 1; i < tasks.length; i++) {
      const anc = tasks[i];
      let p = anc.parent;
      while (p !== null && p !== undefined) {
        if (p === ref.id) { insertIdx = i; break; }
        p = taskById(p)?.parent;
      }
    }
  }
  pushHistory();
  tasks.splice(insertIdx + 1, 0, newTask);
  render();
  requestAnimationFrame(() => {
    const row = document.querySelector(`.task-row[data-id="${newTask.id}"]`);
    if (row) openNameEditor(newTask, row.querySelector('.tname'), true);
  });
}

export function openModalUnder(taskId) {
  const { isReadOnly, taskById, TODAY_STR } = D;
  if (isReadOnly) return;
  const task = taskById(taskId);
  if (!task) return;
  const parentId = task.parent;
  editingTaskId = null;
  document.getElementById('modal-title').textContent = '+ Add Task';
  document.getElementById('modal-submit').textContent = 'Add Task';
  document.getElementById('fName').value = '';
  document.getElementById('fStart').value = TODAY_STR;
  document.getElementById('fEnd').value = TODAY_STR;
  document.getElementById('fType').value = 'task';
  populateModal(null, [], parentId);
  updateModalForType();
  document.getElementById('overlay').classList.add('open');
  setTimeout(() => document.getElementById('fName').focus(), 50);
}

export function openEditModal(taskId) {
  const { isReadOnly, taskById, TODAY_STR, buildDepsText } = D;
  if (isReadOnly) return;
  const task = taskById(taskId);
  if (!task) return;
  editingTaskId = taskId;
  document.getElementById('modal-title').textContent = '✏️ Edit Task';
  document.getElementById('modal-submit').textContent = 'Save Changes';
  document.getElementById('fName').value = task.name;
  document.getElementById('fType').value = task.type;
  document.getElementById('fStart').value = task.start || task.date || TODAY_STR;
  document.getElementById('fEnd').value = task.end || task.date || TODAY_STR;
  document.getElementById('fWday').value = (task.start && task.end) ? countWorkingDays(task.start, task.end) : 1;
  document.getElementById('fProgress').value = task.done ? 100 : (task.progress || 0);
  document.getElementById('fAssignee').value = task.assignee || '';
  populateModal(taskId, task.deps || [], task.parent, task.done || false);
  selectedSdeps = new Set(task.sdeps || []);
  document.getElementById('fDeps').value = buildDepsText(task);
  document.getElementById('fDepsTip').textContent = '';
  updateModalForType();
  document.getElementById('overlay').classList.add('open');
  setupDepsInputListener(taskId);
  setTimeout(() => document.getElementById('fName').focus(), 50);
}

export function closeModal(e) {
  if (!e || e.target === document.getElementById('overlay')) {
    document.getElementById('overlay').classList.remove('open');
  }
}

export function confirmDeleteTask(id) {
  const { taskById, getAllDescendants } = D;
  const task = taskById(id);
  if (!task) return;
  _deleteTargetId = id;

  const descendants = getAllDescendants(id);
  const msg = document.getElementById('deleteModalMsg');
  if (task.type === 'group' && descendants.length > 0) {
    msg.textContent = `This group and its ${descendants.length} sub-tasks will also be deleted. This action cannot be undone.`;
  } else {
    msg.textContent = 'This action cannot be undone.';
  }

  document.getElementById('deleteConfirmBtn').onclick = () => { executeDeleteTask(_deleteTargetId); };
  document.getElementById('deleteOverlay').classList.add('open');
}

export function closeDeleteModal(e) {
  if (!e || e.target === document.getElementById('deleteOverlay')) {
    document.getElementById('deleteOverlay').classList.remove('open');
    _deleteTargetId = null;
  }
}

export function executeDeleteTask(id) {
  const { tasks, getAllDescendants, pushHistory, render, saveToLS, saveToCloud, currentUser } = D;
  document.getElementById('deleteOverlay').classList.remove('open');
  _deleteTargetId = null;
  pushHistory();
  const toDelete = new Set([id, ...getAllDescendants(id)]);
  // 清除其他任務對被刪除任務的依賴
  tasks.forEach(t => {
    if (t.deps)   t.deps   = t.deps.filter(d => !toDelete.has(d));
    if (t.sdeps)  t.sdeps  = t.sdeps.filter(d => !toDelete.has(d));
    if (t.ffdeps) t.ffdeps = t.ffdeps.filter(d => !toDelete.has(d));
    if (t.sfdeps) t.sfdeps = t.sfdeps.filter(d => !toDelete.has(d));
  });
  const _filtered = tasks.filter(t => !toDelete.has(t.id));
  tasks.length = 0;
  tasks.push(..._filtered);
  render();
  saveToLS();
  if (currentUser) saveToCloud();
}

export function submitTask() {
  const { tasks, curProj, taskById, getNextGroupColor, parseDepInput, pushHistory, render, scheduleTasks, recalcProjEnd, consumeNextId } = D;
  const name = document.getElementById('fName').value.trim();
  if (!name) { document.getElementById('fName').focus(); return; }

  const parentRaw = parseInt(document.getElementById('fParent').value);
  const parentId = Number.isNaN(parentRaw) ? null : parentRaw;
  const parent = taskById(parentId);
  const type = document.getElementById('fType').value;
  const start = document.getElementById('fStart').value;
  const end = document.getElementById('fEnd').value;
  const done = document.getElementById('fDone').classList.contains('done');

  // 解析前置任務文字輸入
  const depsRaw = document.getElementById('fDeps').value;
  const parsedDeps = parseDepInput(depsRaw, editingTaskId);
  const hasDepErr = parsedDeps.some(p => p.err);
  const newDeps   = hasDepErr ? null : [...new Set(parsedDeps.filter(p=>p.type==='FS').map(p=>p.taskId))];
  const newSdeps  = hasDepErr ? null : [...new Set(parsedDeps.filter(p=>p.type==='SS').map(p=>p.taskId))];
  const newFfdeps = hasDepErr ? null : [...new Set(parsedDeps.filter(p=>p.type==='FF').map(p=>p.taskId))];
  const newSfdeps = hasDepErr ? null : [...new Set(parsedDeps.filter(p=>p.type==='SF').map(p=>p.taskId))];

  pushHistory();
  if (editingTaskId !== null) {
    // Update existing task
    const t = taskById(editingTaskId);
    if (t) {
      t.name = name;
      t.type = type;
      t.parent = parentId;
      t.color = parent ? parent.color : t.color;
      if (!hasDepErr) {
        t.deps = newDeps; t.sdeps = newSdeps;
        if (newFfdeps.length) t.ffdeps = newFfdeps; else delete t.ffdeps;
        if (newSfdeps.length) t.sfdeps = newSfdeps; else delete t.sfdeps;
        const newLags = lagsFromParsed(parsedDeps);
        if (Object.keys(newLags).length) t.lags = newLags; else delete t.lags;
      }
      if (type === 'task') {
        t.start = start; t.end = end; t.done = done; t.pinStart = true; delete t.date;
        t.progress = done ? 100 : Math.max(0, Math.min(100, parseInt(document.getElementById('fProgress').value) || 0));
      }
      else if (type === 'milestone') { t.date = start; t.pinStart = true; delete t.start; delete t.end; }
      else { delete t.date; delete t.start; delete t.end; delete t.pinStart; }
      const asg = document.getElementById('fAssignee').value.trim();
      if (type !== 'group' && asg) t.assignee = asg; else delete t.assignee;
    }
  } else {
    // Add new task
    const autoColor = type === 'group' ? getNextGroupColor() : (parent ? parent.color : '#5E6AD2');
    const t = { id: consumeNextId(), name, type, parent: parentId, color: autoColor,
                deps: newDeps||[], sdeps: newSdeps||[] };
    if (newFfdeps?.length) t.ffdeps = newFfdeps;
    if (newSfdeps?.length) t.sfdeps = newSfdeps;
    if (!hasDepErr) {
      const newLags = lagsFromParsed(parsedDeps);
      if (Object.keys(newLags).length) t.lags = newLags;
    }
    if (type === 'task') {
      t.start = start; t.end = end; t.done = done; t.pinStart = true;
      t.progress = done ? 100 : Math.max(0, Math.min(100, parseInt(document.getElementById('fProgress').value) || 0));
    }
    else if (type === 'milestone') { t.date = start; t.pinStart = true; }
    const asg = document.getElementById('fAssignee').value.trim();
    if (type !== 'group' && asg) t.assignee = asg;
    tasks.push(t);
  }

  editingTaskId = null;
  document.getElementById('overlay').classList.remove('open');
  scheduleTasks();
  recalcProjEnd();
  render();
}

export function openDateEditor(task, field, cell) {
  const { recalcProjEnd, render } = D;
  const inp = document.createElement('input');
  inp.type = 'date';
  inp.className = 'inline-input';
  inp.value = field === 'start' ? (task.start || '') : (task.end || '');
  cell.innerHTML = '';
  cell.appendChild(inp);
  inp.focus();
  function commit() {
    if (!inp.value) { render(); return; }
    if (field === 'start') {
      task.start = inp.value;
      if (task.end && task.end < task.start) task.end = task.start;
    } else {
      task.end = inp.value;
      if (task.start && task.start >= task.end) task.start = task.end; // keep start behind end
    }
    recalcProjEnd(); render();
  }
  inp.addEventListener('change', commit);
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', e => { if (e.key === 'Escape') render(); });
}

export function openStartEditor(task, cell) {
  const { pushHistory, scheduleTasks, recalcProjEnd, render, saveToLS, saveToCloud, currentUser } = D;
  const inp = document.createElement('input');
  inp.type = 'date';
  inp.className = 'inline-input';
  inp.value = task.start || '';
  cell.innerHTML = '';
  cell.appendChild(inp);
  inp.focus();
  try { inp.showPicker(); } catch(e) {}
  function commit() {
    const val = inp.value;
    if (val && val !== task.start) {
      pushHistory();
      if (val > (task.end || '')) task.end = val;
      task.wday = countWorkingDays(val, task.end);
      task.start = val;
      task.pinStart = true;
    }
    scheduleTasks();
    recalcProjEnd();
    render();
    saveToLS();
    if (currentUser) saveToCloud();
  }
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { render(); } });
}

export function openEndEditor(task, cell) {
  const { pushHistory, scheduleTasks, recalcProjEnd, render, saveToLS, saveToCloud, currentUser } = D;
  const inp = document.createElement('input');
  inp.type = 'date';
  inp.className = 'inline-input';
  inp.value = task.end || '';
  cell.innerHTML = '';
  cell.appendChild(inp);
  inp.focus();
  try { inp.showPicker(); } catch(e) {}
  function commit() {
    const val = inp.value;
    if (val && val !== task.end) {
      pushHistory();
      if (val < (task.start || '')) { task.start = val; task.wday = 1; }
      else { task.wday = countWorkingDays(task.start, val); }
      task.end = val;
      task.pinStart = true;
    }
    scheduleTasks();
    recalcProjEnd();
    render();
    saveToLS();
    if (currentUser) saveToCloud();
  }
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') render(); });
}

export function openWdayEditor(task, cell) {
  const { pushHistory, scheduleTasks, recalcProjEnd, render } = D;
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.min = '1';
  inp.className = 'inline-input';
  inp.style.textAlign = 'center';
  inp.value = task.start && task.end ? countWorkingDays(task.start, task.end) : 1;
  cell.innerHTML = '';
  cell.appendChild(inp);
  inp.focus(); inp.select();
  function commit() {
    const days = parseInt(inp.value);
    if (!isNaN(days) && days >= 1) {
      pushHistory();
      task.wday = days;
      scheduleTasks();
      recalcProjEnd(); render();
    } else { render(); }
  }
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') render(); });
}

/* ── DEPS PICKER LOGIC ── */
export function toggleDepsMenu(e) {
  const { isReadOnly } = D;
  if (isReadOnly) return;
  if (e && e.target.closest('.deps-tag-x')) return;
  const menu = document.getElementById('depsMenu');
  if (menu.classList.contains('open')) {
    menu.classList.remove('open');
  } else {
    renderDepsMenu();
    menu.classList.add('open');
    setTimeout(() => document.addEventListener('click', closeDepsOutside, { once: true }), 0);
  }
}

export function closeDepsOutside(e) {
  if (!document.getElementById('depsPicker').contains(e.target)) {
    document.getElementById('depsMenu').classList.remove('open');
  } else {
    document.addEventListener('click', closeDepsOutside, { once: true });
  }
}

export function toggleDepOpt(id) {
  if (selectedDeps.has(id)) selectedDeps.delete(id);
  else selectedDeps.add(id);
  renderDepsMenu();
}

export function removeDepTag(id) {
  selectedDeps.delete(id);
}

export function updateDepsTags() { /* 已由 fDeps 文字輸入取代 */ }

export function renderDepsMenu() {
  const { tasks, taskById } = D;
  const menu = document.getElementById('depsMenu');
  menu.innerHTML = '';
  const editingTask = taskById(depsExcludeId);
  const editingParent = editingTask ? editingTask.parent : null;
  const list = tasks.filter(t =>
    t.type !== 'milestone' &&
    t.parent !== null &&
    t.id !== depsExcludeId
  );
  if (list.length === 0) {
    menu.innerHTML = '<div style="padding:10px;text-align:center;font-size:12px;color:var(--t4)">No dependencies available</div>';
    return;
  }
  list.forEach(t => {
    const opt = document.createElement('div');
    opt.className = 'deps-opt' + (selectedDeps.has(t.id) ? ' sel' : '');
    opt.innerHTML = `
      <span class="deps-opt-num">#${t.id}</span>
      <span class="cdot" style="background:${t.color}"></span>
      <span>${t.name}</span>
      <span class="deps-opt-check">${selectedDeps.has(t.id) ? '✓' : ''}</span>
    `;
    opt.addEventListener('click', () => toggleDepOpt(t.id));
    menu.appendChild(opt);
  });
}

export function openDepsEditor(task, cell) { openAllDepsEditor(task, cell); }

export function openAllDepsEditor(task, cell) {
  const { parseDepInput, taskById, buildDepsText, pushHistory, scheduleTasks, recalcProjEnd, render, saveToLS, saveToCloud, currentUser } = D;
  const wrap = document.createElement('div');
  wrap.className = 'deps-edit-wrap';

  const inp = document.createElement('input');
  inp.className = 'deps-input';
  inp.placeholder = 'e.g. 2FS, 3SS, 2FS+3';
  inp.value = buildDepsText(task);
  wrap.appendChild(inp);

  cell.innerHTML = '';
  cell.appendChild(wrap);

  // Tooltip 掛在 body，避免被 overflow:hidden 裁切
  const tip = document.createElement('div');
  tip.className = 'deps-tip';
  tip.style.display = 'none';
  tip.style.position = 'fixed';
  document.body.appendChild(tip);

  function positionTip() {
    const r = wrap.getBoundingClientRect();
    tip.style.left = r.left + 'px';
    tip.style.top  = (r.bottom + 6) + 'px';
    tip.style.minWidth = Math.max(r.width, 200) + 'px';
  }

  function updateTip(v) {
    if (!v.trim()) { tip.style.display = 'none'; return; }
    const parsed = parseDepInput(v, task.id);
    if (!parsed.length) { tip.style.display = 'none'; return; }
    const rows = parsed.map(p => {
      if (p.err) return `<div><span style="color:#A5B4FC;font-weight:600;display:inline-block;min-width:44px">${p.raw}</span> <span style="color:#FCA5A5">✕ ${p.err}</span></div>`;
      const dt = taskById(p.taskId);
      return `<div><span style="color:#A5B4FC;font-weight:600;display:inline-block;min-width:44px">${p.rowNum}${p.type}</span> <span style="color:#6EE7B7">✓ ${dt ? dt.name : ''} · ${p.type}</span></div>`;
    });
    rows.push('<div style="margin-top:4px;color:#9CA3AF;font-size:10px">Enter to confirm &nbsp; Esc to cancel</div>');
    tip.innerHTML = rows.join('');
    positionTip();
    tip.style.display = 'block';
  }

  inp.addEventListener('input', () => updateTip(inp.value));
  updateTip(inp.value);

  let committed = false;
  function commit() {
    if (committed) return; committed = true;
    const parsed = parseDepInput(inp.value, task.id);
    const hasErr = parsed.some(p => p.err);
    if (!hasErr) {
      pushHistory();
      task.deps   = [...new Set(parsed.filter(p => p.type === 'FS').map(p => p.taskId))];
      task.sdeps  = [...new Set(parsed.filter(p => p.type === 'SS').map(p => p.taskId))];
      task.ffdeps = [...new Set(parsed.filter(p => p.type === 'FF').map(p => p.taskId))];
      task.sfdeps = [...new Set(parsed.filter(p => p.type === 'SF').map(p => p.taskId))];
      const newLags = lagsFromParsed(parsed);
      if (Object.keys(newLags).length) task.lags = newLags; else delete task.lags;
      scheduleTasks();
      recalcProjEnd();
    }
    tip.remove();
    render();
    saveToLS();
    if (currentUser) saveToCloud();
  }

  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
    if (e.key === 'Escape') { committed = true; tip.remove(); render(); }
  });

  setTimeout(() => { inp.focus(); inp.select(); }, 30);
}
