## 2025-02-14 - Fix DoS risk in backup deserialization
**Vulnerability:** The application parsed incoming backup JSON files without validating maximum string lengths for unbounded strings (like backup ID, original text, translated text, and dictionary note). This allowed arbitrary-length strings to be imported.
**Learning:** During data deserialization, even benign files may contain extremely large string properties that exceed UI boundaries and potentially exhaust storage quota and cause a Denial of Service (DoS).
**Prevention:** Always enforce strict schema boundaries, specifically using maximum string lengths directly in schema parsing and normalization functions to match UI bounds.
