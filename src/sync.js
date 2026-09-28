/* Cloud sync, local persistence, realtime listeners, and offline queue.
   Initialized by main.js via initSync(ctx). All internal state is module-private. */
import { t } from './i18n/index.js';
import * as Remote from './data/remote.js';
import * as Local from './data/local.js';
import * as Share from './data/share.js';
import { validateProject, validateProjects } from './core/validate.js';
import { modalOpen } from './ui/modal.js';
import { db } from './data/firebase.js';

/* ═══════════════════════════════════════════
   INTERNAL STATE
═══════════════════════════════════════════ */
let _ctx = null;
let _cloudSaveSeq = 0;
let _dirtySinceCloud = false;
const _pendingCloudWrites = new Set();
let _realtimeUnsub = null;
let _saveTimer = null;
const _syncChannel = new BroadcastChannel('gantt_sync');
let _syncReloadTimer = null;
let _sharedChannels = [];
const _shareMap = new Map();

/* ═══════════════════════════════════════════
   SHARE HELPERS
═══════════════════════════════════════════ */
function shareKey(ownerId, projectId) {
  return `${ownerId}:${projectId}`;
}

function recordShare(ownerId, projectId, permission) {
  _shareMap.set(shareKey(ownerId, projectId), permission);
}

function getSharePermission(ownerId, projectId) {
  return _shareMap.get(shareKey(ownerId, projectId));
}

export function isSharedProject(proj) {
  return (
    proj &&
    proj.ownerId &&
    _ctx.getCurrentUser() &&
    proj.ownerId !== _ctx.getCurrentUser().uid &&
    _shareMap.has(shareKey(proj.ownerId, proj.id))
  );
}

export function isReadOnlyShared(proj) {
  return isSharedProject(proj) && getSharePermission(proj.ownerId, proj.id) === 'read';
}

export function stripSharedFlags(proj) {
  const p = { ...proj };
  delete p._isShared;
  delete p._permission;
  delete p._ownerId;
  delete p.ownerId;
  delete p._history;
  delete p.shareToken;
  return p;
}

/* ═══════════════════════════════════════════
   OFFLINE QUEUE
═══════════════════════════════════════════ */
function setOfflinePending() {
  const q = JSON.parse(localStorage.getItem('gantt_offline_queue') || '[]');
  if (!q.includes('pending')) {
    q.push('pending');
    localStorage.setItem('gantt_offline_queue', JSON.stringify(q));
  }
}

function clearOfflinePending() {
  localStorage.removeItem('gantt_offline_queue');
}

function hasOfflinePending() {
  return JSON.parse(localStorage.getItem('gantt_offline_queue') || '[]').length > 0;
}

/* ═══════════════════════════════════════════
   SYNC UI HELPERS
═══════════════════════════════════════════ */
export function setSyncDot(state) {
  const dot = document.getElementById('syncDot');
  if (!dot) return;
  dot.className = 'sync-dot' + (state ? ' ' + state : '');
  dot.title =
    {
      saving: t('status.syncSaving'),
      ok: t('status.syncOk'),
      err: t('status.syncErr'),
      off: t('status.syncOff'),
      local: t('status.syncLocal')
    }[state] || t('status.syncDefault');
}

function showSyncToast() {
  let el = document.getElementById('syncToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'syncToast';
    el.style.cssText =
      'position:fixed;bottom:20px;right:20px;background:var(--t1);color:var(--surface);padding:8px 14px;border-radius:8px;font-size:12px;z-index:9999;opacity:0;transition:opacity .3s';
    document.body.appendChild(el);
  }
  el.textContent = '📡 ' + t('status.dataUpdated');
  el.style.opacity = '1';
  setTimeout(() => (el.style.opacity = '0'), 2500);
}

/* ═══════════════════════════════════════════
   CLOUD SAVE
═══════════════════════════════════════════ */
async function _saveToCloudInner() {
  const cp = _ctx.getCurProj();
  if (cp) cp.nextId = _ctx.getNextId();

  if (!cp) {
    await Remote.writeUserData(_ctx.getCurrentUser().uid, {
      projects: [],
      currentProjId: null,
      nextProjId: _ctx.getNextProjId()
    });
    setSyncDot('ok');
    _dirtySinceCloud = false;
  } else if (isSharedProject(cp) && getSharePermission(cp.ownerId, cp.id) === 'edit') {
    await Remote.updateSharedProjectAtomic(cp.ownerId, stripSharedFlags(cp));
    setSyncDot('ok');
    _dirtySinceCloud = false;
  } else if (!isSharedProject(cp)) {
    const ownProjects = _ctx
      .getProjects()
      .filter(p => !isSharedProject(p))
      .map(stripSharedFlags);
    await Remote.writeUserData(_ctx.getCurrentUser().uid, {
      projects: ownProjects,
      currentProjId: _ctx.getCurrentProjId(),
      nextProjId: _ctx.getNextProjId()
    });
    setSyncDot('ok');
    _dirtySinceCloud = false;
  }
}

