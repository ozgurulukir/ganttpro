# WIP — GanttPro Vite Split

## Status

**Phase 3 COMPLETE ✅ (Firebase seam + modular v9).** Next: **Phase 4 — Render layer.**

## Active

- Phase 4 next: extract DOM/canvas rendering code into `src/render/` modules. Most
  coupled, least testable layer. Do render() orchestration last (4.9).

## Decisions resolved

- ✅ Keep Firebase working through split (isolate to `src/data/remote.js`).
- ✅ Migrate compat SDK → modular v9 in Phase 3 (not Phase 0).
- ✅ Phase 0 keeps CDN script tags; removal deferred to Phase 3. ✅ DONE
- ✅ ESLint deferred to post-Phase-6.
- ✅ Phase 2 state.js deferred — SSOT violation fixed via in-place mutation.
- ✅ DataBackend interface deferred — remote.js is de-facto interface until 2nd backend.

## Phase 0 revisions (see done.md)

- 0.6 keep CDN scripts · 0.7 defer firebase npm install · 0.8 Prettier only (ESLint later).

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
- Bundle size 675 kB (Firebase SDK bundled). Future: code-splitting / dynamic import.
