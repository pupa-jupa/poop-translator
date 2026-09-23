## 2025-02-12 - Screen reader announcements for async translations
**Learning:** In the Chrome Extension popup, dynamically generated translation results (`<p data-result-translation>`) are not naturally announced by screen readers when they appear asynchronously.
**Action:** Always consider adding `aria-live="polite"` to dynamically populated text containers, especially for core features like search results or translations, so visually impaired users don't have to manually navigate to find the result.
