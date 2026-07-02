import { getHoliday, isNonWorkday, subtractWorkingDays, addWorkingDays, nextWorkingDay, shiftWorkingDays, countWorkingDays } from "./core/calendar.js";
import * as Tree from "./core/tree.js";
import * as Deps from "./core/deps.js";
import * as CPM from "./core/critical-path.js";
import * as Schedule from "./core/schedule.js";
import * as Format from "./core/format.js";
import { D } from "./render/deps.js";
import { highlightRow, getPredIds, getSuccIds, highlightDeps, showTT, moveTT, hideTT } from "./render/tooltip.js";
import { computeWorkload, renderWorkloadPanel, renderWorkloadChart } from "./render/workload.js";
import { renderGrid } from "./render/grid.js";
import { renderBar, renderGroupBar, attachBarDrag, getWorkingSegs } from "./render/bar.js";
import { renderMilestone, renderMilestoneTimeline } from "./render/milestone.js";
import { renderArrows } from "./render/arrows.js";
import { renderChartHeader } from "./render/chart-header.js";
import { renderChartBody } from "./render/chart-body.js";
import { renderTaskPanel } from "./render/task-panel.js";
import {
  populateModal, syncWday, syncEndFromWday, updateModalForType,
  setupDepsInputListener, renderDepsDropdown, addDepToInput,
  openModal, openModalUnder, openEditModal, closeModal,
  openNameEditor, openDateEditor, openStartEditor, openEndEditor, openWdayEditor,
  addTaskInline, confirmDeleteTask, closeDeleteModal, executeDeleteTask,
  submitTask, toggleDepsMenu, closeDepsOutside, toggleDepOpt, removeDepTag,
  updateDepsTags, renderDepsMenu, openDepsEditor, openAllDepsEditor,
} from "./ui/modal.js";
import {
  switchProject, updateProjUI, toggleProjMenu, closeProjOnOutside,
  closeProjMenuOnly, renderProjMenu, deleteProject, openEditProjModal,
  openProjModal, onTemplateChange, closeProjModal, selectColor, submitProject,
} from "./ui/project.js";
import {
  onSettingBarDatesChange, onSettingBaselineChange, setBaseline,
  toggleSettings, toggleExportMenu, closeExportMenu, closeSettings,
  applyZoom, zoomIn, zoomOut, fitToFrame, scrollToToday,
  updateStats, toggleDark,
  curVersions, openVersionPanel, closeVersionPanel,
  createVersion, restoreVersion, deleteVersion, renderVersionList,
} from "./ui/settings.js";
import { setupSync, applyColGrid, setupColResizers, setupResizer } from "./interactions.js";
import { auth, googleProvider } from "./data/firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import * as Local from "./data/local.js";
import * as Share from "./data/share.js";
import * as Remote from "./data/remote.js";
/* ═══════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════ */
let CHART_START = new Date('2026-04-01');
let CHART_END   = new Date('2026-07-31');
const TODAY_STR = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Taipei' });
const TODAY     = new Date(TODAY_STR);
document.getElementById('sTodayDisplay').textContent = TODAY_STR;
const ROW_H       = 36;
const BAR_H       = 20;

const PPDS = { day: 36, week: 20, month: 8 };
let PPD = PPDS.week;
let viewMode = 'week';
let milestoneView = false;
let workloadView = false;
let showBarDates = true;
const MS_ROW_H = 160;

const AV_COLORS = {
  'Paul':     '#5E6AD2',
  '王小明':   '#10B981',
  '李美華':   '#F59E0B',
  '陳設計':   '#EC4899',
  '張後端':   '#3B82F6',
  '林前端':   '#8B5CF6',
  '吳 AI':    '#EF4444',
  '測試工程師':'#6B7280',
  '維運團隊': '#D97706',
};

// 群組色盤：10 個視覺清晰的色彩，依序分配
const GROUP_PALETTE = [
  '#5E6AD2', // indigo
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#3B82F6', // blue
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
  '#84CC16', // lime
];

function getNextGroupColor() {
  // Collect all group colors used across all projects
  const used = new Set(
    projects.flatMap(p => p.tasks.filter(t => t.type === 'group').map(t => t.color))
  );
  // Pick first palette color not yet used
  const pick = GROUP_PALETTE.find(c => !used.has(c));
  if (pick) return pick;
  // All used → cycle by count of existing groups
  const total = projects.reduce((s, p) => s + p.tasks.filter(t => t.type === 'group').length, 0);
  return GROUP_PALETTE[total % GROUP_PALETTE.length];
}

/* ═══════════════════════════════════════════
   PROJECT TEMPLATES
═══════════════════════════════════════════ */
const TEMPLATES = [
  {
    id: 'hardware',
    name: '硬體產品開發與量產標準流程',
    defaultName: '硬體產品開發計畫',
    color: '#0EA5E9',
    tasks: [
      { id:1,  name:'{{PROJECT_NAME}}',      type:'group',     parent:null, color:'#0EA5E9' },

      { id:2,  name:'需求定義',              type:'group',     parent:1,  color:'#818CF8' },
      { id:3,  name:'市場需求調研',          type:'task',      parent:2,  color:'#818CF8', wday:10, deps:[],    done:false, start:'', end:'' },
      { id:4,  name:'產品規格制定',          type:'task',      parent:2,  color:'#818CF8', wday:8,  deps:[3],   done:false, start:'', end:'' },
      { id:5,  name:'競品分析',              type:'task',      parent:2,  color:'#818CF8', wday:5,  deps:[],    done:false, start:'', end:'' },
      { id:6,  name:'規格凍結',              type:'milestone', parent:2,  color:'#5E6AD2',          deps:[4],   date:'' },

      { id:7,  name:'概念設計',              type:'group',     parent:1,  color:'#60A5FA' },
      { id:8,  name:'系統架構設計',          type:'task',      parent:7,  color:'#60A5FA', wday:10, deps:[6],   done:false, start:'', end:'' },
      { id:9,  name:'硬體概念設計',          type:'task',      parent:7,  color:'#60A5FA', wday:8,  deps:[8],   done:false, start:'', end:'' },
      { id:10, name:'外觀設計',              type:'task',      parent:7,  color:'#60A5FA', wday:8,  deps:[8],   done:false, start:'', end:'' },
      { id:11, name:'CDR 概念設計審查',      type:'milestone', parent:7,  color:'#3B82F6',          deps:[9,10],date:'' },

      { id:12, name:'詳細設計',              type:'group',     parent:1,  color:'#34D399' },
      { id:13, name:'電路圖設計',            type:'task',      parent:12, color:'#34D399', wday:15, deps:[11],  done:false, start:'', end:'' },
      { id:14, name:'PCB Layout',            type:'task',      parent:12, color:'#34D399', wday:12, deps:[13],  done:false, start:'', end:'' },
      { id:15, name:'結構件設計',            type:'task',      parent:12, color:'#34D399', wday:12, deps:[11],  done:false, start:'', end:'' },
      { id:16, name:'韌體開發',              type:'task',      parent:12, color:'#34D399', wday:20, deps:[13],  done:false, start:'', end:'' },
      { id:17, name:'PDR 詳細設計審查',      type:'milestone', parent:12, color:'#10B981',          deps:[14,15],date:'' },

      { id:18, name:'EVT 原型製作',          type:'group',     parent:1,  color:'#FBBF24' },
      { id:19, name:'PCB 打樣',              type:'task',      parent:18, color:'#FBBF24', wday:10, deps:[17],  done:false, start:'', end:'' },
      { id:20, name:'結構件打樣',            type:'task',      parent:18, color:'#FBBF24', wday:10, deps:[17],  done:false, start:'', end:'' },
      { id:21, name:'原型組裝與調試',        type:'task',      parent:18, color:'#FBBF24', wday:5,  deps:[19,20],done:false,start:'', end:'' },
      { id:22, name:'EVT 原型完成',          type:'milestone', parent:18, color:'#F59E0B',          deps:[21],  date:'' },

      { id:23, name:'DVT 驗證測試',          type:'group',     parent:1,  color:'#F87171' },
      { id:24, name:'功能測試',              type:'task',      parent:23, color:'#F87171', wday:10, deps:[22],  done:false, start:'', end:'' },
      { id:25, name:'環境壓力測試',          type:'task',      parent:23, color:'#F87171', wday:10, deps:[22],  done:false, start:'', end:'' },
      { id:26, name:'安規認證',              type:'task',      parent:23, color:'#F87171', wday:15, deps:[24],  done:false, start:'', end:'' },
      { id:27, name:'問題修改改版',          type:'task',      parent:23, color:'#F87171', wday:10, deps:[24,25],done:false,start:'', end:'' },
      { id:28, name:'DVT 驗證完成',          type:'milestone', parent:23, color:'#EF4444',          deps:[26,27],date:'' },

      { id:29, name:'PVT 量產準備',          type:'group',     parent:1,  color:'#A78BFA' },
      { id:30, name:'供應商確認',            type:'task',      parent:29, color:'#A78BFA', wday:10, deps:[28],  done:false, start:'', end:'' },
      { id:31, name:'生產工程設計',          type:'task',      parent:29, color:'#A78BFA', wday:10, deps:[28],  done:false, start:'', end:'' },
      { id:32, name:'試量產',                type:'task',      parent:29, color:'#A78BFA', wday:15, deps:[30,31],done:false,start:'', end:'' },
      { id:33, name:'PVT 量產準備完成',      type:'milestone', parent:29, color:'#8B5CF6',          deps:[32],  date:'' },

      { id:34, name:'MP 量產導入',           type:'group',     parent:1,  color:'#10B981' },
      { id:35, name:'正式量產',              type:'task',      parent:34, color:'#10B981', wday:20, deps:[33],  done:false, start:'', end:'' },
      { id:36, name:'品質監控',              type:'task',      parent:34, color:'#10B981', wday:15, deps:[35],  done:false, start:'', end:'' },
      { id:37, name:'MP 正式出貨',           type:'milestone', parent:34, color:'#059669',          deps:[35],  date:'' },
    ]
  }
];

