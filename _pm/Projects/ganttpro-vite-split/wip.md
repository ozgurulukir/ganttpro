# WIP — GanttPro Vite Split

## Status

**Phase 6 COMPLETE ✅ (Kill inline onclick + window shim).** Next: **Phase 7 — Export layer (png/pdf/csv).**

## Active

- Phase 7: extract export functions (exportPNG, exportPDF, exportCSV) into `src/export/` module.

## Decisions resolved

- ✅ Keep Firebase working through split (isolate to `src/data/remote.js`).
- ✅ Migrate compat SDK → modular v9 in Phase 3 (not Phase 0).
- ✅ Phase 0 keeps CDN script tags; removal deferred to Phase 3. ✅ DONE
- ✅ ESLint deferred to post-Phase-6.
- ✅ Phase 2 state.js deferred — SSOT violation fixed via in-place mutation.
- ✅ DataBackend interface deferred — remote.js is de-facto interface until 2nd backend.

## Phase 4 details

- **10 render modules** in `src/render/`:
  `deps.js` (shared D object), `tooltip.js`, `workload.js`, `grid.js`, `bar.js`,
  `milestone.js`, `arrows.js`, `chart-header.js`, `chart-body.js`, `task-panel.js`.
- **Render extraction pattern**: shared mutable `D` object populated by `syncRenderDeps()`
  before each render cycle. Render modules destructure `const { x, y } = D;` at function top.
  Core functions imported directly. Inter-module render functions imported directly (acyclic).
- **dragSrcId** moved to `D.dragSrcId` (owned by task-panel.js). Dead `let dragSrcId` removed
  from main.js.
- **currentUser** added to D for bar/milestone drag handlers.
- **main.js**: 4017 → 2951 lines (1066 lines removed).
- **Render module dependency DAG** (acyclic):
  tooltip, grid, arrows, workload (leaves) ← bar, milestone ← chart-header, chart-body ← main.js.
  task-panel → workload, tooltip.

## Notes for future phases

- Extracted core functions take `tasks`/state as **parameters** (pure → testable).
- Test runner: `node:test` (Node 24 native). 86 tests total.
- Core module dependency layering (acyclic):
  calendar ← tree ← deps; calendar+tree ← critical-path; calendar+tree ← schedule; format standalone.
- `tasks` SSOT invariant documented at declaration (~line 185). Maintain it:
  mutate in-place, never reassign except `tasks = curProj().tasks` on switch/load.
- `nextId` is a primitive — write-backs (`curProj().nextId = nextId`) are still
  needed at save/switch sites (6 locations). Acceptable; no reference sharing for primitives.
- Data layer architecture:
  `firebase.js` (init+exports) ← `remote.js` (Firestore CRUD) + `share.js` (share I/O) +
  `local.js` (localStorage). main.js imports all four. Auth functions stay in main.js
  until Phase 8.
- Bundle size 678 kB (Firebase SDK + render modules bundled). Future: code-splitting / dynamic import.
- Window shim at end of main.js still exposes ~187 functions for inline onclick (Phase 6 removes).
