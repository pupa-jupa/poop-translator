## 2024-10-10 - Assist sighted users with tooltip labels
**Learning:** Icon-only buttons often rely on `aria-label` for screen reader accessibility, but sighted users need standard hover text to understand what the icon means. Using `aria-label` along with the `title` attribute correctly caters to both groups, ensuring accessibility is preserved and usability is enhanced.
**Action:** When adding or checking icon-only buttons, always ensure that a `title` attribute is present alongside the `aria-label` to provide tooltips for sighted users.
