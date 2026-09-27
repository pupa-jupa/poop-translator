## 2024-05-18 - Decorative Characters and Icons

**Learning:** Purely decorative characters (like "→", "↓", "↑", "›") used for visual spacing or styling in UI components can be unintentionally read by screen readers.
**Action:** When adding structural visual elements that have no semantic meaning, always wrap them in a `span` or `div` with `aria-hidden="true"` to prevent screen readers from reading them out loud.
