import {
	getHoliday,
	isNonWorkday,
	subtractWorkingDays,
	addWorkingDays,
	nextWorkingDay,
	shiftWorkingDays,
	countWorkingDays,
} from "./core/calendar.js";
import * as Tree from "./core/tree.js";
import * as Deps from "./core/deps.js";
import * as CPM from "./core/critical-path.js";
import * as Schedule from "./core/schedule.js";
import * as Format from "./core/format.js";
import * as DateUtils from "./core/date.js";
import { validateProject, validateProjects } from "./core/validate.js";
import { D } from "./render/deps.js";
import {
	highlightRow,
	getPredIds,
	getSuccIds,
	highlightDeps,
	showTT,
	moveTT,
	hideTT,
} from "./render/tooltip.js";
import {
	computeWorkload,
	renderWorkloadPanel,
	renderWorkloadChart,
} from "./render/workload.js";
import { renderGrid } from "./render/grid.js";
import {
	renderBar,
	renderGroupBar,
	attachBarDrag,
	getWorkingSegs,
} from "./render/bar.js";
import {
	renderMilestone,
	renderMilestoneTimeline,
} from "./render/milestone.js";
import { renderArrows } from "./render/arrows.js";
import { renderChartHeader } from "./render/chart-header.js";
import { renderChartBody } from "./render/chart-body.js";
import { renderTaskPanel } from "./render/task-panel.js";
import {
	modalOpen,
	populateModal,
	syncWday,
	syncEndFromWday,
	updateModalForType,
	setupDepsInputListener,
	renderDepsDropdown,
	addDepToInput,
	openModal,
	openModalUnder,
	openEditModal,
	closeModal,
	openNameEditor,
	openDateEditor,
	openStartEditor,
	openEndEditor,
	openWdayEditor,
	addTaskInline,
	confirmDeleteTask,
	closeDeleteModal,
	executeDeleteTask,
	submitTask,
	toggleDepsMenu,
	closeDepsOutside,
	toggleDepOpt,
	removeDepTag,
	updateDepsTags,
	renderDepsMenu,
	openDepsEditor,
	openAllDepsEditor,
	cancelInlineEditors,
} from "./ui/modal.js";
import {
	switchProject,
	updateProjUI,
	toggleProjMenu,
	closeProjOnOutside,
	closeProjMenuOnly,
	renderProjMenu,
	deleteProject,
	openEditProjModal,
	openProjModal,
	onTemplateChange,
	closeProjModal,
	selectColor,
	submitProject,
} from "./ui/project.js";
import {
	onSettingBarDatesChange,
	onSettingBaselineChange,
	setBaseline,
	toggleSettings,
	toggleExportMenu,
	closeExportMenu,
	closeSettings,
	applyZoom,
	zoomIn,
	zoomOut,
	fitToFrame,
	scrollToToday,
	updateStats,
	toggleDark,
	curVersions,
	openVersionPanel,
	closeVersionPanel,
	createVersion,
	restoreVersion,
	deleteVersion,
	renderVersionList,
} from "./ui/settings.js";
import {
	setupSync,
	applyColGrid,
	setupColResizers,
	setupResizer,
} from "./interactions.js";
import {
	signInWithGoogle,
	signInAsGuest,
	checkAuthorized,
	submitRegister,
	signOut,
	isAdmin,
} from "./auth.js";
import {
	openShareModal,
	closeShareModal,
	copyShareLink,
	openCollabModal,
	closeCollabModal,
	onCollabProjChange,
	addShare,
	removeShare,
} from "./collab.js";
import { auth, googleProvider } from "./data/firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import * as Local from "./data/local.js";
import * as Share from "./data/share.js";
import * as Remote from "./data/remote.js";
import {
	initI18n,
	translateDOM,
	t,
	setLocale,
	getLocale,
} from "./i18n/index.js";
import { initContextMenu, showContextMenu } from "./ui/context-menu.js";
import { logAudit } from "./data/audit.js";
/* ═══════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════ */
let CHART_START = new Date("2026-04-01");
let CHART_END = new Date("2026-07-31");
document.getElementById("sTodayDisplay").textContent = formatDate(
	Math.floor(Date.now() / 86400000),
);
const ROW_H = 36;
const BAR_H = 20;

const PPDS = { day: 36, week: 20, month: 8 };
let PPD = PPDS.week;
let viewMode = "week";
let milestoneView = false;
let workloadView = false;
let showBarDates = true;
let showBaseline = true;
let showWBS = false;
const MS_ROW_H = 160;

const AV_COLORS = {
	Paul: "#5E6AD2",
	Xiaoming: "#10B981",
	Meihua: "#F59E0B",
	Designer: "#EC4899",
	Backend: "#3B82F6",
	Frontend: "#8B5CF6",
	"AI-Eng": "#EF4444",
	"QA-Eng": "#6B7280",
	DevOps: "#D97706",
};

// 群組色盤：10 個視覺清晰的色彩，依序分配
const GROUP_PALETTE = [
	"#5E6AD2", // indigo
	"#10B981", // emerald
	"#F59E0B", // amber
	"#EF4444", // red
	"#8B5CF6", // violet
	"#3B82F6", // blue
	"#EC4899", // pink
	"#14B8A6", // teal
	"#F97316", // orange
	"#84CC16", // lime
];

function getNextGroupColor() {
	// Collect all group colors used across all projects
	const used = new Set(
		projects.flatMap((p) =>
			p.tasks.filter((t) => t.type === "group").map((t) => t.color),
		),
	);
	// Pick first palette color not yet used
	const pick = GROUP_PALETTE.find((c) => !used.has(c));
	if (pick) return pick;
	// All used → cycle by count of existing groups
	const total = projects.reduce(
		(s, p) => s + p.tasks.filter((t) => t.type === "group").length,
		0,
	);
	return GROUP_PALETTE[total % GROUP_PALETTE.length];
}

