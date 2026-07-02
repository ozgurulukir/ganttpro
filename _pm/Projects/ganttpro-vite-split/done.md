# DONE — GanttPro Vite Split

Newest first. Move items here from todo.md as completed.

---

## 2026-07-02 — Phase 7: Export layer ✅

- **Goal achieved**: exportPNG, exportCSV, exportPDF extracted to `src/export.js`.
  main.js reduced 1736→1448 lines (288 removed).
- **Module**: `src/export.js` (295 lines) — 3 exported functions.
  Direct imports from `core/calendar.js` (countWorkingDays, nextWorkingDay) and
  `core/format.js` (darkenColor). D deps for state-bound wrappers (getVisibleRows,
  curProj, totalW, dateToX, groupBounds, buildDepsText) and state values
  (milestoneView, ROW_H, MS_ROW_H, TODAY_STR, CHART_START/END, PPD, etc.).
- **Build**: 47 modules, 672 kB bundle. 86 tests green.

## 2026-07-02 — Phase 6: Kill inline onclick + window shim ✅

- **Goal achieved**: all 71 static inline handlers in index.html and 8 dynamic
  innerHTML handlers replaced with `addEventListener` + event delegation.
  180-entry `Object.assign(window, {...})` shim deleted entirely.
- **index.html**: all `onclick`/`onchange`/`onkeydown`/`onmouseover`/`onmouseout`/
  `onmousedown` attributes removed. Elements given `id` or `data-*` attributes
  for querySelector targeting.
- **Dynamic innerHTML** (6 sites across modal.js, project.js, settings.js, main.js):
  converted to `data-action` attributes + event delegation on parent containers
  (`#verList`, `#fDepsList`, `#projMenu`, `#collabShareList`, `#adminUserList`).
- **wireStaticEvents()** function (~120 lines) in main.js: called once during
  `DOMContentLoaded`. Uses `overlayClose` helper for backdrop-click-to-close
  pattern (`e.target === e.currentTarget`).
- **main.js**: 1770→1735 lines net (added wireStaticEvents ~120 lines, removed
  shim ~180 lines).
- **Build**: 46 modules, 672 kB bundle. 86 tests green.

## 2026-07-02 — Phase 5: UI & interactions extraction ✅

- **Goal achieved**: all UI/modal/editors/project/settings/interactions code extracted
  into 4 ES modules. main.js reduced 3017→1770 lines (1247 lines removed).
- **Modules created**:
  - `ui/modal.js` (677 lines) — task editing modal, inline cell editors, deps picker,
    delete confirm. 27 exported functions. Modal-local state (`editingTaskId`,
    `selectedDeps`, `depsExcludeId`, `selectedSdeps`, `_deleteTargetId`) moved into module.
  - `ui/project.js` (287 lines) — project CRUD, menu, switch, templates.
    13 exported functions. Uses D setter callbacks (`loadProject`, `resetState`,
    `setProjects`) for state reassignment.
  - `ui/settings.js` (198 lines) — settings panel, zoom, stats, dark mode, baseline,
    versions. 18 exported functions. Includes click-outside listeners.
    Uses D setters (`setShowBarDates`, `setPPD`, `setIsDark`, `loadTasksFromSnapshot`).
  - `interactions.js` (88 lines) — scroll sync, column resizers, panel resizer.
    Self-contained (COL_WIDTHS as module const).
- **D object expansion**: added `projects`, `currentProjId`, `nextProjId`, `PPDS`,
  `isDark`, `TEMPLATES` state refs. Added setter callbacks: `consumeNextId`,
  `loadProject`, `resetState`, `setProjects`, `setCurrentProjId`, `setChartStart/End`,
  `loadTasksFromSnapshot`, `setShowBarDates/Baseline`, `setIsDark`, `setPPD`.
  Added function refs: `getAllDescendants`, `parseDepInput`, `updateReadOnly`,
  `showStatus`, `scrollToToday`, `getNextGroupColor`, `getOwnerId`, `switchProject`.
- **Build**: 46 modules, 681 kB bundle. 86 tests green.

## 2026-07-02 — Phase 4: Render layer extraction ✅

- **Goal achieved**: all DOM/canvas rendering code extracted into 10 ES modules
  under `src/render/`. main.js reduced from 4017 → 2951 lines.
