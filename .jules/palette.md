## 2024-10-31 - Add title and aria-live attributes for better accessibility
**Learning:** Icon-only buttons should include a 'title' attribute alongside 'aria-label' to assist sighted users who might not recognize the icon. Additionally, dynamically updating content containers need 'aria-live' attributes to ensure screen readers announce updates (e.g., translation results and download progress).
**Action:** Ensure all new icon-only buttons include both 'aria-label' and 'title'. Apply 'aria-live="polite"' to dynamic content containers in future components.
