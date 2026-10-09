## 2025-05-20 - Tree query adapters dropping pre-built task index

**Learning:** `src/main.js` adapter functions for tree/dep queries (`groupBounds`, `groupProgress`, `getVisibleRows`, etc.) omitted the optional `index` parameter supported by `src/core/tree.js`. As a result, render loops and export functions that called `D.groupBounds` or `D.groupProgress` ended up triggering `buildIndex(tasks)` on every single group row instead of reusing a pre-built index, turning O(1) lookups into O(N) map allocations and array traversals.
**Action:** Always verify that wrapper closures in `main.js` forward all optional parameters (like `index` or `rowMap`) to core functions, and ensure render and export loops pass `taskIndex` down to sub-renderers.
