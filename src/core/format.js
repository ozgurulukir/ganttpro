/**
 * Pure formatting & color helpers.
 *
 * `dateToX` and `avColor` take their config (chart start / pixels-per-day,
 * assignee-color map) as explicit parameters; the rest are fully pure.
 *
 * Extracted verbatim from main.js (Phase 1.6); only the state previously read
 * as globals is now passed explicitly.
 */

/** Fallback palette for assignees without an explicit color. */
const AV_PALETTE = ['#5E6AD2','#10B981','#F59E0B','#EF4444','#8B5CF6','#0EA5E9','#EC4899','#14B8A6'];

/** Pixel x-position of a date string, relative to `chartStart` at `ppd` px/day. */
export function dateToX(str, chartStart, ppd) {
  const diff = (new Date(str) - chartStart) / 86400000;
  return Math.round(diff * ppd);
}

/** Date → 'YYYY-MM-DD' string. */
export function toStr(d) {
  return d.toISOString().split('T')[0];
}

/** Up to two uppercase initials from a name (first + last word, or first 2 chars). */
export function initials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.replace(/\s/g, '').slice(0, 2).toUpperCase();
}

/** Assignee color: explicit map override, else deterministic hash → palette. */
export function avColor(name, avColors) {
  if (avColors && avColors[name]) return avColors[name];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AV_PALETTE[h % AV_PALETTE.length];
}

/** Darken a #RRGGBB hex color by `amount` (0–1) → 'rgb(...)' string. */
export function darkenColor(hex, amount = 0.35) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgb(${Math.round(r*(1-amount))},${Math.round(g*(1-amount))},${Math.round(b*(1-amount))})`;
}

/** #RRGGBB hex → 'rgba(r,g,b,alpha)'. Short/invalid hex falls back to indigo. */
export function hexToRgba(hex, alpha) {
  if (!hex || hex.length < 7) return `rgba(94,106,210,${alpha})`;
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
