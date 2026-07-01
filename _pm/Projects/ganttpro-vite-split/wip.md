# WIP — GanttPro Vite Split

## Status

**Phase 1.1–1.3 ✅.** Next: **Phase 1.4 — `critical-path.js` (CPM).**

## Active

- Phase 1.4 next: `src/core/critical-path.js` — computeCriticalPath,
  getCriticalPredTaskIds, prevWorkingDay. CPM forward/backward pass with
  known-good test cases (FS/SS/FF/SF + lag).
- **Tooling**: Prettier-on-write still active. Write=ok for new files;
  Python surgery for main.js edits.

## Decisions resolved

- ✅ Keep Firebase working through split (isolate to `src/data/remote.js`).
- ✅ Migrate compat SDK → modular v9 in Phase 3 (not Phase 0).
- ✅ Phase 0 keeps CDN script tags; removal deferred to Phase 3.
- ✅ ESLint deferred to post-Phase-6.

## Phase 0 revisions (see done.md)

- 0.6 keep CDN scripts · 0.7 defer firebase npm install · 0.8 Prettier only (ESLint later).

## Notes for Phase 1

- Extracted core functions take `tasks`/state as **parameters** (pure → testable).
- Test runner: `node:test` (Node 24 native) or vitest — decide at 1.1.
- Order: calendar → tree → deps → critical-path → schedule → format.
