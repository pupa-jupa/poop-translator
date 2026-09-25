## 2024-05-24 - Memoizing getComputedStyle for Text Collection
**Learning:** During full page translation, the `collectTextNodes` function uses a TreeWalker to find text. For each text node, it checks `isSkippedElement` on all its ancestors, which calls `getComputedStyle` synchronously. This triggers O(N * depth) recalculations of layout, creating a huge performance bottleneck on large pages.
**Action:** Use a `WeakMap` or `Map` to memoize the result of `isSkippedElement` (or directly the `getComputedStyle` evaluations) during a single traversal so that elements are only checked once.
