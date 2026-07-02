/* Settings panel, zoom, stats, dark mode, baseline, versions. */
import { D } from '../render/deps.js';

export function onSettingBarDatesChange() {
  const { setShowBarDates, render } = D;
  setShowBarDates(document.getElementById('settingBarDates').checked);
  render();
}

export function onSettingBaselineChange() {
  const { setShowBaseline, render } = D;
  setShowBaseline(document.getElementById('settingBaseline').checked);
  render();
}

// 設定基準線：快照所有任務目前的日期，之後排程變動時可比對偏差
export function setBaseline() {
  const { tasks, curProj, isReadOnly, TODAY_STR, showStatus, render, saveToLS, saveToCloud, currentUser } = D;
  const p = curProj();
  if (!p || isReadOnly) return;
  const dates = {};
  tasks.forEach(t => {
    if (t.type === 'task' && t.start && t.end) dates[t.id] = { s: t.start, e: t.end };
    else if (t.type === 'milestone' && t.date) dates[t.id] = { d: t.date };
  });
  p.baseline = { setAt: TODAY_STR, dates };
  showStatus(`已設定基準線（${TODAY_STR}）`);
  render();
  saveToLS();
  if (currentUser) saveToCloud();
}

export function toggleSettings() {
  document.getElementById('settingsPanel').classList.toggle('open');
}

export function toggleExportMenu() {
  document.getElementById('exportPanel').classList.toggle('open');
}
export function closeExportMenu() {
  document.getElementById('exportPanel').classList.remove('open');
}

// Click-outside listeners (module-load wiring)
document.addEventListener('click', e => {
  const w = document.getElementById('exportWrap');
  if (w && !w.contains(e.target)) closeExportMenu();
});

export function closeSettings() {
  document.getElementById('settingsPanel').classList.remove('open');
}

document.addEventListener('click', e => {
  const wrap = document.getElementById('settingsWrap');
  if (wrap && !wrap.contains(e.target)) closeSettings();
});

export function applyZoom(factor) {
  const { CHART_START, PPD, PPDS, updateChartStart, render } = D;
  const cs = document.getElementById('chartScroll');
  // Anchor: keep the left-edge date fixed so content doesn't jump off-screen
  const leftMs = CHART_START.getTime() + cs.scrollLeft / PPD * 86400000;
  D.setPPD(Math.max(2, Math.min(80, Math.round(PPD * factor))));
  document.querySelectorAll('#viewBtns .btn').forEach(b => {
    b.classList.toggle('active', PPDS[b.dataset.v] === D.PPD);
  });
  updateChartStart(); // recompute CHART_START padding for new PPD
  render();
  requestAnimationFrame(() => {
    cs.scrollLeft = Math.max(0, (leftMs - D.CHART_START.getTime()) / 86400000 * D.PPD);
  });
}
export function zoomIn()  { applyZoom(1.4); }
export function zoomOut() { applyZoom(1 / 1.4); }

export function fitToFrame() {
  const { CHART_END, CHART_START, PPDS, updateChartStart, render } = D;
  const cs = document.getElementById('chartScroll');
  const viewW = cs.clientWidth - 4;
  const totalDays = (CHART_END - CHART_START) / 86400000 + 1;
  D.setPPD(Math.max(2, Math.min(80, viewW / totalDays)));
  document.querySelectorAll('#viewBtns .btn').forEach(b => {
    b.classList.toggle('active', PPDS[b.dataset.v] === D.PPD);
  });
  updateChartStart();
  render();
  requestAnimationFrame(() => { cs.scrollLeft = 0; });
}

export function scrollToToday() {
  const { dateToX, TODAY_STR } = D;
  const cs = document.getElementById('chartScroll');
  const x = Math.max(0, dateToX(TODAY_STR) - cs.clientWidth / 3);
  cs.scrollTo({ left: x, behavior: 'smooth' });
}

export function updateStats() {
  const { tasks } = D;
  const t = tasks.filter(x => x.type === 'task');
  const m = tasks.filter(x => x.type === 'milestone');
  document.getElementById('sDone').textContent    = t.filter(x => x.done).length;
  document.getElementById('sPending').textContent = t.filter(x => !x.done).length;
  document.getElementById('sMilestone').textContent = m.length;
}

export function toggleDark() {
  const { setIsDark } = D;
  const isDark = D.isDark;
  setIsDark(!isDark);
  document.body.classList.toggle('dark', !isDark);
  document.getElementById('darkBtn').textContent = !isDark ? '☀️' : '🌙';
}

export function curVersions() {
  const { curProj } = D;
  const p = curProj();
  if (!p.versions) p.versions = [];
  return p.versions;
}

export function openVersionPanel() {
  document.getElementById('verPanel').classList.add('open');
  document.getElementById('verBackdrop').classList.add('open');
  renderVersionList();
  setTimeout(() => document.getElementById('verNameInput').focus(), 200);
}

export function closeVersionPanel() {
  document.getElementById('verPanel').classList.remove('open');
  document.getElementById('verBackdrop').classList.remove('open');
}

export function createVersion() {
  const { tasks, render, showStatus } = D;
  const inp = document.getElementById('verNameInput');
  const name = inp.value.trim();
  if (!name) { inp.focus(); return; }
  const v = {
    id: Date.now(),
    name,
    createdAt: new Date().toISOString(),
    taskCount: tasks.filter(t => t.type === 'task').length,
    snapshot: JSON.parse(JSON.stringify(tasks))
  };
  curVersions().unshift(v);
  inp.value = '';
  renderVersionList();
  render(); // triggers save
  showStatus('✓ 版本「' + name + '」已建立');
}

export function restoreVersion(vId) {
  const { loadTasksFromSnapshot, render, showStatus } = D;
  const v = curVersions().find(v => v.id === vId);
  if (!v) return;
  if (!confirm(`還原至版本「${v.name}」？\n目前變更將被覆蓋，此操作無法復原。`)) return;
  loadTasksFromSnapshot(v.snapshot);
  render();
  closeVersionPanel();
  showStatus('✓ 已還原至「' + v.name + '」');
}

export function deleteVersion(vId) {
  const { curProj, render } = D;
  const vs = curVersions();
  const v = vs.find(v => v.id === vId);
  if (!v) return;
  if (!confirm(`刪除版本「${v.name}」？`)) return;
  curProj().versions = vs.filter(v => v.id !== vId);
  renderVersionList();
  render();
}

export function renderVersionList() {
  const el = document.getElementById('verList');
  const vs = curVersions();
  if (vs.length === 0) {
    el.innerHTML = '<div class="ver-empty">尚無版本紀錄<br>編輯完成後輸入版本名稱<br>點擊「建立版本」儲存快照</div>';
    return;
  }
  el.innerHTML = '';
  vs.forEach(v => {
    const d = new Date(v.createdAt);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const item = document.createElement('div');
    item.className = 'ver-item';
    item.innerHTML = `
      <div class="ver-item-name">${v.name}</div>
      <div class="ver-item-meta">${dateStr} · ${v.taskCount} 個任務</div>
      <div class="ver-item-actions">
        <button class="ver-btn ver-btn-restore" data-action="restore-version" data-id="${v.id}">還原此版本</button>
        <button class="ver-btn ver-btn-del" data-action="delete-version" data-id="${v.id}">刪除</button>
      </div>
    `;
    el.appendChild(item);
  });
}
