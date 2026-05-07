// src/i18n/index.js — i18n minimal sans dependance lourde
// Charge la locale depuis localStorage('locale') ou defaut 'fr'
import { useState, useEffect, useCallback } from 'react';
import fr from './fr.js';
import en from './en.js';

const DICTS = { fr, en };
const SUPPORTED = ['fr', 'en'];
const DEFAULT_LOCALE = 'fr';

let _currentLocale = (() => {
  try {
    const saved = localStorage.getItem('locale');
    if (saved && SUPPORTED.includes(saved)) return saved;
  } catch { /* noop */ }
  // Auto-detect via navigator
  if (typeof navigator !== 'undefined' && navigator.language) {
    const lang = navigator.language.slice(0, 2).toLowerCase();
    if (SUPPORTED.includes(lang)) return lang;
  }
  return DEFAULT_LOCALE;
})();

const _listeners = new Set();

export function setLocale(locale) {
  if (!SUPPORTED.includes(locale)) return;
  _currentLocale = locale;
  try { localStorage.setItem('locale', locale); } catch { /* noop */ }
  _listeners.forEach(cb => cb(locale));
}

export function getLocale() {
  return _currentLocale;
}

export function t(key, params = {}) {
  const dict = DICTS[_currentLocale] || DICTS[DEFAULT_LOCALE];
  // Resolution de cle pointee : 'chat.greeting' -> dict.chat.greeting
  const value = key.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : null), dict);
  if (value === null || value === undefined) {
    // Fallback : retourner la cle si traduction absente
    return key;
  }
  // Substitution {var}
  if (typeof value === 'string' && Object.keys(params).length > 0) {
    return value.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
  }
  return value;
}

export function useTranslation() {
  const [locale, setLocaleState] = useState(_currentLocale);

  useEffect(() => {
    const cb = (newLocale) => setLocaleState(newLocale);
    _listeners.add(cb);
    return () => { _listeners.delete(cb); };
  }, []);

  const tFn = useCallback((key, params) => t(key, params), [locale]);  // eslint-disable-line react-hooks/exhaustive-deps

  return { t: tFn, locale, setLocale, supportedLocales: SUPPORTED };
}
