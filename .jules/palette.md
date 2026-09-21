## YYYY-MM-DD - [Keyboard Accessibility for Interactive Elements]
**Learning:** Found that custom button elements (`.result-variant`, `.mini-action`, `.danger-zone button` in popup and `.pt-variant` in content script) did not have `focus-visible` styles, leading to poor keyboard navigation visibility.
**Action:** Changed specific class-based focus selectors to a generic `button:focus-visible` in `popup.css` to catch all button variants, and added `.pt-variant:focus-visible` in `content.css`.
