## 2026-05-18 - Dynamic Tooltips and ARIA Labels for Toggle Buttons

**Learning:** Buttons that toggle between binary states (e.g. Dark Mode vs. Light Mode) should dynamically update both `title` and `aria-label` when toggled. Relying on static `data-i18n-title` or `data-i18n-aria-label` attributes in HTML causes `translateDOM()` to overwrite dynamic state-specific labels back to static defaults.
**Action:** Remove static `data-i18n-title` / `data-i18n-aria-label` attributes from toggle elements and manage `textContent`, `title`, and `aria-label` via a dedicated UI update function called during theme state changes, undo/redo state restoration, and re-renders.
