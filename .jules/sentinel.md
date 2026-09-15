## 2026-09-15 - [Insecure Randomness Fallback in Dictionary]
**Vulnerability:** Used Math.random() as fallback for unique ID generation for Dictionary elements.
**Learning:** Even for non-critical elements like dictionary keys, cryptographically secure randomness should be preferred for ID generation to avoid predictable values or collisions.
**Prevention:** Prefer crypto.getRandomValues or crypto.randomUUID when making IDs, reserving Math.random() strictly for non-sensitive randomness.
