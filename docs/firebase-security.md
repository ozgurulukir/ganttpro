# Firebase configuration and security

This page describes how the app uses Firebase and what the checked-in Firestore rules allow. See
[Development setup](development.md) for the commands and the [README](../README.md) for the feature overview.

## Firebase configuration

The app reads Firebase web configuration from these `VITE_FIREBASE_*` values in `.env`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Google sign-in uses Firebase Authentication. Project and collaboration data use Cloud Firestore. `VITE_ADMIN_EMAIL`
configures the admin email in the client and is substituted into `firestore.rules` when the rules generator runs. The
Firebase web API key is part of the browser configuration; access control is defined by Firestore rules, not by hiding
that key.

## Firestore collections

| Collection                     | Purpose                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `gantt_user_data/{uid}`        | One document per user containing that user's projects.                          |
| `gantt_user_shares/{docId}`    | User-level collaboration access grants (owner ID + invitee email).              |
| `gantt_project_shares/{docId}` | Per-project collaboration grants between an owner and an invitee.               |
| `gantt_allowed_users/{email}`  | Self-service registration records used to check whether an email is registered. |
| `gantt_shares/{token}`         | Publicly readable snapshots for Firestore-backed share links.                   |

## What the rules allow

- A user can read and write their own `gantt_user_data` document. Cross-user access to `gantt_user_data/{uid}` is strictly
  restricted to registered collaborators with valid grants in `gantt_user_shares`. Collaborators with read access can read
  the owner's document; collaborators with edit access (`can_edit: true`) can read and write the document. Uninvited users cannot access other users' data.
- Owners and named invitees can read their collaboration-grant documents in `gantt_user_shares` and `gantt_project_shares`.
  Project owners can create, update, and delete collaboration records for their projects.
- A signed-in user can self-register by creating their own allowlist document with `is_admin: false`. Only the
  configured admin can update or delete allowlist records. The client-supplied `is_admin` field does not grant admin
  authority.
- Anyone can read a `gantt_shares/{token}` document. The rules allow its owner to create or delete it; updates are
  denied.

## Share-link behavior

The app has two link formats:

- For a signed-in owner, the project snapshot is stored in `gantt_shares` and the URL contains a token. The document is
  publicly readable by that token. The UI's invalidation flow asks Firestore to delete the snapshot and rotates the
  saved token even if deletion fails. If deletion fails, the old token can still read the public snapshot; verify that
  the document was deleted before treating the link as revoked. The rules do not define an automatic expiry.
- In guest mode, project data is embedded directly in the URL. This payload is unsigned and cannot be revoked by the
  app. Anyone with the URL can read its data; treat the URL itself as the shared data.

## Generate and deploy rules

`firestore.rules.template` is the source of truth. The generator substitutes `VITE_ADMIN_EMAIL` from `.env` into the
template and writes the Git-ignored `firestore.rules` output. Regenerate rules after changing the admin email,
authenticate and select the intended Firebase project, then run the deploy script:

```bash
npm run build:rules
npm run firebase -- login
npm run deploy:rules
```

The app's admin UI check and the Firestore rule check serve different roles: the UI check controls what the client
displays, while Firestore rules govern database requests. Review the generated rules and selected Firebase project
before deployment.

## Related pages

- [Documentation index](index.md)
- [Development setup and commands](development.md)
- [Architecture and source layout](architecture.md)
- [README](../README.md)