export async function saveToCloud() {
  if (!_ctx.getCurrentUser()) return;
  setSyncDot('saving');
  const token = ++_cloudSaveSeq;

  if (!navigator.onLine) {
    setOfflinePending();
    setSyncDot('err');
    return;
  }

  const savePromise = _saveToCloudInner();
  _pendingCloudWrites.add(savePromise);

  try {
    await savePromise;
    _syncChannel.postMessage({ type: 'save' });
  } catch (e) {
    console.error('saveToCloud failed', e);
    setSyncDot('err');
    if (e.message && e.message.includes('offline')) {
      setOfflinePending();
    }
  } finally {
    _pendingCloudWrites.delete(savePromise);
  }
}

export function debounceSaveToCloud() {
  if (!_ctx.getCurrentUser()) return;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => saveToCloud(), 600);
}

export function persist() {
  _dirtySinceCloud = true;
  saveToLS();
  debounceSaveToCloud();
}

/* ═══════════════════════════════════════════
   CLOUD LOAD
═══════════════════════════════════════════ */
export async function loadFromCloud() {
  if (!_ctx.getCurrentUser()) return false;
  try {
    const s = await Remote.readUserData(_ctx.getCurrentUser().uid);
    if (!s) return false;
    const validated = validateProjects(s.projects || []);
    _ctx.setProjects(validated);
    _ctx.setNextProjId(s.nextProjId ?? 1);
    if (!validated.length) {
      _ctx.setCurrentProjId(null);
      _ctx.setTasks([]);
      _ctx.setNextId(1);
      return true;
    }
    const targetId =
      s.currentProjId && validated.find(p => p.id === Number(s.currentProjId))
        ? Number(s.currentProjId)
        : validated[0].id;
    _ctx.setCurrentProjId(targetId);
    _ctx.setTasks(_ctx.getCurProj().tasks);
    _ctx.setNextId(_ctx.getCurProj().nextId);
    _ctx.setChartStart(new Date(_ctx.getCurProj().startDate));
    _ctx.setChartEnd(new Date(_ctx.getCurProj().endDate));
    return true;
  } catch (e) {
    return false;
  }
}

