# TODO — GanttPro Vite Split

Ordered execution plan. One module per commit. App stays runnable (green) after
every step. Each extraction is **verbatim cut/paste + import** — no logic changes
during extraction.

Legend: `[ ]` pending · `[~]` in progress · `[x]` done (move to done.md)

---

## Phase 0 — Scaffold & mechanical split (behavior-preserving) ✅ DONE

Goal: Vite boots, app runs identically to `gantt.html`. No logic change.

- [x] 0.1 Scaffold Vite (manual files — Vite 8.1.2, npm-installed)
- [x] 0.2 CSS (gantt.html 14–981) → `styles.css` (968 lines)
- [x] 0.3 HTML body (985–1346) → `index.html` (381 lines, Vite entry)
- [x] 0.4 JS (1349–5927) → `src/main.js` (4579 lines, unchanged)
- [x] 0.5 Wire `<link>` + `<script type="module" src="/src/main.js">`
- [x] 0.6 **REVISED**: Kept Firebase CDN `<script>` tags (removal in Phase 3) + added temporary `window` exposure shim (169 fns) for inline onclick
- [~] 0.7 **DEFERRED to Phase 3**: `npm install firebase` (nothing uses it yet)
- [x] 0.8 **PARTIAL**: Prettier `.prettierrc` + `.gitignore` done; **ESLint deferred
      to post-Phase-6** (legacy code would emit hundreds of warnings)
- [x] 0.9 Verified: `node --check` OK, `npm run build` → dist/ (103 kB JS/34 kB CSS),
      dev server HTTP 200, Firebase scripts preserved in dist
- [x] 0.10 **(user)** Browser smoke-test: local mode ✅ verified (render/edit/deps/CPM/
      export all Firebase-independent paths confirmed working). Google login
      pending Firebase console `localhost` authorized-domain config (not a code issue).
- [x] 0.11 Commit: `9bec5fa chore: scaffold vite + mechanical split`

**Exit criteria:** single-file app reproduced as Vite project, zero behavior change. ✅

---

## Phase 1 — Extract pure core (with tests)

Goal: the buggy, untested logic becomes a tested, DOM-free `src/core/`.
Rule 3 compliance: tests written as each module is extracted.

Principle: extracted functions take `tasks`/state as **parameters** (not globals),
so they're testable in Node. `main.js` passes current state at call sites.

- [x] 1.1 `src/core/calendar.js` — isWeekend, getHoliday, isNonWorkday, dateKey,
      addWorkingDays, subtractWorkingDays, nextWorkingDay, shiftWorkingDays,
      countWorkingDays, TW_HOLIDAYS, TW_MAKEUP_WORKDAYS
      → **9 node:test characterization tests, all pass**
- [ ] 1.2 `src/core/tree.js` — taskById, getVisibleRows, groupBounds, groupProgress,
      groupAllDone, isDescendant, getAllDescendants, getTaskDepth,
      hasMilestoneDescendant (1603–1712, 3853–3864, 4507–4513, 4600–4610)
      → tests
- [ ] 1.3 `src/core/deps.js` — wouldCreateCycle, parseDepInput, buildDepsText,
      lagsFromParsed (4228–4280, 4241–4254) → tests (cycle detection!)
- [ ] 1.4 `src/core/critical-path.js` — computeCriticalPath, getCriticalPredTaskIds,
      prevWorkingDay (3017–3147) → tests with known-good CPM cases
- [ ] 1.5 `src/core/schedule.js` — scheduleTasks, autoScheduleFromDeps,
      allGroupMembersScheduled (4358–4505) → tests (FS/SS/FF/SF + lag)
- [ ] 1.6 `src/core/format.js` — dateToX, toStr, initials, hexToRgba, darkenColor,
      avColor (1572–1647) → tests
- [ ] 1.7 Commit: `refactor: extract tested core (calendar/deps/cpm/schedule)`

**Exit criteria:** all pure logic in `src/core/`, unit-tested, `main.js` imports it.

---

## Phase 2 — Establish state store (SSOT)

