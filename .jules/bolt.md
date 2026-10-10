## 2024-05-15 - TreeWalker ancestor traversal memoization
**Learning:** During heavy DOM manipulation (like `collectTextNodes` via TreeWalker), repetitively checking attributes and styles (e.g. `getComputedStyle`) on parent elements is an O(depth) operation for every text node, which causes a performance bottleneck on large pages.
**Action:** Use a `WeakMap<Element, boolean>` to memoize the result of ancestor visibility/skip checks for elements, reducing the time complexity to amortized O(1).
