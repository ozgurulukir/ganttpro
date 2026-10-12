## 2026-05-06 - Accessible Drag Handles and Task Checkboxes

**Learning:** In vanilla DOM task tables, icon-only drag handles (`⋮⋮`) and task checkboxes lacking native `title` tooltips hinder accessibility and hover discovery.
**Action:** Always provide both `title` tooltips and explicit `aria-label`s on task row drag handles and checkboxes via i18n keys (`taskPanel.dragToReorder`, `taskPanel.markDone`, etc.).

## 2026-05-18 - Dynamic Tooltips and ARIA Labels for Toggle Buttons

**Learning:** Buttons that toggle between binary states (e.g. Dark Mode vs. Light Mode) should dynamically update both `title` and `aria-label` when toggled. Relying on static `data-i18n-title` or `data-i18n-aria-label` attributes in HTML causes `translateDOM()` to overwrite dynamic state-specific labels back to static defaults.
**Action:** Remove static `data-i18n-title` / `data-i18n-aria-label` attributes from toggle elements and manage `textContent`, `title`, and `aria-label` via a dedicated UI update function called during theme state changes, undo/redo state restoration, and re-renders.

## 2026-10-12 - ARIA Expanded States on Collapsible Section Accordions

**Learning:** Collapsible accordion toggle buttons in modal dialogs (e.g. `#modalAdvancedToggle`) that lack `aria-expanded` and `aria-controls` fail to inform screen reader users whether the panel is expanded or collapsed.
**Action:** Add `aria-controls` linking to the section ID and `aria-expanded` initialized to `"false"`. Synchronize `aria-expanded` ("true"/"false") whenever the panel toggles or when modal state is initialized/edited.