Goal: kill the `tasks` ↔ `curProj().tasks` dual source of truth (review #9).

- [ ] 2.1 `src/state.js` — single store: projects, currentProjId, nextProjId,
      collapsed, isDark, viewMode, milestoneView, workloadView, showBarDates,
      showCriticalPath, showBaseline + accessors (curProj, getTasks, setTasks)
- [ ] 2.2 Replace all top-level `let` globals in main.js with imports from state.js
- [ ] 2.3 Remove manual `curProj().tasks = tasks` write-backs (now handled by store)
- [ ] 2.4 Commit: `refactor: single state store (SSOT)`

---

## Phase 3 — Extract data layer (Firebase seam)

Goal: isolate all Firebase into removable files. Directly enables future removal.

- [ ] 3.1 `src/data/local.js` — LS_KEY, saveToLS, loadFromLS, mergeDefaultProjects (5646–5733)
- [ ] 3.2 `src/data/remote.js` — FB_CONFIG, firebase init, saveToCloud, loadFromCloud,
      setupRealtime, setSyncDot (5480–5641)
- [ ] 3.3 `src/data/share.js` — saveShareToCloud, loadShareFromCloud,
      getOrCreateShareToken, _encodeData, _decodeData (5564–5610, 5082–5087)
- [ ] 3.4 Migrate compat SDK → modular v9 (`firebase/app`, `firebase/auth`, `firebase/firestore`)
      now loaded via npm (installed in 0.7)
- [ ] 3.5 Define a `DataBackend` interface (save/load/share/realtime) so local.js and
      remote.js share a contract — enables swapping backends later
- [ ] 3.6 Commit: `refactor: extract data layer, migrate to firebase v9 modular`

**Exit criteria:** Firebase lives only in `src/data/remote.js`. Removing it = one file.

---

## Phase 4 — Extract render layer

Goal: DOM/canvas code grouped by concern. Most coupled, least testable — do last.

- [ ] 4.1 `src/render/task-panel.js` — renderTaskPanel + helpers (1713–2009)
- [ ] 4.2 `src/render/chart-header.js` — renderChartHeader (2030–2137)
- [ ] 4.3 `src/render/chart-body.js` — renderChartBody, renderGrid (2138–2262)
- [ ] 4.4 `src/render/bar.js` — renderBar, renderGroupBar, attachBarDrag, getWorkingSegs (2263–2477)
- [ ] 4.5 `src/render/milestone.js` — renderMilestone, renderMilestoneTimeline (2478–2618)
- [ ] 4.6 `src/render/arrows.js` — renderArrows (2619–2800)
- [ ] 4.7 `src/render/workload.js` — computeWorkload, renderWorkloadPanel/Chart (2905–3000)
- [ ] 4.8 `src/render/tooltip.js` — showTT, moveTT, hideTT, highlightRow, highlightDeps (2801–2892)
- [ ] 4.9 `src/render/index.js` — orchestrates render() (5466–5475)
- [ ] 4.10 Commit: `refactor: extract render layer`

---

## Phase 5 — Extract UI & interactions

- [ ] 5.1 `src/ui/modal.js` — openModal, closeModal, submitTask, populateModal, deps UI (3540–3958, 4059–4357)
- [ ] 5.2 `src/ui/project.js` — openProjModal, submitProject, switchProject, renderProjMenu, deleteProject (4664–4955)
- [ ] 5.3 `src/ui/settings.js` — settings, baseline, versions, dark mode, stats (3011–3539, 5365–5446)
- [ ] 5.4 `src/interactions/dnd.js` — drag reorder (in renderTaskPanel + reorderTask 4514–4537)
- [ ] 5.5 `src/interactions/resize.js` — setupColResizers, setupResizer (4988–5047)
- [ ] 5.6 `src/interactions/scroll-sync.js` — setupSync (4956–4976)
- [ ] 5.7 `src/interactions/keyboard.js` — shortcuts (5451–5460)
- [ ] 5.8 Commit: `refactor: extract ui + interactions`

---

## Phase 6 — Replace inline `onclick` with `addEventListener`

Goal: kill global-function soup, enable tree-shaking. Required before build pays off.

- [ ] 6.1 Inventory all `onclick="fn()"` in index.html (~30+ handlers)
- [ ] 6.2 Wire each via `addEventListener` or event delegation in relevant module
- [ ] 6.3 Remove `window.fn = ...` exposures
- [ ] 6.4 Commit: `refactor: replace inline handlers with addEventListener`

---

## Phase 7 — Export layer

- [ ] 7.1 `src/export/png.js` (3157–3389), `pdf.js` (5112–5126), `csv.js` (3390–3426)
- [ ] 7.2 Commit

---

## Phase 8 — Auth / admin / collab (Firebase-dependent UI)

Goal: group removable Firebase UI for clean future removal.

- [ ] 8.1 `src/auth/` — signInWithGoogle, signInAsGuest, signOut, checkAuthorized, submitRegister, onAuthStateChanged (5738–5927)
- [ ] 8.2 `src/admin/` — admin panel (5309–5349)
- [ ] 8.3 `src/collab/` — collab modal, addShare, removeShare, loadSharedProjects (5131–5304)
- [ ] 8.4 Commit

---

## Phase 9 — Hardening (from review)

- [ ] 9.1 **Security**: verify/ship Firestore security rules (review #1, #2) — coordinate w/ Firebase console
- [ ] 9.2 **XSS**: add `esc()` helper, sweep all `innerHTML` sinks (review #3):
      renderProjMenu 4735, renderCollabModal 5256, loadAdminUsers 5330, renderVersionList 5437, deps tooltip 4316
- [ ] 9.3 **Timezone**: replace `new Date(str)` + `toISOString` mix with date-fns or explicit-zone math (review #10)
- [ ] 9.4 **Errors**: remove empty `catch(e){}`, surface failures (review #6)
- [ ] 9.5 Null-guard `curProj()` in saveToLS/saveToCloud (review #7)
- [ ] 9.6 Production: `npm run build` clean, smoke-test `dist/`
- [ ] 9.7 README + this plan cross-linked

---

## Final state

```
ganttpro/
  index.html              # markup only
  styles.css
  package.json            # vite, prettier, eslint, firebase, date-fns
  vite.config.js
  src/
    main.js               # init + wiring
    state.js              # single store
    core/                 # PURE + unit-tested
      calendar.js tree.js deps.js critical-path.js schedule.js format.js
    data/                 # ← Firebase seam
      local.js remote.js share.js
    render/ ui/ interactions/ export/ auth/ admin/ collab/
  dist/                   # build output (gitignored)
  tests/                  # node:test or vitest
```
