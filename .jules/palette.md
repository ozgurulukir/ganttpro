## 2026-05-06 - Accessible Drag Handles and Task Checkboxes

**Learning:** In vanilla DOM task tables, icon-only drag handles (`⋮⋮`) and task checkboxes lacking native `title` tooltips hinder accessibility and hover discovery.
**Action:** Always provide both `title` tooltips and explicit `aria-label`s on task row drag handles and checkboxes via i18n keys (`taskPanel.dragToReorder`, `taskPanel.markDone`, etc.).
