## 2026-03-31 - Cycle Detection and Index Forwarding in Dependency Operations

**Learning:** `parseDepInput` accepts `index` but omitted passing it into inner `wouldCreateCycle` calls, leading to redundant O(N) task index rebuilds for every parsed dependency token. Additionally, `wouldCreateCycle` used `allDepIds()` inside DFS traversal which allocated 5 arrays and 1 Set per node visited.
**Action:** Always forward existing `index` parameter to inner graph operations and inspect dependency properties (`t.deps`, `t.sdeps`, `t.ffdeps`, `t.sfdeps`) directly during DFS graph traversal to avoid intermediate object allocations.
