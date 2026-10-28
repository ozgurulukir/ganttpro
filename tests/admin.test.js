import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { esc } from '../src/core/format.js';
import { ADMIN_EMAIL } from '../src/auth.js';
import { initI18n, setLocale } from '../src/i18n/index.js';
import { D } from '../src/render/deps.js';

// Mock minimal DOM elements, localStorage, and window dialogs for Node.js test environment
const mockElements = new Map();

function getOrCreateMockElement(id) {
  if (!mockElements.has(id)) {
    const classList = new Set();
    mockElements.set(id, {
      id,
      innerHTML: '',
      textContent: '',
      classList: {
        add(cls) {
          classList.add(cls);
        },
        remove(cls) {
          classList.delete(cls);
        },
        contains(cls) {
          return classList.has(cls);
        }
      }
    });
  }
  return mockElements.get(id);
}

globalThis.document = {
  documentElement: { lang: 'en' },
  getElementById(id) {
    return getOrCreateMockElement(id);
  },
  querySelectorAll() {
    return [];
  }
};

const storageMap = new Map();
globalThis.localStorage = {
  getItem(k) {
    return storageMap.get(k) || null;
  },
  setItem(k, v) {
    storageMap.set(k, String(v));
  },
  removeItem(k) {
    storageMap.delete(k);
  }
};

let confirmReturn = true;
let lastConfirmMsg = null;
let lastAlertMsg = null;

globalThis.confirm = msg => {
  lastConfirmMsg = msg;
  return confirmReturn;
};

globalThis.alert = msg => {
  lastAlertMsg = msg;
};

const { openAdminPanel, closeAdminPanel, deleteUser } = await import('../src/admin.js');

