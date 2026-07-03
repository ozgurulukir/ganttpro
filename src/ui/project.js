/* Project CRUD: switch, create, edit, delete, menu rendering. */
import { D } from '../render/deps.js';
import { esc, safeColor } from '../core/format.js';
import { parseDate, formatDate } from '../core/date.js';
import { t } from '../i18n/index.js';

let _editingProjId = null;

export function switchProject(id) {
  const { currentProjId, projects, closeProjMenuOnly, loadProject, updateReadOnly, updateProjUI, scheduleTasks, recalcProjEnd, render, scrollToToday, isSharedProject } = D;
  if (id === currentProjId) { closeProjMenuOnly(); return; }
  const proj = projects.find(p => p.id === id);
  if (!proj) return;
  loadProject(proj);
  closeProjMenuOnly();
  updateReadOnly();
  updateProjUI();
  scheduleTasks();
  recalcProjEnd();
  render();
  setTimeout(scrollToToday, 80);
}

export function updateProjUI() {
  const { projects, currentProjId, setCurrentProjId, updateReadOnly, isSharedProject } = D;
  let p = projects.find(x => x.id === currentProjId);
  if (!p) {
    const fallback = projects.find(x => !isSharedProject(x)) || projects[0];
    if (!fallback) {
      // No projects at all — clear header and show create modal
      document.getElementById('projSelectorName').textContent = t('project.noProjects');
      document.getElementById('projDot').style.background = '#999';
      renderProjMenu();
      return;
    }
    p = fallback;
    setCurrentProjId(p.id);
  }
  document.getElementById('projSelectorName').textContent = p.name;
  document.getElementById('projDot').style.background = p.color;
  document.getElementById('sPeriod').textContent = `${p.startDate} — ${p.endDate}`;
  updateReadOnly();
}

export function toggleProjMenu(e) {
  const menu = document.getElementById('projMenu');
  const sel  = document.getElementById('projSelector');
  const isOpen = menu.classList.contains('open');
  if (isOpen) { closeProjMenuOnly(); return; }
  renderProjMenu();
  menu.classList.add('open');
  sel.classList.add('open');
  // Close when clicking outside
  setTimeout(() => document.addEventListener('click', closeProjOnOutside, { once: true }), 0);
}

export function closeProjOnOutside(e) {
  if (!document.getElementById('projSelector').contains(e.target)) closeProjMenuOnly();
  else document.addEventListener('click', closeProjOnOutside, { once: true });
}

export function closeProjMenuOnly() {
  document.getElementById('projMenu').classList.remove('open');
  document.getElementById('projSelector').classList.remove('open');
}

export function renderProjMenu() {
  const { projects, currentProjId, isSharedProject } = D;
  const menu = document.getElementById('projMenu');
  menu.innerHTML = '';
  projects.forEach(p => {
    const shared = isSharedProject(p);
    const item = document.createElement('div');
    item.className = 'proj-item' + (p.id === currentProjId ? ' active' : '');
    item.innerHTML = `
      <div class="proj-item-dot" style="background:${safeColor(p.color)}"></div>
      <span class="proj-item-name">${esc(p.name)}${shared ? ' <span class="collab-shared-badge">Shared</span>' : ''}</span>
      ${!shared ? `<span class="proj-item-edit" data-action="edit-proj" data-pid="${p.id}" title="Edit project">✎</span>` : ''}
      ${!shared ? `<span class="proj-item-del" data-action="delete-proj" data-pid="${p.id}" title="Delete project">✕</span>` : ''}
    `;
    item.dataset.pid = p.id;
    menu.appendChild(item);
  });
  const div = document.createElement('div'); div.className = 'proj-menu-div';
  menu.appendChild(div);
  const add = document.createElement('div');
  add.className = 'proj-item proj-item-new';
  add.innerHTML = t('project.newProject');
  add.onclick = () => { closeProjMenuOnly(); openProjModal(); };
  menu.appendChild(add);
}