/* ═══════════════════════════════════════════
   PROJECTS DATA
═══════════════════════════════════════════ */
let projects = [
  {
    id: 2,
    name: '硬體產品開發與量產標準流程',
    color: '#0EA5E9',
    startDate: '2026-05-04',
    endDate: '2027-03-31',
    nextId: 38,
    tasks: [
      { id:1,  name:'硬體產品開發與量產標準流程', type:'group', parent:null, color:'#0EA5E9' },

      { id:2,  name:'需求定義',           type:'group',     parent:1,  color:'#818CF8' },
      { id:3,  name:'市場需求調研',       type:'task',      parent:2,  color:'#818CF8', wday:10, deps:[],    done:false, start:'', end:'' },
      { id:4,  name:'產品規格制定',       type:'task',      parent:2,  color:'#818CF8', wday:8,  deps:[3],   done:false, start:'', end:'' },
      { id:5,  name:'競品分析',           type:'task',      parent:2,  color:'#818CF8', wday:5,  deps:[],    done:false, start:'', end:'' },
      { id:6,  name:'規格凍結',           type:'milestone', parent:2,  color:'#5E6AD2',          deps:[4],   date:'' },

      { id:7,  name:'概念設計',           type:'group',     parent:1,  color:'#60A5FA' },
      { id:8,  name:'系統架構設計',       type:'task',      parent:7,  color:'#60A5FA', wday:10, deps:[6],   done:false, start:'', end:'' },
      { id:9,  name:'硬體概念設計',       type:'task',      parent:7,  color:'#60A5FA', wday:8,  deps:[8],   done:false, start:'', end:'' },
      { id:10, name:'外觀設計',           type:'task',      parent:7,  color:'#60A5FA', wday:8,  deps:[8],   done:false, start:'', end:'' },
      { id:11, name:'CDR 概念設計審查',   type:'milestone', parent:7,  color:'#3B82F6',          deps:[9,10],date:'' },

      { id:12, name:'詳細設計',           type:'group',     parent:1,  color:'#34D399' },
      { id:13, name:'電路圖設計',         type:'task',      parent:12, color:'#34D399', wday:15, deps:[11],  done:false, start:'', end:'' },
      { id:14, name:'PCB Layout',         type:'task',      parent:12, color:'#34D399', wday:12, deps:[13],  done:false, start:'', end:'' },
      { id:15, name:'結構件設計',         type:'task',      parent:12, color:'#34D399', wday:12, deps:[11],  done:false, start:'', end:'' },
      { id:16, name:'韌體開發',           type:'task',      parent:12, color:'#34D399', wday:20, deps:[13],  done:false, start:'', end:'' },
      { id:17, name:'PDR 詳細設計審查',   type:'milestone', parent:12, color:'#10B981',          deps:[14,15],date:'' },

      { id:18, name:'EVT 原型製作',       type:'group',     parent:1,  color:'#FBBF24' },
      { id:19, name:'PCB 打樣',           type:'task',      parent:18, color:'#FBBF24', wday:10, deps:[17],  done:false, start:'', end:'' },
      { id:20, name:'結構件打樣',         type:'task',      parent:18, color:'#FBBF24', wday:10, deps:[17],  done:false, start:'', end:'' },
      { id:21, name:'原型組裝與調試',     type:'task',      parent:18, color:'#FBBF24', wday:5,  deps:[19,20],done:false,start:'', end:'' },
      { id:22, name:'EVT 原型完成',       type:'milestone', parent:18, color:'#F59E0B',          deps:[21],  date:'' },

      { id:23, name:'DVT 驗證測試',       type:'group',     parent:1,  color:'#F87171' },
      { id:24, name:'功能測試',           type:'task',      parent:23, color:'#F87171', wday:10, deps:[22],  done:false, start:'', end:'' },
      { id:25, name:'環境壓力測試',       type:'task',      parent:23, color:'#F87171', wday:10, deps:[22],  done:false, start:'', end:'' },
      { id:26, name:'安規認證',           type:'task',      parent:23, color:'#F87171', wday:15, deps:[24],  done:false, start:'', end:'' },
      { id:27, name:'問題修改改版',       type:'task',      parent:23, color:'#F87171', wday:10, deps:[24,25],done:false,start:'', end:'' },
      { id:28, name:'DVT 驗證完成',       type:'milestone', parent:23, color:'#EF4444',          deps:[26,27],date:'' },

      { id:29, name:'PVT 量產準備',       type:'group',     parent:1,  color:'#A78BFA' },
      { id:30, name:'供應商確認',         type:'task',      parent:29, color:'#A78BFA', wday:10, deps:[28],  done:false, start:'', end:'' },
      { id:31, name:'生產工程設計',       type:'task',      parent:29, color:'#A78BFA', wday:10, deps:[28],  done:false, start:'', end:'' },
      { id:32, name:'試量產',             type:'task',      parent:29, color:'#A78BFA', wday:15, deps:[30,31],done:false,start:'', end:'' },
      { id:33, name:'PVT 量產準備完成',   type:'milestone', parent:29, color:'#8B5CF6',          deps:[32],  date:'' },

      { id:34, name:'MP 量產導入',        type:'group',     parent:1,  color:'#10B981' },
      { id:35, name:'正式量產',           type:'task',      parent:34, color:'#10B981', wday:20, deps:[33],  done:false, start:'', end:'' },
      { id:36, name:'品質監控',           type:'task',      parent:34, color:'#10B981', wday:15, deps:[35],  done:false, start:'', end:'' },
      { id:37, name:'MP 正式出貨',        type:'milestone', parent:34, color:'#059669',          deps:[35],  date:'' },
    ]
  }
];
let currentProjId = 1;
let nextProjId    = 3;

// SSOT INVARIANT: tasks must always reference the same array as curProj().tasks.
// Mutate in-place (push/splice/length=0); NEVER reassign (tasks = newArray breaks the link).
// On project switch/load: tasks = curProj().tasks (sync FROM project).
let tasks  = projects[0].tasks;
let nextId = projects[0].nextId;

function curProj() { return projects.find(p => p.id === currentProjId); }

/* ═══════════════════════════════════════════
   STATE
═══════════════════════════════════════════ */
let collapsed = new Set();
let isDark = false;

/* ─── UNDO HISTORY ─── */
const MAX_HISTORY = 50;
let _history = [];

function pushHistory() {
  _history.push({ tasks: JSON.parse(JSON.stringify(tasks)), nextId });
  if (_history.length > MAX_HISTORY) _history.shift();
  const btn = document.getElementById('undoBtn');
  if (btn) btn.disabled = false;
}

function undo() {
  if (!_history.length) return;
  const snap = _history.pop();
  curProj().tasks = snap.tasks;
  curProj().nextId = snap.nextId;
  tasks = curProj().tasks;
  nextId = curProj().nextId;
  scheduleTasks();
  recalcProjEnd();
  render();
  const btn = document.getElementById('undoBtn');
  if (btn) btn.disabled = _history.length === 0;
}

/* ═══════════════════════════════════════════
   UTILS
═══════════════════════════════════════════ */
/* format adapters: pure logic in core/format.js; bind global config. */
function dateToX(str) { return Format.dateToX(str, CHART_START, PPD); }
function avColor(name) { return Format.avColor(name, AV_COLORS); }
const { toStr, initials, darkenColor, hexToRgba } = Format;

function totalW() {
  return Math.round(((CHART_END - CHART_START) / 86400000 + 1) * PPD);
}

/* tree-query adapters: pure logic in core/tree.js; bind global state.
   Removed when state.js lands (Phase 2.x). */
const { getTreeLines } = Tree;
function taskById(id) { return Tree.taskById(tasks, id); }
function hasMilestoneDescendant(id) { return Tree.hasMilestoneDescendant(tasks, id); }
function getRowNum(taskId) { return Tree.getRowNum(tasks, collapsed, milestoneView, taskId); }
function getTaskByRowNum(num) { return Tree.getTaskByRowNum(tasks, collapsed, milestoneView, num); }
function getVisibleRows() { return Tree.getVisibleRows(tasks, collapsed, milestoneView); }
function groupAllDone(id) { return Tree.groupAllDone(tasks, id); }
function groupBounds(id) { return Tree.groupBounds(tasks, id); }
function groupProgress(id) { return Tree.groupProgress(tasks, id); }
function getAllDescendants(id) { return Tree.getAllDescendants(tasks, id); }
function isDescendant(ancestorId, checkId) { return Tree.isDescendant(tasks, ancestorId, checkId); }
function getTaskDepth(id) { return Tree.getTaskDepth(tasks, id); }

