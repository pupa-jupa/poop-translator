## 2024-05-24 - DOM Traversal Caching
**Learning:** During heavy parsing operations (like TreeWalker processing text nodes), recursively checking DOM element properties (e.g., getComputedStyle, traversing to parent nodes) repeatedly for each text node introduces an O(depth * num_nodes) complexity bottleneck.
**Action:** Use a `WeakMap<Element, boolean>` initialized outside the TreeWalker iteration to memoize and store these intermediate states. This reduces repetitive checks on parent elements to O(1) across the full document text tree.
