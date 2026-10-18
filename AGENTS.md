# GanttPro agent guide

GanttPro is a vanilla JavaScript single-page Gantt chart app built with Vite and Firebase. `index.html` loads
`src/main.js`; `gantt.html` is a separate legacy implementation and is not part of the Vite build.

## Documentation

- Start with [README.md](README.md) for the project overview and quickstart.
- Use [docs/index.md](docs/index.md) to find development, architecture, and Firebase/security guidance.
- Keep code and technical documentation in English. User-facing strings belong in both `src/i18n/locales/en.json` and
  `src/i18n/locales/zh-TW.json`.

## Code conventions

- Keep `src/core/` domain logic pure: no DOM, `window`, or app-global state.
- Keep browser and Firebase I/O in the application shell (`src/main.js`, `src/render/`, `src/ui/`, `src/data/`, and
  feature modules).
- Rendering modules receive current state through the shared `D` object in `src/render/deps.js`; extracted modules
  should not import `src/main.js`.
- Use event delegation in the Vite app rather than adding inline `onclick` handlers.
- When changing core behavior, update or add tests under `tests/`. Run them with `npm test`.
- Do not edit generated `firestore.rules` directly. Update `firestore.rules.template` and regenerate the output with
  `npm run build:rules`.

## Common commands

```bash
npm ci
npm run dev
npm run build
npm test
npm run format:check
```

See [Development setup](docs/development.md) for prerequisites, Firebase configuration, and the full command list. See
[Firebase and security](docs/firebase-security.md) before changing access rules or sharing behavior.
