/**
 * i18n — i18next initialization, translation helper, and DOM translator.
 *
 * Phase 1: Core setup with minimal locale stubs.
 * Phase 2 will populate en.json and zh-TW.json with all ~300 keys.
 */
import i18next from 'i18next';
import en from './locales/en.json';
import zhTW from './locales/zh-TW.json';

const STORAGE_KEY = 'ganttpro-locale';
const SUPPORTED = ['en', 'zh-TW'];
const FALLBACK = 'en';

/**
 * Initialize i18next. Call once in DOMContentLoaded before app renders.
 * Reads saved locale from localStorage, falls back to 'en'.
 */
export async function initI18n() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const lng = SUPPORTED.includes(saved) ? saved : FALLBACK;

  await i18next.init({
    lng,
    fallbackLng: FALLBACK,
    resources: {
      en: { translation: en },
      'zh-TW': { translation: zhTW }
    },
    interpolation: { escapeValue: false }
  });
}

/**
 * Translation function. Thin wrapper around i18next.t().
 * @param {string} key - Dot-separated key (e.g. 'common.save')
 * @param {object} [opts] - Interpolation values (e.g. { count: 5 })
 * @returns {string}
 */
export function t(key, opts) {
  return i18next.t(key, opts);
}

/**
 * Change the active locale. Persists to localStorage, re-translates the DOM,
 * and updates <html lang>. Caller is responsible for re-rendering the app.
 * @param {string} lng - 'en' or 'zh-TW'
 */
export function setLocale(lng) {
  if (!SUPPORTED.includes(lng)) return;
  i18next.changeLanguage(lng);
  localStorage.setItem(STORAGE_KEY, lng);
  document.documentElement.lang = lng;
  translateDOM();
}

/**
 * Get the current active locale code.
 * @returns {string} e.g. 'en' or 'zh-TW'
 */
export function getLocale() {
  return i18next.language || FALLBACK;
}

/**
 * Walk the DOM and translate all elements with data-i18n attributes.
 * Supports three attributes:
 *   data-i18n="key"             → sets textContent
 *   data-i18n-title="key"       → sets title
 *   data-i18n-placeholder="key" → sets placeholder
 *
 * Safe to call multiple times (idempotent).
 */
export function translateDOM() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}
