## 2024-05-24 - Add tooltips to icon-only buttons
**Learning:** Icon-only buttons with `aria-label` are accessible to screen readers, but sighted users (or users with cognitive disabilities) may not understand their purpose without a visual tooltip. Adding a `title` attribute provides a native tooltip on hover.
**Action:** Always include a `title` attribute on icon-only buttons to assist sighted users, in addition to the `aria-label` for screen readers.
