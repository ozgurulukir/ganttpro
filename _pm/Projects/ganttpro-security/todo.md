# TODO — GanttPro Security

## Phase 1: Firestore rules ✅

- [x] Write `firestore.rules`
- [x] Write `firebase.json` (rules pointer)
- [x] Document deployment instructions
- [x] Document known limitations (cross-doc collab rule)

## Deployment (manual)

```
npx firebase deploy --only firestore:rules
```

Requires `firebase-tools` and login (`npx firebase login`).
