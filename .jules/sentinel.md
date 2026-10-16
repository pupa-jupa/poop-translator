## 2025-10-15 - [Remove innerHTML for security]
**Vulnerability:** Found `innerHTML` being used to dynamically set status texts and render SVGs in content scripts which can be a XSS attack vector if the inputs are not correctly sanitized or maliciously manipulated.
**Learning:** In a vanilla DOM context, avoiding `innerHTML` usage is essential to defend against XSS. `DOMParser().parseFromString(svgStr, 'image/svg+xml').documentElement` is the correct approach to parse SVG safely and use `appendChild`. To replace elements without `innerHTML`, `replaceChildren()` and `document.createElement()` should be used.
**Prevention:** Avoid `innerHTML` everywhere. Use safe alternatives for DOM manipulation.
