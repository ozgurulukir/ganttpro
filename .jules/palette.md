# Palette's Journal

## 2025-05-20 - Multi-locale ARIA Labels in Custom i18n

**Learning:** In vanilla JavaScript apps with custom i18n modules, adding static `aria-label` attributes to HTML template elements is insufficient when users switch languages. Adding a `data-i18n-aria-label` attribute handler to `translateDOM()` ensures screen reader labels update dynamically alongside visual text.
**Action:** When adding accessible ARIA labels to template elements, pair `aria-label` with `data-i18n-aria-label` and update `translateDOM()` to query and update them on locale changes.

## 2026-03-31 - Keyboard Accessibility & ARIA Semantics for Custom Row Action Buttons

**Learning:** Custom interactive elements (e.g. `div` or `span` buttons/checkboxes) inside table/list rows are unreachable for keyboard and screen reader users unless assigned `tabindex="0"`, `role="checkbox"`/`role="button"`, `aria-checked`, and `keydown` handlers (Space/Enter). Additionally, action buttons that reveal on row hover must also be revealed when focus enters the row (`.task-row:focus-within .row-action-btn`).
**Action:** Always pair custom interactive row controls with `tabindex="0"`, ARIA roles, keydown listeners, and `.task-row:focus-within` CSS selectors so keyboard users can navigate and operate them smoothly.

## 2026-04-01 - Discoverability & ARIA Expansion States for Keyboard Shortcuts & Dropdowns

**Learning:** Shortcut overlays triggered only via single-key listeners (e.g., `?`) are undiscoverable for visual and screen-reader users unless exposed in standard navigation menus (e.g., Settings dropdown). Additionally, popup/dropdown trigger buttons require `aria-haspopup="true"` and dynamic `aria-expanded` updates so assistive technologies can track open/closed overlay states.
**Action:** Expose shortcut modals in the Settings dropdown menu, update trigger `aria-expanded` states on open/close, and automatically focus the modal close button upon opening.
