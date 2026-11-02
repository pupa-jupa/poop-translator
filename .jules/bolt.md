## 2024-11-03 - Memoize ancestor checks in DOM traversal
**Learning:** Checking DOM ancestor properties (like `getComputedStyle` or tags) inside a TreeWalker filter is highly redundant for deeply nested DOM trees, making traversal O(depth).
**Action:** Use a `WeakMap<Element, boolean>` scoped to the `TreeWalker` lifecycle to memoize repetitive ancestor traversal checks, collecting intermediate nodes in a path array to apply the result iteratively. This reduces complexity to amortized O(1).
