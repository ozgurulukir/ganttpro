# Palette's Journal

## 2025-05-20 - Multi-locale ARIA Labels in Custom i18n

**Learning:** In vanilla JavaScript apps with custom i18n modules, adding static `aria-label` attributes to HTML template elements is insufficient when users switch languages. Adding a `data-i18n-aria-label` attribute handler to `translateDOM()` ensures screen reader labels update dynamically alongside visual text.
**Action:** When adding accessible ARIA labels to template elements, pair `aria-label` with `data-i18n-aria-label` and update `translateDOM()` to query and update them on locale changes.
