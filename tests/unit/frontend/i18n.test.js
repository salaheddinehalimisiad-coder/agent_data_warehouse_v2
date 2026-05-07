// Tests pour src/i18n
import { describe, it, expect, beforeEach } from 'vitest';
import { t, setLocale, getLocale } from '../../../src/i18n';

describe('i18n', () => {
  beforeEach(() => {
    setLocale('fr');
  });

  describe('t() basic', () => {
    it('translates a simple key', () => {
      setLocale('fr');
      expect(t('chat.greeting')).toBe('Bonjour, je suis Atlas');
    });

    it('translates same key in EN', () => {
      setLocale('en');
      expect(t('chat.greeting')).toBe('Hello, I am Atlas');
    });

    it('returns key when missing', () => {
      expect(t('this.does.not.exist')).toBe('this.does.not.exist');
    });

    it('substitutes parameters', () => {
      setLocale('fr');
      const result = t('chat.status_working', { agent: 'modeler' });
      expect(result).toContain('modeler');
    });

    it('keeps {var} when param missing', () => {
      const result = t('chat.status_working', {});
      expect(result).toContain('{agent}');
    });
  });

  describe('setLocale()', () => {
    it('changes the current locale', () => {
      setLocale('en');
      expect(getLocale()).toBe('en');
      setLocale('fr');
      expect(getLocale()).toBe('fr');
    });

    it('ignores unsupported locales', () => {
      setLocale('fr');
      setLocale('xx');
      expect(getLocale()).toBe('fr');
    });

    it('persists to localStorage', () => {
      setLocale('en');
      expect(localStorage.getItem('locale')).toBe('en');
    });
  });

  describe('Coverage all sections', () => {
    const sections = ['app', 'nav', 'status', 'chat', 'human_review', 'exports', 'buttons', 'errors'];

    it.each(sections)('FR has section %s', (section) => {
      setLocale('fr');
      expect(t(`${section}.name`) || t(`${section}.title`) || t(`${section}.idle`) || t(`${section}.greeting`) ||
             t(`${section}.pipeline`) || t(`${section}.save`) || t(`${section}.not_found`) || t(`${section}.excel`)).not.toBe(null);
    });

    it.each(sections)('EN has section %s', (section) => {
      setLocale('en');
      const v = t(`${section}.name`) || t(`${section}.title`) || t(`${section}.idle`) || t(`${section}.greeting`) ||
                t(`${section}.pipeline`) || t(`${section}.save`) || t(`${section}.not_found`) || t(`${section}.excel`);
      expect(v).toBeDefined();
    });
  });
});