describe('Admin Panel', () => {
  let origGetCurrentUser;
  let origGetAllUsers;
  let origRemoveUser;

  beforeEach(async () => {
    await initI18n();
    setLocale('en');

    mockElements.clear();
    confirmReturn = true;
    lastConfirmMsg = null;
    lastAlertMsg = null;

    origGetCurrentUser = D.GetCurrentUser;
    origGetAllUsers = D.getAllUsers;
    origRemoveUser = D.removeUser;
  });

  afterEach(() => {
    D.GetCurrentUser = origGetCurrentUser;
    D.getAllUsers = origGetAllUsers;
    D.removeUser = origRemoveUser;
  });

  describe('openAdminPanel()', () => {
    it('does nothing if the current user is not an admin', async () => {
      D.GetCurrentUser = () => ({ email: 'regular@example.com' });
      let getAllUsersCalled = false;
      D.getAllUsers = async () => {
        getAllUsersCalled = true;
        return [];
      };

      await openAdminPanel();

      const overlay = getOrCreateMockElement('adminOverlay');
      assert.strictEqual(overlay.classList.contains('open'), false);
      assert.strictEqual(getAllUsersCalled, false);
    });

    it('opens overlay and renders user list when user is admin', async () => {
      D.GetCurrentUser = () => ({ email: ADMIN_EMAIL });
      const mockUsers = [
        {
          name: 'Admin Alice',
          email: 'admin@example.com',
          is_admin: true,
          added_at: '2026-01-01T00:00:00Z'
        },
        {
          name: 'User Bob <script>alert(1)</script>',
          email: 'bob@example.com',
          is_admin: false,
          added_at: '2026-02-01T00:00:00Z'
        },
        {
          name: null,
          email: 'noname@example.com',
          is_admin: false,
          added_at: null
        }
      ];

      D.getAllUsers = async () => mockUsers;

      await openAdminPanel();

      const overlay = getOrCreateMockElement('adminOverlay');
      assert.strictEqual(overlay.classList.contains('open'), true);

      const countEl = getOrCreateMockElement('adminUserCount');
      assert.strictEqual(countEl.textContent, '(3 users)');

      const listEl = getOrCreateMockElement('adminUserList');
      const html = listEl.innerHTML;

      // Admin user row check
      assert.ok(html.includes('Admin Alice'));
      assert.ok(html.includes('Admin'));
      // Non-admin user row check
      assert.ok(html.includes('bob@example.com'));
      assert.ok(html.includes('User'));
      assert.ok(html.includes('data-action="delete-user"'));
      // Escaping check
      assert.strictEqual(html.includes('<script>'), false);
      assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
      // Missing field fallback check
      assert.ok(html.includes('—'));
    });

    it('displays error message in user list if loading users fails', async () => {
      D.GetCurrentUser = () => ({ email: ADMIN_EMAIL });
      D.getAllUsers = async () => {
        throw new Error('Database network failure');
      };

      await openAdminPanel();

      const listEl = getOrCreateMockElement('adminUserList');
      assert.ok(listEl.innerHTML.includes('Failed to load: '));
      assert.ok(listEl.innerHTML.includes('Database network failure'));
    });
  });

  describe('closeAdminPanel()', () => {
    it('removes open class from admin overlay', () => {
      const overlay = getOrCreateMockElement('adminOverlay');
      overlay.classList.add('open');
      assert.strictEqual(overlay.classList.contains('open'), true);

      closeAdminPanel();

      assert.strictEqual(overlay.classList.contains('open'), false);
    });
  });

  describe('deleteUser()', () => {
    it('does nothing if the current user is not an admin', async () => {
      D.GetCurrentUser = () => ({ email: 'regular@example.com' });
      let removeUserCalled = false;
      D.removeUser = async () => {
        removeUserCalled = true;
      };

      await deleteUser('target@example.com');

      assert.strictEqual(lastConfirmMsg, null);
      assert.strictEqual(removeUserCalled, false);
    });

    it('aborts deletion when user cancels confirmation dialog', async () => {
      D.GetCurrentUser = () => ({ email: ADMIN_EMAIL });
      confirmReturn = false;
      let removeUserCalled = false;
      D.removeUser = async () => {
        removeUserCalled = true;
      };

      await deleteUser('target@example.com');

      assert.ok(lastConfirmMsg.includes('Remove access for target@example.com?'));
      assert.strictEqual(removeUserCalled, false);
    });

    it('deletes user and reloads user list when confirmation is accepted', async () => {
      D.GetCurrentUser = () => ({ email: ADMIN_EMAIL });
      confirmReturn = true;

      let removedEmail = null;
      D.removeUser = async email => {
        removedEmail = email;
      };

      let getAllUsersCalled = false;
      D.getAllUsers = async () => {
        getAllUsersCalled = true;
        return [];
      };

      await deleteUser('target@example.com');

      assert.strictEqual(removedEmail, 'target@example.com');
      assert.strictEqual(getAllUsersCalled, true);
    });

    it('shows alert popup when deletion fails', async () => {
      D.GetCurrentUser = () => ({ email: ADMIN_EMAIL });
      confirmReturn = true;

      D.removeUser = async () => {
        throw new Error('Permission denied');
      };

      await deleteUser('target@example.com');

      assert.strictEqual(lastAlertMsg, 'Delete failed: Permission denied');
    });
  });
});

describe('Admin Panel User List Escaping', () => {
  it('escapes user input fields including name, email, and dates for HTML template literal insertion', () => {
    const maliciousPayload = '<script>alert("xss")</script>';

    const u = {
      name: maliciousPayload,
      email: maliciousPayload,
      is_admin: false,
      added_at: maliciousPayload
    };

    const delBtn = u.is_admin
      ? ''
      : `<button class="btn" style="font-size:11px;padding:3px 8px;color:#E53;border-color:#E53" data-action="delete-user" data-email="${esc(u.email)}">Delete</button>`;

    const dateStr = u.added_at
      ? new Date(u.added_at).toLocaleDateString('en-US', { timeZone: 'Asia/Taipei' })
      : '—';

    const htmlRow = `<tr>
        <td>${esc(u.name) || '—'}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(u.email)}">${esc(u.email)}</td>
        <td>${u.is_admin ? 'Admin' : 'User'}</td>
        <td style="color:var(--t3)">${esc(dateStr)}</td>
        <td>${delBtn}</td>
      </tr>`;

    // Verify raw script tag is completely absent
    assert.strictEqual(htmlRow.includes('<script>'), false);
    // Verify script tags and quotes in all template interpolations are HTML-escaped
    assert.strictEqual(
      htmlRow.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'),
      true
    );
  });
});