export function deleteProject(id, e) {
  const { projects, currentProjId, setProjects, resetState, closeProjMenuOnly, switchProject, saveToLS, saveToCloud, updateProjUI, renderProjMenu, render, isSharedProject } = D;
  e.stopPropagation();
  const p = projects.find(x => x.id === id);
  if (!p || isSharedProject(p)) return;
  if (!confirm(t('project.deleteConfirm', { name: p.name }))) return;
  setProjects(projects.filter(x => x.id !== id));
  closeProjMenuOnly();
  const ownedLeft = D.projects.filter(x => !isSharedProject(x));
  if (ownedLeft.length === 0) {
    // 全部刪完：重置狀態，更新 header
    resetState();
    updateProjUI();
    renderProjMenu();
    render();
    D.persist();
  } else if (id === currentProjId) {
    switchProject((ownedLeft[0] || D.projects[0]).id);
    D.persist();
  } else {
    renderProjMenu();
    D.persist();
  }
}

export function openEditProjModal(id, e) {
  const { projects } = D;
  if (e) e.stopPropagation();
  closeProjMenuOnly();
  const p = projects.find(x => x.id === id);
  if (!p) return;
  _editingProjId = id;
  document.getElementById('projModalTitle').textContent = t('project.editProject');
  document.getElementById('projSubmitBtn').textContent = t('common.save');
  document.getElementById('pName').value = p.name;
  document.getElementById('pStart').value = p.startDate;
  document.getElementById('projColorDot').style.background = p.color;
  // 隱藏範本選擇（僅建立時使用）
  const tplRow = document.getElementById('tplRow');
  if (tplRow) tplRow.style.display = 'none';
  const preview = document.getElementById('templatePreview');
  if (preview) preview.style.display = 'none';
  document.getElementById('projOverlay').classList.add('open');
  setTimeout(() => document.getElementById('pName').focus(), 50);
}

export function openProjModal() {
  const { TODAY_STR, TEMPLATES, getNextGroupColor } = D;
  _editingProjId = null;
  document.getElementById('projModalTitle').textContent = t('project.createProject');
  document.getElementById('projSubmitBtn').textContent = t('project.createBtn');
  document.getElementById('pName').value = '';
  document.getElementById('pStart').value = TODAY_STR;

  // Inject template row dynamically (handles browser HTML cache)
  if (!document.getElementById('pTemplate')) {
    const startRow = document.getElementById('pStart').closest('.form-row');
    const tplRow = document.createElement('div');
    tplRow.className = 'form-row';
    tplRow.id = 'tplRow';
    tplRow.innerHTML =
      '<label class="form-lbl">Template</label>' +
      '<select class="form-ctrl" id="pTemplate">' +
      '<option value="">— Blank Project —</option></select>';
    startRow.insertAdjacentElement('afterend', tplRow);
    const prevDiv = document.createElement('div');
    prevDiv.id = 'templatePreview';
    prevDiv.style.cssText = 'display:none;margin:4px 0 0;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;font-size:11px;color:var(--t3);line-height:1.6';
    tplRow.insertAdjacentElement('afterend', prevDiv);
  }

  // Fill template options
  const sel = document.getElementById('pTemplate');
  sel.innerHTML = `<option value="">${t('project.blankProject')}</option>` +
    TEMPLATES.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  sel.value = '';
  document.getElementById('templatePreview').style.display = 'none';
  // Preview the color that will be auto-assigned
  const nextColor = getNextGroupColor();
  document.getElementById('projColorDot').style.background = nextColor;
  const tplRow = document.getElementById('tplRow');
  if (tplRow) tplRow.style.display = '';
  document.getElementById('projOverlay').classList.add('open');
  setTimeout(() => document.getElementById('pName').focus(), 50);
}

