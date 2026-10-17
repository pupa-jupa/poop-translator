## 2024-10-18 - Insecure Deserialization (DoS / Quota Exhaustion) in Backup Import
**Vulnerability:** Unbounded string deserialization allowed arbitrary large values for history and dictionary items during backup import, risking DoS or chrome.storage quota exhaustion.
**Learning:** `nonEmptyString` validator checked for presence and type but not maximum length. Backup files could inject 100MB string keys which would cause OOM limits when loading `ExtensionState` into storage.
**Prevention:** Always enforce strict schema boundaries with explicit maximum string lengths when reading unsanitized user inputs, especially backup JSON blobs, to match UI limits (e.g. `isString(value, 10_000)`).
