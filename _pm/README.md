# _pm — Project Index

PARA-structured project management for the GanttPro workspace.
Workflow per project: `backlog.md` → `todo.md` → `wip.md` → `done.md`.
Finished projects move to `Archives/`. Always use full paths.

## Projects (active)

- **[ganttpro-security](Projects/ganttpro-security/todo.md)** — Firestore security
  rules + `firebase.json`. Admin hardcoded by email, cross-doc collab rules.
  Status: ready.
- **[ganttpro-timezone](Projects/ganttpro-timezone/todo.md)** — Pure-arithmetic
  day-number model to eliminate UTC/local Date frame-mix. 15-step refactor.
  Status: ready.
- **[ganttpro-docs](Projects/ganttpro-docs/todo.md)** — README.md with architecture
  overview, module map, dev setup. Status: ready.

## Projects (planned, not started)

- **firebase-removal** — depends on security rules landing. Tier decision pending
  (local-only vs backend vs Supabase). See
  [Archives/ganttpro-vite-split/backlog.md](Archives/ganttpro-vite-split/backlog.md).
- **elm-rewrite** — frontend rewrite, pending decision. See backlog.
- **gleam-logic-core** — alternative tested core in Gleam→JS. See backlog.

## Areas (ongoing responsibilities)

- [architecture](Areas/architecture.md) — cross-cutting architecture decisions & ADRs.

## Resources

- (none yet — add `patterns.md` when reusable conventions emerge)

## Archives

- [ganttpro-vite-split](Archives/ganttpro-vite-split/done.md) — Split 5,930-line
  `gantt.html` into 51-module Vite project. 9 phases complete, 86 tests green.
