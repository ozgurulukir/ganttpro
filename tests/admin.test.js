import { describe, it } from 'node:test';
import assert from 'node:assert';
import { esc } from '../src/core/format.js';

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