function toggleCollapse(id) {
  if (collapsed.has(id)) collapsed.delete(id);
  else collapsed.add(id);
  render();
}

function expandAll() {
  collapsed.clear();
  render();
}

function collapseAll() {
  tasks.filter(t => tasks.some(c => c.parent === t.id)).forEach(t => collapsed.add(t.id));
  render();
}

/* ═══════════════════════════════════════════
   VIEW MODE
═══════════════════════════════════════════ */
function setView(v) {
  viewMode = v;
  PPD = PPDS[v];
  document.querySelectorAll('#viewBtns .btn').forEach(b => {
    b.classList.toggle('active', b.dataset.v === v);
  });
  updateChartStart();
  render();
}

/* ── WORKLOAD VIEW (extracted to src/render/workload.js) ── */

function setChartView(v) {
  milestoneView = v === 'milestone';
  workloadView = v === 'workload';
  document.querySelectorAll('#chartViewBtns .btn').forEach(b => {
    b.classList.toggle('active', b.dataset.cv === v);
  });
  document.body.classList.toggle('ms-view', milestoneView);
  render();
}

function toggleBarDates() {
  showBarDates = !showBarDates;
  render();
}

/* ── CRITICAL PATH ── */
let showCriticalPath = false;
let criticalTaskIds = new Set();

/* critical-path adapters: pure logic in core/critical-path.js; bind global state. */
const { prevWorkingDay } = CPM;
function computeCriticalPath() { return CPM.computeCriticalPath(tasks); }
function getCriticalPredTaskIds(task) { return CPM.getCriticalPredTaskIds(tasks, criticalTaskIds, task); }

function toggleCriticalPath() {
  showCriticalPath = !showCriticalPath;
  document.getElementById('cpBtn').classList.toggle('active', showCriticalPath);
  if (showCriticalPath) criticalTaskIds = computeCriticalPath();
  else criticalTaskIds = new Set();
  render();
}

function exportPNG() {
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
  ctx.fillText(`匯出日期：${TODAY_STR}　任務數：${rows.filter(r=>r.task.type==='task').length}　里程碑：${rows.filter(r=>r.task.type==='milestone').length}`, 10, HDR / 2 + 10);

  // ─── 表頭列 ───
  ctx.fillStyle = '#F9FAFB';
  ctx.fillRect(0, HDR, totalWpx, THDR);
  ctx.fillStyle = '#6B7280';
  ctx.font = '600 10px -apple-system,system-ui,sans-serif';
  [['#',8],['任務名稱',28],['開始日期',240],['結束日期',310],['工作日',380]].forEach(([t,x])=>{
    ctx.fillText(t, x, HDR + THDR/2);
  });
  // Gantt header: month labels
  let dm = new Date(CHART_START.getFullYear(), CHART_START.getMonth(), 1);
  while (dm <= CHART_END) {
    const mx = PANEL + dateToX(dm.toISOString().slice(0,10));
    if (mx >= PANEL) {
      ctx.fillStyle = '#374151';
      ctx.font = '10px -apple-system,system-ui,sans-serif';
      ctx.fillText(`${dm.getFullYear()} ${dm.getMonth()+1}月`, mx+3, HDR + THDR/2);
    }
    dm.setMonth(dm.getMonth()+1);
  }

  // ─── 垂直格線（月） ───
  ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 0.5;
  let dg = new Date(CHART_START.getFullYear(), CHART_START.getMonth(), 1);
  while (dg <= CHART_END) {
    const gx = PANEL + dateToX(dg.toISOString().slice(0,10));
    if (gx >= PANEL) {
      ctx.beginPath(); ctx.moveTo(gx, HDR); ctx.lineTo(gx, totalH); ctx.stroke();
    }
    dg.setMonth(dg.getMonth()+1);
  }

  // ─── 今日線 ───
  const todayX = PANEL + dateToX(TODAY_STR);
  if (todayX >= PANEL && todayX <= totalWpx) {
    ctx.strokeStyle = '#EF4444'; ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(todayX, HDR); ctx.lineTo(todayX, totalH); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('今日', todayX+2, HDR+6);
  }

  // ─── 任務列 ───
  rows.forEach(({task, depth}, i) => {
    const y = HDR + THDR + i * ROW_H;

    // 列背景（里程碑模式：右側為單一時間軸，不畫列底紋）
    ctx.fillStyle = task.type === 'group' ? '#F9FAFB' : (i%2===0 ? '#FFFFFF' : '#FAFAFA');
    ctx.fillRect(0, y, PANEL, ROW_H);
    if (!msMode) {
      ctx.fillStyle = i%2===0 ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,.012)';
      ctx.fillRect(PANEL, y, tw, ROW_H);
    }

    // 列分隔線
    ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, y+ROW_H); ctx.lineTo(msMode ? PANEL : totalWpx, y+ROW_H); ctx.stroke();

    // 列號
    ctx.fillStyle = '#9CA3AF'; ctx.font = '10px sans-serif';
    ctx.fillText(i+1, 8, y+ROW_H/2);

    // 色點
    const indent = depth * 10;
    ctx.fillStyle = task.color || '#5E6AD2';
    ctx.beginPath(); ctx.arc(22+indent, y+ROW_H/2, 4, 0, Math.PI*2); ctx.fill();

    // 任務名稱
    ctx.fillStyle = task.type === 'group' ? '#111827' : '#374151';
    ctx.font = task.type === 'group' ? 'bold 12px sans-serif' : '12px sans-serif';
    let name = task.name;
    const maxNW = 200 - indent;
    while (ctx.measureText(name).width > maxNW && name.length > 1) name = name.slice(0,-1);
    if (name !== task.name) name += '…';
    ctx.fillText(name, 32+indent, y+ROW_H/2);

    // 日期欄
    if (task.type === 'task' || task.type === 'milestone') {
      ctx.fillStyle = '#6B7280'; ctx.font = '10.5px sans-serif';
      const s = task.start || task.date || '';
      const e = task.end   || task.date || '';
      ctx.fillText(s.replace(/^\d{4}-/,'').replace('-','/'), 240, y+ROW_H/2);
      ctx.fillText(e.replace(/^\d{4}-/,'').replace('-','/'), 310, y+ROW_H/2);
      if (task.type === 'task') {
        const wd = task.wday || (task.start && task.end ? countWorkingDays(task.start,task.end) : 1);
        ctx.fillText(wd+'d', 385, y+ROW_H/2);
      }
    }

    // ─── 甘特 Bar ───
    if (task.type === 'task' && task.start && task.end) {
      const bx = PANEL + dateToX(task.start);
      const bw = Math.max(PANEL + dateToX((() => { const d = new Date(task.end); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })()) - bx, 3);
      const by = y + (ROW_H - 20) / 2;
      ctx.globalAlpha = task.done ? 0.32 : 1;
      ctx.fillStyle = task.color || '#5E6AD2';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, 20, 3); ctx.fill();
      const _prog = task.done ? 100 : (task.progress || 0);
      if (_prog > 0 && _prog < 100) {
        ctx.fillStyle = darkenColor(task.color || '#5E6AD2', 0.3);
        ctx.beginPath(); ctx.roundRect(bx, by, bw * _prog / 100, 20, 3); ctx.fill();
      }
      const _bl = showBaseline && (proj.baseline?.dates || {})[task.id];
      if (_bl && _bl.s && _bl.e && (_bl.s !== task.start || _bl.e !== task.end)) {
        const blx = PANEL + dateToX(_bl.s);
        const blw = Math.max(PANEL + dateToX((() => { const d = new Date(_bl.e); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })()) - blx, 3);
        ctx.fillStyle = '#9CA3AF'; ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.roundRect(blx, y + 30, blw, 4, 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (showCriticalPath && criticalTaskIds.has(task.id)) {
        ctx.strokeStyle = '#EF4444'; ctx.lineWidth = 2;
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, 20, 3); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (bw > 50) {
        ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif';
        let lbl = task.name; while (ctx.measureText(lbl).width > bw-12 && lbl.length>1) lbl=lbl.slice(0,-1);
        ctx.fillText(lbl, bx+6, by+10);
      }
    } else if (task.type === 'milestone' && task.date && !msMode) {
      const mx = PANEL + dateToX(task.date) + PPD/2;
      const my = y + ROW_H/2;
      ctx.fillStyle = task.color || '#F59E0B';
      ctx.save(); ctx.translate(mx,my); ctx.rotate(Math.PI/4);
      ctx.fillRect(-7,-7,14,14); ctx.restore();
      // 在菱形右側繪製里程碑名稱
      ctx.fillStyle = task.color || '#F59E0B';
      ctx.font = '10px sans-serif';
      const lbl = task.name.length > 12 ? task.name.slice(0,12)+'…' : task.name;
      ctx.fillText(lbl, mx + 11, my);
    } else if (task.type === 'group') {
      const b = groupBounds(task.id);
      if (b.s && b.e) {
        const bx = PANEL + dateToX(b.s);
        const bw = Math.max(PANEL + dateToX(nextWorkingDay(b.e)) - bx, 6);
        const by = y + (ROW_H-8)/2;
        ctx.fillStyle = task.color || '#5E6AD2';
        ctx.beginPath(); ctx.roundRect(bx, by, bw, 8, 4); ctx.fill();
      }
    }
  });

  // ─── 里程碑模式：單一時間軸（同 Web 版 renderMilestoneTimeline）───
  if (msMode) {
    const cy = HDR + THDR + bodyH / 2;
    const halfD = 8, connH = 28;
    // Spine
    ctx.strokeStyle = '#5E6AD2'; ctx.lineWidth = 2; ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.moveTo(PANEL, cy); ctx.lineTo(PANEL + tw, cy); ctx.stroke();
    ctx.globalAlpha = 1;
    const msList = rows.map(r => r.task).filter(t => t.type === 'milestone' && t.date);
    msList.forEach((m, idx) => {
      const x = PANEL + dateToX(m.date) + PPD / 2;
      const above = idx % 2 === 0;
      const col = m.color || '#5E6AD2';
      // Connector
      ctx.strokeStyle = '#C7CAD1'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, above ? cy - halfD - connH : cy + halfD);
      ctx.lineTo(x, above ? cy - halfD : cy + halfD + connH);
      ctx.stroke();
      // Diamond
      ctx.fillStyle = col;
      ctx.save(); ctx.translate(x, cy); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-halfD + 1, -halfD + 1, (halfD - 1) * 2, (halfD - 1) * 2);
      ctx.restore();
      // Name + date（置中、交錯上下）
      ctx.textAlign = 'center';
      const lbl = m.name.length > 16 ? m.name.slice(0, 16) + '…' : m.name;
      const nameY = above ? cy - halfD - connH - 8 : cy + halfD + connH + 10;
      ctx.fillStyle = col; ctx.font = '600 11px -apple-system,system-ui,sans-serif';
      ctx.fillText(lbl, x, nameY);
      const dateY = above ? nameY - 13 : nameY + 13;
      ctx.fillStyle = '#9CA3AF'; ctx.font = '10px sans-serif';
      ctx.fillText(m.date, x, dateY);
      ctx.textAlign = 'left';
    });
  }

  // ─── 面板邊線 ───
  ctx.strokeStyle = '#D1D5DB'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PANEL, 0); ctx.lineTo(PANEL, totalH); ctx.stroke();
  ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(0, HDR+THDR); ctx.lineTo(totalWpx, HDR+THDR); ctx.stroke();

  // ─── 下載 ───
  const filename = `gantt-${(proj.name||'export').replace(/\s+/g,'-')}-${TODAY_STR}.png`;
  c.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = filename; a.href = url; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}

