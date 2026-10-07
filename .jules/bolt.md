## 2026-03-31 - Reusing pre-built `taskIndex` in render loops

**Learning:** Functions like `buildDepsText` and `getWBSMap` defaulted to `index = buildIndex(tasks)`. Calling them inside row-by-row rendering loops without passing the already constructed `taskIndex` caused `buildIndex(tasks)` to execute $N$ times per render frame ($O(N^2)$ index creations).
**Action:** Always forward the existing `taskIndex` / `index` parameter into helper functions inside rendering loops and export tasks.
