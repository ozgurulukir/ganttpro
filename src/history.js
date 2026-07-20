/* ═══════════════════════════════════════════
   UNDO HISTORY
   Pure functions for undo/redo state management.
   All state is passed in as parameters — no module-scope coupling.
═══════════════════════════════════════════ */
const MAX_HISTORY = 50;

export function getHistory(proj) {
  if (!proj) return [];
  if (!proj._history) proj._history = [];
  return proj._history;
}

export function pushHistory(state) {
  const proj = state.curProj;
  if (!proj) return;
  const h = getHistory(proj);
  h.push({
    tasks: JSON.parse(JSON.stringify(state.tasks)),
    nextId: state.nextId,
    currentProjId: state.currentProjId,
    collapsed: Array.from(state.collapsed),
    viewMode: state.viewMode,
    showCriticalPath: state.showCriticalPath,
    showWBS: state.showWBS,
    isDark: state.isDark,
    CHART_START: proj.startDate,
    CHART_END: proj.endDate,
    milestoneView: state.milestoneView,
    workloadView: state.workloadView,
    showBarDates: state.showBarDates,
    showBaseline: state.showBaseline,
    startDate: proj.startDate,
    endDate: proj.endDate,
    name: proj.name,
    color: proj.color,
    versions: proj.versions ? JSON.parse(JSON.stringify(proj.versions)) : [],
    baseline: proj.baseline ? JSON.parse(JSON.stringify(proj.baseline)) : null
  });
  if (h.length > MAX_HISTORY) h.shift();
  const btn = document.getElementById('undoBtn');
  if (btn) btn.disabled = false;
}

export function undo(state, deps) {
  const proj = state.curProj;
  const h = deps.getHistory(proj);
  if (!h.length || !proj) return;
  const snap = h.pop();

  proj.tasks.length = 0;
  proj.tasks.push(...snap.tasks);
  proj.nextId = snap.nextId;
  proj.startDate = snap.startDate;
  proj.endDate = snap.endDate;
  proj.name = snap.name;
  proj.color = snap.color;
  proj.versions = snap.versions ? JSON.parse(JSON.stringify(snap.versions)) : [];
  proj.baseline = snap.baseline ? JSON.parse(JSON.stringify(snap.baseline)) : null;

  state.nextId = proj.nextId;

  state.collapsed.clear();
  if (snap.collapsed) {
    snap.collapsed.forEach(id => state.collapsed.add(id));
  }

  if (snap.viewMode) {
    state.viewMode = snap.viewMode;
    state.PPD = state.PPDS[snap.viewMode];
    document.querySelectorAll('#viewBtns .btn').forEach(b => {
      b.classList.toggle('active', b.dataset.v === snap.viewMode);
    });
  }

  state.showCriticalPath = snap.showCriticalPath;
  state.showWBS = snap.showWBS;
  state.isDark = snap.isDark;
  state.CHART_START = new Date(snap.CHART_START);
  state.CHART_END = new Date(snap.CHART_END);
  state.milestoneView = snap.milestoneView;
  state.workloadView = snap.workloadView;
  state.showBarDates = snap.showBarDates;
  state.showBaseline = snap.showBaseline;

  // UI sync
  document.body.classList.toggle('ms-view', state.milestoneView);
  document.body.classList.toggle('show-wbs', state.showWBS);
  document.body.classList.toggle('dark', state.isDark);

  const darkBtn = document.getElementById('darkBtn');
  if (darkBtn) darkBtn.textContent = state.isDark ? '☀️' : '🌙';

  const bd = document.getElementById('settingBarDates');
  if (bd) bd.checked = state.showBarDates;
  const bl = document.getElementById('settingBaseline');
  if (bl) bl.checked = state.showBaseline;

  const cv = state.milestoneView ? 'milestone' : state.workloadView ? 'workload' : 'gantt';
  document.querySelectorAll('#chartViewBtns .btn').forEach(b => {
    b.classList.toggle('active', b.dataset.cv === cv);
  });

  const cpBtn = document.getElementById('cpBtn');
  if (cpBtn) cpBtn.classList.toggle('active', state.showCriticalPath);
  if (state.showCriticalPath) state.criticalTaskIds = deps.computeCriticalPath();
  else state.criticalTaskIds = new Set();
  const wbsBtn = document.getElementById('wbsBtn');
  if (wbsBtn) wbsBtn.classList.toggle('active', state.showWBS);

  deps.updateProjUI();
  deps.renderVersionList();

  deps.scheduleTasks();
  deps.recalcProjEnd();
  deps.render();
  const btn = document.getElementById('undoBtn');
  if (btn) btn.disabled = deps.getHistory(proj).length === 0;
}