// 匯出 CSV（UTF-8 BOM，Excel 可直接開啟）
function exportCSV() {
  const proj = curProj();
  if (!proj) return;
  const lines = [['編號','任務名稱','類型','負責人','開始日期','結束日期','工作日','進度%','前置任務','已完成']];
  let num = 0;
  const walk = (parentId, depth) => {
    tasks.filter(t => t.parent === parentId).forEach(t => {
      num++;
      const isGrp = t.type === 'group';
      const gb = isGrp ? groupBounds(t.id) : null;
      lines.push([
        num,
        '　'.repeat(depth) + t.name,
        isGrp ? '群組' : t.type === 'milestone' ? '里程碑' : '任務',
        t.assignee || '',
        isGrp ? (gb.s || '') : (t.start || t.date || ''),
        isGrp ? (gb.e || '') : (t.end || t.date || ''),
        t.type === 'task' && t.start && t.end ? countWorkingDays(t.start, t.end) : '',
        t.type === 'task' ? (t.done ? 100 : (t.progress || 0)) : '',
        buildDepsText(t),
        t.done ? 'V' : ''
      ]);
      walk(t.id, depth + 1);
    });
  };
  walk(null, 0);
  const esc = v => { v = String(v ?? ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const csv = '\ufeff' + lines.map(r => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `gantt-${(proj.name || 'export').replace(/\s+/g, '-')}-${TODAY_STR}.csv`;
  a.href = url;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
/* deps adapters: pure logic in core/deps.js; bind global state. */
function buildDepsText(task) { return Deps.buildDepsText(tasks, collapsed, milestoneView, task); }
function wouldCreateCycle(taskId, newDepId) { return Deps.wouldCreateCycle(tasks, taskId, newDepId); }

const { lagsFromParsed } = Deps;
function parseDepInput(val, taskId) { return Deps.parseDepInput(val, taskId, tasks, collapsed, milestoneView); }

/* schedule adapters: pure logic in core/schedule.js; bind global state. */
function allGroupMembersScheduled(groupId, scheduled) { return Schedule.allGroupMembersScheduled(tasks, groupId, scheduled); }
function scheduleTasks() { return Schedule.scheduleTasks(tasks, curProj().startDate); }
function autoScheduleFromDeps(task) { return Schedule.autoScheduleFromDeps(tasks, task); }

function reorderTask(srcId, targetId, insertBefore) {
  const src = taskById(srcId);
  const target = taskById(targetId);
  if (!src || !target) return;
  if (isDescendant(srcId, targetId)) return; // prevent cycle

  pushHistory();

  // New parent: dropping on a group row → child of that group
  //             dropping on task/milestone → sibling of target
  src.parent = (target.type === 'group' && !insertBefore)
    ? target.id
    : target.parent;

  // Reorder in tasks array
  const srcIdx = tasks.indexOf(src);
  tasks.splice(srcIdx, 1);
  const targetIdx = tasks.indexOf(target);
  tasks.splice(insertBefore ? targetIdx : targetIdx + 1, 0, src);

  recalcProjEnd();
  render();
}

function outdentTask(id) {
  const task = taskById(id);
  if (!task || task.parent === null) return;
  const parent = taskById(task.parent);
  if (!parent || parent.parent === null) return;

  pushHistory();

  // Collect task + all its descendants (preserve order)
  const subtreeIds = new Set();
  function collectSubtree(tid) {
    subtreeIds.add(tid);
    tasks.filter(c => c.parent === tid).forEach(c => collectSubtree(c.id));
  }
  collectSubtree(id);
  const subtree = tasks.filter(t => subtreeIds.has(t.id));

  // Remove subtree from main array
  const _remaining = tasks.filter(t => !subtreeIds.has(t.id));
  tasks.length = 0;
  tasks.push(..._remaining);

  // Find insertion point: after last descendant of parent in remaining tasks
  function isDescOf(checkId, ancestorId) {
    let cur = taskById(checkId);
    const seen = new Set();
    while (cur && cur.parent !== null) {
      if (seen.has(cur.id)) break;
      seen.add(cur.id);
      if (cur.parent === ancestorId) return true;
      cur = taskById(cur.parent);
    }
    return false;
  }
  const parentIdx = tasks.findIndex(t => t.id === parent.id);
  let insertIdx = parentIdx;
  for (let i = parentIdx + 1; i < tasks.length; i++) {
    if (isDescOf(tasks[i].id, parent.id)) insertIdx = i;
  }

  // Update parent and reinsert after parent's subtree
  task.parent = parent.parent;
  tasks.splice(insertIdx + 1, 0, ...subtree);

  scheduleTasks();
  recalcProjEnd();
  render();
}

function showStatus(msg) {
  let el = document.getElementById('statusToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'statusToast';
    el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--t1);color:var(--surface);padding:6px 16px;border-radius:8px;font-size:12px;z-index:9999;opacity:0;transition:opacity .25s;pointer-events:none';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => el.style.opacity = '0', 2000);
}

function indentTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const myIdx = tasks.findIndex(t => t.id === id);
  let prevSibling = null;
  for (let i = myIdx - 1; i >= 0; i--) {
    if (tasks[i].parent === task.parent) { prevSibling = tasks[i]; break; }
  }
  if (!prevSibling) return;
  if (getTaskDepth(prevSibling.id) + 1 >= 5) {
    showStatus('已達最大層數 5 層'); return;
  }
  pushHistory();
  task.parent = prevSibling.id;
  scheduleTasks();
  recalcProjEnd();
  render();
}

function updateChartStart() {
  let minDate = null;
  tasks.forEach(t => {
    const s = t.start || t.date;
    if (s && (!minDate || s < minDate)) minDate = s;
  });
  const baseStart = minDate || curProj()?.startDate;
  if (!baseStart) return;
  const d = new Date(baseStart);
  const dayPad = Math.max(1, Math.ceil(30 / PPD));
  d.setDate(d.getDate() - dayPad);
  CHART_START = d;
}

function recalcProjEnd() {
  updateChartStart();
  let maxDate = null;
  tasks.forEach(t => {
    const e = t.end || t.date;
    if (e && (!maxDate || e > maxDate)) maxDate = e;
  });
  if (!maxDate) return;
  // Pad at least 3 months beyond last task
  const padded = new Date(maxDate);
  padded.setMonth(padded.getMonth() + 3);
  const endStr = padded.toISOString().slice(0, 10);
  curProj().endDate = endStr;
  CHART_END = padded;
  document.getElementById('sPeriod').textContent = `${curProj().startDate} — ${endStr}`;
}
/* ═══════════════════════════════════════════
   OWNER & SHARE SYSTEM
═══════════════════════════════════════════ */
let isReadOnly = false;
let _isShareLinkMode = false;

const ADMIN_EMAIL = 's19800430@gmail.com';
function isAdmin() { return currentUser?.email === ADMIN_EMAIL; }

function updateReadOnly() {
  const cp = curProj();
  // Use !! to ensure boolean (avoid undefined causing toggle() to act as actual toggle)
  isReadOnly = !!(_isShareLinkMode || (cp && cp._isShared && cp._permission === 'read'));
  document.body.classList.toggle('readonly', isReadOnly);
  const badge = document.querySelector('.readonly-badge');
  if (badge) badge.style.display = isReadOnly ? 'flex' : 'none';
  // shareBtn and collabBtn only for own projects
  const isOwnProj = !_isShareLinkMode && !(cp && cp._isShared);
  ['shareBtn','collabBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isOwnProj ? '' : 'none';
  });
}

function getOwnerId() { return Local.getOwnerId(); }

function getOrCreateShareToken(proj) { return Share.getOrCreateShareToken(proj); }

function openShareModal() {
  if (isReadOnly) return;
  const proj = curProj();
  const token = getOrCreateShareToken(proj);
  document.getElementById('shareModalProjName').textContent = proj.name;
  const note = document.querySelector('.share-owner-note');
  if (note) note.innerHTML = '💡 此連結為唯讀連結。只有您（專案建立者）在一般模式下可以編輯。';
  render();
  const encoded = saveShareToCloud(token, proj);
  const hash = encoded ? '#d=' + encoded : '';
  const url = location.origin + location.pathname + '?share=' + token + hash;
  document.getElementById('shareLinkInput').value = url;
  if (!encoded && note) note.innerHTML = '⚠️ 連結產生失敗，請稍後再試。';
  document.getElementById('shareOverlay').classList.add('open');
}

function closeShareModal() {
  document.getElementById('shareOverlay').classList.remove('open');
}

/* ═══════════════════════════════════════════
   PDF EXPORT
═══════════════════════════════════════════ */
function exportPDF() {
  const proj = curProj();
  const now = new Date().toLocaleDateString('zh-TW');
  document.getElementById('printProjName').textContent = proj.name;
  document.getElementById('printMeta').textContent =
    `列印日期：${now}　｜　期間：${proj.startDate} ~ ${proj.endDate}　｜　共 ${tasks.length} 項任務`;

  // Temporarily remove dark mode for print (white background)
  const wasDark = document.body.classList.contains('dark');
  if (wasDark) document.body.classList.remove('dark');

  window.print();

  if (wasDark) document.body.classList.add('dark');
}

/* ═══════════════════════════════════════════
   COLLABORATION — SHARED PROJECTS
═══════════════════════════════════════════ */
let _sharedChannels = [];

async function loadSharedProjects() {
  if (!currentUser) return;
  try {
    const shares = await Remote.getProjectSharesForEmail(currentUser.email);
    if (!shares.length) return;

    const byOwner = {};
    shares.forEach(s => {
      if (!byOwner[s.owner_id]) byOwner[s.owner_id] = [];
      byOwner[s.owner_id].push(s);
    });

    for (const [ownerId, ownerShares] of Object.entries(byOwner)) {
      const ownerData = await Remote.readUserData(ownerId);
      if (!ownerData?.projects) continue;

      ownerShares.forEach(share => {
        const proj = ownerData.projects.find(p => p.id == share.project_id);
        if (!proj) return;
        if (projects.find(p => p.id === proj.id && p._isShared)) return;
        projects.push({
          ...JSON.parse(JSON.stringify(proj)),
          _isShared: true,
          _ownerId: ownerId,
          _permission: share.permission
        });
      });
    }

    setupSharedRealtime(Object.keys(byOwner));
  } catch(e) { console.error('loadSharedProjects:', e); }
}

function setupSharedRealtime(ownerIds) {
  _sharedChannels.forEach(unsub => unsub());
  _sharedChannels = [];

  ownerIds.forEach(ownerId => {
    let skipFirst = true;
    const unsub = Remote.watchUserData(ownerId, async () => {
        if (skipFirst) { skipFirst = false; return; }
        const ownerData = await Remote.readUserData(ownerId);
        if (!ownerData?.projects) return;
        projects = projects.map(p => {
          if (p._isShared && p._ownerId === ownerId) {
            const fresh = ownerData.projects.find(op => op.id === p.id);
            if (fresh) return { ...fresh, _isShared: true, _ownerId: ownerId, _permission: p._permission };
          }
          return p;
        });
        if (curProj()?._ownerId === ownerId) {
          tasks = curProj().tasks;
          nextId = curProj().nextId;
          scheduleTasks();
          recalcProjEnd();
        }
        saveToLS();
        updateProjUI();
        render();
        showSyncToast();
      });
    _sharedChannels.push(unsub);
  });
}

/* ═══════════════════════════════════════════
   COLLABORATION — COLLAB MODAL
═══════════════════════════════════════════ */
let _collabShares = [];

async function openCollabModal() {
  if (isReadOnly) return;
  const overlay = document.getElementById('collabOverlay');
  overlay.classList.add('open');
  document.getElementById('collabMsg').style.display = 'none';
  document.getElementById('collabEmailInput').value = '';

  // 填入所有「我擁有」的專案（排除別人分享給我的）
  const sel = document.getElementById('collabProjSelect');
  const ownedProjects = projects.filter(p => !p._isShared);
  sel.innerHTML = ownedProjects.map(p =>
    `<option value="${p.id}">${p.name}</option>`
  ).join('');
  // 預設選目前專案
  const cur = curProj();
  if (cur && !cur._isShared) sel.value = cur.id;

  await refreshCollabList();
}

function closeCollabModal() {
  document.getElementById('collabOverlay').classList.remove('open');
}

async function onCollabProjChange() {
  document.getElementById('collabMsg').style.display = 'none';
  await refreshCollabList();
}

async function refreshCollabList() {
  const sel = document.getElementById('collabProjSelect');
  const projId = sel ? sel.value : (curProj()?.id);
  if (!projId) return;
  _collabShares = await Remote.getProjectSharesForOwner(projId, currentUser.uid);
  renderCollabModal();
}

function renderCollabModal() {
  const list = document.getElementById('collabShareList');
  if (!_collabShares.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--t3);text-align:center;padding:12px 0">尚未分享給任何人</div>';
    return;
  }
  list.innerHTML = _collabShares.map(s => `
    <div class="collab-share-item">
      <span class="ci-email" title="${s.shared_with_email}">${s.shared_with_email}</span>
      <span class="ci-perm ${s.permission}">${s.permission === 'read' ? '唯讀' : '共同編輯'}</span>
      <span class="ci-del" onclick="removeShare('${s.id}','${s.shared_with_email}')" title="移除">✕</span>
    </div>
  `).join('');
}

async function addShare() {
  const emailInput = document.getElementById('collabEmailInput');
  const email = (emailInput.value || '').trim().toLowerCase();
  const perm  = document.getElementById('collabPermSelect').value;
  const msgEl = document.getElementById('collabMsg');

  const showMsg = (txt, ok) => {
    msgEl.textContent = txt;
    msgEl.style.color = ok ? '#0a0' : '#E53';
    msgEl.style.display = 'block';
  };

  msgEl.style.display = 'none';

  if (!email || !email.includes('@')) { showMsg('請輸入有效的 Gmail 帳號'); return; }
  if (currentUser && email === currentUser.email) { showMsg('不能分享給自己'); return; }

  try {
    const sel = document.getElementById('collabProjSelect');
    const projId = sel?.value;
    if (!projId) { showMsg('請先選擇專案'); return; }

    const docId = `${projId}_${email.replace(/[.@]/g,'_')}`;
    await Remote.addProjectShare(docId, {
      project_id: String(projId),
      owner_id: currentUser.uid,
      shared_with_email: email,
      permission: perm
    });
    showMsg('✓ 已成功加入', true);
    emailInput.value = '';
    await refreshCollabList();
  } catch(e) {
    showMsg('加入失敗：' + e.message);
  }
}

async function removeShare(shareId, email) {
  if (!confirm(`確定要移除 ${email} 的存取權限嗎？`)) return;
  await Remote.removeProjectShare(shareId);
  await refreshCollabList();
}

/* ═══════════════════════════════════════════
   ADMIN PANEL
═══════════════════════════════════════════ */
async function openAdminPanel() {
  if (!isAdmin()) return;
  document.getElementById('adminOverlay').classList.add('open');
  await loadAdminUsers();
}

function closeAdminPanel() {
  document.getElementById('adminOverlay').classList.remove('open');
}

async function loadAdminUsers() {
  const tbody = document.getElementById('adminUserList');
  tbody.innerHTML = '<tr><td colspan="5" style="color:var(--t3);text-align:center;padding:16px">載入中…</td></tr>';
  try {
    const data = await Remote.getAllUsers();
    document.getElementById('adminUserCount').textContent = `（${data.length} 人）`;
    tbody.innerHTML = data.map(u => {
      const delBtn = u.is_admin ? '' : `<button class="btn" style="font-size:11px;padding:3px 8px;color:#E53;border-color:#E53" onclick="deleteUser('${u.email}')">刪除</button>`;
      const dateStr = u.added_at ? new Date(u.added_at).toLocaleDateString('zh-TW') : '—';
      return `<tr>
        <td>${u.name || '—'}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${u.email}">${u.email}</td>
        <td>${u.is_admin ? '管理員' : '用戶'}</td>
        <td style="color:var(--t3)">${dateStr}</td>
        <td>${delBtn}</td>
      </tr>`;
    }).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:#E53;text-align:center">載入失敗：${e.message}</td></tr>`;
  }
}

async function deleteUser(email) {
  if (!isAdmin()) return;
  if (!confirm(`確定要刪除用戶 ${email}？此操作無法復原。`)) return;
  try {
    await Remote.removeUser(email);
    await loadAdminUsers();
  } catch(e) { alert('刪除失敗：' + e.message); }
}

function copyShareLink() {
  const val = document.getElementById('shareLinkInput').value;
  navigator.clipboard.writeText(val)
    .then(() => { showStatus('✓ 分享連結已複製到剪貼簿'); closeShareModal(); })
    .catch(() => {
      const inp = document.getElementById('shareLinkInput');
      inp.select(); document.execCommand('copy');
      showStatus('✓ 分享連結已複製'); closeShareModal();
    });
}
/* ═══════════════════════════════════════════
   KEYBOARD SHORTCUTS
═══════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
  if (e.key !== 'Escape' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
  if (e.key === 't' || e.key === 'T') scrollToToday();
  if (e.key === 'd') setView('day');
  if (e.key === 'w') setView('week');
  if (e.key === 'm') setView('month');
  if (e.key === 'n') openModal();
  if (e.key === 'Escape') { closeModal(); closeProjModal(); closeProjMenuOnly(); closeDeleteModal(); }
});

/* ═══════════════════════════════════════════
   MAIN RENDER
═══════════════════════════════════════════ */

/* Sync app state + function refs to render modules' shared D object.
   Called at startup + before each render cycle. */
function syncRenderDeps() {
  // State variables (refreshed each render)
  D.tasks = tasks;
  D.collapsed = collapsed;
  D.milestoneView = milestoneView;
  D.workloadView = workloadView;
  D.isReadOnly = isReadOnly;
  D.showCriticalPath = showCriticalPath;
  D.criticalTaskIds = criticalTaskIds;
  D.showBarDates = showBarDates;
  D.showBaseline = showBaseline;
  D.isDark = isDark;
  D.PPD = PPD;
  D.PPDS = PPDS;
  D.CHART_START = CHART_START;
  D.CHART_END = CHART_END;
  D.TODAY = TODAY;
  D.TODAY_STR = TODAY_STR;
  D.ROW_H = ROW_H;
  D.BAR_H = BAR_H;
  D.MS_ROW_H = MS_ROW_H;
  D.projects = projects;
  D.currentProjId = currentProjId;
  D.nextProjId = nextProjId;
  D.currentUser = currentUser;
  D.TEMPLATES = TEMPLATES;

  // Function refs (stable, but harmless to reassign)
  D.curProj = curProj;
  D.taskById = taskById;
  D.getVisibleRows = getVisibleRows;
  D.getRowNum = getRowNum;
  D.getAllDescendants = getAllDescendants;
  D.dateToX = dateToX;
  D.totalW = totalW;
  D.avColor = avColor;
  D.groupBounds = groupBounds;
  D.groupProgress = groupProgress;
  D.buildDepsText = buildDepsText;
  D.parseDepInput = parseDepInput;
  D.getTaskDepth = getTaskDepth;
  D.getCriticalPredTaskIds = getCriticalPredTaskIds;
  D.updateStats = updateStats;
  D.updateReadOnly = updateReadOnly;
  D.updateProjUI = updateProjUI;
  D.updateChartStart = updateChartStart;
  D.openModal = openModal;
  D.openProjModal = openProjModal;
  D.openNameEditor = openNameEditor;
  D.openStartEditor = openStartEditor;
  D.openEndEditor = openEndEditor;
  D.openWdayEditor = openWdayEditor;
  D.openAllDepsEditor = openAllDepsEditor;
  D.addTaskInline = addTaskInline;
  D.indentTask = indentTask;
  D.outdentTask = outdentTask;
  D.confirmDeleteTask = confirmDeleteTask;
  D.toggleCollapse = toggleCollapse;
  D.toggleProjMenu = toggleProjMenu;
  D.closeProjMenuOnly = closeProjMenuOnly;
  D.switchProject = switchProject;
  D.reorderTask = reorderTask;
  D.pushHistory = pushHistory;
  D.render = render;
  D.scheduleTasks = scheduleTasks;
  D.recalcProjEnd = recalcProjEnd;
  D.saveToLS = saveToLS;
  D.saveToCloud = saveToCloud;
  D.showStatus = showStatus;
  D.scrollToToday = scrollToToday;
  D.getNextGroupColor = getNextGroupColor;
  D.getOwnerId = getOwnerId;
  D.consumeNextId = () => { const id = nextId++; if (curProj()) curProj().nextId = nextId; return id; };
  D.loadProject = (proj) => {
    if (curProj()) curProj().nextId = nextId;
    currentProjId = proj.id;
    tasks = proj.tasks;
    nextId = proj.nextId;
    CHART_START = new Date(proj.startDate);
    CHART_END = new Date(proj.endDate);
    collapsed.clear();
    _history = [];
  };
  D.resetState = () => { currentProjId = null; tasks = []; nextId = 1; };
  D.setProjects = (arr) => { projects = arr; };
  D.setCurrentProjId = (id) => { currentProjId = id; };
  D.setChartStart = (d) => { CHART_START = d; };
  D.setChartEnd = (d) => { CHART_END = d; };
  D.loadTasksFromSnapshot = (snap) => {
    curProj().tasks = JSON.parse(JSON.stringify(snap));
    tasks = curProj().tasks;
    collapsed.clear();
  };
  D.setShowBarDates = (v) => { showBarDates = v; };
  D.setShowBaseline = (v) => { showBaseline = v; };
  D.setIsDark = (v) => { isDark = v; };
  D.setPPD = (v) => { PPD = v; };
}

let _saveTimer = null;
function render() {
  syncRenderDeps();
  renderTaskPanel();
  renderChartHeader();
  renderChartBody();
  const undoBtn = document.getElementById('undoBtn');
  if (undoBtn) undoBtn.disabled = _history.length === 0;
  if (isReadOnly) return;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => { saveToLS(); saveToCloud(); }, 600);
}

