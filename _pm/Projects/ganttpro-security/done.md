# DONE — GanttPro Security

## Phase 1: Firestore rules

- [x] Written `firestore.rules` — 4 collections, admin hardcoded by email
- [x] Written `firebase.json` — rules pointer
- [x] Documented cross-doc collab limitation (relaxed with registered-user trust boundary)
- [x] Deployment: `npx firebase deploy --only firestore:rules`
  (requires `firebase-tools` installed: `npm install -g firebase-tools`)

### Design decisions

1. **Admin = hardcoded email** (`s19800430@gmail.com`). The `is_admin` field in
   `gantt_allowed_users` is user-writable (self-registration), so rules cannot
   trust it. The hardcoded email is the sole source of admin truth.

2. **Cross-doc collab = relaxed**. Collaborators with edit permission write
   directly to the owner's `gantt_user_data` doc. Firestore rules cannot query
   `gantt_project_shares` from within a `gantt_user_data` rule. Decision: any
   registered user may read/write any other registered user's data. The trust
   boundary is `gantt_allowed_users` (self-registration with email verification
   via Google OAuth). Future hardening: Cloud Function for collab edits.

3. **`gantt_shares` = world-readable**. Required for unauthenticated share-link
   feature. Tokens are unguessable (`shr_` + random base36 + timestamp). No
   expiry in current schema (see backlog).
