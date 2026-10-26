## 2024-05-18 - Enforce maximum string lengths during deserialization
**Vulnerability:** The application was deserializing unbounded strings into the application state via the `nonEmptyString` check. Large payloads (e.g. during backup imports) could cause high memory usage or out-of-memory errors (DoS attack).
**Learning:** Checking that a string exists and is non-empty is insufficient if its length is not constrained to logical boundaries. Malicious or malformed inputs could exceed expected schema lengths.
**Prevention:** Always enforce strict upper boundaries (maximum lengths) matching the UI and data limits when deserializing external payloads.
