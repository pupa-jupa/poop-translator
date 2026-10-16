## 2024-09-17 - [DOM Text Node Traversal]
**Learning:** Checking skip criteria (like attributes or styles) repeatedly on parent elements for every single child text node results in O(N*D) complexity (where D is tree depth) and is a significant frontend bottleneck when traversing large DOM trees.
**Action:** Use `TreeWalker` with `NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT` and return `NodeFilter.FILTER_REJECT` on elements that match skip criteria. This prunes entire subtrees early, drastically reducing redundant computations.
