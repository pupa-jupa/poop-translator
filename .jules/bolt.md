## 2024-10-20 - TreeWalker Memoization for DOM Iteration
**Learning:** Repetitive ancestor traversal operations like `getComputedStyle` inside a `TreeWalker` callback can be a major hidden bottleneck, degrading from O(N) to O(N * depth).
**Action:** When filtering DOM nodes that require looking up the tree (for visibility checks, inherited styles, or specific ancestor tags), implement a local `WeakMap` to memoize the ancestor state. This drastically reduces the overhead to amortized O(1) per node visited, significantly improving overall page traversal performance.
