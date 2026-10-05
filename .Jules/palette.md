## 2024-10-06 - Tooltips for icon-only buttons
**Learning:** Icon-only buttons with `aria-label` are accessible to screen readers, but sighted users might struggle to understand their function without visual tooltips. Native `title` attributes provide a lightweight, native tooltip for these users.
**Action:** Always ensure that icon-only buttons in this app include a `title` attribute matching their `aria-label` (e.g. `title="Закрыть"` and `aria-label="Закрыть"` for a close button) to support both visual and non-visual user experiences.
