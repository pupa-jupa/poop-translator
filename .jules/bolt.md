## 2023-10-25 - TreeWalker redundant traversal in `collectTextNodes`
**Learning:** Checking parent state iteratively inside a `TreeWalker`'s `SHOW_TEXT` filter causes redundant O(N*M) traversal and re-evaluation of `getComputedStyle` for ancestor elements.
**Action:** Use `NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT` and return `FILTER_REJECT` for elements to efficiently prune entire subtrees without redundant calculations.
