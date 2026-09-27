## 2026-09-27 - Hide decorative arrows from screen readers
**Learning:** Decorative characters (like `→`, `↓`, `↑`, `›`) used in `.language-arrow` and `.danger-zone` buttons were missing `aria-hidden="true"`, causing screen readers to redundantly announce them.
**Action:** Always add `aria-hidden="true"` to structural or decorative typography elements that have no semantic meaning and are accompanied by descriptive text.
