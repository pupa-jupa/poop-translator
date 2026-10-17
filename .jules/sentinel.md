## 2024-10-17 - Validate Object Lengths on Import
**Vulnerability:** DoS and Quota Exhaustion risk via malicious extension backup imports with unbounded strings.
**Learning:** During deserialization of imported user data, the lack of individual field length validations can bypass UI-level constraints (`maxlength`). This can exhaust extension storage quota or crash the extension's rendering logic.
**Prevention:** Always enforce strict schema boundaries, including explicit maximum lengths for strings and array limits, matching UI limits during data normalization.
