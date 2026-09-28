# GanttPro — 專案甘特圖管理工具

Gantt chart project management tool with task scheduling, critical path analysis,
milestones, collaboration, and export. Built as a vanilla ES-module SPA with
Vite + Firebase.

**[繁體中文](README.zh-TW.md)**

## Features

- **Gantt chart** with task bars, group summaries, and milestone diamonds
- **Dependency types**: FS (Finish-to-Start), SS, FF, SF with lag
- **CPM critical path** highlighting (backward-pass float computation)
- **Taiwan working-day calendar** with national holidays (2025–2027)
- **Forward-pass scheduler** auto-computes earliest start/end from dependencies
- **Drag interactions**: resize bars, move tasks, drag milestones — snaps to workdays
- **Workload view**: per-assignee daily load heatmap
- **Collaboration**: share projects by email with read/edit permissions
- **Share links**: generate read-only public URLs (no auth required)
- **Export**: PNG, CSV, PDF (print), iCalendar
- **Version history**: save and restore project snapshots
- **Baseline comparison**: overlay planned vs actual dates
- **Dark mode**, zoom controls (day/week/month granularity)
- **Firebase Auth** (Google OAuth) + guest mode + admin panel

## Tech Stack

| Layer      | Technology                                  |
| ---------- | ------------------------------------------- |
| Build      | Vite 8                                      |
| Frontend   | Vanilla JS (ES modules, no framework)       |
| Backend    | Firebase (Auth + Firestore, modular v9 SDK) |
| Testing    | Node.js native test runner (`node --test`)  |
| Formatting | Prettier                                    |
| Language   | Traditional Chinese (zh-TW)                 |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure Firebase + admin email
cp .env.example .env
# Then edit .env — set VITE_FIREBASE_* to your Firebase project's values,
# and set VITE_ADMIN_EMAIL to your email address.

# 3. Generate Firestore rules (picks up your VITE_ADMIN_EMAIL)
npm run build:rules

