# TODO — GanttPro Timezone

## Root cause

Dates stored as `YYYY-MM-DD` strings (calendar dates). `new Date('2026-04-01')`
parses as **UTC midnight** (per ES spec), but `.getDate()` / `.setDate()` /
`.getDay()` operate in **local time**. On UTC+N machines this happens to work;
on UTC−N machines the day shifts backward.

## Fix: pure-arithmetic day numbers (no Date object for calendar math)

Create `src/core/date.js` with integer-based date operations:

- `parseDate(str)` — `'YYYY-MM-DD'` → day number (days since epoch, via `Date.UTC`)
- `formatDate(dayNum)` — day number → `'YYYY-MM-DD'`
- `dayOfWeek(dayNum)` — 0=Sun…6=Sat (via modulo, no Date)
- `diffDays(strA, strB)` — integer difference
- `todayStr()` — timezone-safe today via explicit `timeZone` option

Then update all consumers to use day numbers internally:

- [ ] 1. Create `src/core/date.js` + tests
- [ ] 2. Refactor `core/calendar.js` — all 6 functions use day numbers
- [ ] 3. Refactor `core/format.js` — `dateToX`, `toStr`
- [ ] 4. Refactor `core/schedule.js` — drop local `setDate` loops
- [ ] 5. Refactor `core/critical-path.js` — drop local `setDate` loops
- [ ] 6. Refactor `render/chart-header.js` — month/day labels
- [ ] 7. Refactor `render/grid.js` — grid lines + weekend shading
- [ ] 8. Refactor `render/bar.js` — task bars, drag, snap
- [ ] 9. Refactor `render/milestone.js` — milestone drag
- [ ] 10. Refactor `render/chart-body.js` — today line, dblclick
- [ ] 11. Refactor `render/workload.js` — workload heatmap
- [ ] 12. Refactor `main.js` — CHART_START/END/TODAY construction
- [ ] 13. Refactor `export.js` — PNG/PDF/CSV date math
- [ ] 14. Update existing tests, add cross-TZ test
- [ ] 15. Run `TZ=America/Los_Angeles npm test` to verify invariance

## Files needing NO change

- `data/local.js`, `data/remote.js`, `data/firebase.js` — dates are opaque strings
- `render/tooltip.js`, `render/deps.js`, `render/task-panel.js`, `render/arrows.js`
- `core/tree.js`, `core/deps.js` — string comparisons only
- `collab.js`, `data/share.js` — no date math
- `auth.js` — timestamps use `.toISOString()` (already UTC-correct)
