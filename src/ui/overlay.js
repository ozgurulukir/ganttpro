/* Overlay helpers — one vocabulary for the 'open'-class dance and the
   click-outside-to-close patterns previously re-implemented per UI module. */

function idsToElements(ids) {
  return ids.map(id => document.getElementById(id)).filter(Boolean);
}

/** Show one or more overlays (adds the 'open' class; missing ids are ignored). */
export function openOverlay(...ids) {
  idsToElements(ids).forEach(el => el.classList.add('open'));
}

/** Hide one or more overlays (removes the 'open' class; missing ids are ignored). */
export function closeOverlay(...ids) {
  idsToElements(ids).forEach(el => el.classList.remove('open'));
}

/**
 * Close `panelId` when a document click lands outside it. The listener
 * re-arms itself while clicks stay inside the panel; the setTimeout defers
 * arming past the click that opened the panel. Returns nothing — call it
 * once when opening the panel.
 */
export function attachOutsideClose(panelId, onClose) {
  setTimeout(() => document.addEventListener('click', once), 0);
  function once(e) {
    const panel = document.getElementById(panelId);
    if (panel && panel.contains(e.target)) {
      document.addEventListener('click', once, { once: true });
    } else {
      onClose();
    }
  }
}

/**
 * Backdrop-click closer: invoke `fn` when a click lands on the overlay
 * element itself (not its children). Wire once at startup per overlay.
 */
export function onBackdropClick(id, fn) {
  const el = document.getElementById(id);
  if (el)
    el.addEventListener('click', e => {
      if (e.target === el) fn();
    });
}
