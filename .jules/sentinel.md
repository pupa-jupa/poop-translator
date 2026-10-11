## 2026-10-11 - [Secure Message Origin]
**Vulnerability:** Background script did not explicitly reject unauthenticated messages from cross-extension contexts (defense-in-depth failure, as Chrome handles most of it, but explicit checks are best practice).
**Learning:** For defense in depth, always verify `sender.id === chrome.runtime.id` in `onMessage` listeners to guarantee messages originate from our extension.
**Prevention:** Add explicit sender verification at the beginning of all `chrome.runtime.onMessage.addListener` functions.
