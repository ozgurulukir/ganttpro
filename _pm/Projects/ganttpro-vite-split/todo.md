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
- [x] 1.2 `src/core/tree.js` — taskById, getVisibleRows, groupBounds, groupProgress,
      groupAllDone, isDescendant, getAllDescendants, getTaskDepth,
      hasMilestoneDescendant, getRowNum, getTaskByRowNum, getTreeLines
      → **16 node:test tests, all pass**; thin bound wrappers in main.js (zero
      call-site changes); color helpers kept for format.js (1.6)
- [x] 1.3 `src/core/deps.js` — wouldCreateCycle, parseDepInput, buildDepsText,
      lagsFromParsed → **20 node:test tests, all pass** (cycle detection covered);
      imports tree.js resolvers; thin bound wrappers in main.js
- [x] 1.4 `src/core/critical-path.js` — computeCriticalPath, getCriticalPredTaskIds,
      prevWorkingDay → **11 node:test tests, all pass** (linear/parallel/milestone
      CPM cases + float classification); imports calendar.js + tree.js
- [x] 1.5 `src/core/schedule.js` — scheduleTasks, autoScheduleFromDeps,
      allGroupMembersScheduled → **14 node:test tests, all pass** (FS/SS/FF
      forward pass, lag, group bounds, milestones); imports calendar.js + tree.js
- [x] 1.6 `src/core/format.js` — dateToX, toStr, initials, hexToRgba, darkenColor,
      avColor → **16 node:test tests, all pass**; AV_PALETTE moved into module
- [x] 1.7 Commit — **superseded**: per-module commits (1.1–1.6) provide finer
      rollback granularity than the planned single commit

**Exit criteria:** all pure logic in `src/core/`, unit-tested, `main.js` imports it.

---

## Phase 2 — Kill tasks SSOT violation ✅ DONE

Goal: kill the `tasks` ↔ `curProj().tasks` dual source of truth (review #9).

- [x] 2.1 ~~`src/state.js` — single store~~ **DEFERRED**: `projects` is reassigned
      5×, `currentProjId` 8× — ES module read-only bindings require `state.xxx`
      object + ~120 renames. Actual SSOT bug fixed without it (see 2.3).
- [x] 2.2 ~~Replace all top-level `let` globals~~ **DEFERRED** (same rationale).
- [x] 2.3 Remove manual `curProj().tasks = tasks` write-backs — **DONE**: fixed 4
      broken `tasks = newArray` reassignments (in-place mutation or curProj-first
      pattern), removed all 4 write-backs. Zero remain (grep-verified).
- [x] 2.4 Commit

**Exit criteria:** `tasks` and `curProj().tasks` always share the same array
reference. ✅ Invariant documented at declaration.

---

## Phase 3 — Firebase seam + modular v9 ✅ DONE

Goal: isolate all Firebase into removable files. Directly enables future removal.

- [x] 3.1 `src/data/firebase.js` — modular v9 init, exports auth, db, googleProvider
- [x] 3.2 `src/data/local.js` — LS_KEY, saveToLS, loadFromLS, getOwnerId (pure)
- [x] 3.3 `src/data/share.js` — encodeData, decodeData, getOrCreateShareToken,
      saveShareDoc, loadShareDoc
- [x] 3.4 `src/data/remote.js` — Firestore CRUD wrappers for 3 collections (14 fns)
- [x] 3.5 Migrated compat SDK → modular v9 (18 Firestore call sites + auth)
- [x] 3.6 CDN script tags removed from index.html
- [x] 3.7 npm install firebase (12.15.0)
- [x] 3.8 DataBackend interface — **deferred**: remote.js already serves as the
      de-facto interface. Formalizing adds YAGNI complexity until a second backend exists.
- [x] 3.9 Commit

**Exit criteria:** All Firestore API calls in `src/data/`. CDN scripts removed.
Firebase loaded via npm modular v9. ✅

---

## Phase 4 — Extract render layer ✅ DONE

Goal: DOM/canvas code grouped by concern. Most coupled, least testable — do last.

- [x] 4.1 `src/render/deps.js` — shared `D` object populated by `syncRenderDeps()`
- [x] 4.2 `src/render/tooltip.js` — highlightRow, highlightDeps, showTT, moveTT, hideTT
- [x] 4.3 `src/render/workload.js` — computeWorkload, renderWorkloadPanel/Chart
- [x] 4.4 `src/render/grid.js` — renderGrid (month/week/day grid lines)
- [x] 4.5 `src/render/bar.js` — renderBar, renderGroupBar, attachBarDrag, getWorkingSegs
- [x] 4.6 `src/render/milestone.js` — renderMilestoneTimeline, renderMilestone
- [x] 4.7 `src/render/arrows.js` — renderArrows (SVG FS/SS/FF/SF + critical path)
- [x] 4.8 `src/render/chart-header.js` — renderChartHeader (month labels + day cells)
- [x] 4.9 `src/render/chart-body.js` — renderChartBody (canvas orchestration)
- [x] 4.10 `src/render/task-panel.js` — renderTaskPanel (left-side table)
- [x] 4.11 Commit

**Exit criteria:** all rendering code in `src/render/`. main.js reduced 4017→2951 lines. ✅

---

## Phase 5 — Extract UI & interactions ✅ DONE

- [x] 5.1 `src/ui/modal.js` (677 lines) — 27 functions: modal lifecycle, editors, deps
- [x] 5.2 `src/ui/project.js` (287 lines) — 13 functions: CRUD, menu, templates
- [x] 5.3 `src/ui/settings.js` (198 lines) — 18 functions: settings, zoom, versions
- [x] 5.4 `src/interactions.js` (88 lines) — scroll sync, col resizers, panel resizer
- [x] 5.5 Commit

**Exit criteria:** UI code in `src/ui/` + `src/interactions.js`. main.js 3017→1770. ✅

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
