import * as Remote from "./data/remote.js";
import { isAdmin } from "./auth.js";
import { esc } from "./core/format.js";

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
  tbody.innerHTML = '<tr><td colspan="5" style="color:var(--t3);text-align:center;padding:16px">載入中…</td></tr>';
  try {
    const data = await Remote.getAllUsers();
    document.getElementById('adminUserCount').textContent = `（${data.length} 人）`;
    tbody.innerHTML = data.map(u => {
      const delBtn = u.is_admin ? '' : `<button class="btn" style="font-size:11px;padding:3px 8px;color:#E53;border-color:#E53" data-action="delete-user" data-email="${esc(u.email)}">刪除</button>`;
      const dateStr = u.added_at ? new Date(u.added_at).toLocaleDateString('zh-TW') : '—';
      return `<tr>
        <td>${esc(u.name) || '—'}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(u.email)}">${esc(u.email)}</td>
        <td>${u.is_admin ? '管理員' : '用戶'}</td>
        <td style="color:var(--t3)">${dateStr}</td>
        <td>${delBtn}</td>
      </tr>`;
    }).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:#E53;text-align:center">載入失敗：${esc(e.message)}</td></tr>`;
  }
}

export async function deleteUser(email) {
  if (!isAdmin()) return;
  if (!confirm(`確定要刪除用戶 ${email}？此操作無法復原。`)) return;
  try {
    await Remote.removeUser(email);
    await loadAdminUsers();
  } catch(e) { alert('刪除失敗：' + e.message); }
}
