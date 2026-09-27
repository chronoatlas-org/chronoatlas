// Panel tests use made-up polities, dates, and sources (Testland), not real ones.

import { describe, expect, it } from 'vitest';
import { civilToJdn } from '../dates/index.ts';
import { describeDate, describePeriod, describeTerritory, languageName, sourceLink } from './model.ts';
import type { PolityFile, PolityRecord, SourcesFile } from './model.ts';

const sources: SourcesFile['sources'] = {
  'test-source': { title: 'Test Source' },
  'other-test-source': { title: 'Other Test Source' },
  openhistoricalmap: { title: 'OpenHistoricalMap' },
};

const FAR_FUTURE = 99_999_999;
const day = (y: number, m: number, d: number) => civilToJdn(y, m, d);

function record(id: string, relation: string, start: string, end: string, extra: Partial<PolityRecord> = {}): PolityRecord {
  const s0 = /^\d{4}$/.test(start) ? day(Number(start), 1, 1) : day(...(start.split('-').map(Number) as [number, number, number]));
  const s1 = /^\d{4}$/.test(start) ? day(Number(start), 12, 31) : s0;
  const e0 = end === 'ongoing' ? FAR_FUTURE : /^\d{4}$/.test(end) ? day(Number(end), 1, 1) : day(...(end.split('-').map(Number) as [number, number, number]));
  return { id, relation, subject: 'testland', start, end, s0, s1, e0, sources: [{ source: 'test-source', locator: 'map 1' }], ...extra };
}

const testland: PolityFile = {
  id: 'testland',
  names: [
    { text: 'Testland', lang: 'en', s0: null, e0: null, sources: [{ source: 'test-source', locator: 'p. 1' }] },
    { text: 'Tɛstlɑnd', lang: 'und', s0: null, e0: null, sources: [{ source: 'test-source', locator: 'p. 1' }] },
    {
      text: 'Testlande',
      lang: 'fr',
      start: '1901',
      end: '1905-05-12',
      s0: day(1901, 1, 1),
      e0: day(1905, 5, 12),
      sources: [{ source: 'other-test-source', locator: 'p. 2' }],
    },
  ],
  records: [
    record('a', 'controls', '1901', '1905-05-12'),
    record('c', 'sovereign', '1901', 'ongoing', {
      recognized_by: ['otherland'],
      sources: [{ source: 'test-source', locator: 'p. 3', note: 'A made-up citation note.' }],
    }),
    record('b', 'administers', '1905-05-12', 'ongoing', { sources: [{ source: 'openhistoricalmap', locator: 'relation 1, version 2' }] }),
    record('d', 'puppet-of', '1906', '1910', { subject: 'otherland', object: 'testland' }),
  ],
  related: { otherland: [{ text: 'Otherland', lang: 'en', s0: null, e0: null }] },
};

const view = (y: number, m: number, d: number, locale = 'en') => describeTerritory(testland, sources, day(y, m, d), locale);

describe('describeTerritory: on this date', () => {
  it('lists the records in effect, and names the kinds of statement we have no source for', () => {
    const v = view(1903, 1, 1);
    expect(v.hasTerritory).toBe(true);
    expect(v.current.map((e) => [e.id, e.label])).toEqual([
      ['a', 'Controlled (de facto)'],
      ['c', 'Sovereign (de jure)'],
    ]);
    expect(v.missing).toBe('Not in our data yet for this date: claims.');
  });

  it('says so when there is no territory, without listing missing kinds', () => {
    const v = view(1900, 6, 1);
    expect(v.hasTerritory).toBe(false);
    expect(v.current).toEqual([]);
    expect(v.missing).toBeUndefined();
  });

  it('treats the end as the first day a record no longer applied', () => {
    expect(view(1905, 5, 11).current.map((e) => e.id)).toEqual(['a', 'c']);
    expect(view(1905, 5, 12).current.map((e) => e.id)).toEqual(['c', 'b']);
  });

  it('says how precise each date is, and explains an uncertain start', () => {
    const during = view(1901, 6, 1).current[0];
    expect(during.began).toBe('1901 (year only)');
    expect(during.ended).toBe('12 May 1905');
    expect(during.notes.join(' ')).toMatch(/only as 1901/);
    expect(view(1902, 1, 1).current[0].notes).toEqual([]);
  });

  it('adds caveats, recognition, and citation notes, with each source and its locator', () => {
    const [c, b] = view(1906, 1, 1).current;
    expect(c.notes).toEqual(['Recognized by Otherland, according to the source.', 'A made-up citation note.']);
    expect(c.sources).toEqual([{ text: 'Test Source, p. 3' }]);
    expect(b.ended).toBe('Not ended');
    expect(b.notes[0]).toMatch(/administered/);
    expect(b.sources).toEqual([
      { text: 'OpenHistoricalMap, relation 1, version 2', url: 'https://www.openhistoricalmap.org/relation/1' },
    ]);
  });
});

