## 2024-05-24 - Missing Input Length Limits on Backup Deserialization
**Vulnerability:** The extension imported and deserialized backup JSON strings without enforcing explicit max lengths on strings (via `nonEmptyString`). This could lead to storage quota exhaustion and potential DoS by keeping huge strings in memory and attempting to persist them via `chrome.storage.local`.
**Learning:** Checking for string types and trimming them isn't enough when importing externally provided data. The `chrome.storage` API has limits and attempting to store oversized properties could crash the extension or disrupt local state.
**Prevention:** Always enforce strict schema boundaries (including maximum string lengths) on data imported from outside boundaries, matching the expected UI limits.