/* ═══════════════════════════════════════════
   PROJECT TEMPLATES
═══════════════════════════════════════════ */
const TEMPLATES = [
	{
		id: "hardware",
		name: "Hardware Product Development & Mass Production",
		defaultName: "Hardware Product Development Plan",
		color: "#0EA5E9",
		tasks: [
			{
				id: 1,
				name: "{{PROJECT_NAME}}",
				type: "group",
				parent: null,
				color: "#0EA5E9",
			},

			{
				id: 2,
				name: "Requirements",
				type: "group",
				parent: 1,
				color: "#818CF8",
			},
			{
				id: 3,
				name: "Market Research",
				type: "task",
				parent: 2,
				color: "#818CF8",
				wday: 10,
				deps: [],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 4,
				name: "Product Spec Definition",
				type: "task",
				parent: 2,
				color: "#818CF8",
				wday: 8,
				deps: [3],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 5,
				name: "Competitive Analysis",
				type: "task",
				parent: 2,
				color: "#818CF8",
				wday: 5,
				deps: [],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 6,
				name: "Spec Freeze",
				type: "milestone",
				parent: 2,
				color: "#5E6AD2",
				deps: [4],
				date: "",
			},

			{
				id: 7,
				name: "Concept Design",
				type: "group",
				parent: 1,
				color: "#60A5FA",
			},
			{
				id: 8,
				name: "System Architecture",
				type: "task",
				parent: 7,
				color: "#60A5FA",
				wday: 10,
				deps: [6],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 9,
				name: "Hardware Concept Design",
				type: "task",
				parent: 7,
				color: "#60A5FA",
				wday: 8,
				deps: [8],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 10,
				name: "Industrial Design",
				type: "task",
				parent: 7,
				color: "#60A5FA",
				wday: 8,
				deps: [8],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 11,
				name: "CDR Concept Design Review",
				type: "milestone",
				parent: 7,
				color: "#3B82F6",
				deps: [9, 10],
				date: "",
			},

			{
				id: 12,
				name: "Detailed Design",
				type: "group",
				parent: 1,
				color: "#34D399",
			},
			{
				id: 13,
				name: "Schematic Design",
				type: "task",
				parent: 12,
				color: "#34D399",
				wday: 15,
				deps: [11],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 14,
				name: "PCB Layout",
				type: "task",
				parent: 12,
				color: "#34D399",
				wday: 12,
				deps: [13],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 15,
				name: "Mechanical Design",
				type: "task",
				parent: 12,
				color: "#34D399",
				wday: 12,
				deps: [11],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 16,
				name: "Firmware Development",
				type: "task",
				parent: 12,
				color: "#34D399",
				wday: 20,
				deps: [13],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 17,
				name: "PDR Detailed Design Review",
				type: "milestone",
				parent: 12,
				color: "#10B981",
				deps: [14, 15],
				date: "",
			},

			{
				id: 18,
				name: "EVT Prototyping",
				type: "group",
				parent: 1,
				color: "#FBBF24",
			},
			{
				id: 19,
				name: "PCB Fabrication",
				type: "task",
				parent: 18,
				color: "#FBBF24",
				wday: 10,
				deps: [17],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 20,
				name: "Parts Prototyping",
				type: "task",
				parent: 18,
				color: "#FBBF24",
				wday: 10,
				deps: [17],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 21,
				name: "Assembly & Debug",
				type: "task",
				parent: 18,
				color: "#FBBF24",
				wday: 5,
				deps: [19, 20],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 22,
				name: "EVT Prototype Complete",
				type: "milestone",
				parent: 18,
				color: "#F59E0B",
				deps: [21],
				date: "",
			},

			{
				id: 23,
				name: "DVT Verification",
				type: "group",
				parent: 1,
				color: "#F87171",
			},
			{
				id: 24,
				name: "Functional Testing",
				type: "task",
				parent: 23,
				color: "#F87171",
				wday: 10,
				deps: [22],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 25,
				name: "Environmental Stress Testing",
				type: "task",
				parent: 23,
				color: "#F87171",
				wday: 10,
				deps: [22],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 26,
				name: "Safety Certification",
				type: "task",
				parent: 23,
				color: "#F87171",
				wday: 15,
				deps: [24],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 27,
				name: "Issue Fixing & Revision",
				type: "task",
				parent: 23,
				color: "#F87171",
				wday: 10,
				deps: [24, 25],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 28,
				name: "DVT Verification Complete",
				type: "milestone",
				parent: 23,
				color: "#EF4444",
				deps: [26, 27],
				date: "",
			},

			{
				id: 29,
				name: "PVT Mass Production Prep",
				type: "group",
				parent: 1,
				color: "#A78BFA",
			},
			{
				id: 30,
				name: "Supplier Confirmation",
				type: "task",
				parent: 29,
				color: "#A78BFA",
				wday: 10,
				deps: [28],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 31,
				name: "Manufacturing Engineering",
				type: "task",
				parent: 29,
				color: "#A78BFA",
				wday: 10,
				deps: [28],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 32,
				name: "Pilot Run",
				type: "task",
				parent: 29,
				color: "#A78BFA",
				wday: 15,
				deps: [30, 31],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 33,
				name: "PVT Production Prep Complete",
				type: "milestone",
				parent: 29,
				color: "#8B5CF6",
				deps: [32],
				date: "",
			},

			{
				id: 34,
				name: "MP Mass Production",
				type: "group",
				parent: 1,
				color: "#10B981",
			},
			{
				id: 35,
				name: "Mass Production",
				type: "task",
				parent: 34,
				color: "#10B981",
				wday: 20,
				deps: [33],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 36,
				name: "Quality Control",
				type: "task",
				parent: 34,
				color: "#10B981",
				wday: 15,
				deps: [35],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 37,
				name: "MP First Shipment",
				type: "milestone",
				parent: 34,
				color: "#059669",
				deps: [35],
				date: "",
			},
		],
	},
];

/* ═══════════════════════════════════════════
   PROJECTS DATA
═══════════════════════════════════════════ */
let projects = [
	{
		id: 2,
		name: "Hardware Product Development & Mass Production",
		color: "#0EA5E9",
		startDate: "2026-05-04",
		endDate: "2027-03-31",
		nextId: 38,
		tasks: [
			{
				id: 1,
				name: "Hardware Product Development & Mass Production",
				type: "group",
				parent: null,
				color: "#0EA5E9",
			},

			{
				id: 2,
				name: "Requirements",
				type: "group",
				parent: 1,
				color: "#818CF8",
			},
			{
				id: 3,
				name: "Market Research",
				type: "task",
				parent: 2,
				color: "#818CF8",
				wday: 10,
				deps: [],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 4,
				name: "Product Spec Definition",
				type: "task",
				parent: 2,
				color: "#818CF8",
				wday: 8,
				deps: [3],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 5,
				name: "Competitive Analysis",
				type: "task",
				parent: 2,
				color: "#818CF8",
				wday: 5,
				deps: [],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 6,
				name: "Spec Freeze",
				type: "milestone",
				parent: 2,
				color: "#5E6AD2",
				deps: [4],
				date: "",
			},

			{
				id: 7,
				name: "Concept Design",
				type: "group",
				parent: 1,
				color: "#60A5FA",
			},
			{
				id: 8,
				name: "System Architecture",
				type: "task",
				parent: 7,
				color: "#60A5FA",
				wday: 10,
				deps: [6],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 9,
				name: "Hardware Concept Design",
				type: "task",
				parent: 7,
				color: "#60A5FA",
				wday: 8,
				deps: [8],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 10,
				name: "Industrial Design",
				type: "task",
				parent: 7,
				color: "#60A5FA",
				wday: 8,
				deps: [8],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 11,
				name: "CDR Concept Design Review",
				type: "milestone",
				parent: 7,
				color: "#3B82F6",
				deps: [9, 10],
				date: "",
			},

			{
				id: 12,
				name: "Detailed Design",
				type: "group",
				parent: 1,
				color: "#34D399",
			},
			{
				id: 13,
				name: "Schematic Design",
				type: "task",
				parent: 12,
				color: "#34D399",
				wday: 15,
				deps: [11],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 14,
				name: "PCB Layout",
				type: "task",
				parent: 12,
				color: "#34D399",
				wday: 12,
				deps: [13],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 15,
				name: "Mechanical Design",
				type: "task",
				parent: 12,
				color: "#34D399",
				wday: 12,
				deps: [11],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 16,
				name: "Firmware Development",
				type: "task",
				parent: 12,
				color: "#34D399",
				wday: 20,
				deps: [13],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 17,
				name: "PDR Detailed Design Review",
				type: "milestone",
				parent: 12,
				color: "#10B981",
				deps: [14, 15],
				date: "",
			},

			{
				id: 18,
				name: "EVT Prototyping",
				type: "group",
				parent: 1,
				color: "#FBBF24",
			},
			{
				id: 19,
				name: "PCB Fabrication",
				type: "task",
				parent: 18,
				color: "#FBBF24",
				wday: 10,
				deps: [17],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 20,
				name: "Parts Prototyping",
				type: "task",
				parent: 18,
				color: "#FBBF24",
				wday: 10,
				deps: [17],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 21,
				name: "Assembly & Debug",
				type: "task",
				parent: 18,
				color: "#FBBF24",
				wday: 5,
				deps: [19, 20],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 22,
				name: "EVT Prototype Complete",
				type: "milestone",
				parent: 18,
				color: "#F59E0B",
				deps: [21],
				date: "",
			},

			{
				id: 23,
				name: "DVT Verification",
				type: "group",
				parent: 1,
				color: "#F87171",
			},
			{
				id: 24,
				name: "Functional Testing",
				type: "task",
				parent: 23,
				color: "#F87171",
				wday: 10,
				deps: [22],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 25,
				name: "Environmental Stress Testing",
				type: "task",
				parent: 23,
				color: "#F87171",
				wday: 10,
				deps: [22],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 26,
				name: "Safety Certification",
				type: "task",
				parent: 23,
				color: "#F87171",
				wday: 15,
				deps: [24],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 27,
				name: "Issue Fixing & Revision",
				type: "task",
				parent: 23,
				color: "#F87171",
				wday: 10,
				deps: [24, 25],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 28,
				name: "DVT Verification Complete",
				type: "milestone",
				parent: 23,
				color: "#EF4444",
				deps: [26, 27],
				date: "",
			},

			{
				id: 29,
				name: "PVT Mass Production Prep",
				type: "group",
				parent: 1,
				color: "#A78BFA",
			},
			{
				id: 30,
				name: "Supplier Confirmation",
				type: "task",
				parent: 29,
				color: "#A78BFA",
				wday: 10,
				deps: [28],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 31,
				name: "Manufacturing Engineering",
				type: "task",
				parent: 29,
				color: "#A78BFA",
				wday: 10,
				deps: [28],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 32,
				name: "Pilot Run",
				type: "task",
				parent: 29,
				color: "#A78BFA",
				wday: 15,
				deps: [30, 31],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 33,
				name: "PVT Production Prep Complete",
				type: "milestone",
				parent: 29,
				color: "#8B5CF6",
				deps: [32],
				date: "",
			},

			{
				id: 34,
				name: "MP Mass Production",
				type: "group",
				parent: 1,
				color: "#10B981",
			},
			{
				id: 35,
				name: "Mass Production",
				type: "task",
				parent: 34,
				color: "#10B981",
				wday: 20,
				deps: [33],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 36,
				name: "Quality Control",
				type: "task",
				parent: 34,
				color: "#10B981",
				wday: 15,
				deps: [35],
				done: false,
				start: "",
				end: "",
			},
			{
				id: 37,
				name: "MP First Shipment",
				type: "milestone",
				parent: 34,
				color: "#059669",
				deps: [35],
				date: "",
			},
		],
	},
];
let currentProjId = 2;
let nextProjId = 3;

