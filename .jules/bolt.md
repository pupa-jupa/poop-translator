## 2024-02-12 - Missing Debounce/Throttle
**Learning:** We need to add debounce or throttle in search inputs. Specifically, the search input fields in the history and dictionary views fire events on every keystroke, which can cause performance issues if there are many entries, by rendering on every single keystroke.
**Action:** Add debounce when rendering the search results to improve performance.
