## 2026-04-18 - CSV Formula Injection via Percent Character (%)

**Vulnerability:** CSV exports did not escape cell values beginning with `%`, potentially allowing formula injection in spreadsheet applications (such as Lotus 1-2-3 compatibility mode or specific Excel configurations).
**Learning:** In addition to `=`, `+`, `-`, `@`, `\t`, and `\r`, characters like `%` can trigger formula execution or unwanted evaluation in some CSV parsers and spreadsheet tools.
**Prevention:** Always ensure `csvEsc` prepends a single quote `'` to any cell value whose trimmed or leading-whitespace string starts with formula trigger characters (`=`, `+`, `-`, `@`, `%`, `\t`, `\r`).
