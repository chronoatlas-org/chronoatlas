// Panel tests use made-up polities, dates, and sources (Testland), not real ones.

import { describe, expect, it } from 'vitest';
import { civilToJdn } from '../dates/index.ts';
import type { BorderRecord } from '../map/historical.ts';
import { describeDate, describeTerritory, sourceLink } from './model.ts';
import type { Atlas } from './model.ts';

const atlas: Atlas = {
  polities: {
    testland: {
      names: [
        { text: 'Testland', lang: 'en', s0: null, e0: null },
        { text: 'Tɛstlɑnd', lang: 'und', s0: null, e0: null },
      ],
    },
    otherland: { names: [{ text: 'Otherland', lang: 'en', s0: null, e0: null }] },
  },
  sources: { 'test-source': { title: 'Test Source' }, openhistoricalmap: { title: 'OpenHistoricalMap' } },
};

function record(id: string, start: string, end: string, s0: number, s1: number, e0: number, extra: Partial<BorderRecord> = {}): BorderRecord {
  return { id, polity: 'testland', relation: 'controls', start, end, s0, s1, e0, source: 'test-source', locator: 'map 1', ...extra };
}

const y1901 = civilToJdn(1901, 1, 1);
const y1901end = civilToJdn(1901, 12, 31);
const may1905 = civilToJdn(1905, 5, 12);
const records = [
  record('a', '1901', '1905-05-12', y1901, y1901end, may1905),
  record('a', '1901', '1905-05-12', y1901, y1901end, may1905), // the same border from another tile
  record('b', '1905-05-12', 'ongoing', may1905, may1905, 99_999_999, { relation: 'administers' }),
  record('c', '1901', 'ongoing', y1901, y1901end, 99_999_999, { polity: 'otherland' }),
];

describe('describeTerritory', () => {
  it('returns null for an ID that is not in our data', () => {
    expect(describeTerritory(atlas, 'nowhere', records, y1901, 'en')).toBeNull();
  });

  it('lists only this polity’s borders in effect on the day, once each', () => {
    const view = describeTerritory(atlas, 'testland', records, civilToJdn(1903, 1, 1), 'en')!;
    expect(view.name).toBe('Testland');
    expect(view.localName).toBe('Tɛstlɑnd');
    expect(view.borders.map((b) => b.id)).toEqual(['a']);
  });

  it('treats the end as the first day the border no longer applied', () => {
    expect(describeTerritory(atlas, 'testland', records, may1905 - 1, 'en')!.borders.map((b) => b.id)).toEqual(['a']);
    expect(describeTerritory(atlas, 'testland', records, may1905, 'en')!.borders.map((b) => b.id)).toEqual(['b']);
  });

  it('says how precise each date is, and explains an uncertain start', () => {
    const during = describeTerritory(atlas, 'testland', records, civilToJdn(1901, 6, 1), 'en')!.borders[0];
    expect(during.began).toBe('1901 (year only)');
    expect(during.ended).toBe('12 May 1905');
    expect(during.uncertainStart).toContain('1901');
    const after = describeTerritory(atlas, 'testland', records, civilToJdn(1902, 1, 1), 'en')!.borders[0];
    expect(after.uncertainStart).toBeUndefined();
  });

  it('adds the "administered" caveat and the source with its locator', () => {
    const [border] = describeTerritory(atlas, 'testland', records, may1905, 'en')!.borders;
    expect(border.relation).toBe('Administered (de facto)');
    expect(border.ended).toBe('Not ended');
    expect(border.note).toMatch(/administered/);
    expect(border.source).toEqual({ text: 'Test Source, map 1' });
  });

  it('returns an empty list, not null, when no border is loaded for the day', () => {
    const view = describeTerritory(atlas, 'testland', [], y1901, 'en')!;
    expect(view.borders).toEqual([]);
    expect(view.name).toBe('Testland');
  });
});

describe('describeDate', () => {
  it('spells out month and year precision, and unknown ends', () => {
    expect(describeDate('1901-05')).toBe('May 1901 (month only)');
    expect(describeDate('1901-05-12')).toBe('12 May 1901');
    expect(describeDate('unknown')).toBe('Unknown');
  });
});

describe('sourceLink', () => {
  it('links OpenHistoricalMap relations, and nothing else', () => {
    expect(sourceLink('openhistoricalmap', 'relation 123, version 4')).toBe('https://www.openhistoricalmap.org/relation/123');
    expect(sourceLink('openhistoricalmap', 'name tags')).toBeUndefined();
    expect(sourceLink('test-source', 'relation 123')).toBeUndefined();
  });
});