// SSOT INVARIANT: tasks must always reference the same array as curProj().tasks.
// Mutate in-place (push/splice/length=0); NEVER reassign (tasks = newArray breaks the link).
// On project switch/load: tasks = curProj().tasks (sync FROM project).
let tasks = projects[0].tasks;
let nextId = projects[0].nextId;

function curProj() {
	return projects.find((p) => p.id === currentProjId);
}

/* ═══════════════════════════════════════════
   STATE
═══════════════════════════════════════════ */
let collapsed = new Set();
let isDark = false;

/* ─── UNDO HISTORY ─── */
const MAX_HISTORY = 50;

function getHistory() {
	if (!curProj()) return [];
	if (!curProj()._history) curProj()._history = [];
	return curProj()._history;
}

function pushHistory() {
	if (!curProj()) return;
	const h = getHistory();
	// Deep clone tasks and metadata
	h.push({
		tasks: JSON.parse(JSON.stringify(tasks)),
		nextId,
		startDate: curProj().startDate,
		endDate: curProj().endDate,
		name: curProj().name,
		color: curProj().color,
	});
	if (h.length > MAX_HISTORY) h.shift();
	const btn = document.getElementById("undoBtn");
	if (btn) btn.disabled = false;
}

function undo() {
	const h = getHistory();
	if (!h.length || !curProj()) return;
	const snap = h.pop();
	curProj().tasks = snap.tasks;
	curProj().nextId = snap.nextId;
	curProj().startDate = snap.startDate;
	curProj().endDate = snap.endDate;
	curProj().name = snap.name;
	curProj().color = snap.color;
	tasks = curProj().tasks;
	nextId = curProj().nextId;
	CHART_START = new Date(curProj().startDate);
	CHART_END = new Date(curProj().endDate);
	scheduleTasks();
	recalcProjEnd();
	render();
	const btn = document.getElementById("undoBtn");
	if (btn) btn.disabled = getHistory().length === 0;
}

/* ═══════════════════════════════════════════
   UTILS
═══════════════════════════════════════════ */
/* format adapters: pure logic in core/format.js; bind global config. */
function dateToX(str) {
	return Format.dateToX(str, CHART_START, PPD);
}
function avColor(name) {
	return Format.avColor(name, AV_COLORS);
}
const { toStr, initials, darkenColor, hexToRgba, esc } = Format;
const { diffDays, addDays, parseDate, formatDate } = DateUtils;

function totalW() {
	return Math.round((diffDays(toStr(CHART_END), toStr(CHART_START)) + 1) * PPD);
}

/* tree-query adapters: pure logic in core/tree.js; bind global state.
   Removed when state.js lands (Phase 2.x). */
const { getTreeLines } = Tree;
function taskById(id) {
	return Tree.taskById(tasks, id);
}
function hasMilestoneDescendant(id) {
	return Tree.hasMilestoneDescendant(tasks, id);
}
function getRowNum(taskId) {
	return Tree.getRowNum(tasks, collapsed, milestoneView, taskId);
}
function getTaskByRowNum(num) {
	return Tree.getTaskByRowNum(tasks, collapsed, milestoneView, num);
}
function getVisibleRows() {
	return Tree.getVisibleRows(tasks, collapsed, milestoneView);
}
function groupBounds(id) {
	return Tree.groupBounds(tasks, id);
}
function groupProgress(id) {
	return Tree.groupProgress(tasks, id);
}
function getAllDescendants(id) {
	return Tree.getAllDescendants(tasks, id);
}
function isDescendant(ancestorId, checkId) {
	return Tree.isDescendant(tasks, ancestorId, checkId);
}
function getTaskDepth(id) {
	return Tree.getTaskDepth(tasks, id);
}

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
	tasks
		.filter((t) => tasks.some((c) => c.parent === t.id))
		.forEach((t) => collapsed.add(t.id));
	render();
}

/* ═══════════════════════════════════════════
   VIEW MODE
═══════════════════════════════════════════ */
function setView(v) {
	viewMode = v;
	PPD = PPDS[v];
	document.querySelectorAll("#viewBtns .btn").forEach((b) => {
		b.classList.toggle("active", b.dataset.v === v);
	});
	updateChartStart();
	render();
}

/* ── WORKLOAD VIEW (extracted to src/render/workload.js) ── */

function setChartView(v) {
	milestoneView = v === "milestone";
	workloadView = v === "workload";
	document.querySelectorAll("#chartViewBtns .btn").forEach((b) => {
		b.classList.toggle("active", b.dataset.cv === v);
	});
	document.body.classList.toggle("ms-view", milestoneView);
	render();
}

/* ── CRITICAL PATH ── */
let showCriticalPath = false;
let criticalTaskIds = new Set();

/* critical-path adapters: pure logic in core/critical-path.js; bind global state. */
const { prevWorkingDay } = CPM;
function computeCriticalPath() {
	return CPM.computeCriticalPath(tasks);
}
function getCriticalPredTaskIds(task) {
	return CPM.getCriticalPredTaskIds(tasks, criticalTaskIds, task);
}

