## 2024-05-19 - Caching expensive DOM style checks
**Learning:** During page translation, checking `getComputedStyle(element)` for every text node's ancestor resulted in a $O(N \times D)$ performance bottleneck (where N is text nodes and D is ancestor depth).
**Action:** Introduced a `Map<Element, boolean>` cache during the `TreeWalker` iteration to transform the check into $O(E)$ (where E is unique elements), avoiding redundant, expensive layout/style recalculation checks. Always consider cross-iteration memoization when traversing deep hierarchies.
