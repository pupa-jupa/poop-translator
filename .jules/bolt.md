## 2025-05-18 - Memoize TreeWalker ancestor checks
**Learning:** During heavy DOM traversal using `TreeWalker` to extract text nodes, repeatedly checking `.parentElement` properties up the DOM tree (e.g., for `display: none` or specific skip-tags) results in O(depth) complexity per text node. This causes redundant work.
**Action:** Use a `WeakMap<Element, boolean>` initialized before the `TreeWalker` loop and pass it down. Cache the computed result for every ancestor in the traversed path. This reduces the check complexity to amortized O(1) and significantly speeds up parsing of large DOMs.