- **Modules created**:
  - `deps.js` — shared mutable `D` object (populated by `syncRenderDeps()` each render).
  - `tooltip.js` — `highlightRow`, `highlightDeps`, `showTT`, `moveTT`, `hideTT`.
  - `workload.js` — `computeWorkload`, `renderWorkloadPanel`, `renderWorkloadChart`.
  - `grid.js` — `renderGrid` (month/week/day grid lines).
  - `bar.js` — `renderBar`, `renderGroupBar`, `attachBarDrag`, `getWorkingSegs`.
  - `milestone.js` — `renderMilestoneTimeline`, `renderMilestone`.
  - `arrows.js` — `renderArrows` (SVG FS/SS/FF/SF + critical path arrows).
  - `chart-header.js` — `renderChartHeader` (month labels + day/week cells).
  - `chart-body.js` — `renderChartBody` (canvas orchestration: grid + bars + arrows).
  - `task-panel.js` — `renderTaskPanel` (left-side table: name, dates, deps, actions).
- **Pattern**: shared `D` object + per-function destructuring. Core functions imported
  directly from `src/core/`. Inter-module render calls imported directly (acyclic DAG).
- **State migration**: `dragSrcId` moved from main.js `let` to `D.dragSrcId` (owned by
  task-panel.js). Dead variable removed. `currentUser` added to D for drag-save handlers.
- **Build**: 42 modules transformed, 678 kB bundle. 86 tests green.

## 2026-07-02 — Phase 3: Firebase seam + modular v9 migration ✅

- **Goal achieved**: all Firestore API calls live in `src/data/` modules. CDN compat
  scripts removed. Firebase loaded via npm modular v9 SDK. Removing Firebase = remove
  `src/data/` directory + clean up 2 imports in main.js.
- **New files** (4 data layer modules):
  - `src/data/firebase.js` — modular v9 init (initializeApp, getAuth, getFirestore),
    exports `auth`, `db`, `googleProvider`. FB_CONFIG lives here.
  - `src/data/local.js` — `saveToLS(data)`, `loadFromLS()`, `getOwnerId()`. Pure
    localStorage I/O, no app-state globals.
  - `src/data/share.js` — `encodeData()`, `decodeData()`, `getOrCreateShareToken()`,
    `saveShareDoc()`, `loadShareDoc()`. Imports firebase.js for Firestore share-doc ops.
  - `src/data/remote.js` — all Firestore CRUD wrappers across 3 collections
    (gantt_user_data, gantt_project_shares, gantt_allowed_users). 14 exported functions,
    each 2-5 lines. Pure I/O: take data, return data, no globals.
- **main.js changes** (net -62 lines, 4135 total):
  - Added 5 imports (auth, googleProvider, onAuthStateChanged, Local, Share, Remote).
  - Removed FB_CONFIG + firebase.initializeApp + `const auth = firebase.auth()` +
    `const db = firebase.firestore()` (moved to firebase.js).
  - Removed _encodeData, _decodeData, LS_KEY, getOwnerId body, getOrCreateShareToken
    body (moved to modules; thin wrappers remain for window shim).
  - 18 Firestore call sites migrated from compat chained API
    (`db.collection().doc().get/set/update/delete`) to functional v9 API via Remote
    wrappers (`Remote.readUserData()`, `Remote.writeUserData()`, etc.).
  - `new firebase.auth.GoogleAuthProvider()` → imported `googleProvider`.
  - `auth.onAuthStateChanged()` → `onAuthStateChanged(auth, ...)` (functional form).
  - Window shim: `_decodeData`/`_encodeData` now reference `Share.decodeData`/`Share.encodeData`.
  - `saveToLS` null-guard: `if (curProj()) curProj().nextId = nextId` (was bare, threw
    and was silently caught — now skips gracefully).
- **CDN removal**: 3 `<script>` tags removed from index.html head. No more
  `gstatic.com/firebasejs` dependency.
- **Bundle size**: 110 kB → 675 kB (Firebase SDK now bundled). Expected — tree-shaking
  and code-splitting can reduce this in future optimization passes.
- Verified: `node --check` all files clean, `npm test` 86/86 green, `npm run build`
  green (32 modules transformed), dev server boots OK.

---

## 2026-07-02 — Phase 2: Kill tasks SSOT violation ✅

- **Problem**: `tasks` (local var) and `curProj().tasks` (project property) were
  dual sources of truth. In-place mutations were safe (shared reference), but 4
  sites reassigned `tasks = newArray`, breaking the reference. Each required a
  manual `curProj().tasks = tasks` write-back — fragile and easy to forget.
