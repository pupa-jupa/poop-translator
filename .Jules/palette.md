## 2026-10-08 - Dynamic content accessibility
**Learning:** Adding `aria-live="polite"` to components that fetch dynamic content is necessary to inform screen readers of incoming changes without full page reloads, and adding `title` tags on top of `aria-label` helps sighted users understand icon buttons.
**Action:** Always check dynamically updating containers (like translation blocks) for `aria-live` and icon buttons for `title`.
