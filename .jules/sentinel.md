## 2026-09-29 - Unescaped raw input in dependency input tooltips

**Vulnerability:** DOM XSS when invalid or unparsed dependency string containing HTML tags (e.g., `<img src=x onerror=... >`) is rendered in tooltips via `innerHTML`.
**Learning:** `parseDepInput` returns unparsed raw string chunks in `p.raw`. Rendering `p.raw` or `p.err` into `innerHTML` sinks without `esc()` allows arbitrary script execution in the UI.
**Prevention:** Always wrap raw user input fields and error messages with `esc()` when inserting into `innerHTML` template strings.

## 2026-09-30 - Baseline date object schema validation gap

**Vulnerability:** Project schema validator `validateProject` dropped baseline date objects `{ s, e }` or `{ d }` by calling `toDateStr` directly on objects, while failing to sanitize nested object properties against untrusted input.
**Learning:** Baseline entries are stored as structured objects (`{ s, e }` / `{ d }`), but validator expected string dates.
**Prevention:** Ensure schema validators handle nested object data structures explicitly, sanitizing each nested string property while stripping unvalidated keys.

## 2026-10-01 - Obfuscated URI scheme entity encoding bypass in URL sanitization

**Vulnerability:** `sanitizeUrl` checked for `javascript:`, `data:`, and `vbscript:` via literal string prefix, but allowed HTML entity-encoded colons (`javascript&colon;`, `javascript&#58;`, `javascript&#x3a;`) and risky schemes (`blob:`, `file:`). When injected into HTML `href` or `src` attributes, browsers decode HTML entities prior to scheme execution, allowing XSS bypasses.
**Learning:** Checking string prefixes on raw input without normalizing HTML entities or checking dangerous protocol variations leaves sanitizers vulnerable to entity obfuscation.
**Prevention:** Normalize HTML entity representations of colons and inspect normalized scheme prefixes against an explicit blocklist (including `blob:` and `file:`) prior to allowing URL strings.