function toggleCriticalPath() {
	showCriticalPath = !showCriticalPath;
	document.getElementById("cpBtn").classList.toggle("active", showCriticalPath);
	if (showCriticalPath) criticalTaskIds = computeCriticalPath();
	else criticalTaskIds = new Set();
	render();
}

function toggleWBS() {
	showWBS = !showWBS;
	document.body.classList.toggle("show-wbs", showWBS);
	localStorage.setItem("gp_showWBS", showWBS ? "1" : "0");
	document.getElementById("wbsBtn")?.classList.toggle("active", showWBS);
	render();
}

/* deps adapters: pure logic in core/deps.js; bind global state. */
function buildDepsText(task) {
	return Deps.buildDepsText(tasks, collapsed, milestoneView, task);
}
function wouldCreateCycle(taskId, newDepId) {
	return Deps.wouldCreateCycle(tasks, taskId, newDepId);
}

const { lagsFromParsed } = Deps;
function parseDepInput(val, taskId) {
	return Deps.parseDepInput(val, taskId, tasks, collapsed, milestoneView);
}

/* schedule adapters: pure logic in core/schedule.js; bind global state. */
function allGroupMembersScheduled(groupId, scheduled) {
	return Schedule.allGroupMembersScheduled(tasks, groupId, scheduled);
}
function scheduleTasks() {
	const p = curProj();
	return p ? Schedule.scheduleTasks(tasks, p.startDate) : [];
}

function reorderTask(srcId, targetId, insertBefore) {
	const src = taskById(srcId);
	const target = taskById(targetId);
	if (!src || !target) return;
	if (isDescendant(srcId, targetId)) return; // prevent cycle

	pushHistory();

	// New parent: dropping on a group row → child of that group
	//             dropping on task/milestone → sibling of target
	src.parent =
		target.type === "group" && !insertBefore ? target.id : target.parent;

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
	if (!task) {
		showStatus(t("modal.outdentLimit"));
		return;
	}
	if (task.parent === null) {
		showStatus(t("modal.outdentLimit"));
		return;
	}
	const parent = taskById(task.parent);
	if (!parent || parent.parent === null) {
		showStatus(t("modal.outdentLimit"));
		return;
	}

	pushHistory();

	// Collect task + all its descendants (preserve order)
	const subtreeIds = new Set();
	function collectSubtree(tid) {
		subtreeIds.add(tid);
		tasks.filter((c) => c.parent === tid).forEach((c) => collectSubtree(c.id));
	}
	collectSubtree(id);
	const subtree = tasks.filter((t) => subtreeIds.has(t.id));

	// Remove subtree from main array
	const _remaining = tasks.filter((t) => !subtreeIds.has(t.id));
	tasks.length = 0;
	tasks.push(..._remaining);

	// Find insertion point: after last descendant of parent in remaining tasks.
	// Build a Set of all descendants of `parent` first, then a single linear scan.
	const parentDescendants = new Set();
	const stack = [parent.id];
	while (stack.length) {
		const pid = stack.pop();
		for (const c of tasks) {
			if (c.parent === pid) {
				parentDescendants.add(c.id);
				stack.push(c.id);
			}
		}
	}
	const parentIdx = tasks.findIndex((t) => t.id === parent.id);
	let insertIdx = parentIdx;
	for (let i = parentIdx + 1; i < tasks.length; i++) {
		if (parentDescendants.has(tasks[i].id)) insertIdx = i;
	}

	// Update parent and reinsert after parent's subtree
	task.parent = parent.parent;
	tasks.splice(insertIdx + 1, 0, ...subtree);

	scheduleTasks();
	recalcProjEnd();
	render();
}

function showStatus(msg) {
	let el = document.getElementById("statusToast");
	if (!el) {
		el = document.createElement("div");
		el.id = "statusToast";
		el.style.cssText =
			"position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--t1);color:var(--surface);padding:6px 16px;border-radius:8px;font-size:12px;z-index:9999;opacity:0;transition:opacity .25s;pointer-events:none";
		document.body.appendChild(el);
	}
	el.textContent = msg;
	el.style.opacity = "1";
	clearTimeout(el._t);
	el._t = setTimeout(() => (el.style.opacity = "0"), 2000);
}

function indentTask(id) {
	const task = tasks.find((t) => t.id === id);
	if (!task) {
		showStatus(t("modal.indentNoPrev"));
		return;
	}
	const myIdx = tasks.findIndex((t) => t.id === id);
	let prevSibling = null;
	for (let i = myIdx - 1; i >= 0; i--) {
		if (tasks[i].parent === task.parent) {
			prevSibling = tasks[i];
			break;
		}
	}
	if (!prevSibling) {
		showStatus(t("modal.indentNoPrev"));
		return;
	}
	if (getTaskDepth(prevSibling.id) + 1 >= 5) {
		showStatus(t("modal.indentLimit"));
		return;
	}
	pushHistory();
	task.parent = prevSibling.id;
	scheduleTasks();
	recalcProjEnd();
	render();
}

function updateChartStart() {
	let minDate = null;
	tasks.forEach((t) => {
		const s = t.start || t.date;
		if (s && (!minDate || s < minDate)) minDate = s;
	});
	const baseStart = minDate || curProj()?.startDate;
	if (!baseStart) return;
	const dayPad = Math.max(1, Math.ceil(30 / PPD));
	CHART_START = new Date((parseDate(baseStart) - dayPad) * 86400000);
}

function recalcProjEnd() {
	if (!curProj()) return;
	const nodes = tasks.filter(
		(t) => (t.type === "task" && t.end) || (t.type === "milestone" && t.date),
	);
	let maxEnd = "";
	nodes.forEach((t) => {
		const e = t.type === "task" ? t.end : t.date;
		if (e > maxEnd) maxEnd = e;
	});
	if (maxEnd && maxEnd > curProj().endDate) {
		curProj().endDate = maxEnd;
		CHART_END = new Date(maxEnd);
		// Expand chart by 1 month to give room
		const d = new Date(maxEnd);
		d.setMonth(d.getMonth() + 1);
		const newStr = formatDate(Math.floor(d.getTime() / 86400000));
		if (newStr > curProj().endDate) curProj().endDate = newStr;
		CHART_END = new Date(curProj().endDate);
		persist();
	}
	const sPeriod = document.getElementById("sPeriod");
	if (sPeriod)
		sPeriod.textContent = `${curProj().startDate} ~ ${curProj().endDate}`;
}
/* ═══════════════════════════════════════════
   OWNER & SHARE SYSTEM
═══════════════════════════════════════════ */
let isReadOnly = false;
let _isShareLinkMode = false;

function updateReadOnly() {
	const cp = curProj();
	// Use !! to ensure boolean (avoid undefined causing toggle() to act as actual toggle)
	isReadOnly = !!(_isShareLinkMode || isReadOnlyShared(cp));
	document.body.classList.toggle("readonly", isReadOnly);
	const badge = document.querySelector(".readonly-badge");
	if (badge) badge.style.display = isReadOnly ? "flex" : "none";
	// shareBtn and collabBtn only for own projects
	const isOwnProj = !_isShareLinkMode && !isSharedProject(cp);
	["shareBtn", "collabBtn"].forEach((id) => {
		const el = document.getElementById(id);
		if (el) el.style.display = isOwnProj ? "" : "none";
	});
}

function getOwnerId() {
	return Local.getOwnerId();
}

/* ═══════════════════════════════════════════
   COLLABORATION — SHARED PROJECTS
═══════════════════════════════════════════ */
let _sharedChannels = [];
const _shareMap = new Map();