export async function loadShareFromCloud(token) {
  const hashMatch = location.hash.match(/[#&]d=([^&]*)/);
  const hashData = hashMatch ? hashMatch[1] : null;
  if (hashData) {
    const obj = Share.decodeData(hashData);
    if (obj) return obj;
  }
  try {
    return await Share.loadShareDoc(token);
  } catch (e) {
    return null;
  }
}

/* ═══════════════════════════════════════════
   LOCAL STORAGE
═══════════════════════════════════════════ */
export function saveToLS() {
  try {
    const cp = _ctx.getCurProj();
    if (cp) cp.nextId = _ctx.getNextId();
    const ownProjects = _ctx
      .getProjects()
      .filter(p => !isSharedProject(p))
      .map(stripSharedFlags);
    Local.saveToLS({
      projects: ownProjects,
      currentProjId: _ctx.getCurrentProjId(),
      nextProjId: _ctx.getNextProjId()
    });
  } catch (e) {
    console.error('saveToLS:', e);
    if (e.name === 'QuotaExceededError') {
      _ctx.showStatus(t('status.quotaExceeded'));
    }
  }
}

export function loadFromLS() {
  try {
    const d = Local.loadFromLS();
    if (!d?.projects?.length) return false;
    const validated = validateProjects(d.projects);
    _ctx.setProjects(validated);
    _ctx.setNextProjId(d.nextProjId ?? validated.length + 1);
    const targetId =
      d.currentProjId && validated.find(p => p.id === Number(d.currentProjId))
        ? Number(d.currentProjId)
        : validated[0].id;
    _ctx.setCurrentProjId(targetId);
    _ctx.setTasks(_ctx.getCurProj().tasks);
    _ctx.setNextId(_ctx.getCurProj().nextId);
    _ctx.setChartStart(new Date(_ctx.getCurProj().startDate));
    _ctx.setChartEnd(new Date(_ctx.getCurProj().endDate));
    return true;
  } catch (e) {
    return false;
  }
}

/* ═══════════════════════════════════════════
   REALTIME LISTENERS
═══════════════════════════════════════════ */
export function cleanupRealtime() {
  if (_realtimeUnsub) {
    _realtimeUnsub();
    _realtimeUnsub = null;
  }
  _sharedChannels.forEach(unsub => unsub());
  _sharedChannels = [];
  _shareMap.clear();
  clearTimeout(_saveTimer);
  _saveTimer = null;
}

export function setupRealtime() {
  if (!_ctx.getCurrentUser() || !db) return;
  if (_realtimeUnsub) _realtimeUnsub();
  let skipFirst = true;
  _realtimeUnsub = Remote.watchUserData(_ctx.getCurrentUser().uid, async () => {
    if (skipFirst) {
      skipFirst = false;
      return;
    }
    if (_pendingCloudWrites.size > 0) return;
    if (_dirtySinceCloud) return;
    if (modalOpen) return;
    const ok = await loadFromCloud();
    if (ok) {
      if (_ctx.getProjects().length) {
        _ctx.scheduleTasks();
        _ctx.recalcProjEnd();
      }
      saveToLS();
      _ctx.updateProjUI();
      _ctx.render();
      showSyncToast();
    }
  });
}

function setupSharedRealtime(ownerIds) {
  if (!db) return;
  _sharedChannels.forEach(unsub => unsub());
  _sharedChannels = [];

  ownerIds.forEach(ownerId => {
    let skipFirst = true;
    const unsub = Remote.watchUserData(ownerId, async snap => {
      if (skipFirst) {
        skipFirst = false;
        return;
      }
      if (_pendingCloudWrites.size > 0) return;
      if (snap && snap.id !== ownerId) return;

      const ownerData = snap ? snap.data()?.data || null : await Remote.readUserData(ownerId);
      if (!ownerData?.projects) return;
      const updatedProjects = _ctx.getProjects().map(p => {
        if (p.ownerId === ownerId) {
          const raw = ownerData.projects.find(op => op.id === p.id);
          if (raw) {
            const fresh = validateProject(raw);
            if (fresh) {
              fresh.ownerId = ownerId;
              return fresh;
            }
          }
        }
        return p;
      });
      _ctx.setProjects(updatedProjects);
      if (_ctx.getCurProj()?.ownerId === ownerId) {
        _ctx.setTasks(_ctx.getCurProj().tasks);
        _ctx.setNextId(_ctx.getCurProj().nextId);
        _ctx.scheduleTasks();
        _ctx.recalcProjEnd();
      }
      saveToLS();
      _ctx.updateProjUI();
      _ctx.render();
      showSyncToast();
    });
    _sharedChannels.push(unsub);
  });
}

export async function loadSharedProjects() {
  if (!_ctx.getCurrentUser()) return;
  try {
    const shares = await Remote.getProjectSharesForEmail(_ctx.getCurrentUser().email);
    if (!shares.length) return;

    const byOwner = {};
    shares.forEach(s => {
      if (!byOwner[s.owner_id]) byOwner[s.owner_id] = [];
      byOwner[s.owner_id].push(s);
    });

    for (const [ownerId, ownerShares] of Object.entries(byOwner)) {
      const ownerData = await Remote.readUserData(ownerId);
      if (!ownerData?.projects) continue;

      ownerShares.forEach(share => {
        const raw = ownerData.projects.find(p => p.id == share.project_id);
        if (!raw) return;
        recordShare(ownerId, share.project_id, share.permission);
        const existingProjects = _ctx.getProjects();
        if (existingProjects.find(p => p.id === raw.id && p.ownerId === ownerId)) return;
        const proj = validateProject(raw);
        if (!proj) return;
        proj.ownerId = ownerId;
        existingProjects.push(proj);
      });
    }

    setupSharedRealtime(Object.keys(byOwner));
  } catch (e) {
    console.error('loadSharedProjects:', e);
  }
}

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
export function initSync(ctx) {
  _ctx = ctx;

  // Broadcast channel: reload data when another tab saves
  _syncChannel.onmessage = e => {
    if (e.data?.type === 'save') {
      if (_pendingCloudWrites.size > 0 || modalOpen || _dirtySinceCloud) return;
      clearTimeout(_syncReloadTimer);
      _syncReloadTimer = setTimeout(async () => {
        if (_dirtySinceCloud || _pendingCloudWrites.size > 0) return;
        const ok = await loadFromCloud();
        if (ok) {
          if (_ctx.getProjects().length) {
            _ctx.scheduleTasks();
            _ctx.recalcProjEnd();
          }
          saveToLS();
          _ctx.updateProjUI();
          _ctx.render();
          showSyncToast();
        }
      }, 400);
    }
  };

  // Online listener: flush offline queue when connectivity returns
  window.addEventListener('online', () => {
    if (hasOfflinePending()) {
      clearOfflinePending();
      saveToCloud();
    }
  });
}

/* ═══════════════════════════════════════════
   EXPORTS FOR main.js
═══════════════════════════════════════════ */
export {
  recordShare,
  getSharePermission,
  setOfflinePending,
  clearOfflinePending,
  hasOfflinePending
};
export function getPendingCloudWrites() {
  return _pendingCloudWrites;
}
