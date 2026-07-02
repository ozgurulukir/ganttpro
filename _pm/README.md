# _pm — Project Index

PARA-structured project management for the GanttPro workspace.
Workflow per project: `backlog.md` → `todo.md` → `wip.md` → `done.md`.
Finished projects move to `Archives/`. Always use full paths.

## Projects (active)

- **[ganttpro-i18n](Projects/ganttpro-i18n/todo.md)** — Translate all user-facing
  strings from zh-TW to English. 8 phases, ~3,000 CJK chars across ~20 files.
  Status: ready.
- **[ganttpro-security](Projects/ganttpro-security/done.md)** — Firestore security
  rules + `firebase.json`. Complete (deploy is manual).
- **[ganttpro-timezone](Projects/ganttpro-timezone/done.md)** — Pure-arithmetic
  day-number model. Complete, 93 tests green cross-TZ.
- **[ganttpro-docs](Projects/ganttpro-docs/done.md)** — README.md. Complete.

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
  `gantt.html` into 52-module Vite project. 9 phases complete, 93 tests green.
