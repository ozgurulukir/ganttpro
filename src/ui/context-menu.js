/* Context menu: right-click menu for task rows. */
import { D } from '../render/deps.js';
import { t } from '../i18n/index.js';

let _menu = null;

function item(label, fn) {
  const el = document.createElement('div');
  el.className = 'ctx-menu-item';
  el.textContent = label;
  el.addEventListener('click', fn);
  return el;
}

function sep() {
  const el = document.createElement('div');
  el.className = 'ctx-menu-sep';
  return el;
}

export function initContextMenu() {
  _menu = document.createElement('div');
  _menu.className = 'ctx-menu';
  document.body.appendChild(_menu);

  document.addEventListener('mousedown', e => {
    if (_menu.classList.contains('open') && !_menu.contains(e.target)) {
      hideContextMenu();
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideContextMenu();
  });
}

export function showContextMenu(x, y, taskId) {
  // Rebuild items each time so closure captures the correct taskId
  _menu.innerHTML = '';

  const close = fn => e => {
    e.stopPropagation();
    e.preventDefault();
    hideContextMenu();
    fn();
  };

  _menu.appendChild(
    item(
      t('contextMenu.edit'),
      close(() => D.openEditModal(taskId))
    )
  );
  _menu.appendChild(
    item(
      t('contextMenu.addSubtask'),
      close(() => D.addTaskInline(taskId))
    )
  );
  _menu.appendChild(
    item(
      t('contextMenu.indent'),
      close(() => D.indentTask(taskId))
    )
  );
  _menu.appendChild(
    item(
      t('contextMenu.outdent'),
      close(() => D.outdentTask(taskId))
    )
  );
  _menu.appendChild(sep());
  _menu.appendChild(
    item(
      t('contextMenu.copyLink'),
      close(() => {
        navigator.clipboard.writeText(window.location.href).then(() => {
          D.showStatus(t('share.linkCopiedShort'));
        });
      })
    )
  );
  _menu.appendChild(sep());
  _menu.appendChild(
    item(
      t('contextMenu.delete'),
      close(() => D.confirmDeleteTask(taskId))
    )
  );

  // Clamp position to viewport
  _menu.style.left = Math.min(x, window.innerWidth - 200) + 'px';
  _menu.style.top = Math.min(y, window.innerHeight - 250) + 'px';
  _menu.classList.add('open');
}

export function hideContextMenu() {
  if (_menu) _menu.classList.remove('open');
}
