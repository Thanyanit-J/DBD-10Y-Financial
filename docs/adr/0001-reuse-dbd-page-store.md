# 1. Reuse the DBD page's own data store instead of calling and decrypting the API ourselves

Date: 2026-10-06
Status: Accepted

## Context

DBD DataWarehouse is a Nuxt 3 / Vue 3 app. Its API responses are encrypted (HKDF-SHA256 → AES-GCM → zlib) with a key carried in a short-lived (900 s) in-memory access token. The page keeps the decrypted Year Records in a Pinia store (`financeStore`), and its table components draw one column per Year Record in that store. A test showed that the site draws more than 5 years correctly in all three Statement Modes (headers, %Change, title) when the store holds more Year Records.

## Decision

The extension runs a script in the page's main world. It hooks the store action that loads a 5-year window, asks the site to load the older windows as well, and puts the merged Year Records back into the store. The site's own token handling, decryption and table drawing do the rest. The extension does not read the token, call the API directly, or decrypt anything.

## Alternatives considered

- **Copy DBD's pipeline** (read the token, call the API, decrypt in the extension). It depends on the encryption scheme, the token refresh rules and the API wrapper format. It must still write to the store or redraw the table, so it adds risk without removing the dependency on the page internals.
- **Draw our own table in the DOM.** Vue redraws the table on every mode, year, compare-mode and language change, so injected DOM would be overwritten.

## Consequences

- The extension depends on internal names (`financeStore`, its fetch action, the cache key format). A DBD release can break it. When the hook cannot be installed or a request fails, the page must fall back to DBD's normal view with no output.
- Little code, and no cryptography to maintain.
- Isolated-world content scripts cannot reach `__vue_app__`, so the script must run with `world: "MAIN"`.
