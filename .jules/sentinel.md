## 2026-09-29 - Unescaped raw input in dependency input tooltips

**Vulnerability:** DOM XSS when invalid or unparsed dependency string containing HTML tags (e.g., `<img src=x onerror=... >`) is rendered in tooltips via `innerHTML`.
**Learning:** `parseDepInput` returns unparsed raw string chunks in `p.raw`. Rendering `p.raw` or `p.err` into `innerHTML` sinks without `esc()` allows arbitrary script execution in the UI.
**Prevention:** Always wrap raw user input fields and error messages with `esc()` when inserting into `innerHTML` template strings.
