## 2024-05-18 - [TreeWalker performance with getComputedStyle]
**Learning:** During heavy DOM manipulation (like `TreeWalker`), repetitive ancestor traversal checks (e.g. `getComputedStyle` or attribute checks on the same element) cause significant main-thread blocking, exhibiting O(N*depth) complexity.
**Action:** Use a `WeakMap<Element, boolean>` instantiated at the top-level of the loop/operation to memoize the results of traversing common ancestors, reducing the cost to amortized O(1).
