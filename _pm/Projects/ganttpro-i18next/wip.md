# WIP — GanttPro i18next

## Phase 1: Install + core setup

- [x] `npm i i18next` (v26.3.4)
- [x] Created `src/i18n/index.js` — `initI18n()`, `t()`, `setLocale()`, `getLocale()`, `translateDOM()`
- [x] Created `src/i18n/locales/en.json` — minimal stub (8 keys)
- [x] Created `src/i18n/locales/zh-TW.json` — minimal stub (8 keys)
- [x] Wired `initI18n()` + `translateDOM()` into `main.js` DOMContentLoaded
- [x] Verified: 93/93 tests pass, build succeeds (56 modules)

## Next

Phase 2: Create full locale JSONs (~300 keys).