# 4. Start the dev server
npm run dev      # http://localhost:5173
```

### Production build

```bash
npm run build    # outputs to dist/
npm run preview  # preview built output
```

### Tests

```bash
npm test                            # run all 129 tests
TZ=America/Los_Angeles npm test     # verify timezone independence
```

## Architecture

```
src/
├── main.js                  App entry: state, render loop, event wiring
│
├── task-ops.js              Tree manipulation: indent, outdent, reorder tasks
├── history.js               Undo/redo: pushHistory, undo with state snapshots
├── sync.js                  Cloud sync, local persistence, realtime listeners
│
├── core/                    Pure logic (no DOM, no globals, unit-tested)
│   ├── date.js              Timezone-safe date arithmetic (integer day numbers)
│   ├── calendar.js          Taiwan working-day calendar + holiday lookup
│   ├── tree.js              Flat-task tree queries (children, depth, visibility)
│   ├── deps.js              Dependency parsing + cycle detection
│   ├── schedule.js          Forward-pass scheduler (FS/SS/FF/SF + lag)
│   ├── critical-path.js     CPM backward-pass float → critical path
│   └── format.js            Formatting helpers (dateToX, colors, XSS escaping)
│
├── render/                  DOM rendering (consume shared D object)
│   ├── deps.js              Shared mutable D object (state bridge)
│   ├── chart-header.js      Time-axis: month labels + day/week/month cells
│   ├── chart-body.js        Canvas orchestrator: grid + bars + arrows + today
│   ├── grid.js              Grid lines at month/week/day granularity
│   ├── bar.js               Task bars, group bars, drag/resize interactions
│   ├── milestone.js         Milestone timeline spine + diamond markers
│   ├── arrows.js            SVG dependency arrows (FS/SS/FF/SF) + CP highlight
│   ├── workload.js          Per-assignee workload heatmap
│   ├── tooltip.js           Hover tooltips + row/dep highlighting
│   └── task-panel.js        Left-side task table (name, dates, deps, actions)
│
├── ui/                      UI controllers
│   ├── modal.js             Task create/edit/delete modal, inline editors
│   ├── project.js           Project CRUD, template selection, project menu
│   ├── settings.js          Settings, zoom, dark mode, baseline, versions
│   └── context-menu.js      Right-click context menu for task rows
│
├── export/                  Export formats (lazy-loaded)
│   ├── index.js             Barrel re-export
│   ├── png.js               PNG canvas rendering
│   ├── csv.js               CSV generation
│   ├── pdf.js               PDF / print settings
│   └── ical.js              iCalendar (.ics) generation
│
├── data/                    Persistence layer (pure I/O, no app state)
│   ├── firebase.js          Firebase init (app, auth, firestore)
│   ├── remote.js            Firestore CRUD: user data, shares, allowed users
│   ├── local.js             LocalStorage save/load (offline + guest mode)
│   ├── share.js             Share-link encoding + Firestore share-doc I/O
│   └── audit.js             Audit logging
│
├── i18n/                    Localization
│   ├── index.js             i18next setup, t(), setLocale(), translateDOM()
│   └── locales/
│       ├── en.json
│       └── zh-TW.json
│
├── auth.js                  Google sign-in, guest mode, registration, admin gate
├── collab.js                Share & collaboration modal
├── admin.js                 Admin panel (lazy-loaded)
└── interactions.js          DOM setup: scroll sync, column/panel resizers
```

### Key patterns

- **Pure core / imperative shell**: `core/` holds all domain math, fully
  unit-tested. `main.js` + `ui/` + `render/` form the imperative shell.
- **Shared `D` object**: `render/deps.js` exports a mutable object that
  `main.js` repopulates (`syncRenderDeps()`) before each render cycle.
- **Extracted modules**: `task-ops.js` (tree manipulation), `history.js`
  (undo/redo), and `sync.js` (cloud sync + local persistence) are wired
  via the D-object wrapper pattern to avoid circular imports.
- **Timezone-safe dates**: All calendar math uses integer day numbers
  (`core/date.js`), eliminating UTC/local Date frame-mixing. Tests pass
  identically in any timezone.
- **Lazy loading**: `export/`, `admin.js`, and `ui/worktime.js` are
  dynamically `import()`ed.
- **Event wiring**: `wireStaticEvents()` in `main.js` delegates to 11
  focused handler functions (login, toolbar, modals, delegation, etc.).
- **Event delegation**: Dynamic content uses `data-action` attributes +
  delegation instead of inline `onclick`.

## Firebase Setup

Firebase config is configured via environment variables in `.env` (see `.env.example`).
The web API key is public by design (Firebase client-side SDK).

### Firestore collections

| Collection             | Purpose                                             |
| ---------------------- | --------------------------------------------------- |
| `gantt_user_data`      | Per-user project data (all projects as opaque blob) |
| `gantt_project_shares` | Named collaboration grants (owner → invitee)        |
| `gantt_allowed_users`  | Registration allowlist (self-service)               |
| `gantt_shares`         | Public read-only share-link snapshots               |

### Security rules

`firestore.rules` defines access control:

```bash
# One-time: authenticate with Firebase
npm run firebase login

# After changing .env (or anytime you regenerate firestore.rules):
npm run build:rules
npm run deploy:rules
```

Admin authority is configured via `VITE_ADMIN_EMAIL` in `.env` and enforced by the generated `firestore.rules`. The user-writable `is_admin` field is **not** trusted.
See `_pm/Projects/ganttpro-security/done.md` for design decisions.

## Testing

Tests cover the `core/` pure-logic modules (129 tests):

```
tests/
├── date.test.js             Day-number arithmetic (cross-TZ verified)
├── calendar.test.js         Working-day calendar, holidays, make-up days
├── tree.test.js             Tree queries, visibility, group bounds
├── deps.test.js             Dependency parsing, cycle detection
├── schedule.test.js         Forward-pass scheduler (all 4 dep types + lag)
├── critical-path.test.js    CPM backward pass, float, critical set
├── format.test.js           dateToX, colors, initials, XSS escaping
└── validate.test.js         Input sanitization, bounds, migration
```

## Known Limitations

- **Firebase config** set via `VITE_FIREBASE_*` env vars (`.env`); defaults to the original demo project
- **Share links have no expiry** (tokens persist indefinitely in Firestore)
- **Cross-document collab** writes are relaxed (any registered user may write
  another user's data doc — see security notes in `_pm/`)
- **No tests** for render, UI, data, or feature modules (core only)

## License

Private project.
