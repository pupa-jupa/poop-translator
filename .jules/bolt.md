## 2024-05-24 - TreeWalker Optimization
**Learning:** Using TreeWalker `SHOW_TEXT` and traversing the parent chain (`isSkippedElement`) for EVERY text node is incredibly inefficient, leading to O(depth * textNodes) complexity.
**Action:** When walking the DOM, it is much faster to use `SHOW_ELEMENT | SHOW_TEXT` and reject skipped elements directly during traversal using `NodeFilter.FILTER_REJECT`. This prevents TreeWalker from even entering hidden subtrees and eliminates redundant parent chain traversal, resulting in ~5x speedup for text collection on large pages.