- **Fix** (4 sites, 8 line changes):
  1. **Undo** (was line 216–219): Reversed to curProj-first pattern — write to
     `curProj()` then sync `tasks` FROM it (same as project switch).
  2. **Escape-cancel new task** (was line 2145): In-place mutation
     (`length=0; push(...filtered)`) instead of reassignment.
  3. **Delete task** (was line 2278–2279): Same in-place mutation pattern.
  4. **Outdent/move subtree** (was line 2659–2660): Same in-place mutation pattern.
- All 4 `curProj().tasks = tasks` write-backs removed. Zero remain (grep-verified).
- Added SSOT INVARIANT comment at `tasks` declaration documenting the rule.
- **Decision: state.js deferred.** `projects` is reassigned 5× and `currentProjId`
  8× — ES module bindings are read-only, so moving them requires a `state.xxx`
  object with ~120 reference renames. The actual SSOT bug (broken `tasks`
  references) is fixed without that churn. Full state.js creation deferred to when
  we're already doing large-scale renames (Phase 4–5).
- Verified: `npm test` 86/86 green, `npm run build` green, grep confirms zero
  write-backs remaining.

---

## 2026-07-02 — Phase 1.6: Extract `src/core/format.js` ✅ — PHASE 1 COMPLETE

- Moved 6 formatting/color helpers to a pure module. `dateToX(str, chartStart,
  ppd)` and `avColor(name, avColors)` parameterized; `toStr`, `initials`,
  `darkenColor`, `hexToRgba` are fully pure. AV_PALETTE const moved into module.
- `main.js` keeps thin bound wrappers (zero call-site changes; ~76 call sites).
- `tests/format.test.js`: 16 node:test tests, **all pass** — dateToX pixel math,
  toStr, initials (multi-word/CJK/whitespace), avColor (override/deterministic/
  distinct), darkenColor (0/1/50%/default), hexToRgba (valid/fallback).
- Verified: `node --check` clean, `npm test` 86/86 green, `npm run build` green.
- **Phase 1 exit criteria met**: all pure logic is in `src/core/` (calendar,
  tree, deps, critical-path, schedule, format), unit-tested, main.js imports it.
  86 characterization tests total. 1.7 single-commit plan superseded by
  per-module commits (1.1–1.6) for finer rollback granularity.

---

## 2026-07-02 — Phase 1.5: Extract `src/core/schedule.js` ✅

- Moved 3 scheduler functions (allGroupMembersScheduled, scheduleTasks,
  autoScheduleFromDeps) to a pure module; imports calendar.js (6 fns) +
  tree.js (taskById, groupBounds). State (tasks, projStart) passed as params.
- These MUTATE task objects in place (set start/end/date) — that's the
  scheduler's job; deterministic and testable because inputs are explicit.
- `main.js` keeps thin bound wrappers (zero call-site changes; scheduleTasks
  had 18 call sites).
- `tests/schedule.test.js`: 14 node:test tests, **all pass** — FS chain,
  wday>1 spans, SS (start-with), FF (finish-with), milestone dating, positive
  FS lag, group-bounds dependency, null-projStart no-op, autoScheduleFromDeps
  (push-later / already-later / milestone / no-deps).
- Verified: `node --check` clean, `npm test` 70/70 green, `npm run build` green.

---

## 2026-07-02 — Phase 1.4: Extract `src/core/critical-path.js` ✅

- Moved 3 CPM functions (prevWorkingDay, computeCriticalPath, getCriticalPredTaskIds)
  to a pure module; imports calendar.js (isNonWorkday, countWorkingDays,
  subtractWorkingDays, addWorkingDays, shiftWorkingDays) + tree.js (taskById).
- `main.js` keeps thin bound wrappers (zero call-site changes); Edit tool used
  directly now that Prettier is confirmed disabled (subagent probe verified).
- `tests/critical-path.test.js`: 11 node:test tests, **all pass** — prevWorkingDay
  (weekend/holiday skip), computeCriticalPath (linear chain all-critical, parallel
  paths with float, milestone exclusion from result set), getCriticalPredTaskIds
  (direct pred, milestone-transparent tracing, non-critical skip).
- Verified: `node --check` clean, `npm test` 56/56 green, `npm run build` green.

---

## 2026-07-02 — Phase 1.3: Extract `src/core/deps.js` ✅

- Moved 4 dependency functions to a pure module; imports tree.js resolvers
  (taskById, getRowNum, getTaskByRowNum). State passed as params.
- `main.js` keeps thin bound wrappers (zero call-site changes).
- `tests/deps.test.js`: 20 node:test tests, **all pass** — cycle detection
  (direct, transitive, sfdeps, pre-existing-cycle visited guard), parse
  validation (format / not-found / self / cycle errors, multi-entry), lags,
  and deps-text rendering with +/- lag suffixes.