function shareKey(ownerId, projectId) {
	return `${ownerId}:${projectId}`;
}
function recordShare(ownerId, projectId, permission) {
	_shareMap.set(shareKey(ownerId, projectId), permission);
}
function getSharePermission(ownerId, projectId) {
	return _shareMap.get(shareKey(ownerId, projectId));
}
function isSharedProject(proj) {
	return (
		proj &&
		proj.ownerId &&
		currentUser &&
		proj.ownerId !== currentUser.uid &&
		_shareMap.has(shareKey(proj.ownerId, proj.id))
	);
}
function isReadOnlyShared(proj) {
	return (
		isSharedProject(proj) &&
		getSharePermission(proj.ownerId, proj.id) === "read"
	);
}
function stripSharedFlags(proj) {
	const p = { ...proj };
	delete p._isShared;
	delete p._permission;
	delete p._ownerId;
	delete p.shareToken;
	return p;
}

async function loadSharedProjects() {
	if (!currentUser) return;
	try {
		const shares = await Remote.getProjectSharesForEmail(currentUser.email);
		if (!shares.length) return;

		const byOwner = {};
		shares.forEach((s) => {
			if (!byOwner[s.owner_id]) byOwner[s.owner_id] = [];
			byOwner[s.owner_id].push(s);
		});

		for (const [ownerId, ownerShares] of Object.entries(byOwner)) {
			const ownerData = await Remote.readUserData(ownerId);
			if (!ownerData?.projects) continue;

			ownerShares.forEach((share) => {
				const raw = ownerData.projects.find((p) => p.id == share.project_id);
				if (!raw) return;
				recordShare(ownerId, share.project_id, share.permission);
				if (projects.find((p) => p.id === raw.id && p.ownerId === ownerId))
					return;
				const proj = validateProject(raw);
				if (!proj) return;
				proj.ownerId = ownerId;
				projects.push(proj);
			});
		}

		setupSharedRealtime(Object.keys(byOwner));
	} catch (e) {
		console.error("loadSharedProjects:", e);
	}
}

