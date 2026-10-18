# Architecture and source layout

GanttPro is a vanilla JavaScript single-page application. `index.html` loads `src/main.js`; the Vite build does not
include the separate legacy `gantt.html`. For local commands, see [Development setup](development.md). For Firebase
behavior, see [Firebase and security](firebase-security.md).

## Application layers

The source follows a pure-core and imperative-shell split:

- `src/core/` contains date, calendar, task-tree, dependency, scheduling, critical-path, formatting, and validation
  logic. Core modules avoid DOM and application globals so their domain behavior can be used independently.
- `src/main.js`, `src/render/`, `src/ui/`, and feature modules form the browser-facing shell. Rendering and UI code
  interact with the DOM; data modules perform local storage and Firebase I/O.

## Source map

| Path                                           | Responsibility                                                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/main.js`                                  | App state, render loop, event wiring, and composition of modules.                                                    |
| `src/core/`                                    | Date arithmetic, working calendars, task trees, dependencies, scheduling, critical path, formatting, and validation. |
| `src/render/`                                  | Chart header and body, task panel, bars, milestones, dependency arrows, workload view, and tooltips.                 |
| `src/ui/`                                      | Project, task, settings, work-time, and context-menu controllers.                                                    |
| `src/data/`                                    | Firebase initialization, local persistence, remote data, share links, and audit records.                             |
| `src/export/`                                  | PNG and CSV generation, browser print/PDF, and iCalendar output.                                                     |
| `src/i18n/`                                    | i18next setup and English (`en`) and Traditional Chinese (`zh-TW`) strings.                                          |
| `src/task-ops.js`                              | Task hierarchy operations such as indent, outdent, and reorder.                                                      |
| `src/history.js`                               | Undo and redo history.                                                                                               |
| `src/sync.js`                                  | Local persistence, cloud sync, realtime listeners, and shared-project behavior.                                      |
| `src/auth.js`, `src/collab.js`, `src/admin.js` | Sign-in, collaboration UI, and the admin panel.                                                                      |
| `src/interactions.js`                          | Shared scrolling and resizable panels/columns.                                                                       |

## Shared render dependencies

`src/render/deps.js` exports a mutable `D` object used to pass current state and helpers into rendering modules.
`main.js` refreshes its values through `syncRenderDeps()` before rendering. Extracted modules such as task operations,
history, and sync receive state through parameters or context objects instead of importing `main.js`, which avoids a
circular dependency.

## Dates and calendars

`src/core/date.js` represents dates as integer day numbers for calendar arithmetic. The calendar module applies
working-day rules, Taiwan holidays, and configured workdays or custom holidays. This keeps scheduling logic separate
from browser-local date formatting.

## Loading and exports

The admin panel, work-time settings, and export tools are loaded on demand. Export code reads the current app state
through the render dependency object:

- PNG draws a chart image to an off-screen canvas.
- CSV writes task rows and project fields to a downloadable file.
- PDF and print use the browser's print dialog and print styles.
- iCalendar creates `.ics` events for scheduled tasks and milestones.

## Localization and tests

User-facing strings belong in both `src/i18n/locales/en.json` and `src/i18n/locales/zh-TW.json`. Use the i18n helpers
for dynamic UI so changing the selected locale updates the interface consistently.

Run `npm test` to execute the Node.js test suite. Tests live in `tests/`; core logic and selected app modules have
tests. See [Development setup](development.md) for the repository commands.

## Related pages

- [Documentation index](index.md)
- [Development setup and commands](development.md)
- [Firebase configuration and security](firebase-security.md)
- [README](../README.md)
