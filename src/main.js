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
let editingTaskId = null;
let selectedDeps = new Set();
let depsExcludeId = null;
let selectedSdeps = new Set();

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

function onSettingBarDatesChange() {
  showBarDates = document.getElementById('settingBarDates').checked;
  render();
}

let showBaseline = true;
function onSettingBaselineChange() {
  showBaseline = document.getElementById('settingBaseline').checked;
  render();
}

// 設定基準線：快照所有任務目前的日期，之後排程變動時可比對偏差
function setBaseline() {
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

function toggleSettings() {
  const panel = document.getElementById('settingsPanel');
  panel.classList.toggle('open');
}

function toggleExportMenu() {
  document.getElementById('exportPanel').classList.toggle('open');
}
function closeExportMenu() {
  document.getElementById('exportPanel').classList.remove('open');
}
document.addEventListener('click', e => {
  const w = document.getElementById('exportWrap');
  if (w && !w.contains(e.target)) closeExportMenu();
});

function closeSettings() {
  document.getElementById('settingsPanel').classList.remove('open');
}

document.addEventListener('click', e => {
  const wrap = document.getElementById('settingsWrap');
  if (wrap && !wrap.contains(e.target)) closeSettings();
});

function applyZoom(factor) {
  const cs = document.getElementById('chartScroll');
  // Anchor: keep the left-edge date fixed so content doesn't jump off-screen
  const leftMs = CHART_START.getTime() + cs.scrollLeft / PPD * 86400000;
  PPD = Math.max(2, Math.min(80, Math.round(PPD * factor)));
  document.querySelectorAll('#viewBtns .btn').forEach(b => {
    b.classList.toggle('active', PPDS[b.dataset.v] === PPD);
  });
  updateChartStart(); // recompute CHART_START padding for new PPD
  render();
  requestAnimationFrame(() => {
    cs.scrollLeft = Math.max(0, (leftMs - CHART_START.getTime()) / 86400000 * PPD);
  });
}
function zoomIn()  { applyZoom(1.4); }
function zoomOut() { applyZoom(1 / 1.4); }
function fitToFrame() {
  const cs = document.getElementById('chartScroll');
  const viewW = cs.clientWidth - 4;
  const totalDays = (CHART_END - CHART_START) / 86400000 + 1;
  PPD = Math.max(2, Math.min(80, viewW / totalDays));
  document.querySelectorAll('#viewBtns .btn').forEach(b => {
    b.classList.toggle('active', PPDS[b.dataset.v] === PPD);
  });
  updateChartStart();
  render();
  requestAnimationFrame(() => { cs.scrollLeft = 0; });
}

/* ═══════════════════════════════════════════
   SCROLL TO TODAY
═══════════════════════════════════════════ */
function scrollToToday() {
  const cs = document.getElementById('chartScroll');
  const x = Math.max(0, dateToX(TODAY_STR) - cs.clientWidth / 3);
  cs.scrollTo({ left: x, behavior: 'smooth' });
}

/* ═══════════════════════════════════════════
   STATS
═══════════════════════════════════════════ */
function updateStats() {
  const t = tasks.filter(x => x.type === 'task');
  const m = tasks.filter(x => x.type === 'milestone');
  document.getElementById('sDone').textContent    = t.filter(x => x.done).length;
  document.getElementById('sPending').textContent = t.filter(x => !x.done).length;
  document.getElementById('sMilestone').textContent = m.length;
}

/* ═══════════════════════════════════════════
   DARK MODE
═══════════════════════════════════════════ */
function toggleDark() {
  isDark = !isDark;
  document.body.classList.toggle('dark', isDark);
  document.getElementById('darkBtn').textContent = isDark ? '☀️' : '🌙';
}

/* ═══════════════════════════════════════════
   MODAL
═══════════════════════════════════════════ */
function populateModal(excludeId = null, checkedDeps = [], presetParent = null, isDone = false) {
  // Parent groups（含「無」選項；編輯時排除自己與後代避免循環）
  const sel = document.getElementById('fParent');
  sel.innerHTML = '';
  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = '— 無（最上層）—';
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
  updateDepsTags();

  // Done checkbox
  const fd = document.getElementById('fDone');
  fd.classList.toggle('done', isDone);
  fd.textContent = isDone ? '✓' : '';
}

function syncWday() {
  const s = document.getElementById('fStart').value;
  const e = document.getElementById('fEnd').value;
  if (s && e) document.getElementById('fWday').value = countWorkingDays(s, e);
}
function syncEndFromWday() {
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

function updateModalForType() {
  const t = document.getElementById('fType').value;
  const isMs = t === 'milestone', isGrp = t === 'group';
  document.getElementById('rowDates').style.display = isGrp ? 'none' : '';
  document.getElementById('colEnd').style.display   = isMs ? 'none' : '';
  document.getElementById('colWday').style.display  = isMs ? 'none' : '';
  document.getElementById('lblStart').textContent   = isMs ? '日期' : '開始日期';
  document.getElementById('rowDone').style.display  = (isMs || isGrp) ? 'none' : 'flex';
  document.getElementById('rowDeps').style.display  = isGrp ? 'none' : '';
  document.getElementById('rowAssignee').style.display = isGrp ? 'none' : '';
}

function setupDepsInputListener(excludeId) {
  const inp = document.getElementById('fDeps');
  const tip = document.getElementById('fDepsTip');
  const list = document.getElementById('fDepsList');
  if (!inp) return;

  function updateTip() {
    const val = inp.value;
    if (!val.trim()) { tip.innerHTML = ''; return; }
    const parsed = parseDepInput(val, excludeId);
    tip.innerHTML = parsed.map(p => {
      if (p.err) return `<span style="color:var(--red)">✕ ${p.raw}：${p.err}</span>`;
      const dt = taskById(p.taskId);
      return `<span style="color:#10B981">✓ ${p.rowNum}${p.type}・${dt ? dt.name : ''}</span>`;
    }).join('&nbsp;&nbsp;');
  }

  inp.oninput = () => { updateTip(); renderDepsDropdown(excludeId); };
  inp.onfocus = () => { renderDepsDropdown(excludeId); if (list) list.style.display = 'block'; };
  inp.onblur  = () => { setTimeout(() => { if (list) list.style.display = 'none'; }, 150); };
  updateTip();
}

function renderDepsDropdown(excludeId) {
  const list = document.getElementById('fDepsList');
  const inp  = document.getElementById('fDeps');
  if (!list || !inp) return;

  const parsed = parseDepInput(inp.value, excludeId);
  const selMap = {};
  parsed.filter(p => !p.err).forEach(p => { selMap[p.rowNum] = p.type; });

  const rows = getVisibleRows().filter(({task}) =>
    task.type !== 'group' && task.id !== excludeId
  );

  if (!rows.length) { list.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--t4);text-align:center">無可選任務</div>'; return; }

  list.innerHTML = rows.map(({task}, i) => {
    const rowNum = i + 1;
    const selType = selMap[rowNum] || '';
    const isSel = !!selType;
    const typeBtns = ['FS','SS','FF','SF'].map(t =>
      `<button class="dep-type-btn${selType===t?' active':''}" onclick="addDepToInput(${rowNum},'${t}',${JSON.stringify(excludeId)})">${t}</button>`
    ).join('');
    return `<div class="dep-li${isSel?' dep-sel':''}">
      <span class="dep-li-num">#${rowNum}</span>
      <span class="dep-li-name" title="${task.name}">${task.name}</span>
      <div class="dep-type-btns">${typeBtns}</div>
    </div>`;
  }).join('');
}

function addDepToInput(rowNum, type, excludeId) {
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

function openModal(unused, prefillDate) {
  if (isReadOnly) return;
  if (!curProj()) { openProjModal(); return; }
  editingTaskId = null;
  document.getElementById('modal-title').textContent = '＋ 新增任務';
  document.getElementById('modal-submit').textContent = '新增任務';
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

function openNameEditor(task, cell, isNew = false) {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'inline-input';
  inp.value = task.name;
  inp.placeholder = '輸入任務名稱…';
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
    task.name = name || '新任務';
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

function addTaskInline(refTaskId) {
  if (isReadOnly) return;
  const ref = taskById(refTaskId);
  if (!ref) return;
  // Group: new task goes inside (as child); leaf task: new task goes after (as sibling)
  const parentId = ref.type === 'group' ? ref.id : ref.parent;
  const parent = taskById(parentId);
  const newTask = {
    id: nextId++,
    name: '新任務',
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

function openModalUnder(taskId) {
  if (isReadOnly) return;
  const task = taskById(taskId);
  if (!task) return;
  const parentId = task.parent;
  editingTaskId = null;
  document.getElementById('modal-title').textContent = '＋ 新增任務';
  document.getElementById('modal-submit').textContent = '新增任務';
  document.getElementById('fName').value = '';
  document.getElementById('fStart').value = TODAY_STR;
  document.getElementById('fEnd').value = TODAY_STR;
  document.getElementById('fType').value = 'task';
  populateModal(null, [], parentId);
  updateModalForType();
  document.getElementById('overlay').classList.add('open');
  setTimeout(() => document.getElementById('fName').focus(), 50);
}

function openEditModal(taskId) {
  if (isReadOnly) return;
  const task = taskById(taskId);
  if (!task) return;
  editingTaskId = taskId;
  document.getElementById('modal-title').textContent = '✏️ 編輯任務';
  document.getElementById('modal-submit').textContent = '儲存變更';
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

function closeModal(e) {
  if (!e || e.target === document.getElementById('overlay')) {
    document.getElementById('overlay').classList.remove('open');
  }
}

let _deleteTargetId = null;

function confirmDeleteTask(id) {
  const task = taskById(id);
  if (!task) return;
  _deleteTargetId = id;

  const descendants = getAllDescendants(id);
  const msg = document.getElementById('deleteModalMsg');
  if (task.type === 'group' && descendants.length > 0) {
    msg.textContent = `此群組及其 ${descendants.length} 個子任務將一併刪除，此操作無法復原。`;
  } else {
    msg.textContent = '此操作無法復原。';
  }

  document.getElementById('deleteConfirmBtn').onclick = () => { executeDeleteTask(_deleteTargetId); };
  document.getElementById('deleteOverlay').classList.add('open');
}

function closeDeleteModal(e) {
  if (!e || e.target === document.getElementById('deleteOverlay')) {
    document.getElementById('deleteOverlay').classList.remove('open');
    _deleteTargetId = null;
  }
}

function executeDeleteTask(id) {
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

function submitTask() {
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
    const t = { id: nextId++, name, type, parent: parentId, color: autoColor,
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
    curProj().nextId = nextId;
  }

  editingTaskId = null;
  document.getElementById('overlay').classList.remove('open');
  scheduleTasks();
  recalcProjEnd();
  render();
}

function openDateEditor(task, field, cell) {
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

function openStartEditor(task, cell) {
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

function openEndEditor(task, cell) {
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

function openWdayEditor(task, cell) {
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
function toggleDepsMenu(e) {
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

function closeDepsOutside(e) {
  if (!document.getElementById('depsPicker').contains(e.target)) {
    document.getElementById('depsMenu').classList.remove('open');
  } else {
    document.addEventListener('click', closeDepsOutside, { once: true });
  }
}

function toggleDepOpt(id) {
  if (selectedDeps.has(id)) selectedDeps.delete(id);
  else selectedDeps.add(id);
  updateDepsTags();
  renderDepsMenu();
}

function removeDepTag(id) {
  selectedDeps.delete(id);
  updateDepsTags();
}

function updateDepsTags() { /* 已由 fDeps 文字輸入取代 */ }

function renderDepsMenu() {
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
    menu.innerHTML = '<div style="padding:10px;text-align:center;font-size:12px;color:var(--t4)">目前無可選前置任務</div>';
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

function openDepsEditor(task, cell) { openAllDepsEditor(task, cell); }

/* deps adapters: pure logic in core/deps.js; bind global state. */
function buildDepsText(task) { return Deps.buildDepsText(tasks, collapsed, milestoneView, task); }
function wouldCreateCycle(taskId, newDepId) { return Deps.wouldCreateCycle(tasks, taskId, newDepId); }

const { lagsFromParsed } = Deps;
function parseDepInput(val, taskId) { return Deps.parseDepInput(val, taskId, tasks, collapsed, milestoneView); }

function openAllDepsEditor(task, cell) {
  const wrap = document.createElement('div');
  wrap.className = 'deps-edit-wrap';

  const inp = document.createElement('input');
  inp.className = 'deps-input';
  inp.placeholder = '如：2FS, 3SS, 2FS+3';
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
    rows.push('<div style="margin-top:4px;color:#9CA3AF;font-size:10px">Enter 確認 &nbsp; Esc 取消</div>');
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
   PROJECT MANAGEMENT
═══════════════════════════════════════════ */
function switchProject(id) {
  if (id === currentProjId) { closeProjMenuOnly(); return; }
  // Save current nextId back (guard against orphaned currentProjId)
  if (curProj()) curProj().nextId = nextId;
  // Switch
  currentProjId = id;
  tasks  = curProj().tasks;
  nextId = curProj().nextId;
  CHART_START = new Date(curProj().startDate);
  CHART_END   = new Date(curProj().endDate);
  collapsed.clear();
  _history = [];
  closeProjMenuOnly();
  updateReadOnly();
  updateProjUI();
  scheduleTasks();
  recalcProjEnd();
  render();
  setTimeout(scrollToToday, 80);
}

function updateProjUI() {
  let p = curProj();
  if (!p) {
    const fallback = projects.find(x => !x._isShared) || projects[0];
    if (!fallback) {
      // No projects at all — clear header and show create modal
      document.getElementById('projSelectorName').textContent = '— 無專案 —';
      document.getElementById('projDot').style.background = '#999';
      renderProjMenu();
      return;
    }
    p = fallback;
    currentProjId = p.id;
  }
  document.getElementById('projSelectorName').textContent = p.name;
  document.getElementById('projDot').style.background = p.color;
  document.getElementById('sPeriod').textContent = `${p.startDate} — ${p.endDate}`;
  updateReadOnly();
}

function toggleProjMenu(e) {
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

function closeProjOnOutside(e) {
  if (!document.getElementById('projSelector').contains(e.target)) closeProjMenuOnly();
  else document.addEventListener('click', closeProjOnOutside, { once: true });
}

function closeProjMenuOnly() {
  document.getElementById('projMenu').classList.remove('open');
  document.getElementById('projSelector').classList.remove('open');
}

function renderProjMenu() {
  const menu = document.getElementById('projMenu');
  menu.innerHTML = '';
  projects.forEach(p => {
    const item = document.createElement('div');
    item.className = 'proj-item' + (p.id === currentProjId ? ' active' : '');
    item.innerHTML = `
      <div class="proj-item-dot" style="background:${p.color}"></div>
      <span class="proj-item-name">${p.name}${p._isShared ? ' <span class="collab-shared-badge">共享</span>' : ''}</span>
      ${!p._isShared ? `<span class="proj-item-edit" onclick="openEditProjModal(${p.id},event)" title="編輯此專案">✎</span>` : ''}
      ${!p._isShared ? `<span class="proj-item-del" onclick="deleteProject(${p.id},event)" title="刪除此專案">✕</span>` : ''}
    `;
    item.addEventListener('click', () => switchProject(p.id));
    menu.appendChild(item);
  });
  const div = document.createElement('div'); div.className = 'proj-menu-div';
  menu.appendChild(div);
  const add = document.createElement('div');
  add.className = 'proj-item proj-item-new';
  add.innerHTML = '＋ 建立新專案';
  add.onclick = () => { closeProjMenuOnly(); openProjModal(); };
  menu.appendChild(add);
}

function deleteProject(id, e) {
  e.stopPropagation();
  const p = projects.find(x => x.id === id);
  if (!p || p._isShared) return;
  if (!confirm(`確定要刪除「${p.name}」嗎？此操作無法復原。`)) return;
  projects = projects.filter(x => x.id !== id);
  closeProjMenuOnly();
  const ownedLeft = projects.filter(x => !x._isShared);
  if (ownedLeft.length === 0) {
    // 全部刪完：重置狀態，更新 header
    currentProjId = null;
    tasks = [];
    nextId = 1;
    saveToCloud();
    updateProjUI();
    renderProjMenu();
    render();
  } else if (id === currentProjId) {
    switchProject((ownedLeft[0] || projects[0]).id);
    saveToCloud();
  } else {
    renderProjMenu();
    saveToCloud();
  }
}

let _editingProjId = null;

function openEditProjModal(id, e) {
  if (e) e.stopPropagation();
  closeProjMenuOnly();
  const p = projects.find(x => x.id === id);
  if (!p) return;
  _editingProjId = id;
  document.getElementById('projModalTitle').textContent = '✎ 編輯專案';
  document.getElementById('projSubmitBtn').textContent = '儲存';
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

function openProjModal() {
  _editingProjId = null;
  document.getElementById('projModalTitle').textContent = '◆ 建立新專案';
  document.getElementById('projSubmitBtn').textContent = '建立專案';
  document.getElementById('pName').value = '';
  document.getElementById('pStart').value = TODAY_STR;

  // Inject template row dynamically (handles browser HTML cache)
  if (!document.getElementById('pTemplate')) {
    const startRow = document.getElementById('pStart').closest('.form-row');
    const tplRow = document.createElement('div');
    tplRow.className = 'form-row';
    tplRow.id = 'tplRow';
    tplRow.innerHTML =
      '<label class="form-lbl">套用範本</label>' +
      '<select class="form-ctrl" id="pTemplate" onchange="onTemplateChange()">' +
      '<option value="">— 空白專案 —</option></select>';
    startRow.insertAdjacentElement('afterend', tplRow);
    const prevDiv = document.createElement('div');
    prevDiv.id = 'templatePreview';
    prevDiv.style.cssText = 'display:none;margin:4px 0 0;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;font-size:11px;color:var(--t3);line-height:1.6';
    tplRow.insertAdjacentElement('afterend', prevDiv);
  }

  // Fill template options
  const sel = document.getElementById('pTemplate');
  sel.innerHTML = '<option value="">— 空白專案 —</option>' +
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

function onTemplateChange() {
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
    .map(t => t.name).join('　→　');
  preview.innerHTML = `<b>範本內容：</b>${groups} 個階段、${tasks} 個任務、${miles} 個里程碑<br>
    <span style="color:var(--t4)">${phases}</span>`;
  preview.style.display = '';
  // Auto-fill name if empty (use short default, not full template name)
  const nameEl = document.getElementById('pName');
  if (!nameEl.value.trim()) {
    const today = new Date();
    const ym = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0');
    nameEl.value = (tpl.defaultName || tpl.name.split('（')[0]) + ' ' + ym;
    setTimeout(() => { nameEl.select(); }, 60);
  }
  // Update color dot to template color
  document.getElementById('projColorDot').style.background = tpl.color || getNextGroupColor();
}

function closeProjModal(e) {
  if (!e || e.target === document.getElementById('projOverlay'))
    document.getElementById('projOverlay').classList.remove('open');
}

function selectColor(el) {
  document.querySelectorAll('.color-opt').forEach(x => x.classList.remove('active'));
  el.classList.add('active');
}

function submitProject() {
  const name = document.getElementById('pName').value.trim();
  if (!name) { document.getElementById('pName').focus(); return; }
  const start = document.getElementById('pStart').value;

  // 重複名稱提醒：與其他專案同名容易混淆，提示使用者改名（建立與編輯模式皆適用）
  const dupName = projects.some(p => p.id !== _editingProjId && p.name === name);
  if (dupName && !confirm(`已有名稱為「${name}」的專案，重複名稱容易混淆，建議改用不同名稱。\n\n仍要使用這個名稱嗎？`)) {
    document.getElementById('pName').focus();
    return;
  }

  // 編輯模式：更新現有專案
  if (_editingProjId !== null) {
    const p = projects.find(x => x.id === _editingProjId);
    if (p) {
      p.name = name;
      p.startDate = start;
      CHART_START = new Date(start);
      scheduleTasks();
      recalcProjEnd();
      updateProjUI();
      render();
      saveToLS();
      if (currentUser) saveToCloud();
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
  const d = new Date(start);
  d.setMonth(d.getMonth() + (tpl ? 12 : 3));
  const end = d.toISOString().slice(0, 10);

  const newProj = {
    id: nextProjId++,
    name, color,
    startDate: start,
    endDate: end,
    nextId: projNextId,
    ownerId: getOwnerId(),
    tasks: projTasks
  };
  projects.push(newProj);
  document.getElementById('projOverlay').classList.remove('open');
  if (curProj()) curProj().nextId = nextId; // 儲存舊專案的 nextId（無舊專案時跳過）
  currentProjId = newProj.id;
  tasks  = curProj().tasks;
  nextId = curProj().nextId;
  CHART_START = new Date(start);
  CHART_END   = new Date(end);
  collapsed.clear();
  scheduleTasks();
  recalcProjEnd();
  updateProjUI();
  render();
  saveToLS();
  if (currentUser) saveToCloud();
}

/* ═══════════════════════════════════════════
   SCROLL SYNC
═══════════════════════════════════════════ */
function setupSync() {
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

/* ═══════════════════════════════════════════
   COLUMN RESIZER
═══════════════════════════════════════════ */
const COL_WIDTHS = [28, null, 86, 86, 52, 130, 36, 68]; // null = 1fr

function applyColGrid() {
  const tpl = COL_WIDTHS.map(w => w === null ? 'minmax(320px,400px)' : w + 'px').join(' ');
  document.documentElement.style.setProperty('--cg', tpl);
}

function setupColResizers() {
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

/* ═══════════════════════════════════════════
   RESIZER
═══════════════════════════════════════════ */
function setupResizer() {
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
   VERSION MANAGEMENT
═══════════════════════════════════════════ */
function curVersions() {
  const p = curProj();
  if (!p.versions) p.versions = [];
  return p.versions;
}

function openVersionPanel() {
  document.getElementById('verPanel').classList.add('open');
  document.getElementById('verBackdrop').classList.add('open');
  renderVersionList();
  setTimeout(() => document.getElementById('verNameInput').focus(), 200);
}

function closeVersionPanel() {
  document.getElementById('verPanel').classList.remove('open');
  document.getElementById('verBackdrop').classList.remove('open');
}

function createVersion() {
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

function restoreVersion(vId) {
  const v = curVersions().find(v => v.id === vId);
  if (!v) return;
  if (!confirm(`還原至版本「${v.name}」？\n目前變更將被覆蓋，此操作無法復原。`)) return;
  curProj().tasks = JSON.parse(JSON.stringify(v.snapshot));
  tasks = curProj().tasks;
  collapsed.clear();
  render();
  closeVersionPanel();
  showStatus('✓ 已還原至「' + v.name + '」');
}

function deleteVersion(vId) {
  const vs = curVersions();
  const v = vs.find(v => v.id === vId);
  if (!v) return;
  if (!confirm(`刪除版本「${v.name}」？`)) return;
  curProj().versions = vs.filter(v => v.id !== vId);
  renderVersionList();
  render();
}

function renderVersionList() {
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
        <button class="ver-btn ver-btn-restore" onclick="restoreVersion(${v.id})">還原此版本</button>
        <button class="ver-btn ver-btn-del" onclick="deleteVersion(${v.id})">刪除</button>
      </div>
    `;
    el.appendChild(item);
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
  D.currentUser = currentUser;
  D.PPD = PPD;
  D.CHART_START = CHART_START;
  D.CHART_END = CHART_END;
  D.TODAY = TODAY;
  D.TODAY_STR = TODAY_STR;
  D.ROW_H = ROW_H;
  D.BAR_H = BAR_H;
  D.MS_ROW_H = MS_ROW_H;

  // Function refs (stable, but harmless to reassign)
  D.curProj = curProj;
  D.taskById = taskById;
  D.getVisibleRows = getVisibleRows;
  D.getRowNum = getRowNum;
  D.dateToX = dateToX;
  D.totalW = totalW;
  D.avColor = avColor;
  D.groupBounds = groupBounds;
  D.groupProgress = groupProgress;
  D.buildDepsText = buildDepsText;
  D.getTaskDepth = getTaskDepth;
  D.getCriticalPredTaskIds = getCriticalPredTaskIds;
  D.updateStats = updateStats;
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
  D.reorderTask = reorderTask;
  D.pushHistory = pushHistory;
  D.render = render;
  D.scheduleTasks = scheduleTasks;
  D.recalcProjEnd = recalcProjEnd;
  D.saveToLS = saveToLS;
  D.saveToCloud = saveToCloud;
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
