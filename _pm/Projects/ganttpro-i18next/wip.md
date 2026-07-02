# WIP — GanttPro i18next

## Phase 1: Install + core setup ✅

- [x] `npm i i18next` (v26.3.4)
- [x] Created `src/i18n/index.js` — `initI18n()`, `t()`, `setLocale()`, `getLocale()`, `translateDOM()`
- [x] Created `src/i18n/locales/en.json` — minimal stub (8 keys)
- [x] Created `src/i18n/locales/zh-TW.json` — minimal stub (8 keys)
- [x] Wired `initI18n()` + `translateDOM()` into `main.js` DOMContentLoaded
- [x] Verified: 93/93 tests pass, build succeeds (56 modules)

## Phase 2: Create full locale JSONs ✅

- [x] `en.json` — 231 keys (15 namespaces: common, login, toolbar, status, taskPanel, tooltip, workload, chart, modal, project, settings, share, admin, export, holidays)
- [x] `zh-TW.json` — 231 keys (same structure, original Traditional Chinese strings)
- [x] Key parity verified: 231/231 match
- [x] JSON validity verified
- [x] 93/93 tests pass, build succeeds

## Next

Phase 3: Add `data-i18n` attributes to `index.html` static strings.
