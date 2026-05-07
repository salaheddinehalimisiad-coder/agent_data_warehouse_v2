// src/components/LanguageToggle.jsx — Bouton FR/EN dans le header
import React from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from '../i18n';

export default function LanguageToggle({ compact = false }) {
  const { locale, setLocale, supportedLocales } = useTranslation();

  const next = supportedLocales[(supportedLocales.indexOf(locale) + 1) % supportedLocales.length];

  return (
    <button
      onClick={() => setLocale(next)}
      aria-label={`Changer la langue, actuellement ${locale.toUpperCase()}, basculer vers ${next.toUpperCase()}`}
      title={`Switch language: ${locale.toUpperCase()} → ${next.toUpperCase()}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: compact ? '4px 8px' : '6px 12px',
        borderRadius: 8, border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
        background: 'rgba(255,255,255,0.03)',
        color: 'var(--text-secondary, #cbd5e1)',
        fontSize: compact ? 10 : 11,
        fontWeight: 600, letterSpacing: '0.05em',
        cursor: 'pointer', transition: 'all 0.15s',
        textTransform: 'uppercase',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
    >
      <Globe size={compact ? 11 : 13} aria-hidden="true" />
      {locale.toUpperCase()}
    </button>
  );
}
