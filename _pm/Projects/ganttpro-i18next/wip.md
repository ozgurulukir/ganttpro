# WIP — GanttPro i18next

## Phase 1: Install + core setup ✅

- [x] `npm i i18next` (v26.3.4)
- [x] Created `src/i18n/index.js` — `initI18n()`, `t()`, `setLocale()`, `getLocale()`, `translateDOM()`
- [x] Created `src/i18n/locales/en.json` — minimal stub (8 keys)
- [x] Created `src/i18n/locales/zh-TW.json` — minimal stub (8 keys)
- [x] Wired `initI18n()` + `translateDOM()` into `main.js` DOMContentLoaded
- [x] Verified: 93/93 tests pass, build succeeds (56 modules)

## Phase 2: Create full locale JSONs ✅

- [x] `en.json` — 241 keys (16 namespaces)
- [x] `zh-TW.json` — 241 keys (same structure, original Traditional Chinese strings)
- [x] Key parity verified: 241/241 match
- [x] JSON validity verified
- [x] 93/93 tests pass, build succeeds

## Phase 3: Add data-i18n attributes to index.html ✅

- [x] 104 `data-i18n` / `data-i18n-title` / `data-i18n-placeholder` attributes added
- [x] Covers: login screen, toolbar, version panel, share/collab/admin modals, task table headers, status bar, delete/task/project modals
- [x] All HTML keys verified present in locale files
- [x] 93/93 tests pass, build succeeds

## Phase 4: Replace JS strings with t() calls ✅

- [x] 16 JS modules updated (18 files changed, 181 insertions, 161 deletions)
- [x] Core: `calendar.js` (TW_HOLIDAYS → locale keys), `chart-header.js` (month/day names)
- [x] Render: `tooltip.js`, `workload.js`, `task-panel.js`, `chart-body.js`, `milestone.js`
- [x] UI: `modal.js`, `project.js`, `settings.js`
- [x] Top-level: `main.js`, `auth.js`, `collab.js`, `admin.js`, `export.js`
- [x] Added 3 missing keys: `status.dataUpdated`, `export.type`, `export.assignee`
- [x] Fixed `t` variable name conflicts in `workload.js` and `export.js` (renamed loop vars to `tk`)
- [x] Updated `calendar.test.js` for locale key format
- [x] 93/93 tests pass, build succeeds

## Phase 5: Locale switcher UI ✅

- [x] Added `<select id="langSelect">` to toolbar HTML (EN / 繁中)
- [x] Wired `change` event in main.js: `setLocale(value)` → `render()`
- [x] Initial value set from `getLocale()` on load
- [x] 93/93 tests pass, build succeeds

## Next

Phase 6: Final verification — tests, build, manual smoke test.
