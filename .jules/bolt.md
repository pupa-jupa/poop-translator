## 2023-10-27 - Memoize DOM TreeWalker ancestor checks
**Learning:** Repetitive ancestor traversal checks in DOM manipulation like TreeWalkers cause high O(depth) performance overhead per node.
**Action:** Use a strictly-scoped WeakMap<Element, boolean> inside the traversal loop to memoize element states, reducing complexity to amortized O(1).
