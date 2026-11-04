## 2024-11-04 - Memoizing TreeWalker Ancestor Checks
**Learning:** Repetitive ancestor traversal checks (like `getComputedStyle`) during TreeWalker operations can cause an O(depth) performance bottleneck.
**Action:** Use a `WeakMap` scoped to the traversal to memoize these checks, storing path histories to ensure children inherit their ancestors' computed states, reducing complexity to amortized O(1).
