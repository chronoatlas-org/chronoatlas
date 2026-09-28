// Panel tests use made-up polities, dates, and sources (Testland), not real ones.

import { describe, expect, it } from 'vitest';
import { civilToJdn } from '../dates/index.ts';
import { describeDate, describeEvent, describeEventDate, describeNearby, describePeriod, describeTerritory, languageName, otherPolitiesAtSpot, sourceLink } from './model.ts';
import type { BorderChange, EventFile, PolityFile, PolityRecord, SourcesFile } from './model.ts';

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
    expect(v.summary).toBe('Controlled (de facto) · Sovereign (de jure)');
  });

  it('says so when there is no territory, without listing missing kinds', () => {
    const v = view(1900, 6, 1);
    expect(v.hasTerritory).toBe(false);
    expect(v.current).toEqual([]);
    expect(v.missing).toBeUndefined();
    expect(v.summary).toBe('No territory recorded for Testland on this date.');
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

  it('lists every source the view cites once, with its credit, and passes the polity note on', () => {
    const v = describeTerritory({ ...testland, notes: 'A made-up note.' }, { ...sources, 'test-source': { title: 'Test Source', attribution: 'Credit: Test Source.', url: 'https://example.test/' } }, day(1903, 1, 1), 'en');
    expect(v.credits).toEqual([
      { title: 'Test Source', attribution: 'Credit: Test Source.', url: 'https://example.test/' },
      { title: 'OpenHistoricalMap' },
      { title: 'Other Test Source' },
    ]);
    expect(v.note).toBe('A made-up note.');
  });

  it('titles the panel with the name in the reader’s language for that day', () => {
    expect(view(1903, 1, 1, 'fr').name).toBe('Testlande');
    expect(view(1907, 1, 1, 'fr').name).toBe('Testland'); // the French name ended in 1905
    expect(view(1903, 1, 1).localName).toBe('Tɛstlɑnd');
  });
});

