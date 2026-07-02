# BACKLOG — GanttPro Vite Split

Deferred / future / out-of-scope-for-now. Pull into todo.md when ready.

## Deferred (post-split enhancements)

- Adopt TypeScript incrementally (`allowJs`, rename `.js`→`.ts` per module) — natural
  after Phase 1 (core is the first TS candidate). Track in its own project.
- Replace imperative `<canvas>` Gantt rendering with declarative SVG — pairs with a
  future Elm/Lustre rewrite. Separate project when decided.
- Property-based tests for calendar math (fast-check) — after 1.1.
- Visual regression tests for render layer (Playwright) — after Phase 4.
- Web Worker for computeCriticalPath on large projects — only if measured slowdown.

## Separate projects (do NOT bundle into this split)

- **Remove Firebase** → new project `firebase-removal`. Depends on Phase 3 seam.
  Options tiered in conversation: Tier 0/1 (local-only) vs Tier 2 (backend) vs
  Tier 3 (Supabase+RLS). Decide data/auth story first.
- **Elm rewrite** → new project `elm-rewrite`. Frontend-only; Firebase via ports.
  Note: doesn't fix security (rules needed regardless).
- **Gleam logic-core port** → new project `gleam-logic-core`. Alternative to Phase 1's
  JS core; compiles to ESM, drop-in for `src/core/`.

## Out of scope

- Backend / server-side auth (BEAM/Gleam/wisp, Go, Node) — only if Firebase removal
  lands on Tier 2. Track under `firebase-removal` then.
- Mobile/responsive redesign.
- i18n beyond zh-TW.
