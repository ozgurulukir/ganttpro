# DONE — GanttPro i18next

## Summary

Replaced all hardcoded English strings with i18next `t()` calls.
Ships with English (en) + Traditional Chinese (zh-TW).
Locale switcher in toolbar, persisted to localStorage.

## Phases completed

| Phase | Scope | Commit |
|-------|-------|--------|
| 1 | Install i18next, create `src/i18n/index.js`, wire into main.js | `f7ac164` |
| 2 | Create full locale JSONs (241 keys, 16 namespaces) | `71d8524` |
| 3 | Add `data-i18n` attributes to index.html (104 sites) | `c747993` |
| 4 | Replace hardcoded strings in 16 JS modules with `t()` calls | `4980d6c` |
| 5 | Add locale switcher UI to toolbar | `90955f3` |
| 6 | Final verification — fix remaining hardcoded string | `1721abb` |

## Verification

- `npm test` → 93 pass, 0 fail
- `npm run build` → 56 modules, succeeds
- Key parity: 241/241 (en ↔ zh-TW)
- Grep: zero remaining hardcoded user-facing strings in JS modules

## Architecture

```
src/i18n/
  index.js              # initI18n(), t(), setLocale(), getLocale(), translateDOM()
  locales/
    en.json             # 241 keys, 16 namespaces
    zh-TW.json          # 241 keys, original Traditional Chinese strings
```

**Namespaces**: common, login, toolbar, status, taskPanel, tooltip, workload, chart, modal, project, settings, share, admin, export, holidays

**Locale switch flow**: User selects EN/繁中 → `setLocale()` saves to localStorage, updates `<html lang>`, calls `translateDOM()` → `render()` redraws entire app

**Key decisions**:
- `data-i18n` / `data-i18n-title` / `data-i18n-placeholder` attributes on HTML elements
- `translateDOM()` walks DOM on init + locale switch
- TW_HOLIDAYS stores locale keys (`'holidays.newYear'`), translated at display time via `t()`
- Template task names left as-is (user data, not UI copy)
- `t` variable name conflicts resolved by renaming loop vars to `tk`