describe('otherPolitiesAtSpot', () => {
  const names = (id: string) => (id === 'otherland' ? [{ text: 'Otherland', lang: 'en', s0: null, e0: null }] : undefined);

  it('offers the other polities recorded where the reader clicked, by name or by ID until loaded', () => {
    expect(otherPolitiesAtSpot(['testland', 'otherland', 'thirdland'], 'testland', names, day(1903, 1, 1), 'en')).toEqual([
      { id: 'otherland', name: 'Otherland' },
      { id: 'thirdland', name: 'thirdland' },
    ]);
  });

  it('offers nothing once the selection is no longer one from that spot', () => {
    expect(otherPolitiesAtSpot(['otherland'], 'testland', names, day(1903, 1, 1), 'en')).toEqual([]);
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

describe('describeEvent', () => {
  const treaty: EventFile = {
    id: 'testland-treaty',
    title: 'Treaty of Testland',
    date: '1905-05-12',
    importance: 4,
    location: { coordinates: [10, 20], precision_km: 5, sources: [{ source: 'test-source', locator: 'p. 9' }] },
    summary: 'A made-up treaty between made-up countries.',
    polities: ['testland', 'otherland'],
    effects: [record('a', 'controls', '1901', '1905-05-12'), record('b', 'administers', '1905-05-12', 'ongoing')],
    sources: [{ source: 'test-source', locator: 'pp. 1–2' }],
    related: { testland: testland.names, otherland: [{ text: 'Otherland', lang: 'en', s0: null, e0: null }] },
  };

  it('describes the event with its date, place, polities, and sources', () => {
    const v = describeEvent(treaty, sources, day(1905, 5, 12), 'en');
    expect(v.date).toBe('12 May 1905');
    expect(v.location).toEqual({
      text: 'Place: within about 5 km of the point marked on the map.',
      sources: [{ text: 'Test Source, p. 9' }],
    });
    expect(v.polities).toEqual([
      { id: 'testland', name: 'Testland' },
      { id: 'otherland', name: 'Otherland' },
    ]);
    expect(v.sources).toEqual([{ text: 'Test Source, pp. 1–2' }]);
  });

  it('says which records the event ended and which it started', () => {
    const v = describeEvent(treaty, sources, day(1905, 5, 12), 'en');
    expect(v.effects.map((e) => e.label)).toEqual([
      'Ended: Controlled (de facto): Testland',
      'Started: Administered (de facto): Testland',
    ]);
    expect(v.effects[0].period).toBe('1901 (year only) – 12 May 1905');
  });

  it('words dates and ranges with their precision, including open ends', () => {
    expect(describeEventDate('1901-05')).toBe('May 1901 (month only)');
    expect(describeEventDate('1901-05/1901-09')).toBe('May 1901 (month only) – September 1901 (month only)');
    expect(describeEventDate('1901/..')).toBe('1901 (year only) onwards');
    expect(describeEventDate('/1901')).toBe('until 1901 (year only)');
  });
});

describe('describeNearby', () => {
  const change = (d: number, kind: 'start' | 'end', date: string, polity = 'testland'): BorderChange => ({
    day: d, kind, date, polity, record: `r-${polity}-${d}`, relation: 'administers', source: { source: 'test-source', locator: 'map 1' },
  });
  const changes = [
    change(day(1901, 1, 1), 'start', '1901'),
    change(day(1905, 5, 12), 'end', '1905-05-12'),
    change(day(1905, 5, 12), 'start', '1905-05-12', 'otherland'),
    change(day(1950, 1, 1), 'start', '1950'), // outside the window
  ];
  const events = [
    { id: 'near', title: 'Near event', date: '1905-06', s0: day(1905, 6, 1), s1: day(1905, 6, 30), importance: 1 },
    { id: 'far', title: 'Far event', s0: day(1960, 1, 1), s1: day(1960, 1, 1), importance: 5 },
  ];
  const namesOf = (id: string) => (id === 'testland' ? testland.names : undefined);
  const v = describeNearby(day(1905, 1, 1), [day(1900, 1, 1), day(1910, 1, 1)], events, changes, sources, namesOf, 'en');

  it('lists events and border changes in the window, nearest first', () => {
    expect(v.events).toEqual([{ id: 'near', title: 'Near event', date: 'June 1905 (month only)' }]);
    expect(v.changes.map((c) => [c.name, c.label, c.date])).toEqual([
      ['Testland', 'Ends: Administered (de facto)', '12 May 1905'],
      ['otherland', 'Begins: Administered (de facto)', '12 May 1905'], // name not loaded yet
      ['Testland', 'Begins: Administered (de facto)', '1901 (year only)'],
    ]);
    expect(v.changes[0].sources).toEqual([{ text: 'Test Source, map 1' }]);
  });

  it('says which date and period it covers', () => {
    expect(v.title).toBe('Around 1 January 1905');
    expect(v.window).toBe('From 1 January 1900 to 1 January 1910 (the part of the timeline in view), nearest first.');
  });
});

describe('describeTerritory: other sources', () => {
  const withLinks: PolityFile = {
    ...testland,
    records: [
      ...testland.records,
      record('legal-1', 'sovereign', '1901', 'ongoing', { subject: 'unit-a', via: 'unit-a', link: 'same-state', m1: day(1904, 1, 1), sources: [{ source: 'other-test-source', locator: 'row 1' }] }),
      record('legal-2', 'sovereign', '1901', 'ongoing', { subject: 'unit-b', via: 'unit-b', link: 'dependency', sources: [{ source: 'other-test-source', locator: 'row 2' }] }),
    ],
    contested: [
      { side: 'facto', other: 'unit-b', relation: 'sovereign', source: 'other-test-source', s0: day(1902, 1, 1), e0: day(1903, 1, 1), km2: 123_456 },
    ],
    related: { ...testland.related, 'unit-a': [{ text: 'Unit A', lang: 'en', s0: null, e0: null }], 'unit-b': [{ text: 'Unit B', lang: 'en', s0: null, e0: null }] },
  };

  it('labels linked records by the unit that holds them, and only while the link applies', () => {
    const labels = (y: number) => describeTerritory(withLinks, sources, day(y, 6, 1), 'en').current.map((e) => e.label);
    expect(labels(1903)).toContain('Sovereign (de jure), as “Unit A”');
    expect(labels(1903)).toContain('Sovereign (de jure): Unit B');
    expect(labels(1905)).not.toContain('Sovereign (de jure), as “Unit A”'); // the link ended in 1904
  });

  it('describes a disagreement in words, attributed to the other source, only on its days', () => {
    expect(describeTerritory(withLinks, sources, day(1902, 6, 1), 'en').contested).toEqual([
      'Contested: Other Test Source records Unit B as sovereign over about 120,000 km² of this territory.',
    ]);
    expect(describeTerritory(withLinks, sources, day(1904, 6, 1), 'en').contested).toEqual([]);
  });

  it('explains when a territory is too small for the legal-borders source', () => {
    const tiny: PolityFile = { ...testland, records: [record('a', 'controls', '1901', 'ongoing', { km2: 1_000 })] };
    expect(describeTerritory(tiny, sources, day(1902, 1, 1), 'en').smallTerritory).toMatch(/under 10,000 km²/);
    const large: PolityFile = { ...testland, records: [record('a', 'controls', '1901', 'ongoing', { km2: 50_000 })] };
    expect(describeTerritory(large, sources, day(1902, 1, 1), 'en').smallTerritory).toBeUndefined();
  });
});

describe('describeTerritory: figures', () => {
  const cite = [{ source: 'test-source', locator: 'map 1' }];
  const withFigures: PolityFile = {
    ...testland,
    figures: [
      { metric: 'area-km2', value: 123_456, basis: 'computed-from-shape', s0: day(1901, 1, 1), e0: day(1905, 1, 1), relation: 'administers', records: ['a', 'b'], waterKm2: 5_000, partOf: '1–2°N, 3–4°E', sources: cite },
      { metric: 'area-km2', value: 5_000, basis: 'computed-from-shape', s0: day(1901, 1, 1), e0: day(1905, 1, 1), relation: 'occupies', records: ['c'], sources: cite },
      { metric: 'population', value: 1_000_000, basis: 'polity-territory', date: '1902', s0: day(1902, 1, 1), e0: day(1903, 1, 1), sources: [{ source: 'other-test-source', locator: 'table 1' }] },
      { metric: 'population', value: 2_000_000, basis: 'polity-territory', date: '1910', s0: day(1910, 1, 1), e0: day(1911, 1, 1), sources: [{ source: 'other-test-source', locator: 'table 2' }] },
    ],
  };

  it('shows a computed land area while it applies, saying what it counts and leaves out', () => {
    const [area, occupied] = describeTerritory(withFigures, sources, day(1903, 6, 1), 'en').figures;
    expect(area.label).toBe('Land area');
    expect(area.value).toBe('about 120,000 km²');
    const notes = area.notes.join(' ');
    expect(notes).toMatch(/Measured over the 2 records that apply on this date, counting any overlap once/);
    expect(notes).toMatch(/Only the part inside the area imported so far \(1–2°N, 3–4°E\)/);
    expect(notes).toMatch(/about 5,000 km² of coastal waters/);
    expect(notes).toMatch(/present-day coastline/);
    expect(notes).not.toMatch(/Counts only the area recorded as/);
    expect(occupied.notes).toContain('Counts only the area recorded as “Occupied”.');
    expect(describeTerritory(withFigures, sources, day(1906, 1, 1), 'en').figures.map((f) => f.label)).not.toContain('Land area');
  });

  it('shows the sourced estimate nearest to the date, with its own date, never an in-between value', () => {
    const population = (y: number) => describeTerritory(withFigures, sources, day(y, 6, 1), 'en').figures.find((f) => f.label === 'Population')!;
    expect(population(1903).value).toBe('about 1,000,000');
    expect(population(1903).notes).toContain('The nearest estimate to this date: 1902 (year only).');
    expect(population(1908).value).toBe('about 2,000,000');
  });
});