/* ═══════════════════════════════════════════
   CLOUD SYNC STATE (Firebase init in src/data/firebase.js)
═══════════════════════════════════════════ */
let _myUpdate = false;
let currentUser = null;
let _guestMode = false;
let _appInitialized = false;

function setSyncDot(state) {
  const dot = document.getElementById('syncDot');
  if (!dot) return;
  dot.className = 'sync-dot' + (state ? ' ' + state : '');
  dot.title = { saving:'儲存中...', ok:'已同步', err:'同步失敗', off:'唯讀模式', local:'本地模式（不同步雲端）' }[state] || '雲端同步';
}

async function saveToCloud() {
  if (!currentUser) return;
  setSyncDot('saving');
  try {
    if (curProj()) curProj().nextId = nextId;
    const cp = curProj();

    if (!cp) {
      await Remote.writeUserData(currentUser.uid, { projects: [], currentProjId: null, nextProjId });
      setSyncDot('ok');
    } else if (cp._isShared && cp._permission === 'edit') {
      const ownerData = await Remote.readUserData(cp._ownerId);
      if (!ownerData?.projects) { setSyncDot('err'); return; }
      const ownerProjects = ownerData.projects.map(p =>
        p.id === cp.id ? { ...cp, _isShared: undefined, _ownerId: undefined, _permission: undefined } : p
      );
      await Remote.updateUserData(cp._ownerId, { ...ownerData, projects: ownerProjects });
      setSyncDot('ok');
    } else if (!cp._isShared) {
      const ownProjects = projects.filter(p => !p._isShared);
      _myUpdate = true;
      await Remote.writeUserData(currentUser.uid, { projects: ownProjects, currentProjId, nextProjId });
      setTimeout(() => _myUpdate = false, 1000);
      setSyncDot('ok');
    }
  } catch(e) {
    setSyncDot('err');
  }
}

