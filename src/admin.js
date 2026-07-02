import * as Remote from "./data/remote.js";
import { isAdmin } from "./auth.js";
import { esc } from "./core/format.js";
import { t } from "./i18n/index.js";

export async function openAdminPanel() {
  if (!isAdmin()) return;
  document.getElementById('adminOverlay').classList.add('open');
  await loadAdminUsers();
}

export function closeAdminPanel() {
  document.getElementById('adminOverlay').classList.remove('open');
}

async function loadAdminUsers() {
  const tbody = document.getElementById('adminUserList');
  tbody.innerHTML = `<tr><td colspan="5" style="color:var(--t3);text-align:center;padding:16px">${t('common.loading')}</td></tr>`;
  try {
    const data = await Remote.getAllUsers();
    document.getElementById('adminUserCount').textContent = t('admin.userCount', { count: data.length });
    tbody.innerHTML = data.map(u => {
      const delBtn = u.is_admin ? '' : `<button class="btn" style="font-size:11px;padding:3px 8px;color:#E53;border-color:#E53" data-action="delete-user" data-email="${esc(u.email)}">${t('common.delete')}</button>`;
      const dateStr = u.added_at ? new Date(u.added_at).toLocaleDateString('en-US', { timeZone: 'Asia/Taipei' }) : '—';
      return `<tr>
        <td>${esc(u.name) || '—'}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(u.email)}">${esc(u.email)}</td>
        <td>${u.is_admin ? 'Admin' : 'User'}</td>
        <td style="color:var(--t3)">${dateStr}</td>
        <td>${delBtn}</td>
      </tr>`;
    }).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:#E53;text-align:center">${t('admin.failedLoad')}${esc(e.message)}</td></tr>`;
  }
}

export async function deleteUser(email) {
  if (!isAdmin()) return;
  if (!confirm(t('share.removeAccess', { email }))) return;
  try {
    await Remote.removeUser(email);
    await loadAdminUsers();
  } catch(e) { alert('Delete failed: ' + e.message); }
}
