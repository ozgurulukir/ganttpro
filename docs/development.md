# Development setup and commands

This guide covers the local prerequisites, Firebase configuration, and repository scripts. For the project overview, see
the [README](../README.md); for source organization, see [Architecture](architecture.md).

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`, as declared by the locked Vite dependency.
- npm.

The repository includes `package-lock.json`; use `npm ci` to install its locked dependencies.

## Configure Firebase

For Google sign-in and cloud storage, create a Firebase project, enable Google as an Authentication provider, and enable
Cloud Firestore. Copy the web app settings into a local `.env` file:

```bash
cp .env.example .env
```

Set the `VITE_FIREBASE_*` values from the Firebase web app configuration. Set `VITE_ADMIN_EMAIL` to the admin email when
using the admin panel or generating Firestore rules. `.env` is ignored by Git.

The browser app reads these values from Vite's environment. The guest option is intended for local work without cloud
sync. More about the limits of guest and cloud sharing is in [Firebase and security](firebase-security.md).

## Run locally

```bash
npm ci
npm run dev
```

Vite serves the development app at <http://localhost:5173>.

## Repository commands

| Command                           | Purpose                                             |
| --------------------------------- | --------------------------------------------------- |
| `npm run build`                   | Build the static app into `dist/`.                  |
| `npm run preview`                 | Serve the last production build locally.            |
| `npm test`                        | Run the Node.js native test runner (`node --test`). |
| `TZ=America/Los_Angeles npm test` | Run the same tests with a different timezone.       |
| `npm run format`                  | Format repository files with Prettier.              |
| `npm run format:check`            | Check formatting without writing files.             |

Tests are in `tests/`; consult those files for the current coverage.

## Generate and deploy Firestore rules

`firestore.rules` is generated from `firestore.rules.template`; do not edit the generated file directly. The generator
reads `VITE_ADMIN_EMAIL` from `.env` and writes the result to the Git-ignored `firestore.rules` file.

```bash
npm run build:rules
```

To deploy, authenticate with the Firebase CLI and select the target Firebase project first. The project provides the
Firebase CLI through this npm script:

```bash
npm run firebase -- login
npm run deploy:rules
```

`npm run deploy:rules` runs `firebase deploy --only firestore:rules`. Firebase project selection is not committed in
this repository, so verify the selected project before deploying. Review [Firebase and security](firebase-security.md)
before changing these rules.

## Related pages

- [Documentation index](index.md)
- [Architecture and source layout](architecture.md)
- [Firebase configuration and security](firebase-security.md)
- [README](../README.md)
