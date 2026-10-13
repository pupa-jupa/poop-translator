## 2024-05-18 - [Memoizing DOM Ancestor Traversal]
**Learning:** Repetitively walking up the DOM tree and performing expensive checks (like `getComputedStyle` and `hasAttribute`) on every node during heavy operations like `TreeWalker.nextNode()` causes severe performance bottlenecks (O(depth * nodes) complexity).
**Action:** When heavily iterating over DOM nodes and inspecting their ancestors, scope a `WeakMap<Element, boolean>` cache around the iteration to memoize ancestor state checks. This brings the complexity of ancestor checks down to amortized O(1).