export function onTemplateChange() {
  const { TEMPLATES, getNextGroupColor } = D;
  const val = document.getElementById('pTemplate').value;
  const preview = document.getElementById('templatePreview');
  const tpl = TEMPLATES.find(t => t.id === val);
  if (!tpl) { preview.style.display = 'none'; return; }
  // Count tasks by type
  const groups = tpl.tasks.filter(t => t.type === 'group' && t.parent !== null).length;
  const tasks  = tpl.tasks.filter(t => t.type === 'task').length;
  const miles  = tpl.tasks.filter(t => t.type === 'milestone').length;
  // List phase names (top-level groups)
  const phases = tpl.tasks.filter(t => t.type === 'group' && t.parent === 1)
    .map(t => t.name).join(' → ');
  preview.innerHTML = `<b>${t('project.template')}:</b> ${t('project.templatePreview', { groups, tasks, miles })}<br>
    <span style="color:var(--t4)">${phases}</span>`;
  preview.style.display = '';
  // Auto-fill name if empty (use short default, not full template name)
  const nameEl = document.getElementById('pName');
  if (!nameEl.value.trim()) {
    const today = new Date();
    const ym = today.toLocaleDateString('sv', { timeZone: 'Asia/Taipei' }).slice(0, 7);
    nameEl.value = (tpl.defaultName || tpl.name.split('(')[0]) + ' ' + ym;
    setTimeout(() => { nameEl.select(); }, 60);
  }
  // Update color dot to template color
  document.getElementById('projColorDot').style.background = tpl.color || getNextGroupColor();
}

export function closeProjModal(e) {
  if (!e || e.target === document.getElementById('projOverlay'))
    document.getElementById('projOverlay').classList.remove('open');
}

export function selectColor(el) {
  document.querySelectorAll('.color-opt').forEach(x => x.classList.remove('active'));
  el.classList.add('active');
}

export function submitProject() {
  const { projects, nextProjId, getOwnerId, getNextGroupColor, TEMPLATES, loadProject, setChartStart, setChartEnd, curProj, scheduleTasks, recalcProjEnd, updateProjUI, render, saveToLS, saveToCloud, currentUser } = D;
  const name = document.getElementById('pName').value.trim();
  if (!name) { document.getElementById('pName').focus(); return; }
  const start = document.getElementById('pStart').value;

  // 重複名稱提醒
  const dupName = projects.some(p => p.id !== _editingProjId && p.name === name);
  if (dupName && !confirm(t('project.duplicateName', { name }))) {
    document.getElementById('pName').focus();
    return;
  }

  // 編輯模式：更新現有專案
  if (_editingProjId !== null) {
    const p = projects.find(x => x.id === _editingProjId);
    if (p) {
      p.name = name;
      p.startDate = start;
      setChartStart(new Date(start));
      scheduleTasks();
      recalcProjEnd();
      updateProjUI();
      render();
      D.persist();
    }
    document.getElementById('projOverlay').classList.remove('open');
    _editingProjId = null;
    return;
  }

  const tplId   = document.getElementById('pTemplate').value;
  const tpl     = TEMPLATES.find(t => t.id === tplId);
  const color   = tpl ? tpl.color : getNextGroupColor();

  let projTasks, projNextId;
  if (tpl) {
    // Deep-clone template tasks, replace root group name with project name
    projTasks = JSON.parse(JSON.stringify(tpl.tasks));
    projTasks[0].name = name;
    projTasks[0].color = color;
    projNextId = Math.max(...projTasks.map(t => t.id)) + 1;
  } else {
    projTasks  = [{ id:1, name, type:'group', parent:null, color, assignee:'' }];
    projNextId = 2;
  }

  // Default end = start + 12 months for template, 3 months for blank
  const startD = new Date(start + 'T00:00:00Z');
  startD.setUTCMonth(startD.getUTCMonth() + (tpl ? 12 : 3));
  const end = startD.toISOString().slice(0, 10);

  const newProj = {
    id: nextProjId,
    name, color,
    startDate: start,
    endDate: end,
    nextId: projNextId,
    ownerId: getOwnerId(),
    tasks: projTasks
  };
  projects.push(newProj);
  D.nextProjId = nextProjId + 1;
  document.getElementById('projOverlay').classList.remove('open');
  if (curProj()) curProj().nextId = D.nextId; // 儲存舊專案的 nextId
  loadProject(newProj);
  setChartStart(new Date(start));
  setChartEnd(new Date(end));
  scheduleTasks();
  recalcProjEnd();
  updateProjUI();
  render();
  D.persist();
}
