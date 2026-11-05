## 2024-05-18 - Tooltip for Icon-only Buttons
**Learning:** Found a pattern where icon-only buttons in modals lack the `title` attribute, which hurts accessibility and UX for sighted users who need tooltips to understand icon meanings.
**Action:** Always ensure icon-only buttons have both `aria-label` (for screen readers) and `title` (for sighted users).
