## 2024-05-18 - Tooltips and ARIA Live for Dynamic Content
**Learning:** Found that some icon-only buttons lacked tooltips and dynamic translation outputs lacked screen reader announcement capabilities in this specific pure-DOM setup.
**Action:** Always add `title` to complement `aria-label` for icon-only buttons, and use `aria-live="polite"` on containers where translations are asynchronously injected to ensure accessibility for all user types.
