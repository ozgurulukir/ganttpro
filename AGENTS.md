# GanttPro Agent Guide

Operational context, commands, and strict invariants for AI coding agents working on GanttPro.

## Quick Reference Commands

| Purpose        | Command                           | Notes                                                      |
| -------------- | --------------------------------- | ---------------------------------------------------------- |
| Install        | `npm ci`                          | **npm only**. Never use `pnpm` or commit `pnpm-lock.yaml`. |
| Test           | `npm test`                        | Node.js native test runner (`node --test`).                |
| Timezone Test  | `TZ=America/Los_Angeles npm test` | Verifies UTC date arithmetic independence.                 |
| Build          | `npm run build`                   | Vite client production build into `dist/`.                 |
| Format Check   | `npm run format:check`            | Prettier verification across the repository.               |
| Format Fix     | `npm run format`                  | Automatically formats files with Prettier.                 |
| Generate Rules | `npm run build:rules`             | Generates `firestore.rules` from template.                 |

> [!IMPORTANT]
> Always verify changes before completing a task:
> `npm test && npm run build && npm run format:check`

## Architecture & Module Boundaries

GanttPro uses vanilla JavaScript ES modules with a pure-core and imperative-shell split.

- **`src/core/` (Pure Core):** Domain logic only (date arithmetic, task tree, dependencies, CPM, scheduling, validation, formatting).
  - **Constraint:** Strictly no DOM (`document`, `window`, elements), no Firebase, and no global app state.
  - Must remain 100% testable in headless Node.js without DOM mocks.
- **`src/render/` (Rendering Shell):** DOM rendering (bars, milestones, headers, grid, arrows, tooltips).
  - **Constraint:** Modules receive runtime state through the mutable dependency injection object `D` in `src/render/deps.js`. **Never import `src/main.js`** from extracted modules (prevents circular dependencies).
- **`src/ui/` (UI Controllers):** Modal dialogs, menus, project settings, work-time panel. Use event delegation; avoid inline `onclick` attributes.
- **`src/data/` (I/O & Persistence):** Firebase Auth/Firestore, localStorage, share links, audit logging.
- **`src/main.js` (App Shell):** State initialization, render loop orchestration, event wiring.
- **`gantt.html` (Legacy):** Standalone legacy variant. Not part of the Vite build (`index.html` is the canonical entrypoint). Do not edit unless specifically instructed.

## Critical Invariants & Security Guardrails

### 1. XSS Sanitization (`innerHTML` sinks)

Any dynamic value (user input, task properties, dates, translated strings with interpolation) rendered into `innerHTML` sinks **must be escaped** using `esc()` from `src/core/format.js`.

```javascript
import { esc } from '../core/format.js';
// Good
el.innerHTML = `<span>${esc(task.name)}</span> · <span>${esc(dateStr)}</span>`;
// Bad
el.innerHTML = `<span>${task.name}</span> · <span>${dateStr}</span>`;
```

### 2. Timezone-Safe Date Arithmetic

Dates are calendar strings (`YYYY-MM-DD`) without time components.

- **Constraint:** Never use JavaScript `Date` local getters/setters (`.getMonth()`, `.setMonth()`, `.getDate()`, `.setDate()`) on calendar strings. They produce off-by-one day shifts across timezones and daylight saving boundaries.
- **Requirement:** Always use integer day-number helpers from `src/core/date.js` (`parseDate`, `formatDate`, `addMonths`, `addDays`, `diffDays`, `startOfMonth`, `endOfMonth`).

### 3. Package Management & Tooling

- The repository strictly uses `npm` with `package-lock.json`.
- Do not run `pnpm` or commit `pnpm-lock.yaml`.

### 4. Firestore Security Rules

- `firestore.rules` is auto-generated and Git-ignored.
- **Constraint:** Never edit `firestore.rules` directly. Update `firestore.rules.template` and run `npm run build:rules`.
- Admin authority is determined strictly by `VITE_ADMIN_EMAIL` in `.env`; user-writable `is_admin` fields in Firestore are untrusted.

### 5. Localization (i18n)

- Technical documentation, code comments, and commit messages are in **English**.
- User-facing UI strings must be added to **both** locales:
  - `src/i18n/locales/en.json` (English)
  - `src/i18n/locales/zh-TW.json` (Traditional Chinese)

## Testing Guidelines

- Unit tests reside in `tests/` using Node.js native test runner (`node:test` and `node:assert/strict`).
- When modifying pure logic in `src/core/`, add or update corresponding unit tests in `tests/`.
- Ensure new tests are deterministic and independent of local machine timezone.

## Documentation Pointers

For detailed documentation, consult:

- [Architecture & Layout](docs/architecture.md)
- [Development Setup & Scripts](docs/development.md)
- [Firebase & Security Model](docs/firebase-security.md)
- [Documentation Index](docs/index.md)
