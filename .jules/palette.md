## 2024-10-02 - Added tooltips to icon-only buttons
**Learning:** Adding a `title` attribute to buttons that only have an `aria-label` provides a native tooltip on hover, which significantly improves the experience for sighted users who might not recognize the icon's purpose. It's important to provide both `aria-label` for screen readers and `title` for sighted mouse users on icon-only buttons.
**Action:** Always include a `title` attribute matching the `aria-label` on any icon-only interactive element.
