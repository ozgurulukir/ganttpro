## 2026-03-31 - Explicit ARIA Labels for Icon Buttons with i18n

**Learning:** `translateDOM()` translates tooltips via `data-i18n-title` and accessible names via `data-i18n-aria-label`. Icon-only buttons with `title` and `data-i18n-title` update tooltips but leave screen reader users without an explicit `aria-label` unless `aria-label` and `data-i18n-aria-label` are also present.
**Action:** Always include both `aria-label` and `data-i18n-aria-label` alongside `title`/`data-i18n-title` on icon-only and symbol buttons.
