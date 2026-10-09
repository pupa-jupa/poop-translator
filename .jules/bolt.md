## 2024-05-24 - DOM Traversal Memoization
**Learning:** Checking layout properties like `getComputedStyle` repeatedly on the same ancestor elements during deep DOM tree traversal (like with TreeWalker) causes severe performance degradation, running in O(N * depth) time.
**Action:** Use a `WeakMap<Element, boolean>` tied to the lifecycle of the traversal to memoize the ancestor checks. This reduces traversal time to amortized O(N) without causing memory leaks or reading stale layout data.
