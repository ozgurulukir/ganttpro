import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { isAdmin, ADMIN_EMAIL } from '../src/auth.js';
import { D } from '../src/render/deps.js';

describe('isAdmin()', () => {
  let originalGetCurrentUser;

  beforeEach(() => {
    originalGetCurrentUser = D.GetCurrentUser;
  });

  afterEach(() => {
    D.GetCurrentUser = originalGetCurrentUser;
  });

  it('returns true when D.GetCurrentUser().email matches ADMIN_EMAIL', () => {
    D.GetCurrentUser = () => ({ email: ADMIN_EMAIL });
    assert.strictEqual(isAdmin(), true);
  });

  it('returns false when D.GetCurrentUser().email does not match ADMIN_EMAIL', () => {
    D.GetCurrentUser = () => ({ email: 'regularuser@example.com' });
    assert.strictEqual(isAdmin(), false);
  });

  it('returns false when D.GetCurrentUser().email is null or undefined', () => {
    D.GetCurrentUser = () => ({ email: undefined });
    assert.strictEqual(isAdmin(), false);

    D.GetCurrentUser = () => ({ email: null });
    assert.strictEqual(isAdmin(), false);
  });

  it('returns false when D.GetCurrentUser() returns null or undefined', () => {
    D.GetCurrentUser = () => null;
    assert.strictEqual(isAdmin(), false);

    D.GetCurrentUser = () => undefined;
    assert.strictEqual(isAdmin(), false);
  });
});