describe('describeTerritory: history and names', () => {
  it('lists every record in order, marking those in effect, with the day to jump to', () => {
    const v = view(1907, 1, 1);
    expect(v.history.map((e) => [e.id, e.current])).toEqual([
      ['a', false],
      ['c', true],
      ['b', true],
      ['d', true],
    ]);
    expect(v.history[2].period).toBe('12 May 1905 onwards');
    expect(v.history[2].day).toBe(day(1905, 5, 12));
  });

  it('words relations seen from the other polity, naming it', () => {
    expect(view(1907, 1, 1).history[3].label).toBe('Otherland described as its puppet state');
  });

  it('lists the reader’s language, English, and the local name first, grouped by source', () => {
    const v = view(1903, 1, 1);
    expect(v.nameCount).toBe(3);
    expect(v.names.map((g) => g.names.map((n) => n.text))).toEqual([['Testland', 'Tɛstlɑnd'], ['Testlande']]);
    expect(v.names[0].names[1]).toEqual({ text: 'Tɛstlɑnd', language: 'local name' }); // no lang attribute
    expect(v.names[1]).toEqual({
      names: [{ text: 'Testlande', lang: 'fr', language: 'French', period: '1901 (year only) – 12 May 1905' }],
      sources: [{ text: 'Other Test Source, p. 2' }],
    });
  });

  it('titles the panel with the name in the reader’s language for that day', () => {
    expect(view(1903, 1, 1, 'fr').name).toBe('Testlande');
    expect(view(1907, 1, 1, 'fr').name).toBe('Testland'); // the French name ended in 1905
    expect(view(1903, 1, 1).localName).toBe('Tɛstlɑnd');
  });
});

describe('wording helpers', () => {
  it('spells out month and year precision, and unknown ends', () => {
    expect(describeDate('1901-05')).toBe('May 1901 (month only)');
    expect(describeDate('1901-05-12')).toBe('12 May 1901');
    expect(describeDate('unknown')).toBe('Unknown');
  });

  it('words periods with missing or open ends', () => {
    expect(describePeriod(undefined, undefined)).toBeUndefined();
    expect(describePeriod(undefined, '1905')).toBe('until 1905 (year only)');
    expect(describePeriod('1901', 'unknown')).toBe('1901 (year only) – unknown');
  });

  it('names languages, and falls back to the tag for odd ones', () => {
    expect(languageName('ja', 'en')).toBe('Japanese');
    expect(languageName('und', 'en')).toBe('local name');
    expect(languageName('not a tag', 'en')).toBe('not a tag');
  });

  it('links OpenHistoricalMap relations, and nothing else', () => {
    expect(sourceLink('openhistoricalmap', 'relation 123, version 4')).toBe('https://www.openhistoricalmap.org/relation/123');
    expect(sourceLink('openhistoricalmap', 'name tags')).toBeUndefined();
    expect(sourceLink('test-source', 'relation 123')).toBeUndefined();
  });
});
