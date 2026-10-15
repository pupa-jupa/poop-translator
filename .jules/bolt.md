## 2024-05-20 - TreeWalker optimizations
**Learning:** `createTreeWalker` on large documents with expensive `acceptNode` callbacks can be slow because it involves heavy operations (DOM traversal + `getComputedStyle`) on each candidate node. Memoizing `isSkippedElement` could save O(depth) calls to `getComputedStyle` and element traversal.
**Action:** Use a WeakMap to cache skip status for elements during a tree walk.
