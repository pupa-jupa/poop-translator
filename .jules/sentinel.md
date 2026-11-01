## 2024-11-01 - Prevent DoS via unbounded string lengths during deserialization
**Vulnerability:** Unbounded string lengths allowed during deserialization (e.g. backup import)
**Learning:** The `normalizeState` function used `nonEmptyString` which did not enforce a maximum length, allowing potential DoS or quota exhaustion through oversized imports.
**Prevention:** Use an `isString(value, maxLength, allowEmpty)` helper to strictly bound lengths according to UI limits.
