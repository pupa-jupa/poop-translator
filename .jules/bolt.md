## 2025-02-18 - Memoizing TreeWalker Ancestor Checks

**Learning:** TreeWalker operations traversing deep DOM trees can suffer significant performance degradation due to repetitive ancestor property checks (like `getComputedStyle` and `getAttribute`) required for every child text node. This effectively causes an O(depth) operation for every text node, scaling poorly on deep trees.
**Action:** Use a `WeakMap<Element, boolean>` strictly scoped to the execution lifecycle of the TreeWalker operation to cache whether an ancestor meets specific conditions. This reduces repetitive checks to an amortized O(1) lookup per ancestor, preventing memory leaks and avoiding stale data if the DOM mutates between operations.
