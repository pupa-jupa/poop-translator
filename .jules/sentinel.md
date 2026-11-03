## 2024-05-18 - Enforce string length limits during state deserialization
**Vulnerability:** Unbounded strings in storage backup deserialization (DoS and quota exhaustion risk).
**Learning:** `storage.ts` relied on `typeof value === 'string'` without max length bounds, while `storage-client.ts` had them.
**Prevention:** Always enforce strict schema boundaries including maximum string lengths during external data parsing/deserialization to match UI limits.
