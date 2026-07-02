# TODO — GanttPro i18n (zh-TW → English)

## Goal

Translate all user-facing strings from Traditional Chinese (zh-TW) to English.
No i18n framework — hardcode English (YAGNI until multi-language is requested).

## Scope

~3,000 CJK characters across ~20 files. No Chinese in identifiers, CSS, or
styles — all Chinese is in string literals and HTML text content.

## Phases

### Phase 1: HTML shell (`index.html`) — ~517 CJK chars

All static UI text: login screen, toolbar buttons, modal forms, table headers,
status bar, admin/collab/share overlays, print header.

- [ ] Translate all visible text in `index.html`
- [ ] Change `<html lang="zh-TW">` → `<html lang="en">`
- [ ] Change `<title>` to English
- [ ] Replace full-width punctuation (：、（）) with ASCII equivalents

### Phase 2: Core UI strings (`main.js`, `auth.js`, `collab.js`, `admin.js`) — ~700 CJK chars

Sync status messages, alerts, confirms, guest avatar, login/registration copy,
share/collab validation messages, admin panel text.

- [ ] `src/main.js` — sync dots, share-invalid screen, guest avatar `訪`, indent limit message
- [ ] `src/auth.js` — login error, registration validation, empty nickname warning
- [ ] `src/collab.js` — email validation, share messages, remove confirms, permission labels
- [ ] `src/admin.js` — loading text, user/admin labels, delete confirms

### Phase 3: UI modules (`ui/modal.js`, `ui/project.js`, `ui/settings.js`) — ~430 CJK chars

Task modal labels, project CRUD text, settings panel, version history.

- [ ] `src/ui/modal.js` — modal title, labels, dropdown options, delete warnings, inline editor placeholders
- [ ] `src/ui/project.js` — empty state, menu items, template descriptions, duplicate-name confirm
- [ ] `src/ui/settings.js` — baseline message, version confirm/restore/delete messages, empty state

### Phase 4: Render modules — ~290 CJK chars

Chart labels, tooltips, task panel, workload, milestone timeline.

- [ ] `src/render/chart-header.js` — month names (`1月`→`Jan`), day names (`日月一二...`→`Sun Mon...`)
- [ ] `src/render/task-panel.js` — empty states, milestone badge, action tooltips
- [ ] `src/render/tooltip.js` — field labels, status indicators
- [ ] `src/render/workload.js` — `'未指派'`→`'Unassigned'` (all 3 refs: display + sort sentinel + localeCompare)
- [ ] `src/render/milestone.js` — `今日`→`Today`
- [ ] `src/render/chart-body.js` — `今日`→`Today`

### Phase 5: Export module (`src/export.js`) — ~178 CJK chars

Canvas text, CSV headers, PDF/print metadata.

- [ ] Translate canvas labels (title, header row, month labels)
- [ ] Translate CSV column headers
- [ ] Translate PDF print header
- [ ] Replace ideographic spaces (`　`) with regular spaces

### Phase 6: Data & locale — ~900 CJK chars

Demo template, assignee palette, calendar holidays, locale strings.

- [ ] `src/main.js` TEMPLATES — translate demo project task names (or replace with English template)
- [ ] `src/main.js` AV_COLORS — replace Chinese assignee names with English equivalents
- [ ] `src/core/calendar.js` TW_HOLIDAYS — translate holiday names to English
  (keep Taiwan calendar logic — this is a Taiwan-centric app)
- [ ] `src/core/deps.js` — translate error message strings
- [ ] Locale calls: `'zh-TW'`→`'en-US'`, `'zh-Hant'`→`'en'` in 5 sites:
  - `main.js:52`, `settings.js:185`, `admin.js:23`, `project.js:197`, `export.js:290`
  - Keep `timeZone:'Asia/Taipei'` (app is Taiwan-based)
  - Keep `'sv'` locale trick for ISO date formatting (or replace with explicit formatter)

### Phase 7: Code comments (optional, lowest priority)

- [ ] Translate Chinese comments in `core/critical-path.js`, `core/schedule.js`,
      `core/calendar.js`, `render/bar.js`, `export.js`, `main.js`, etc.
- [ ] This is developer-facing only — defer if time-constrained

### Phase 8: Verify

- [ ] `npm test` — all 93 tests green
- [ ] `npm run build` — production build succeeds
- [ ] Manual smoke test: login (guest + Google), create task, drag bar,
      export PNG/CSV/PDF, share link, collab modal, admin panel, dark mode
- [ ] Grep for remaining CJK: `grep -rP '[\x{4e00}-\x{9fff}]' src/ index.html`
      (should return zero or only deferred comments)

## Logic gotchas

1. **`'未指派'` in workload.js** — display string + sort sentinel + localeCompare key.
   Translate all 3 references together.
2. **`TW_MAKEUP_WORKDAYS`** — makeup workday set keyed by date, no translation needed.
3. **Template duplication** — demo template is defined twice in main.js (lines ~113
   and ~177). Dedupe during translation.
4. **Full-width punctuation** — `：`→`:`, `（）`→`()`, `　`→` ` throughout.
5. **Locale calls** — `timeZone:'Asia/Taipei'` should stay; only the display locale changes.
