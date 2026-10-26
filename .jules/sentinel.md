## 2025-05-18 - Fix Insecure Deserialization (Storage Quota Exhaustion)
**Vulnerability:** Unbounded string allocations during backup imports allowed arbitrary string lengths in the popup inputs for Dictionary and History sections, which bypass UI `maxlength` properties, creating a risk for DoS via storage quota exhaustion.
**Learning:** `normalizedHistory` and `normalizedDictionary` did not enforce string bounds during external input validation (`nonEmptyString` only), creating an insecure schema boundary.
**Prevention:** Implement strict schema boundaries on JSON ingestion limits based on realistic properties (matching UI constraints, like 500 characters for a dictionary word).
