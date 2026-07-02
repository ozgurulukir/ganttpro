# Done — GanttPro i18n (zh-TW → English)

## Summary

All user-facing strings translated from Traditional Chinese (zh-TW) to English.
No i18n framework used — English is hardcoded (YAGNI).

## Phases completed

| Phase | Scope | Commit |
|-------|-------|--------|
| 1 | `index.html` — static UI text, `lang="en"`, title | `838dcb3` |
| 2 | `auth.js`, `collab.js`, `admin.js`, `main.js` UI strings | `16c8d80` |
| 3 | `ui/modal.js`, `ui/project.js`, `ui/settings.js` | `9c83732` |
| 4 | Render modules: `chart-header.js`, `task-panel.js`, `tooltip.js`, `workload.js`, `milestone.js`, `chart-body.js` | `6a2fc17` |
| 5 | `export.js` — canvas text, CSV headers, PDF metadata | `f1f8100` |
| 6 | Template/demo data, AV_COLORS, TW_HOLIDAYS, locale strings | `31d3e00` |
| 6+ | `deps.js` error messages + test updates | `305c5f3` |
| 7 | Code comments — **deferred** (developer-facing only) | — |
| 8 | Verification: 93/93 tests pass, build succeeds, zero CJK in string literals | — |

## Verification

- `npm test` → 93 pass, 0 fail
- `npm run build` → 52 modules, succeeds
- Final CJK grep: zero Chinese characters in string literals
  (remaining CJK only in code comments — Phase 7 deferred)

## Key decisions

- `'未指派'` → `'Unassigned'` — all 3 refs (display, sort sentinel, localeCompare) changed together
- `localeCompare(b, 'zh-Hant')` → `localeCompare(b, 'en')`
- `'zh-TW'` locale → `'en-US'` in all `toLocaleDateString` / `toLocaleString` calls
- `timeZone: 'Asia/Taipei'` kept (app is Taiwan-based)
- `toLocaleDateString('sv')` kept (locale-neutral ISO format trick)
- Template/demo task names translated to English equivalents (not transliterated)
- `AV_COLORS` keys: Chinese names → English role names (e.g. `'王小明'`→`'Xiaoming'`)
- `TW_HOLIDAYS` values: Chinese holiday names → English (e.g. `'元旦'`→`'New Year\'s Day'`)
- Phase 7 (code comments) deferred — developer-facing only, no user impact