- Verified: `node --check` clean, `npm test` 45/45 green, `npm run build` green.
- **Tooling**: Prettier-on-write is still active (user disable didn't take).
  Established workflow: Write tool for NEW core/test files (Prettier style ok),
  Python string surgery for main.js (avoid legacy-file churn).

---

## 2026-07-02 — Phase 1.2: Extract `src/core/tree.js` ✅

- Moved 12 tree functions to a pure module, parameterized with `tasks`
  (+ `collapsed`, `milestoneView` for getVisibleRows / getRowNum / getTaskByRowNum).
- `main.js` keeps thin bound wrappers (close over global `tasks` / `collapsed` /
  `milestoneView`) so ~95 call sites are unchanged; removed when state.js lands (2.x).
- Color helpers (darkenColor, hexToRgba) left in main.js → format.js in Phase 1.6.
- `tests/tree.test.js`: 16 node:test characterization tests, **all pass**.
- Verified: `node --check` both files, `npm test` 25/25 green, `npm run build` green.
- **Discovery**: Edit/Write tools run Prettier on `.js` save → whole-file reformat
  (+1576 lines churn). Bypassed via Python string surgery to keep the diff minimal
  (15 ins / 125 del). All future `.js` surgical edits must bypass the formatter.

---

## 2026-07-02 — Phase 1.1: Extract `src/core/calendar.js` ✅

- Moved 11 symbols (isWeekend, getHoliday, isNonWorkday, dateKey,
  addWorkingDays, subtractWorkingDays, nextWorkingDay, shiftWorkingDays,
  countWorkingDays, TW_HOLIDAYS, TW_MAKEUP_WORKDAYS) verbatim to a pure module.
- Self-contained — no parameterization needed (no globals referenced).
- `main.js` imports the 7 functions used in logic; window shim regenerated
  (calendar fns dropped — not onclick-referenced).
- `tests/calendar.test.js`: 9 node:test characterization tests, **all pass**.
- Verified: `node --check` both files, `npm test` green, `npm run build` green.

---

## 2026-07-01 — Phase 0: Scaffold & mechanical split ✅

- Vite 8.1.2 scaffolded (manual file creation — controlled for non-empty dir).
- `styles.css` (968 lines, from gantt.html 14–981).
- `src/main.js` (4579 lines, from 1349–5927) + temporary `window` exposure shim
  (169 functions) so inline `onclick` handlers resolve under `<script type=module>`.
  Shim removed in Phase 6.
- `index.html` (381 lines): head + `<link>` + Firebase CDN scripts + body +
  `<script type=module src="/src/main.js">`.
- Dev tooling: `package.json` (type=module, dev/build/preview/format scripts),
  `vite.config.js`, `.gitignore`, `.prettierrc`.
- Verified: `node --check src/main.js` OK, `npm run build` → dist/ (103 kB JS,
  34 kB CSS, 158 ms), dev server returns HTTP 200, Firebase CDN scripts preserved
  in dist (behavior-preserving).

### Plan revisions made during execution (update todo.md)

1. **0.6**: Kept Firebase CDN `<script>` tags in index.html (do NOT remove in
   Phase 0 — removing breaks the app since calls still use the `firebase` global).
   Removal now happens in Phase 3 alongside the modular-v9 migration.
2. **0.7**: Deferred `npm install firebase` to Phase 3 (YAGNI — nothing uses it yet).
3. **0.8**: Prettier added; **ESLint deferred** to post-Phase-6 (legacy code would
   emit hundreds of warnings until globals/onclick are cleaned up).

### Bug found in smoke test → fixed (2026-07-01)

- **Symptom**: login screen appeared but Google + Local buttons did nothing.
- **Root cause**: shim regex `^function ` missed `async function` —
  `signInWithGoogle`, `signInAsGuest` (both async) + 16 others never reached
  `window`, so inline `onclick` silently failed ("not defined").
- **Fix**: regenerated shim with `^(async )?function ` → 187 names exposed.
  Re-verified `node --check` + `npm run build` green (108 kB JS).
- **Remaining (NOT a code bug)**: Google `signInWithPopup` may still fail with
  `auth/unauthorized-domain` → add `localhost:5173` in Firebase console →
  Authentication → Settings → Authorized domains. Local/guest mode unaffected.

### Pending (user)

- **0.10 Browser smoke-test**: local mode ✅; Google login pending Firebase
  console `localhost` authorized-domain config (not a code issue).
- **0.11 Commit** ✅ `9bec5fa chore: scaffold vite + mechanical split`.
