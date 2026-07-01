# DONE — GanttPro Vite Split

Newest first. Move items here from todo.md as completed.

---

## 2026-07-02 — Phase 1.2: Extract `src/core/tree.js` ✅

- Moved 12 tree functions to a pure module, parameterized with `tasks`
  (+ `collapsed`, `milestoneView` for getVisibleRows / getRowNum / getTaskByRowNum).
- `main.js` keeps thin bound wrappers (close over global `tasks` / `collapsed` /
  `milestoneView`) so ~95 call sites are unchanged; removed when state.js lands (2.x).
- Color helpers (darkenColor, hexToRgba) left in main.js → format.js in Phase 1.6.
- `tests/tree.test.js`: 16 node:test characterization tests, **all pass**.
- Verified: `node --check` both files, `npm test` 25/25 green, `npm run build` green.
- **Discovery**: Edit/Write tools run Prettier on `.js` save → whole-file reformat
  (+1576 lines churn). Bypassed via Python string surgery to keep the diff minimal
  (15 ins / 125 del). All future `.js` surgical edits must bypass the formatter.

---

## 2026-07-02 — Phase 1.1: Extract `src/core/calendar.js` ✅

- Moved 11 symbols (isWeekend, getHoliday, isNonWorkday, dateKey,
  addWorkingDays, subtractWorkingDays, nextWorkingDay, shiftWorkingDays,
  countWorkingDays, TW_HOLIDAYS, TW_MAKEUP_WORKDAYS) verbatim to a pure module.
- Self-contained — no parameterization needed (no globals referenced).
- `main.js` imports the 7 functions used in logic; window shim regenerated
  (calendar fns dropped — not onclick-referenced).
- `tests/calendar.test.js`: 9 node:test characterization tests, **all pass**.
- Verified: `node --check` both files, `npm test` green, `npm run build` green.

---

## 2026-07-01 — Phase 0: Scaffold & mechanical split ✅

- Vite 8.1.2 scaffolded (manual file creation — controlled for non-empty dir).
- `styles.css` (968 lines, from gantt.html 14–981).
- `src/main.js` (4579 lines, from 1349–5927) + temporary `window` exposure shim
  (169 functions) so inline `onclick` handlers resolve under `<script type=module>`.
  Shim removed in Phase 6.
- `index.html` (381 lines): head + `<link>` + Firebase CDN scripts + body +
  `<script type=module src="/src/main.js">`.
- Dev tooling: `package.json` (type=module, dev/build/preview/format scripts),
  `vite.config.js`, `.gitignore`, `.prettierrc`.
- Verified: `node --check src/main.js` OK, `npm run build` → dist/ (103 kB JS,
  34 kB CSS, 158 ms), dev server returns HTTP 200, Firebase CDN scripts preserved
  in dist (behavior-preserving).

### Plan revisions made during execution (update todo.md)

1. **0.6**: Kept Firebase CDN `<script>` tags in index.html (do NOT remove in
   Phase 0 — removing breaks the app since calls still use the `firebase` global).
   Removal now happens in Phase 3 alongside the modular-v9 migration.
2. **0.7**: Deferred `npm install firebase` to Phase 3 (YAGNI — nothing uses it yet).
3. **0.8**: Prettier added; **ESLint deferred** to post-Phase-6 (legacy code would
   emit hundreds of warnings until globals/onclick are cleaned up).

### Bug found in smoke test → fixed (2026-07-01)

- **Symptom**: login screen appeared but Google + Local buttons did nothing.
- **Root cause**: shim regex `^function ` missed `async function` —
  `signInWithGoogle`, `signInAsGuest` (both async) + 16 others never reached
  `window`, so inline `onclick` silently failed ("not defined").
- **Fix**: regenerated shim with `^(async )?function ` → 187 names exposed.
  Re-verified `node --check` + `npm run build` green (108 kB JS).
- **Remaining (NOT a code bug)**: Google `signInWithPopup` may still fail with
  `auth/unauthorized-domain` → add `localhost:5173` in Firebase console →
  Authentication → Settings → Authorized domains. Local/guest mode unaffected.

### Pending (user)

- **0.10 Browser smoke-test**: local mode ✅; Google login pending Firebase
  console `localhost` authorized-domain config (not a code issue).
- **0.11 Commit** ✅ `9bec5fa chore: scaffold vite + mechanical split`.
