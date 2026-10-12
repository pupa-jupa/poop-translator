## 2024-05-17 - [DOM Traversal Memoization in Extension]
**Learning:** In a Chrome Extension working directly on DOM Nodes, using a `TreeWalker` can be slow if it relies on verifying parent node styling (`getComputedStyle()`) and skipping attributes via a simple loop. `getComputedStyle()` is highly expensive.
**Action:** Use a `WeakMap<Element, boolean>` tied to the life cycle of the `collectTextNodes` execution to cache the visible/skipped status of ancestors. This efficiently memoizes node statuses, eliminating repetitive recalculations from $O(Depth * Nodes)$ to an amortized $O(Nodes)$.