function setupSharedRealtime(ownerIds) {
	_sharedChannels.forEach((unsub) => unsub());
	_sharedChannels = [];

	ownerIds.forEach((ownerId) => {
		let skipFirst = true;
		const unsub = Remote.watchUserData(ownerId, async (snap) => {
			if (skipFirst) {
				skipFirst = false;
				return;
			}
			// Skip if we are currently saving to avoid clobbering in-flight writes
			if (_pendingCloudWrites.size > 0) return;
			if (snap && snap.id !== ownerId) return;

			const ownerData = snap ? snap.data()?.data || null : await Remote.readUserData(ownerId);
			if (!ownerData?.projects) return;
			projects = projects.map((p) => {
				if (p.ownerId === ownerId) {
					const raw = ownerData.projects.find((op) => op.id === p.id);
					if (raw) {
						const fresh = validateProject(raw);
						if (fresh) {
							fresh.ownerId = ownerId;
							return fresh;
						}
					}
				}
				return p;
			});
			if (curProj()?.ownerId === ownerId) {
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
   KEYBOARD SHORTCUTS
═══════════════════════════════════════════ */
function toggleShortcutsOverlay() {
	let el = document.getElementById("shortcutsOverlay");
	if (!el) return;
	el.classList.toggle("open");
}

document.addEventListener("keydown", (e) => {
	if ((e.ctrlKey || e.metaKey) && e.key === "z") {
		e.preventDefault();
		undo();
		return;
	}
	if (document.querySelector(".overlay.open, .panel.open")) return;
	if (
		e.key !== "Escape" &&
		(e.target.tagName === "INPUT" || e.target.tagName === "SELECT")
	)
		return;
	if (e.key === "e") expandAll();
	if (e.key === "c") collapseAll();
	if (e.key === "f") fitToFrame();
	if (e.key === "r") setChartView("workload");
	if (e.key === "g") setChartView("gantt");
	if (e.key === "?") toggleShortcutsOverlay();
	if (e.key === "t" || e.key === "T") scrollToToday();
	if (e.key === "d") setView("day");
	if (e.key === "w") setView("week");
	if (e.key === "m") setView("month");
	if (e.key === "n") openModal();
	if (e.altKey && (e.key === "w" || e.key === "W")) {
		e.preventDefault();
		toggleWBS();
	}
	if (e.key === "Escape") {
		closeModal();
		closeProjModal();
		closeProjMenuOnly();
		closeDeleteModal();
	}
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
	D.showWBS = showWBS;
	D.isDark = isDark;
	D.PPD = PPD;
	D.PPDS = PPDS;
	D.CHART_START = CHART_START;
	D.CHART_END = CHART_END;
	D.TODAY = new Date(formatDate(Math.floor(Date.now() / 86400000)));
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
	D.openEditModal = openEditModal;
	D.addTaskInline = addTaskInline;
	D.indentTask = indentTask;
	D.outdentTask = outdentTask;
	D.confirmDeleteTask = confirmDeleteTask;
	D.toggleCollapse = toggleCollapse;
	D.toggleProjMenu = toggleProjMenu;
	D.closeProjMenuOnly = closeProjMenuOnly;
	D.renderProjMenu = renderProjMenu;
	D.switchProject = switchProject;
	D.reorderTask = reorderTask;
	D.pushHistory = pushHistory;
	D.render = render;
	D.scheduleTasks = scheduleTasks;
	D.recalcProjEnd = recalcProjEnd;
	D.saveToLS = saveToLS;
	D.saveToCloud = saveToCloud;
	D.persist = persist;
	D.isSharedProject = isSharedProject;
	D.isReadOnlyShared = isReadOnlyShared;
	D.showStatus = showStatus;
	D.scrollToToday = scrollToToday;
	D.getNextGroupColor = getNextGroupColor;
	D.getOwnerId = getOwnerId;
	D.consumeNextId = () => {
		const id = nextId++;
		if (curProj()) curProj().nextId = nextId;
		D.nextId = nextId;
		return id;
	};
	D.loadProject = (proj) => {
		cancelInlineEditors();
		if (curProj()) curProj().nextId = nextId;
		currentProjId = proj.id;
		tasks = proj.tasks;
		nextId = proj.nextId;
		CHART_START = new Date(proj.startDate);
		CHART_END = new Date(proj.endDate);
		collapsed.clear();
		_history = [];
		D.currentProjId = currentProjId;
		D.tasks = tasks;
		D.nextId = nextId;
		D.CHART_START = CHART_START;
		D.CHART_END = CHART_END;
	};
	D.resetState = () => {
		currentProjId = null;
		tasks = [];
		nextId = 1;
		D.currentProjId = null;
		D.tasks = [];
		D.nextId = 1;
	};
	D.setProjects = (arr) => {
		projects = arr;
		D.projects = arr;
	};
	D.setCurrentProjId = (id) => {
		currentProjId = id;
		D.currentProjId = id;
	};
	D.setChartStart = (d) => {
		CHART_START = d;
		D.CHART_START = d;
	};
	D.setChartEnd = (d) => {
		CHART_END = d;
		D.CHART_END = d;
	};
	D.loadTasksFromSnapshot = (snap) => {
		const p = curProj();
		if (!p) return;
		p.tasks = JSON.parse(JSON.stringify(snap));
		tasks = p.tasks;
		collapsed.clear();
		D.tasks = tasks;
	};
	D.setShowBarDates = (v) => {
		showBarDates = v;
		D.showBarDates = v;
	};
	D.setShowBaseline = (v) => {
		showBaseline = v;
		D.showBaseline = v;
	};
	D.setIsDark = (v) => {
		isDark = v;
		D.isDark = v;
	};
	D.setPPD = (v) => {
		PPD = v;
		D.PPD = v;
	};
	D.arrowStyle = localStorage.getItem("gp_arrowStyle") || "bezier";

	// Auth/callback refs for auth/collab/admin modules
	D.GetCurrentUser = () => currentUser;
	D.SetCurrentUser = (u) => {
		currentUser = u;
		D.currentUser = u;
	};
	D.SetGuestMode = (v) => {
		_guestMode = v;
		D._guestMode = v;
	};
	D.SetAppInitialized = (v) => {
		_appInitialized = v;
		D._appInitialized = v;
	};
	D.IsGuestMode = () => _guestMode;
	D.initApp = initApp;
	D.cleanupRealtime = cleanupRealtime;
	D.setSyncDot = setSyncDot;
}

let _saveTimer = null;
function render() {
	syncRenderDeps();
	renderTaskPanel();
	renderChartHeader();
	renderChartBody();
	const undoBtn = document.getElementById("undoBtn");
	if (undoBtn) undoBtn.disabled = getHistory().length === 0;
}

function debounceSaveToCloud() {
	if (!currentUser) return;
	clearTimeout(_saveTimer);
	_saveTimer = setTimeout(() => saveToCloud(), 600);
}

function persist() {
	_dirtySinceCloud = true;
	saveToLS();
	debounceSaveToCloud();
}

/* ═══════════════════════════════════════════
   CLOUD SYNC STATE (Firebase init in src/data/firebase.js)
═══════════════════════════════════════════ */
let _cloudSaveSeq = 0;
let _dirtySinceCloud = false;
const _pendingCloudWrites = new Set();
let currentUser = null;
let _guestMode = false;
let _appInitialized = false;

const _syncChannel = new BroadcastChannel("gantt_sync");
let _syncReloadTimer = null;

/* Offline queue: saveToCloud always pushes full state, so we only need
   a flag to know a push is pending. Flush on reconnect or next init. */
function setOfflinePending() {
	const q = JSON.parse(localStorage.getItem("gantt_offline_queue") || "[]");
	if (!q.includes("pending")) {
		q.push("pending");
		localStorage.setItem("gantt_offline_queue", JSON.stringify(q));
	}
}

function clearOfflinePending() {
	localStorage.removeItem("gantt_offline_queue");
}

function hasOfflinePending() {
	return JSON.parse(localStorage.getItem("gantt_offline_queue") || "[]").length > 0;
}

_syncChannel.onmessage = (e) => {
	if (e.data?.type === "save") {
		if (_pendingCloudWrites.size > 0 || modalOpen || _dirtySinceCloud) return;
		// Debounce: another tab saved. Wait briefly in case the user
		// is also editing, then reload. Prevents clobbering unsaved work.
		clearTimeout(_syncReloadTimer);
		_syncReloadTimer = setTimeout(async () => {
			if (_dirtySinceCloud || _pendingCloudWrites.size > 0) return;
			const ok = await loadFromCloud();
			if (ok) {
				if (projects.length) {
					scheduleTasks();
					recalcProjEnd();
				}
				saveToLS();
				updateProjUI();
				render();
				showSyncToast();
			}
		}, 400);
	}
};

function setSyncDot(state) {
	const dot = document.getElementById("syncDot");
	if (!dot) return;
	dot.className = "sync-dot" + (state ? " " + state : "");
	dot.title =
		{
			saving: t("status.syncSaving"),
			ok: t("status.syncOk"),
			err: t("status.syncErr"),
			off: t("status.syncOff"),
			local: t("status.syncLocal"),
		}[state] || t("status.syncDefault");
}

async function _saveToCloudInner() {
	if (curProj()) curProj().nextId = nextId;
	const cp = curProj();

	if (!cp) {
		await Remote.writeUserData(currentUser.uid, {
			projects: [],
			currentProjId: null,
			nextProjId,
		});
		setSyncDot("ok");
		_dirtySinceCloud = false;
	} else if (
		isSharedProject(cp) &&
		getSharePermission(cp.ownerId, cp.id) === "edit"
	) {
		await Remote.updateSharedProjectAtomic(cp.ownerId, stripSharedFlags(cp));
		setSyncDot("ok");
		_dirtySinceCloud = false;
	} else if (!isSharedProject(cp)) {
		const ownProjects = projects
			.filter((p) => !isSharedProject(p))
			.map(stripSharedFlags);
		await Remote.writeUserData(currentUser.uid, {
			projects: ownProjects,
			currentProjId,
			nextProjId,
		});
		setSyncDot("ok");
		_dirtySinceCloud = false;
	}
}

async function saveToCloud() {
	if (!currentUser) return;
	setSyncDot("saving");
	const token = ++_cloudSaveSeq;

	if (!navigator.onLine) {
		setOfflinePending();
		setSyncDot("err");
		return;
	}

	const savePromise = _saveToCloudInner();
	_pendingCloudWrites.add(savePromise);

	try {
		await savePromise;
		_syncChannel.postMessage({ type: "save" });
	} catch (e) {
		console.error("saveToCloud failed", e);
		setSyncDot("err");
		if (e.message && e.message.includes("offline")) {
			setOfflinePending();
		}
	} finally {
		_pendingCloudWrites.delete(savePromise);
	}
}

window.addEventListener("online", () => {
	if (hasOfflinePending()) {
		clearOfflinePending();
		saveToCloud();
	}
});

async function loadFromCloud() {
	if (!currentUser) return false;
	try {
		const s = await Remote.readUserData(currentUser.uid);
		if (!s) return false;
		projects = validateProjects(s.projects || []);
		nextProjId = s.nextProjId ?? 1;
		if (!projects.length) {
			// User intentionally cleared all projects
			currentProjId = null;
			tasks = [];
			nextId = 1;
			return true;
		}
		currentProjId =
			s.currentProjId && projects.find((p) => p.id === Number(s.currentProjId))
				? Number(s.currentProjId)
				: projects[0].id;
		tasks = curProj().tasks;
		nextId = curProj().nextId;
		CHART_START = new Date(curProj().startDate);
		CHART_END = new Date(curProj().endDate);
		return true;
	} catch (e) {
		return false;
	}
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
	} catch (e) {
		return null;
	}
}

let _realtimeUnsub = null;

function cleanupRealtime() {
	if (_realtimeUnsub) {
		_realtimeUnsub();
		_realtimeUnsub = null;
	}
	_sharedChannels.forEach((unsub) => unsub());
	_sharedChannels = [];
	_shareMap.clear();
	clearTimeout(_saveTimer);
	_saveTimer = null;
}

function setupRealtime() {
	if (!currentUser) return;
	if (_realtimeUnsub) _realtimeUnsub();
	let skipFirst = true;
	_realtimeUnsub = Remote.watchUserData(currentUser.uid, async () => {
		if (skipFirst) {
			skipFirst = false;
			return;
		}
		if (_pendingCloudWrites.size > 0) return;
		if (_dirtySinceCloud) return;
		if (modalOpen) return;
		const ok = await loadFromCloud();
		if (ok) {
			if (projects.length) {
				scheduleTasks();
				recalcProjEnd();
			}
			saveToLS();
			updateProjUI();
			render();
			showSyncToast();
		}
	});
}

function showSyncToast() {
	let el = document.getElementById("syncToast");
	if (!el) {
		el = document.createElement("div");
		el.id = "syncToast";
		el.style.cssText =
			"position:fixed;bottom:20px;right:20px;background:var(--t1);color:var(--surface);padding:8px 14px;border-radius:8px;font-size:12px;z-index:9999;opacity:0;transition:opacity .3s";
		document.body.appendChild(el);
	}
	el.textContent = "📡 " + t("status.dataUpdated");
	el.style.opacity = "1";
	setTimeout(() => (el.style.opacity = "0"), 2500);
}

/* ═══════════════════════════════════════════
   LOCALSTORAGE
═══════════════════════════════════════════ */
function saveToLS() {
	try {
		if (curProj()) curProj().nextId = nextId;
		const ownProjects = projects
			.filter((p) => !isSharedProject(p))
			.map(stripSharedFlags);
		Local.saveToLS({ projects: ownProjects, currentProjId, nextProjId });
	} catch (e) {
		console.error("saveToLS:", e);
	}
}

function loadFromLS() {
	try {
		const d = Local.loadFromLS();
		if (!d?.projects?.length) return false;
		projects = validateProjects(d.projects);
		nextProjId = d.nextProjId ?? projects.length + 1;
		currentProjId =
			d.currentProjId && projects.find((p) => p.id === Number(d.currentProjId))
				? Number(d.currentProjId)
				: projects[0].id;
		tasks = curProj().tasks;
		nextId = curProj().nextId;
		CHART_START = new Date(curProj().startDate);
		CHART_END = new Date(curProj().endDate);
		return true;
	} catch (e) {
		return false;
	}
}

function showApp() {
	document.getElementById("loginScreen").style.display = "none";
	document.getElementById("appToolbar").style.display = "flex";
	document.getElementById("main").style.display = "flex";
}

function isSafeAvatarUrl(url) {
	try {
		const u = new URL(url);
		return u.protocol === "https:";
	} catch {
		return false;
	}
}

function updateUserDisplay() {
	if (!currentUser) return;
	const name = currentUser.displayName || currentUser.email || "";
	const avatar = isSafeAvatarUrl(currentUser.photoURL)
		? currentUser.photoURL
		: null;
	const el = document.getElementById("userDisplay");
	if (!el) return;
	el.innerHTML = avatar
		? `<img src="${esc(avatar)}" title="${esc(name)}" style="width:26px;height:26px;border-radius:50%;object-fit:cover">`
		: `<div title="${esc(name)}" style="width:26px;height:26px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700">${esc(name[0] || "U").toUpperCase()}</div>`;
	document.getElementById("signOutBtn").style.display = "";
}

async function initApp() {
	if (_appInitialized) return;
	_appInitialized = true;
	// Clear header immediately before showing app, preventing cached name flash
	const _nameEl = document.getElementById("projSelectorName");
	if (_nameEl) _nameEl.textContent = "";
	showApp();
	updateUserDisplay();
	// Clear hardcoded demo data before cloud load to prevent flash
	projects = [];
	currentProjId = null;
	tasks = [];

	if (navigator.onLine && hasOfflinePending()) {
		clearOfflinePending();
		// If we had pending offline writes, we should load from local storage first, then save to cloud
		loadFromLS();
		saveToCloud();
	}

	const cloudOk = await loadFromCloud();
	if (!cloudOk) loadFromLS();
	await loadSharedProjects();
	setupRealtime();
	updateProjUI();
	if (projects.length) {
		scheduleTasks();
		recalcProjEnd();
	}
	render();
	setSyncDot(cloudOk ? "ok" : _guestMode ? "off" : "err");
	setTimeout(scrollToToday, 120);
	const adminBtn = document.getElementById("adminBtn");
	if (adminBtn) adminBtn.style.display = isAdmin() ? "" : "none";
	if (_guestMode) {
		const el = document.getElementById("userDisplay");
		if (el)
			el.innerHTML = `<div title="Guest mode (local)" style="width:26px;height:26px;border-radius:50%;background:var(--t4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700">G</div>`;
		document.getElementById("signOutBtn").style.display = "";
	}
}

/* ═══════════════════════════════════════════
   EVENT WIRING — replaces all inline onclick/onchange/onkeydown
═══════════════════════════════════════════ */
function wireStaticEvents() {
	const $ = (id) => document.getElementById(id);
	const clk = (id, fn) => {
		const el = $(id);
		if (el) el.addEventListener("click", fn);
	};
	const overlayClose = (id, fn) => {
		const el = $(id);
		if (el)
			el.addEventListener("click", (e) => {
				if (e.target === el) fn();
			});
	};

	// ── Login ──
	clk("loginGoogleBtn", signInWithGoogle);
	const guestBtn = $("loginGuestBtn");
	if (guestBtn) {
		guestBtn.addEventListener("click", signInAsGuest);
		guestBtn.addEventListener(
			"mouseover",
			() => (guestBtn.style.background = "var(--s-hover)"),
		);
		guestBtn.addEventListener(
			"mouseout",
			() => (guestBtn.style.background = "transparent"),
		);
	}
	const regNick = $("registerNickname");
	if (regNick)
		regNick.addEventListener("keydown", (e) => {
			if (e.key === "Enter") submitRegister();
		});
	clk("registerSubmitBtn", submitRegister);

	// ── Toolbar ──
	const projSel = $("projSelector");
	if (projSel)
		projSel.addEventListener("click", (e) => {
			if (!e.target.closest("#projMenu")) toggleProjMenu(e);
		});
	clk("shareBtn", openCollabModal);
	clk("addTaskBtn", openModal);
	clk("undoBtn", undo);
	clk("todayBtn", scrollToToday);
	clk("expandAllBtn", expandAll);
	clk("collapseAllBtn", collapseAll);
	document
		.querySelectorAll("[data-cv]")
		.forEach((b) =>
			b.addEventListener("click", () => setChartView(b.dataset.cv)),
		);
	document
		.querySelectorAll("[data-v]")
		.forEach((b) => b.addEventListener("click", () => setView(b.dataset.v)));
	document
		.querySelectorAll("[data-zoom]")
		.forEach((b) =>
			b.addEventListener("click", () =>
				b.dataset.zoom === "in" ? zoomIn() : zoomOut(),
			),
		);
	clk("fitBtn", fitToFrame);
	clk("cpBtn", toggleCriticalPath);
	clk("wbsBtn", toggleWBS);
	clk("exportToggleBtn", toggleExportMenu);
	document.querySelectorAll("[data-export]").forEach((b) =>
		b.addEventListener("click", async () => {
			const {
				exportPNG,
				exportPDF,
				exportCSV,
				exportICalendar,
				openPrintSettings,
			} = await import("./export.js");
			const fmt = b.dataset.export;
			if (fmt === "png") exportPNG();
			else if (fmt === "pdf") exportPDF();
			else if (fmt === "csv") exportCSV();
			else if (fmt === "ical") exportICalendar();
			else if (fmt === "print") openPrintSettings();
			closeExportMenu();
		}),
	);
	clk("collabBtn", openCollabModal);
	clk("darkBtn", toggleDark);
	clk("settingsBtn", toggleSettings);
	const bd = $("settingBarDates");
	if (bd) bd.addEventListener("change", onSettingBarDatesChange);
	const bl = $("settingBaseline");
	if (bl) bl.addEventListener("change", onSettingBaselineChange);
	clk("setBaselineBtn", () => {
		setBaseline();
		closeSettings();
	});
	clk("settingVersionBtn", () => {
		openVersionPanel();
		closeSettings();
	});
	clk("worktimeBtn", async () => {
		const m = await import("./ui/worktime.js");
		m.openWorkTimeModal();
		closeSettings();
	});
	clk("adminBtn", () => import("./admin.js").then((m) => m.openAdminPanel()));
	clk("signOutBtn", async () => {
		if (_pendingCloudWrites.size > 0) {
			setSyncDot("saving");
			try {
				await Promise.allSettled(_pendingCloudWrites);
			} catch (e) {
				console.error("Error waiting for pending writes before signout", e);
			}
		}
		signOut();
	});

	// ── Version panel ──
	clk("verBackdrop", closeVersionPanel);
	clk("verCloseBtn", closeVersionPanel);
	const verName = $("verNameInput");
	if (verName)
		verName.addEventListener("keydown", (e) => {
			if (e.key === "Enter") createVersion();
		});
	clk("createVersionBtn", createVersion);

	// ── Share modal ──
	overlayClose("shareOverlay", closeShareModal);
	clk("shareCloseBtn", closeShareModal);
	clk("copyShareLinkBtn", copyShareLink);

	// ── Collab modal ──
	overlayClose("collabOverlay", closeCollabModal);
	const cProj = $("collabProjSelect");
	if (cProj) cProj.addEventListener("change", onCollabProjChange);
	const cEmail = $("collabEmailInput");
	if (cEmail)
		cEmail.addEventListener("keydown", (e) => {
			if (e.key === "Enter") addShare();
		});
	clk("addShareBtn", addShare);
	clk("closeCollabBtn", closeCollabModal);

	// ── Admin panel ──
	overlayClose("adminOverlay", () =>
		import("./admin.js").then((m) => m.closeAdminPanel()),
	);
	clk("closeAdminBtn", () =>
		import("./admin.js").then((m) => m.closeAdminPanel()),
	);

	// ── Delete modal ──
	overlayClose("deleteOverlay", () => closeDeleteModal());
	clk("deleteCancelBtn", () => closeDeleteModal());

	// ── Task modal ──
	overlayClose("overlay", () => closeModal());
	clk("taskModalCloseBtn", () => closeModal());
	const fType = $("fType");
	if (fType) fType.addEventListener("change", updateModalForType);
	const fDepsList = $("fDepsList");
	if (fDepsList) {
		fDepsList.addEventListener("mousedown", (e) => e.preventDefault());
		fDepsList.addEventListener("click", (e) => {
			const btn = e.target.closest('[data-action="add-dep"]');
			if (!btn) return;
			const exc = btn.dataset.exclude;
			addDepToInput(
				Number(btn.dataset.row),
				btn.dataset.type,
				exc === "null" ? null : Number(exc),
			);
		});
	}
	const fDone = $("fDone");
	if (fDone)
		fDone.addEventListener("click", () => {
			fDone.classList.toggle("done");
			fDone.textContent = fDone.classList.contains("done") ? "✓" : "";
			if (fDone.classList.contains("done")) $("fProgress").value = 100;
		});
	clk("taskCancelBtn", () => closeModal());
	clk("modal-submit", submitTask);

	// ── Advanced options toggle ──
	const advToggle = document.getElementById("modalAdvancedToggle");
	if (advToggle)
		advToggle.addEventListener("click", () =>
			document.getElementById("modalAdvanced")?.classList.toggle("collapsed"),
		);

	// ── Arrow style selector ──
	const arrowSel = document.getElementById("settingArrowStyle");
	if (arrowSel) {
		arrowSel.value = D.arrowStyle;
		arrowSel.addEventListener("change", () => {
			D.arrowStyle = arrowSel.value;
			localStorage.setItem("gp_arrowStyle", arrowSel.value);
			render();
		});
	}

	// ── Project modal ──
	overlayClose("projOverlay", () => closeProjModal());
	clk("projModalCloseBtn", () => closeProjModal());
	const pTpl = $("pTemplate");
	if (pTpl) pTpl.addEventListener("change", onTemplateChange);
	clk("projCancelBtn", () => closeProjModal());
	clk("projSubmitBtn", submitProject);

	// ── Dynamic delegation ──
	const verList = $("verList");
	if (verList)
		verList.addEventListener("click", (e) => {
			const btn = e.target.closest("[data-action]");
			if (!btn) return;
			const id = Number(btn.dataset.id);
			if (btn.dataset.action === "restore-version") restoreVersion(id);
			else if (btn.dataset.action === "delete-version") deleteVersion(id);
		});

	const projMenu = $("projMenu");
	if (projMenu)
		projMenu.addEventListener("click", (e) => {
			e.stopPropagation();
			const actEl = e.target.closest("[data-action]");
			if (actEl) {
				const pid = Number(actEl.dataset.pid);
				if (actEl.dataset.action === "edit-proj") openEditProjModal(pid, e);
				else if (actEl.dataset.action === "delete-proj") deleteProject(pid, e);
				return;
			}
			const item = e.target.closest(".proj-item");
			if (item && item.dataset.pid) switchProject(Number(item.dataset.pid));
		});

	const csl = $("collabShareList");
	if (csl)
		csl.addEventListener("click", (e) => {
			const btn = e.target.closest('[data-action="remove-share"]');
			if (!btn) return;
			removeShare(btn.dataset.shareId, btn.dataset.email);
		});

	const aul = $("adminUserList");
	if (aul)
		aul.addEventListener("click", (e) => {
			const btn = e.target.closest('[data-action="delete-user"]');
			if (!btn) return;
			import("./admin.js").then((m) => m.deleteUser(btn.dataset.email));
		});
}

/* ═══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
	await initI18n();
	translateDOM();
	wireStaticEvents();
	setupSync();
	setupColResizers();
	setupResizer();

	// Locale switcher: set initial value and wire change event
	const langSelect = document.getElementById("langSelect");
	if (langSelect) {
		langSelect.value = getLocale();
		langSelect.addEventListener("change", () => {
			setLocale(langSelect.value);
			render();
		});
	}

	// Restore WBS toggle state
	showWBS = localStorage.getItem("gp_showWBS") === "1";
	if (showWBS) document.body.classList.add("show-wbs");

	initContextMenu();

	syncRenderDeps();
	const urlParams = new URLSearchParams(location.search);
	const shareToken = urlParams.get("share");

	if (shareToken) {
		// Read-only share mode: load from gantt_shares table (no auth needed)
		_isShareLinkMode = true;
		showApp();
		const projData = await loadShareFromCloud(shareToken);
		if (!projData) {
			document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;flex-direction:column;gap:12px;color:#555">
        <div style="font-size:48px">🔗</div>
        <div style="font-size:18px;font-weight:600">Invalid or expired link</div>
        <div style="font-size:14px;color:#888">This share link does not exist or has been removed.</div>
      </div>`;
			return;
		}
		const validated = validateProject(projData);
		if (!validated) {
			document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;flex-direction:column;gap:12px;color:#555">
        <div style="font-size:48px">🔗</div>
        <div style="font-size:18px;font-weight:600">Invalid share data</div>
        <div style="font-size:14px;color:#888">This share link contains corrupted project data.</div>
      </div>`;
			return;
		}
		projects = [validated];
		currentProjId = validated.id;
		tasks = curProj().tasks;
		nextId = curProj().nextId || 100;
		CHART_START = new Date(curProj().startDate);
		CHART_END = new Date(curProj().endDate);
		isReadOnly = true;
		document.body.classList.add("readonly");
		setupColResizers();
		setupResizer();
		updateProjUI();
		scheduleTasks();
		recalcProjEnd();
		render();
		setSyncDot("off");
		setTimeout(scrollToToday, 120);
		return;
	}

	// Auth-required mode
	const revealLogin = () => {
		const chk = document.getElementById("authChecking");
		const panel = document.getElementById("loginPanel");
		if (chk) chk.style.display = "none";
		if (
			panel &&
			document.getElementById("registerPanel").style.display === "none"
		)
			panel.style.display = "flex";
	};
	// 保險：Firebase 無回應（離線、被擋）時 4 秒後仍顯示登入按鈕
	const authFallback = setTimeout(() => {
		if (!_appInitialized) revealLogin();
	}, 4000);

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
				const chk = document.getElementById("authChecking");
				if (chk) chk.style.display = "none";
			}
		} else {
			revealLogin();
		}
	});
});
