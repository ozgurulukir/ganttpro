import * as Remote from './data/remote.js';
import * as Share from './data/share.js';
import { D } from './render/deps.js';
import { esc } from './core/format.js';
import { t } from './i18n/index.js';

let _collabShares = [];

export async function openShareModal() {
  if (D.isReadOnly) return;
  const { curProj, render } = D;
  const proj = curProj();
  const user = D.GetCurrentUser();
  const note = document.querySelector('.share-owner-note');
  const invBtn = document.getElementById('invalidateShareLinkBtn');
  // Revocation works by deleting the Firestore share doc — only possible when
  // the link is Firestore-backed. Anonymous (hash) links cannot be revoked.
  if (invBtn) invBtn.style.display = user ? '' : 'none';
  // TextEncoder gives real UTF-8 bytes — CJK-heavy projects serialize to
  // several UTF-16 units per byte-heavy hash character.
  if (new TextEncoder().encode(JSON.stringify(proj)).length > Share.SHARE_MAX_BYTES) {
    // Too large for a URL hash; refuse rather than emit a link that browsers
    // may silently truncate into a broken state.
    document.getElementById('shareLinkInput').value = '';
    if (invBtn) invBtn.style.display = 'none';
    if (note) note.innerHTML = '⚠️ ' + t('share.linkTooLarge');
    document.getElementById('shareOverlay').classList.add('open');
    return;
  }
  const token = Share.getOrCreateShareToken(proj);
  document.getElementById('shareModalProjName').textContent = proj.name;
  if (note) note.innerHTML = '💡 ' + t('share.ownerNote');
  render();
  D.persist();
  const { ok, encoded } = await Share.saveShareDoc(token, user?.uid, proj);
  const hash = encoded ? '#d=' + encoded : '';
  const url = location.origin + location.pathname + '?share=' + token + hash;
  document.getElementById('shareLinkInput').value = ok ? url : '';
  if (!ok) {
    if (note) note.innerHTML = '⚠️ ' + t('share.linkFailed');
  } else if (encoded && note) {
    // Anonymous link: the project data rides in the URL hash itself.
    note.innerHTML = '⚠️ ' + t('share.hashNote');
  }
  document.getElementById('shareOverlay').classList.add('open');
}

/** Kill the current share link: delete the Firestore share doc, then rotate
 * the project's token so any copy of the old URL stops resolving. */
export async function invalidateShareLink() {
  const { curProj, showStatus } = D;
  const proj = curProj();
  const user = D.GetCurrentUser();
  if (!user || !proj?.shareToken) return;
  try {
    await Remote.deleteShareDoc(proj.shareToken);
  } catch (e) {
    // The doc may already be gone; rotating the token is what revokes access.
    console.warn('invalidateShareLink:', e);
  }
  delete proj.shareToken;
  D.persist();
  showStatus(t('share.invalidated'));
  await openShareModal();
}

export function closeShareModal() {
  document.getElementById('shareOverlay').classList.remove('open');
}

export function copyShareLink() {
  const { showStatus } = D;
  const val = document.getElementById('shareLinkInput').value;
  navigator.clipboard
    .writeText(val)
    .then(() => {
      showStatus(t('share.linkCopied'));
      closeShareModal();
    })
    .catch(() => {
      const inp = document.getElementById('shareLinkInput');
      inp.select();
      document.execCommand('copy');
      showStatus(t('share.linkCopiedShort'));
      closeShareModal();
    });
}

export async function openCollabModal() {
  if (D.isReadOnly) return;
  const { projects, curProj, isSharedProject } = D;
  const overlay = document.getElementById('collabOverlay');
  overlay.classList.add('open');
  document.getElementById('collabMsg').style.display = 'none';
  document.getElementById('collabEmailInput').value = '';
  const sel = document.getElementById('collabProjSelect');
  const ownedProjects = projects.filter(p => !isSharedProject(p));
  sel.innerHTML = ownedProjects
    .map(p => `<option value="${p.id}">${esc(p.name)}</option>`)
    .join('');
  const cur = curProj();
  if (cur && !isSharedProject(cur)) sel.value = cur.id;
  await refreshCollabList();
}

export function closeCollabModal() {
  document.getElementById('collabOverlay').classList.remove('open');
}

export async function onCollabProjChange() {
  document.getElementById('collabMsg').style.display = 'none';
  await refreshCollabList();
}

async function refreshCollabList() {
  const { curProj } = D;
  const user = D.GetCurrentUser();
  const sel = document.getElementById('collabProjSelect');
  const projId = sel ? sel.value : curProj()?.id;
  if (!projId) return;
  _collabShares = await Remote.getProjectSharesForOwner(projId, user.uid);
  renderCollabModal();
}

function renderCollabModal() {
  const list = document.getElementById('collabShareList');
  if (!_collabShares.length) {
    list.innerHTML = `<div style="font-size:12px;color:var(--t3);text-align:center;padding:12px 0">${t('share.notSharedYet')}</div>`;
    return;
  }
  list.innerHTML = _collabShares
    .map(
      s => `
    <div class="collab-share-item">
      <span class="ci-email" title="${esc(s.shared_with_email)}">${esc(s.shared_with_email)}</span>
      <span class="ci-perm ${s.permission}">${s.permission === 'read' ? 'Read only' : 'Can edit'}</span>
      <span class="ci-del" data-action="remove-share" data-share-id="${s.id}" data-email="${esc(s.shared_with_email)}" title="Remove">✕</span>
    </div>
  `
    )
    .join('');
}

export async function addShare() {
  const user = D.GetCurrentUser();
  const emailInput = document.getElementById('collabEmailInput');
  const email = (emailInput.value || '').trim().toLowerCase();
  const perm = document.getElementById('collabPermSelect').value;
  const msgEl = document.getElementById('collabMsg');

  const showMsg = (txt, ok) => {
    msgEl.textContent = txt;
    msgEl.style.color = ok ? '#0a0' : '#E53';
    msgEl.style.display = 'block';
  };

  msgEl.style.display = 'none';

  if (!email || !email.includes('@')) {
    showMsg(t('share.invalidEmail'));
    return;
  }
  if (user && email === user.email) {
    showMsg(t('share.cannotShareSelf'));
    return;
  }

  try {
    const sel = document.getElementById('collabProjSelect');
    const projId = sel?.value;
    if (!projId) {
      showMsg(t('share.selectProjectFirst'));
      return;
    }

    const docId = `${projId}_${email.replace(/[.@]/g, '_')}`;
    await Remote.addProjectShare(docId, {
      project_id: String(projId),
      owner_id: user.uid,
      shared_with_email: email,
      permission: perm
    });
    showMsg(t('share.added'), true);
    emailInput.value = '';
    await refreshCollabList();
  } catch (e) {
    showMsg(t('share.addFailed') + e.message);
  }
}

export async function removeShare(shareId, email) {
  if (!confirm(t('share.removeAccess', { email }))) return;
  await Remote.removeProjectShare(shareId);
  await refreshCollabList();
}
