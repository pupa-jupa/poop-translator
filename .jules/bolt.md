## 2025-02-24 - DocumentFragment vs ReplaceChildren Array
**Learning:** Using `replaceChildren(...elements)` with a dynamically sized array can trigger a "Maximum call stack size exceeded" error if the array grows very large (e.g. tens of thousands of items in a user history or dictionary list). Using a `DocumentFragment` is inherently safer for batch DOM insertion.
**Action:** Default to using `DocumentFragment` and appending it when dealing with potentially unbounded arrays of DOM elements.
