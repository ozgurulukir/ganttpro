# DONE — GanttPro Timezone

## All steps complete

- [x] 1. Created `src/core/date.js` (40 lines) + 7 tests
- [x] 2. Refactored `core/calendar.js` — all 6 functions use day numbers
- [x] 3. Refactored `core/format.js` — `dateToX` uses `diffDays`, `toStr` unchanged
- [x] 4. Refactored `core/schedule.js` — dropped local `setDate` loops
- [x] 5. Refactored `core/critical-path.js` — dropped local `setDate` loops
- [x] 6. Refactored 6 render modules (chart-header, grid, bar, milestone, chart-body, workload)
- [x] 7. Refactored `main.js` (totalW, updateChartStart, recalcProjEnd)
- [x] 8. Refactored `export.js`, `project.js`, `settings.js`, `admin.js`
- [x] 9. Updated tests — 93 pass in UTC+3, UTC−8, UTC−5, UTC
- [x] 10. Build succeeds (52 modules)

## Design

**Pure-arithmetic day numbers** eliminate the Date object from calendar math:

- `parseDate('YYYY-MM-DD')` → integer (days since 1970-01-01, via `Date.UTC`)
- `formatDate(n)` → `'YYYY-MM-DD'`
- `dayOfWeek(n)` → 0–6 (modulo, no Date)
- `addDays(str, n)` → string
- `diffDays(a, b)` → integer

All `new Date(str)` + `.setDate()` + `.toISOString().slice(0,10)` patterns replaced
with day-number arithmetic. Date objects kept only for:

- `CHART_START`/`CHART_END` in main.js (ms-timestamp comparisons, `.getTime()`)
- Timestamps (`createdAt`, `added_at`, `updated_at`) — already correct via `.toISOString()`
- Month-level display (`new Date(dn * 86400000).getUTCFullYear()`)

Timestamp display pinned to `timeZone: 'Asia/Taipei'` in admin.js, settings.js, export.js.
