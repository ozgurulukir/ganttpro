# WIP — GanttPro Vite Split

## Status

**Phase 1 COMPLETE ✅ (1.1–1.6, 86 tests).** Next: **Phase 2 — `state.js` (SSOT).**

## Active

- Phase 2 next: `src/state.js` — single store killing the `tasks` ↔
  `curProj().tasks` dual source of truth (review #9). Adapters in main.js
  become state getters. Most coupled step so far — tread carefully.
- **Tooling**: Prettier-on-write confirmed DISABLED. Edit/Write used directly.

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
