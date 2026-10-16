## 2025-02-28 - Memoize TreeWalker ancestor checks
**Learning:** During heavy DOM manipulation (like `TreeWalker` usage in page translation), repetitively checking ancestors via O(depth) functions (e.g., `getComputedStyle`, attribute checks) causes massive performance overhead, especially on deeply nested elements.
**Action:** Use a `WeakMap<Element, boolean>` to memoize traversal checks. This reduces ancestor verification to an amortized O(1) complexity, speeding up DOM iteration significantly.
