# WIP — GanttPro Vite Split

## Status

**Phase 2 COMPLETE ✅ (tasks SSOT violation killed).** Next: **Phase 3 — Firebase seam.**

## Active

- Phase 3 next: isolate Firebase into `src/data/remote.js`. Migrate compat SDK →
  modular v9 (`npm install firebase`, replace CDN globals with ES module imports).
  Also extract `src/data/local.js` (localStorage) and `src/data/share.js`.

## Decisions resolved

- ✅ Keep Firebase working through split (isolate to `src/data/remote.js`).
- ✅ Migrate compat SDK → modular v9 in Phase 3 (not Phase 0).
- ✅ Phase 0 keeps CDN script tags; removal deferred to Phase 3.
- ✅ ESLint deferred to post-Phase-6.
- ✅ **Phase 2 state.js deferred** — SSOT violation fixed via 4 in-place mutation
  fixes + 4 write-back removals. Full state.js store (moving `projects`,
  `currentProjId`, etc.) deferred to Phase 4–5 when large-scale renames are
  already happening. Rationale: 120+ renames for `state.xxx` access is
  high-churn/low-value when the actual bug is already fixed.

## Phase 0 revisions (see done.md)

- 0.6 keep CDN scripts · 0.7 defer firebase npm install · 0.8 Prettier only (ESLint later).

## Notes for future phases

- Extracted core functions take `tasks`/state as **parameters** (pure → testable).
- Test runner: `node:test` (Node 24 native). 86 tests total.
- Core module dependency layering (acyclic):
  calendar ← tree ← deps; calendar+tree ← critical-path; calendar+tree ← schedule; format standalone.
- `tasks` SSOT invariant documented at declaration (line ~185). Maintain it:
  mutate in-place, never reassign except `tasks = curProj().tasks` on switch/load.
- `nextId` is a primitive — write-backs (`curProj().nextId = nextId`) are still
  needed at save/switch sites (6 locations). This is acceptable; no reference
  sharing possible for primitives.
