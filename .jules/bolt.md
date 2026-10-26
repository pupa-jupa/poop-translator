## 2025-02-20 - Memoize ancestor checks in TreeWalker
**Learning:** During heavy DOM manipulation (like TreeWalkers), repeatedly traversing the ancestor chain to check conditions (like visibility or editability) causes O(depth * nodes) complexity, leading to severe bottlenecks on large pages.
**Action:** Use a `WeakMap<Element, boolean>` scoped to the execution lifecycle of the specific traversal (to guarantee safety against stale caches) to memoize repetitive ancestor traversal checks. This reduces O(depth) complexity to amortized O(1).
