# Area — Architecture

Cross-cutting architecture decisions for GanttPro. One ADR-style block per decision:
(1) Context, (2) Decision, (3) Consequences.

## ADR-001 — Build tool: Vite (vanilla + ES modules)

- **Context:** App is a 5,930-line single `gantt.html` (CSS + HTML + JS). Need to split
  for maintainability and to enable future Elm/Gleam integration and Firebase removal.
  Choice between native ESM (no build) vs Vite now.
- **Decision:** Adopt **Vite (vanilla template)** on day one. Decompose into ES modules
  under `src/`. Phased: mechanical split → pure core → state → data → render → ui.
- **Consequences:** Gains HMR, npm packages (date-fns, firebase v9 modular, supabase),
  path aliases, TypeScript/Elm/Gleam readiness, production bundling. Costs: node_modules,
  `npm run dev` workflow, occasional Vite major migrations. No painted corners: TS, Elm,
  Gleam, and Firebase removal all remain smooth additions. Decided 2026-07-01.

## ADR-002 — Firebase: keep through split, isolate to `src/data/remote.js`

- **Context:** Firebase provides auth + Firestore + realtime. Removal is a separate goal
  (see planned project `firebase-removal`). Mixing removal with the split violates
  "one concern per change."
- **Decision:** Keep Firebase working during the split. Isolate ALL Firebase code into
  `src/data/{remote,share}.js` behind a `DataBackend` interface (Phase 3). Migrate compat
  SDK → modular v9 (npm). Do NOT change behavior.
- **Consequences:** Removing Firebase later = touching one module + its interface impl.
  The split's correctness is independent of the Firebase decision. Decided 2026-07-01.

## ADR-003 — Core purity: pure functions take state as parameters

- **Context:** Current logic (calendar, deps, CPM, scheduling) reads globals (`tasks`,
  `curProj()`), making it untestable. Review found real bugs here (timezone, CPM
  convergence). Rule 3: no refactoring untested code.
- **Decision:** When extracting to `src/core/`, make functions **pure** — pass `tasks`
  and needed state as parameters. Write Node tests as each module is extracted (Phase 1).
  `main.js` / `state.js` passes current state at call sites.
- **Consequences:** Fixes Rule 3 (tests accompany refactor), kills the `tasks`↔`curProj()`
  SSOT violation (#9), and makes `src/core/` the exact boundary for a future Gleam port.
  Slight call-site verbosity is acceptable. Decided 2026-07-01.

## ADR-004 — Inline `onclick` → addEventListener (Phase 6)

- **Context:** ~30+ `onclick="fn()"` in HTML call global functions. Defeats tree-shaking,
  forces globals on `window`, couples markup to symbol names.
- **Decision:** Replace all inline handlers with `addEventListener` (or event delegation)
  in Phase 6, after extraction is stable.
- **Consequences:** Unlocks bundler benefits, removes global soup, prerequisite for
  meaningful `npm run build` optimization. Decided 2026-07-01.

## Resolved questions

- **Firestore security rules** — Resolved. Rules written and tracked in
  [Archives/ganttpro-security/done.md](../Archives/ganttpro-security/done.md).
  Deploy is manual: `npx firebase deploy --only firestore:rules`.
  Cross-doc collab relaxed with registered-user trust boundary; Cloud Function
  is the long-term hardening path.

## Open questions (not yet ADRs)

- Firebase-removal tier (0/1/2/3) — decision deferred to `firebase-removal` project.
- Elm vs Gleam vs stay-JS — decision deferred; split keeps all options open.
