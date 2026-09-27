import { afterEach, describe, expect, it } from 'vitest';
import { getLocale, pickLocale, setLocale, t } from './index.ts';

afterEach(() => setLocale('en'));

describe('t', () => {
  it('returns the English text for a key', () => {
    expect(t('timeline.play')).toBe('Play');
  });

  it('fills in placeholders', () => {
    expect(t('date.yearBce', { year: 221 })).toBe('221 BCE');
    expect(t('date.dayMonthYear', { day: 7, month: 'July', year: '1937' })).toBe('7 July 1937');
  });

  it('leaves unknown placeholders visible rather than dropping text', () => {
    expect(t('date.yearBce', {})).toBe('{year} BCE');
  });
});

describe('locales', () => {
  it('falls back to English for languages without a catalog', () => {
    setLocale('xx');
    expect(getLocale()).toBe('en');
  });

  it('picks the first supported language, matching by base language', () => {
    expect(pickLocale(['xx-YY', 'en-GB'])).toBe('en');
    expect(pickLocale(['xx'])).toBe('en');
  });
});
