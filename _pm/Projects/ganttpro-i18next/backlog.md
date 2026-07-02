# BACKLOG — GanttPro i18next

Deferred / future items. Pull into todo.md when ready.

## Future locales

- **zh-CN** (Simplified Chinese) — straightforward from zh-TW base.
- **ja** (Japanese) — if targeting Japan market.
- **ko** (Korean) — if targeting Korea market.

## Enhancements

- Lazy-load locale JSONs via dynamic `import()` for code-splitting
  (only relevant when >3 locales exist).
- CLDR plural rules for languages with complex pluralization (Arabic, Polish).
- RTL layout support (Arabic, Hebrew) — CSS `direction: rtl` + logical properties.
- Date/time formatting per locale via `Intl.DateTimeFormat` (currently hardcoded).
- Number formatting per locale (workload counts, progress percentages).
- Locale detection from `navigator.language` on first visit.
- Locale stored in Firestore user profile (sync across devices).
- E2E tests for locale switching (Playwright).
