## 2026-03-31 - Cycle Detection and Index Forwarding in Dependency Operations

**Learning:** `parseDepInput` accepts `index` but omitted passing it into inner `wouldCreateCycle` calls, leading to redundant O(N) task index rebuilds for every parsed dependency token. Additionally, `wouldCreateCycle` used `allDepIds()` inside DFS traversal which allocated 5 arrays and 1 Set per node visited.
**Action:** Always forward existing `index` parameter to inner graph operations and inspect dependency properties (`t.deps`, `t.sdeps`, `t.ffdeps`, `t.sfdeps`) directly during DFS graph traversal to avoid intermediate object allocations.

## 2026-03-31 - Reusing Tree Depth in Row Iterations

**Learning:** During task panel rendering, `getVisibleRows` returns `{ task, depth }`. Re-calculating the depth of a sibling node using `getTaskDepth` causes unnecessary `O(depth)` parent-chain traversals on every task row since siblings share the exact same parent and depth.
**Action:** Always reuse the known row `depth` when evaluating depth limits for sibling operations instead of querying `getTaskDepth`.

## 2026-03-31 - Zero-Allocation Forward Scheduling and Candidates Shrinking

**Learning:** `scheduleTasks` allocated up to 12 intermediate arrays per task per fixpoint iteration using `.map()` and `.filter()`, and re-iterated over already-scheduled tasks in every pass.
**Action:** Use zero-allocation direct array iteration for dependency resolution and track remaining unscheduled tasks (`remaining = nextRemaining`) across fixpoint iterations to dramatically reduce scheduling pass duration.
