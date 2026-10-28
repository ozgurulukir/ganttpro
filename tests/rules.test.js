import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

describe('Firestore Security Rules Security Verification', () => {
  const templatePath = resolve(ROOT, 'firestore.rules.template');
  const rulesPath = resolve(ROOT, 'firestore.rules');

  before(async () => {
    if (!existsSync(rulesPath)) {
      await import('../scripts/generate-firestore-rules.js');
    }
  });

  it('exists and is readable', () => {
    assert.strictEqual(existsSync(templatePath), true, 'firestore.rules.template should exist');
    assert.strictEqual(existsSync(rulesPath), true, 'firestore.rules should exist');
  });

  it('does NOT contain broad insecure isRegistered() access for gantt_user_data/{uid}', () => {
    const template = readFileSync(templatePath, 'utf-8');
    const rules = readFileSync(rulesPath, 'utf-8');

    // Reject the vulnerable rules pattern: allow read/write if request.auth.uid == uid || isRegistered();
    assert.strictEqual(
      template.includes('allow read: if request.auth.uid == uid || isRegistered();'),
      false,
      'template should not allow un-scoped isRegistered() read on user data'
    );
    assert.strictEqual(
      template.includes('allow write: if request.auth.uid == uid || isRegistered();'),
      false,
      'template should not allow un-scoped isRegistered() write on user data'
    );

    assert.strictEqual(
      rules.includes('allow read: if request.auth.uid == uid || isRegistered();'),
      false,
      'generated rules should not allow un-scoped isRegistered() read on user data'
    );
    assert.strictEqual(
      rules.includes('allow write: if request.auth.uid == uid || isRegistered();'),
      false,
      'generated rules should not allow un-scoped isRegistered() write on user data'
    );
  });

  it('uses gantt_user_shares cross-doc lookup helpers for user data collaborator access', () => {
    const template = readFileSync(templatePath, 'utf-8');

    assert.strictEqual(
      template.includes('hasUserDataReadAccess(uid)'),
      true,
      'template should define hasUserDataReadAccess helper'
    );
    assert.strictEqual(
      template.includes('hasUserDataWriteAccess(uid)'),
      true,
      'template should define hasUserDataWriteAccess helper'
    );

    assert.strictEqual(
      template.includes('gantt_user_shares/$(uid)_$(request.auth.token.email)'),
      true,
      'template should check gantt_user_shares by owner ID and authenticated email'
    );
  });

  it('defines rules for gantt_user_shares collection', () => {
    const template = readFileSync(templatePath, 'utf-8');

    assert.strictEqual(
      template.includes('match /gantt_user_shares/{docId}'),
      true,
      'template should define match rule for gantt_user_shares collection'
    );
  });

  it('uses resource.data.owner_id for gantt_project_shares delete rule to prevent pending resource bug', () => {
    const template = readFileSync(templatePath, 'utf-8');

    // Make sure create checks request.resource and delete checks resource
    assert.strictEqual(
      template.includes(
        'allow delete: if isRegistered()\n        && resource.data.owner_id == request.auth.uid;'
      ),
      true,
      'delete rule for gantt_project_shares must use resource.data.owner_id'
    );
  });
});
