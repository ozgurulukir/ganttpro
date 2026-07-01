# WIP — GanttPro Vite Split

## Status

**Phase 1.1 ✅ (`f82e103`) · Phase 1.2 ✅ (uncommitted).** Next: **Phase 1.3 — `deps.js`.**

## Active

- Phase 1.3 next: `src/core/deps.js` — wouldCreateCycle, parseDepInput,
  buildDepsText, lagsFromParsed (cycle detection is the high-value test target).
- **Tooling note**: bypass Prettier-on-write for `.js` surgical edits (use Python).

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
