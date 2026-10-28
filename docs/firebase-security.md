# Firebase configuration and security

This page describes how the app uses Firebase and what the checked-in Firestore rules allow. The rules are an important
boundary, but project-level collaboration permissions are not fully enforced by them. See
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
| `gantt_project_shares/{docId}` | Named collaboration grants between an owner and an invitee.                     |
| `gantt_allowed_users/{email}`  | Self-service registration records used to check whether an email is registered. |
| `gantt_shares/{token}`         | Publicly readable snapshots for Firestore-backed share links.                   |

## What the rules allow

- A user can read and write their own `gantt_user_data` document. A registered user can also read and write **any**
  user's data document. The rules do not check the per-project share grant before permitting those cross-user writes.
- Owners and named invitees can read their collaboration-grant documents. The template allows the project owner to create
  collaboration grants (checking `request.resource.data.owner_id`) and delete collaboration grants (checking `resource.data.owner_id`). See
  [Firebase's Firestore request reference](https://firebase.google.com/docs/reference/rules/rules.firestore.Request).
- A signed-in user can self-register by creating their own allowlist document with `is_admin: false`. Only the
  configured admin can update or delete allowlist records. The client-supplied `is_admin` field does not grant admin
  authority.
- Anyone can read a `gantt_shares/{token}` document. The rules allow its owner to create or delete it; updates are
  denied.

The app's read/edit collaboration controls do not make the broad `gantt_user_data` rule a project-level access-control
system. Do not treat those UI permissions as a database authorization boundary.

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
