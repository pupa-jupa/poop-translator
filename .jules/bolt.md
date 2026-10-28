## 2026-09-24 - Memoize DOM Traversal in page translation
**Learning:** Repetitive ancestor traversal checks (`getComputedStyle` and attribute checks) during deep DOM manipulation (like `createTreeWalker` in `collectTextNodes`) cause O(depth) complexity, severely impacting performance.
**Action:** Use a `WeakMap<Element, boolean>` scoped to the `collectTextNodes` execution lifecycle to memoize repetitive ancestor traversal checks, reducing complexity to amortized O(1).