async function loadFromCloud() {
  if (!currentUser) return false;
  try {
    const s = await Remote.readUserData(currentUser.uid);
    if (!s) return false;
    projects   = s.projects || [];
    nextProjId = s.nextProjId ?? 1;
    if (!projects.length) {
      // User intentionally cleared all projects
      currentProjId = null;
      tasks = [];
      nextId = 1;
      return true;
    }
    currentProjId = (s.currentProjId && projects.find(p => p.id === s.currentProjId))
      ? s.currentProjId : projects[0].id;
    tasks  = curProj().tasks;
    nextId = curProj().nextId;
    CHART_START = new Date(curProj().startDate);
    CHART_END   = new Date(curProj().endDate);
    return true;
  } catch(e) { return false; }
}

async function loadShareFromCloud(token) {
  const hashMatch = location.hash.match(/[#&]d=([^&]*)/);
  const hashData = hashMatch ? hashMatch[1] : null;
  if (hashData) {
    const obj = Share.decodeData(hashData);
    if (obj) return obj;
  }
  try {
    return await Share.loadShareDoc(token);
  } catch(e) { return null; }
}

function saveShareToCloud(token, project) {
  return Share.saveShareDoc(token, currentUser?.uid, project);
}

let _realtimeUnsub = null;

function setupRealtime() {
  if (!currentUser) return;
  if (_realtimeUnsub) _realtimeUnsub();
  let skipFirst = true;
  _realtimeUnsub = Remote.watchUserData(currentUser.uid, async () => {
      if (skipFirst) { skipFirst = false; return; }
      if (_myUpdate) return;
      const ok = await loadFromCloud();
      if (ok) {
        if (projects.length) { scheduleTasks(); recalcProjEnd(); }
        saveToLS(); updateProjUI(); render(); showSyncToast();
      }
    });
}

function showSyncToast() {
  let t = document.getElementById('syncToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'syncToast';
    t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:var(--t1);color:var(--surface);padding:8px 14px;border-radius:8px;font-size:12px;z-index:9999;opacity:0;transition:opacity .3s';
    document.body.appendChild(t);
  }
  t.textContent = '📡 其他用戶已更新資料';
  t.style.opacity = '1';
  setTimeout(() => t.style.opacity = '0', 2500);
}

/* ═══════════════════════════════════════════
   LOCALSTORAGE
═══════════════════════════════════════════ */
function saveToLS() {
  try {
    if (curProj()) curProj().nextId = nextId;
    const ownProjects = projects.filter(p => !p._isShared);
    Local.saveToLS({ projects: ownProjects, currentProjId, nextProjId });
  } catch(e) {}
}

function loadFromLS() {
  try {
    const d = Local.loadFromLS();
    if (!d?.projects?.length) return false;
    projects   = d.projects;
    nextProjId = d.nextProjId ?? projects.length + 1;
    currentProjId = (d.currentProjId && projects.find(p => p.id === d.currentProjId))
      ? d.currentProjId : projects[0].id;
    tasks  = curProj().tasks;
    nextId = curProj().nextId;
    CHART_START = new Date(curProj().startDate);
    CHART_END   = new Date(curProj().endDate);
    return true;
  } catch(e) { return false; }
}

function mergeDefaultProjects() {
  // Add any built-in projects not yet in the loaded state (identified by name)
  const DEFAULTS = [
    { name: '硬體產品開發計畫', startDate: '2026-05-04' }
  ];
  DEFAULTS.forEach(def => {
    if (!projects.find(p => p.name === def.name)) {
      const maxId = Math.max(...projects.map(p => p.id), 0);
      const template = [
        { id:2, name:'硬體產品開發計畫', color:'#0EA5E9', startDate:'2026-05-04', endDate:'2027-03-31', nextId:38,
          tasks: [
            { id:1,  name:'硬體產品開發',      type:'group',     parent:null, color:'#0EA5E9' },
            { id:2,  name:'需求定義',           type:'group',     parent:1,  color:'#818CF8' },
            { id:3,  name:'市場需求調研',       type:'task',      parent:2,  color:'#818CF8', wday:10, deps:[],    done:false, start:'', end:'' },
            { id:4,  name:'產品規格制定',       type:'task',      parent:2,  color:'#818CF8', wday:8,  deps:[3],   done:false, start:'', end:'' },
            { id:5,  name:'競品分析',           type:'task',      parent:2,  color:'#818CF8', wday:5,  deps:[],    done:false, start:'', end:'' },
            { id:6,  name:'規格凍結',           type:'milestone', parent:2,  color:'#5E6AD2',          deps:[4],   date:'' },
            { id:7,  name:'概念設計',           type:'group',     parent:1,  color:'#60A5FA' },
            { id:8,  name:'系統架構設計',       type:'task',      parent:7,  color:'#60A5FA', wday:10, deps:[6],   done:false, start:'', end:'' },
            { id:9,  name:'硬體概念設計',       type:'task',      parent:7,  color:'#60A5FA', wday:8,  deps:[8],   done:false, start:'', end:'' },
            { id:10, name:'外觀設計',           type:'task',      parent:7,  color:'#60A5FA', wday:8,  deps:[8],   done:false, start:'', end:'' },
            { id:11, name:'CDR 概念設計審查',   type:'milestone', parent:7,  color:'#3B82F6',          deps:[9,10],date:'' },
            { id:12, name:'詳細設計',           type:'group',     parent:1,  color:'#34D399' },
            { id:13, name:'電路圖設計',         type:'task',      parent:12, color:'#34D399', wday:15, deps:[11],  done:false, start:'', end:'' },
            { id:14, name:'PCB Layout',         type:'task',      parent:12, color:'#34D399', wday:12, deps:[13],  done:false, start:'', end:'' },
            { id:15, name:'結構件設計',         type:'task',      parent:12, color:'#34D399', wday:12, deps:[11],  done:false, start:'', end:'' },
            { id:16, name:'韌體開發',           type:'task',      parent:12, color:'#34D399', wday:20, deps:[13],  done:false, start:'', end:'' },
            { id:17, name:'PDR 詳細設計審查',   type:'milestone', parent:12, color:'#10B981',          deps:[14,15],date:'' },
            { id:18, name:'EVT 原型製作',       type:'group',     parent:1,  color:'#FBBF24' },
            { id:19, name:'PCB 打樣',           type:'task',      parent:18, color:'#FBBF24', wday:10, deps:[17],  done:false, start:'', end:'' },
            { id:20, name:'結構件打樣',         type:'task',      parent:18, color:'#FBBF24', wday:10, deps:[17],  done:false, start:'', end:'' },
            { id:21, name:'原型組裝與調試',     type:'task',      parent:18, color:'#FBBF24', wday:5,  deps:[19,20],done:false,start:'', end:'' },
            { id:22, name:'EVT 原型完成',       type:'milestone', parent:18, color:'#F59E0B',          deps:[21],  date:'' },
            { id:23, name:'DVT 驗證測試',       type:'group',     parent:1,  color:'#F87171' },
            { id:24, name:'功能測試',           type:'task',      parent:23, color:'#F87171', wday:10, deps:[22],  done:false, start:'', end:'' },
            { id:25, name:'環境壓力測試',       type:'task',      parent:23, color:'#F87171', wday:10, deps:[22],  done:false, start:'', end:'' },
            { id:26, name:'安規認證',           type:'task',      parent:23, color:'#F87171', wday:15, deps:[24],  done:false, start:'', end:'' },
            { id:27, name:'問題修改改版',       type:'task',      parent:23, color:'#F87171', wday:10, deps:[24,25],done:false,start:'', end:'' },
            { id:28, name:'DVT 驗證完成',       type:'milestone', parent:23, color:'#EF4444',          deps:[26,27],date:'' },
            { id:29, name:'PVT 量產準備',       type:'group',     parent:1,  color:'#A78BFA' },
            { id:30, name:'供應商確認',         type:'task',      parent:29, color:'#A78BFA', wday:10, deps:[28],  done:false, start:'', end:'' },
            { id:31, name:'生產工程設計',       type:'task',      parent:29, color:'#A78BFA', wday:10, deps:[28],  done:false, start:'', end:'' },
            { id:32, name:'試量產',             type:'task',      parent:29, color:'#A78BFA', wday:15, deps:[30,31],done:false,start:'', end:'' },
            { id:33, name:'PVT 量產準備完成',   type:'milestone', parent:29, color:'#8B5CF6',          deps:[32],  date:'' },
            { id:34, name:'MP 量產導入',        type:'group',     parent:1,  color:'#10B981' },
            { id:35, name:'正式量產',           type:'task',      parent:34, color:'#10B981', wday:20, deps:[33],  done:false, start:'', end:'' },
            { id:36, name:'品質監控',           type:'task',      parent:34, color:'#10B981', wday:15, deps:[35],  done:false, start:'', end:'' },
            { id:37, name:'MP 正式出貨',        type:'milestone', parent:34, color:'#059669',          deps:[35],  date:'' },
          ]
        }
      ].find(t => t.name === def.name);
      if (template) {
        template.id = maxId + 1;
        nextProjId = Math.max(nextProjId, template.id + 1);
        projects.push(template);
      }
    }
  });
}

/* ═══════════════════════════════════════════
   AUTH
═══════════════════════════════════════════ */
async function signInWithGoogle() {
  document.getElementById('loginError').style.display = 'none';
  try {
    await auth.signInWithPopup(googleProvider);
  } catch(e) {
    if (e.code !== 'auth/popup-closed-by-user') alert('登入失敗：' + e.message);
  }
}

async function signInAsGuest() {
  _guestMode = true;
  await initApp();
  setSyncDot('local');
}

async function checkAuthorized() {
  if (!currentUser) return false;
  const userData = await Remote.getAuthorizedUser(currentUser.email);
  if (!userData) {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginPanel').style.display = 'none';
    document.getElementById('registerPanel').style.display = 'flex';
    document.getElementById('registerNickname').focus();
    return false;
  }
  return true;
}

async function submitRegister() {
  const nickname = document.getElementById('registerNickname').value.trim();
  const errEl = document.getElementById('registerError');
  if (!nickname) {
    errEl.textContent = '請填寫暱稱';
    errEl.style.display = '';
    return;
  }
  errEl.style.display = 'none';
  try {
    await Remote.registerUser(currentUser.email, {
      email: currentUser.email, name: nickname,
      is_admin: false, added_at: new Date().toISOString()
    });
    document.getElementById('registerPanel').style.display = 'none';
    document.getElementById('loginPanel').style.display = 'flex';
    await initApp();
  } catch(e) {
    errEl.textContent = '註冊失敗：' + e.message;
    errEl.style.display = '';
  }
}

async function signOut() {
  if (!_guestMode) await auth.signOut();
  currentUser = null;
  _guestMode = false;
  _appInitialized = false;
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginPanel').style.display = 'flex';
  document.getElementById('registerPanel').style.display = 'none';
  document.getElementById('registerNickname').value = '';
  document.getElementById('registerError').style.display = 'none';
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('appToolbar').style.display = 'none';
  document.getElementById('main').style.display = 'none';
  document.getElementById('userDisplay').innerHTML = '';
  document.getElementById('signOutBtn').style.display = 'none';
}

function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appToolbar').style.display = 'flex';
  document.getElementById('main').style.display = 'flex';
}

function updateUserDisplay() {
  if (!currentUser) return;
  const name = currentUser.displayName || currentUser.email || '';
  const avatar = currentUser.photoURL;
  const el = document.getElementById('userDisplay');
  if (!el) return;
  el.innerHTML = avatar
    ? `<img src="${avatar}" title="${name}" style="width:26px;height:26px;border-radius:50%;object-fit:cover">`
    : `<div title="${name}" style="width:26px;height:26px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700">${(name[0]||'U').toUpperCase()}</div>`;
  document.getElementById('signOutBtn').style.display = '';
}

async function initApp() {
  if (_appInitialized) return;
  _appInitialized = true;
  // Clear header immediately before showing app, preventing cached name flash
  const _nameEl = document.getElementById('projSelectorName');
  if (_nameEl) _nameEl.textContent = '';
  showApp();
  updateUserDisplay();
  // Clear hardcoded demo data before cloud load to prevent flash
  projects = [];
  currentProjId = null;
  tasks = [];
  const cloudOk = await loadFromCloud();
  if (!cloudOk) loadFromLS();
  await loadSharedProjects();
  setupSync();
  setupColResizers();
  setupResizer();
  setupRealtime();
  updateProjUI();
  if (projects.length) {
    scheduleTasks();
    recalcProjEnd();
  }
  render();
  setSyncDot(cloudOk ? 'ok' : (_guestMode ? 'off' : 'err'));
  setTimeout(scrollToToday, 120);
  const adminBtn = document.getElementById('adminBtn');
  if (adminBtn) adminBtn.style.display = isAdmin() ? '' : 'none';
  if (_guestMode) {
    const el = document.getElementById('userDisplay');
    if (el) el.innerHTML = `<div title="訪客模式（本地）" style="width:26px;height:26px;border-radius:50%;background:var(--t4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700">訪</div>`;
    document.getElementById('signOutBtn').style.display = '';
  }
}

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(location.search);
  const shareToken = urlParams.get('share');

  if (shareToken) {
    // Read-only share mode: load from gantt_shares table (no auth needed)
    _isShareLinkMode = true;
    showApp();
    const projData = await loadShareFromCloud(shareToken);
    if (!projData) {
      document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;flex-direction:column;gap:12px;color:#555">
        <div style="font-size:48px">🔗</div>
        <div style="font-size:18px;font-weight:600">連結無效或已失效</div>
        <div style="font-size:14px;color:#888">此分享連結不存在或已被移除</div>
      </div>`;
      return;
    }
    projects = [projData];
    currentProjId = projData.id;
    tasks  = curProj().tasks;
    nextId = curProj().nextId || 100;
    CHART_START = new Date(curProj().startDate);
    CHART_END   = new Date(curProj().endDate);
    isReadOnly = true;
    document.body.classList.add('readonly');
    setupColResizers();
    setupResizer();
    updateProjUI();
    scheduleTasks();
    recalcProjEnd();
    render();
    setSyncDot('off');
    setTimeout(scrollToToday, 120);
    return;
  }

  // Auth-required mode
  const revealLogin = () => {
    const chk = document.getElementById('authChecking');
    const panel = document.getElementById('loginPanel');
    if (chk) chk.style.display = 'none';
    if (panel && document.getElementById('registerPanel').style.display === 'none') panel.style.display = 'flex';
  };
  // 保險：Firebase 無回應（離線、被擋）時 4 秒後仍顯示登入按鈕
  const authFallback = setTimeout(() => { if (!_appInitialized) revealLogin(); }, 4000);

  onAuthStateChanged(auth, async (user) => {
    if (_appInitialized) return;
    clearTimeout(authFallback);
    if (user) {
      // 既有 session：直接進入 app，不顯示登入按鈕
      currentUser = user;
      const authorized = await checkAuthorized();
      if (authorized) await initApp();
      // 未授權時 checkAuthorized 已切換到註冊面板，這裡只需把檢查中提示收掉
      if (!_appInitialized) {
        const chk = document.getElementById('authChecking');
        if (chk) chk.style.display = 'none';
      }
    } else {
      revealLogin();
    }
  });
});

/* ── PHASE 0 COMPAT SHIM ──────────────────────────────────────
   Module scope hides these from window; inline onclick handlers
   (static + dynamic innerHTML) still resolve them globally.
   TEMPORARY — removed in Phase 6 (onclick -> addEventListener). ── */
Object.assign(window, {
  _decodeData: Share.decodeData,
  _encodeData: Share.encodeData,
  addDepToInput,
  addShare,
  addTaskInline,
  allGroupMembersScheduled,
  applyColGrid,
  applyZoom,
  attachBarDrag,
  autoScheduleFromDeps,
  avColor,
  buildDepsText,
  checkAuthorized,
  closeAdminPanel,
  closeCollabModal,
  closeDeleteModal,
  closeDepsOutside,
  closeExportMenu,
  closeModal,
  closeProjMenuOnly,
  closeProjModal,
  closeProjOnOutside,
  closeSettings,
  closeShareModal,
  closeVersionPanel,
  collapseAll,
  computeCriticalPath,
  computeWorkload,
  confirmDeleteTask,
  copyShareLink,
  createVersion,
  curProj,
  curVersions,
  darkenColor,
  dateToX,
  deleteProject,
  deleteUser,
  deleteVersion,
  executeDeleteTask,
  expandAll,
  exportCSV,
  exportPDF,
  exportPNG,
  fitToFrame,
  getAllDescendants,
  getCriticalPredTaskIds,
  getNextGroupColor,
  getOrCreateShareToken,
  getOwnerId,
  getPredIds,
  getRowNum,
  getSuccIds,
  getTaskByRowNum,
  getTaskDepth,
  getTreeLines,
  getVisibleRows,
  getWorkingSegs,
  groupAllDone,
  groupBounds,
  groupProgress,
  hasMilestoneDescendant,
  hexToRgba,
  hideTT,
  highlightDeps,
  highlightRow,
  indentTask,
  initApp,
  initials,
  isAdmin,
  isDescendant,
  lagsFromParsed,
  loadAdminUsers,
  loadFromCloud,
  loadFromLS,
  loadShareFromCloud,
  loadSharedProjects,
  mergeDefaultProjects,
  moveTT,
  onCollabProjChange,
  onSettingBarDatesChange,
  onSettingBaselineChange,
  onTemplateChange,
  openAdminPanel,
  openAllDepsEditor,
  openCollabModal,
  openDateEditor,
  openDepsEditor,
  openEditModal,
  openEditProjModal,
  openEndEditor,
  openModal,
  openModalUnder,
  openNameEditor,
  openProjModal,
  openShareModal,
  openStartEditor,
  openVersionPanel,
  openWdayEditor,
  outdentTask,
  parseDepInput,
  populateModal,
  prevWorkingDay,
  pushHistory,
  recalcProjEnd,
  refreshCollabList,
  removeDepTag,
  removeShare,
  render,
  renderArrows,
  renderBar,
  renderChartBody,
  renderChartHeader,
  renderCollabModal,
  renderDepsDropdown,
  renderDepsMenu,
  renderGrid,
  renderGroupBar,
  renderMilestone,
  renderMilestoneTimeline,
  renderProjMenu,
  renderTaskPanel,
  renderVersionList,
  renderWorkloadChart,
  renderWorkloadPanel,
  reorderTask,
  restoreVersion,
  saveShareToCloud,
  saveToCloud,
  saveToLS,
  scheduleTasks,
  scrollToToday,
  selectColor,
  setBaseline,
  setChartView,
  setSyncDot,
  setView,
  setupColResizers,
  setupDepsInputListener,
  setupRealtime,
  setupResizer,
  setupSharedRealtime,
  setupSync,
  showApp,
  showStatus,
  showSyncToast,
  showTT,
  signInAsGuest,
  signInWithGoogle,
  signOut,
  submitProject,
  submitRegister,
  submitTask,
  switchProject,
  syncEndFromWday,
  syncWday,
  taskById,
  toStr,
  toggleBarDates,
  toggleCollapse,
  toggleCriticalPath,
  toggleDark,
  toggleDepOpt,
  toggleDepsMenu,
  toggleExportMenu,
  toggleProjMenu,
  toggleSettings,
  totalW,
  undo,
  updateChartStart,
  updateDepsTags,
  updateModalForType,
  updateProjUI,
  updateReadOnly,
  updateStats,
  updateUserDisplay,
  wouldCreateCycle,
  zoomIn,
  zoomOut,
});
