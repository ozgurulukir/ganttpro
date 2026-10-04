## 2026-09-29 - Unescaped raw input in dependency input tooltips

**Vulnerability:** DOM XSS when invalid or unparsed dependency string containing HTML tags (e.g., `<img src=x onerror=... >`) is rendered in tooltips via `innerHTML`.
**Learning:** `parseDepInput` returns unparsed raw string chunks in `p.raw`. Rendering `p.raw` or `p.err` into `innerHTML` sinks without `esc()` allows arbitrary script execution in the UI.
**Prevention:** Always wrap raw user input fields and error messages with `esc()` when inserting into `innerHTML` template strings.

## 2026-09-30 - Baseline date object schema validation gap

**Vulnerability:** Project schema validator `validateProject` dropped baseline date objects `{ s, e }` or `{ d }` by calling `toDateStr` directly on objects, while failing to sanitize nested object properties against untrusted input.
**Learning:** Baseline entries are stored as structured objects (`{ s, e }` / `{ d }`), but validator expected string dates.
**Prevention:** Ensure schema validators handle nested object data structures explicitly, sanitizing each nested string property while stripping unvalidated keys.

## 2026-10-01 - iCalendar CRLF Injection via Unescaped Carriage Returns in Exports

**Vulnerability:** CRLF injection in `.ics` calendar exports when task names or assignees contain carriage returns (`\r`), allowing injection of arbitrary iCalendar properties or `VEVENT` objects.
**Learning:** `replace(/[\n,;]/g, ' ')` failed to match `\r` (carriage return). When parsed by calendar clients, unescaped `\r` acts as a line separator.
**Prevention:** Use `icalEsc()` from `src/core/format.js` to escape backslashes and sanitize `\r`, `\n`, `,`, and `;` in exported TEXT fields.
