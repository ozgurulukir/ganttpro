# _pm — Project Index

PARA-structured project management for the GanttPro workspace.
Workflow per project: `backlog.md` → `todo.md` → `wip.md` → `done.md`.
Finished projects move to `Archives/`. Always use full paths.

## Projects (active)

- **[ganttpro-vite-split](Projects/ganttpro-vite-split/todo.md)** — Split the 5,930-line
  `gantt.html` into a Vite + ES-module project. Phased, behavior-preserving extraction.
  Status: plan ready, Phase 0 pending. → [wip](Projects/ganttpro-vite-split/wip.md)

## Projects (planned, not started)

- **firebase-removal** — depends on ganttpro-vite-split Phase 3 (data seam). Tier
  decision pending (local-only vs backend vs Supabase). See
  [ganttpro-vite-split/backlog.md](Projects/ganttpro-vite-split/backlog.md).
- **elm-rewrite** — frontend rewrite, pending decision. See backlog.
- **gleam-logic-core** — alternative tested core in Gleam→JS. See backlog.

## Areas (ongoing responsibilities)

- [architecture](Areas/architecture.md) — cross-cutting architecture decisions & ADRs.

## Resources

- (none yet — add `patterns.md` when reusable conventions emerge)

## Archives

- (empty — move completed/stale projects here)
