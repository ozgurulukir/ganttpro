# WIP — GanttPro i18next

## Phase 1: Install + core setup ✅

- [x] `npm i i18next` (v26.3.4)
- [x] Created `src/i18n/index.js` — `initI18n()`, `t()`, `setLocale()`, `getLocale()`, `translateDOM()`
- [x] Created `src/i18n/locales/en.json` — minimal stub (8 keys)
- [x] Created `src/i18n/locales/zh-TW.json` — minimal stub (8 keys)
- [x] Wired `initI18n()` + `translateDOM()` into `main.js` DOMContentLoaded
- [x] Verified: 93/93 tests pass, build succeeds (56 modules)

## Phase 2: Create full locale JSONs ✅

- [x] `en.json` — 238 keys (15 namespaces)
- [x] `zh-TW.json` — 238 keys (same structure, original Traditional Chinese strings)
- [x] Key parity verified: 238/238 match
- [x] JSON validity verified
- [x] 93/93 tests pass, build succeeds

## Phase 3: Add data-i18n attributes to index.html ✅

- [x] 104 `data-i18n` / `data-i18n-title` / `data-i18n-placeholder` attributes added
- [x] Covers: login screen, toolbar, version panel, share/collab/admin modals, task table headers, status bar, delete/task/project modals
- [x] Added 7 missing keys to locale JSONs (settings.showBarDates, settings.showBaseline, settings.setBaseline, settings.versionHistory, settings.versionNamePlaceholder, share.collabEmailPlaceholder, chart.milestones)
- [x] All HTML keys verified present in locale files
- [x] 93/93 tests pass, build succeeds

## Next

Phase 4: Replace hardcoded strings in 16 JS modules with `t()` calls (~150 sites).
