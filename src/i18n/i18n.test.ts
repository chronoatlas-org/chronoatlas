import { afterEach, describe, expect, it } from 'vitest';
import { catalogProblems, placeholders } from './check.ts';
import { en } from './en.ts';
import { catalogs, getLocale, pickLocale, setLocale, t } from './index.ts';

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

describe('catalogs', () => {
  it('has every English key in every language, with the same placeholders, and nothing else', () => {
    const problems = Object.entries(catalogs())
      .filter(([name]) => name !== 'en')
      .flatMap(([name, catalog]) => catalogProblems(name, en, catalog));
    expect(problems).toEqual([]);
  });

  it('finds missing, empty, and unknown keys, and lost or renamed placeholders', () => {
    // A made-up language ("xx") translating a made-up reference.
    const reference = { 'a.title': 'Around {date}', 'a.name': 'Testland', 'a.both': '{start} to {end}' };
    const xx = { 'a.title': 'Rɔund {dat}', 'a.both': '{end} ← {start}', 'a.name': ' ', 'a.old': 'Oldland' };
    expect(catalogProblems('xx', reference, xx)).toEqual([
      'xx: "a.title" has placeholders {dat}, but English has {date}',
      'xx: "a.name" is empty',
      'xx: "a.old" isn\'t an English key (renamed or removed?)',
    ]);
    expect(catalogProblems('xx', reference, { 'a.title': 'Rɔund {date}', 'a.both': '{end} ← {start}' })).toEqual(['xx: "a.name" is missing']);
    expect(placeholders('{b} and {a}')).toEqual(['a', 'b']);
  });
});
