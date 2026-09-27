import { describe, expect, it } from 'vitest';
import { civilToJdn } from '../src/dates/index.ts';
import { assignColors, buildChanges, buildEventFiles, buildEvents, buildPolityFiles, changeDays, dayRanges, FAR_FUTURE } from './build-data.ts';
import type { Dataset } from './lib/data.ts';

describe('buildPolityFiles', () => {
  // Made-up polities and sources (Testland), not real ones.
  const cite = [{ source: 'test-source', locator: 'p. 1' }];
  const ds: Dataset = {
    sources: [],
    polities: [
      { file: 'a', value: { id: 'testland', names: [{ text: 'Testland', lang: 'en', start: '1901', sources: cite }] } },
      { file: 'b', value: { id: 'otherland', names: [{ text: 'Otherland', lang: 'en', sources: cite }] } },
      { file: 'c', value: { id: 'quietland', names: [{ text: 'Quietland', lang: 'en', sources: cite }] } },
    ],
    assertions: [
      {
        file: 'd',
        value: [
          { id: 'late', relation: 'controls', subject: 'testland', shape: 's', start: '1910', end: 'ongoing', sources: cite },
          { id: 'early', relation: 'controls', subject: 'testland', shape: 's', start: '1901-05-12', end: '1910', sources: cite },
          { id: 'link', relation: 'protectorate-of', subject: 'otherland', object: 'testland', start: '1905', end: 'unknown', sources: cite },
        ],
      },
    ],
    events: [],
    figures: [],
    coverage: [],
    shapes: [],
    imports: [],
    problems: [],
  };
  const files = new Map(buildPolityFiles(ds).map((f) => [f.id, f]));

  it('writes one file per polity, with every record that mentions it, in date order', () => {
    expect([...files.keys()]).toEqual(['testland', 'otherland', 'quietland']);
    expect(files.get('testland')!.records.map((r) => r.id)).toEqual(['early', 'link', 'late']);
    expect(files.get('otherland')!.records.map((r) => r.id)).toEqual(['link']);
    expect(files.get('quietland')!.records).toEqual([]);
  });

  it('keeps the dates as written and adds day numbers', () => {
    const early = files.get('testland')!.records[0];
    expect(early).toMatchObject({ start: '1901-05-12', end: '1910', s0: civilToJdn(1901, 5, 12), e0: civilToJdn(1910, 1, 1) });
    expect(files.get('testland')!.names[0]).toMatchObject({ start: '1901', s0: civilToJdn(1901, 1, 1), e0: null, sources: cite });
  });

  it('writes event files with their effects in full and the names they need', () => {
    const [file] = buildEventFiles({
      ...ds,
      events: [
        {
          file: 'e',
          value: {
            id: 'testland-event',
            title: 'Made-up event',
            date: '1910',
            summary: 'A made-up event.',
            polities: ['quietland'],
            effects: ['early', 'late'],
            sources: cite,
          },
        },
      ],
    });
    expect(file.importance).toBe(3);
    expect(file.effects!.map((r) => [r.id, r.end])).toEqual([
      ['early', '1910'],
      ['late', 'ongoing'],
    ]);
    expect(Object.keys(file.related!).sort()).toEqual(['quietland', 'testland']);
  });

  it('lists every territorial start and end by day, skipping open ends and non-territorial links', () => {
    const { changes } = buildChanges(ds);
    expect(changes.map((c) => [c.record, c.kind, c.date])).toEqual([
      ['early', 'start', '1901-05-12'],
      ['early', 'end', '1910'],
      ['late', 'start', '1910'],
    ]);
    expect(changes[0]).toMatchObject({ day: civilToJdn(1901, 5, 12), polity: 'testland', relation: 'controls', source: cite[0] });
  });

  it('includes the names of the other polities its records mention, and only those', () => {
    expect(Object.keys(files.get('testland')!.related!)).toEqual(['otherland']);
    expect(files.get('quietland')!.related).toBeUndefined();
  });
});

describe('buildEvents', () => {
  it('lists events by start, with day ranges, a default importance, and inexact dates marked', () => {
    // Made-up events (Testland), not real ones.
    const cite = [{ source: 'test-source', locator: 'p. 1' }];
    const event = (id: string, date: string, importance?: number) => ({
      file: id,
      value: { id, title: `Test event ${id}`, date, summary: 'A made-up event.', sources: cite, ...(importance ? { importance } : {}) },
    });
    const { events } = buildEvents({
      sources: [], polities: [], assertions: [], figures: [], coverage: [], shapes: [], imports: [], problems: [],
      events: [event('later', '1902-03~', 5), event('earlier', '1901-05-12/1901-05-20')],
    });
    expect(events).toEqual([
      { id: 'earlier', title: 'Test event earlier', date: '1901-05-12/1901-05-20', s0: civilToJdn(1901, 5, 12), s1: civilToJdn(1901, 5, 20), importance: 3 },
      { id: 'later', title: 'Test event later', date: '1902-03~', s0: civilToJdn(1902, 3, 1), s1: civilToJdn(1902, 3, 31), importance: 5, inexact: true },
    ]);
  });
});

describe('changeDays', () => {
  it('lists every start, certain-start, and end day once, in order, without "no end yet"', () => {
    const feature = (s0: number, s1: number, e0: number): GeoJSON.Feature => ({
      type: 'Feature',
      properties: { s0, s1, e0 },
      geometry: { type: 'Point', coordinates: [0, 0] },
    });
    const days = changeDays({
      type: 'FeatureCollection',
      features: [feature(10, 20, 50), feature(20, 20, FAR_FUTURE), feature(5, 5, 50)],
    });
    expect(days).toEqual([5, 10, 20, 50]);
  });
});

describe('dayRanges', () => {
  it('turns start and end into day-number ranges', () => {
    const r = dayRanges('1932', '1945-08-17');
    expect(r.s0).toBe(civilToJdn(1932, 1, 1));
    expect(r.s1).toBe(civilToJdn(1932, 12, 31));
    expect(r.e0).toBe(civilToJdn(1945, 8, 17));
    expect(r.e1).toBe(civilToJdn(1945, 8, 17));
  });

  it('treats "ongoing" as no end yet', () => {
    expect(dayRanges('1924-11-26', 'ongoing')).toMatchObject({ e0: FAR_FUTURE, endUnknown: false });
    expect(dayRanges('1924', 'unknown')).toMatchObject({ e0: FAR_FUTURE, endUnknown: true });
  });
});

describe('assignColors', () => {
  it('gives overlapping polities different colors, and reuses colors for distant ones', () => {
    const box = (x: number): [number, number, number, number] => [x, 0, x + 1, 1];
    const colors = assignColors([
      { polity: 'a', box: box(0), s0: 0, e0: 100 },
      { polity: 'b', box: box(0.5), s0: 0, e0: 100 }, // overlaps a
      { polity: 'c', box: box(10), s0: 0, e0: 100 }, // far away
    ]);
    expect(colors.get('a')).not.toBe(colors.get('b'));
    expect(colors.get('c')).toBe(0);
  });

  it('ignores polities that overlap in space but not in time', () => {
    const colors = assignColors([
      { polity: 'a', box: [0, 0, 1, 1], s0: 0, e0: 10 },
      { polity: 'b', box: [0, 0, 1, 1], s0: 10, e0: 20 }, // starts when a ends
    ]);
    expect(colors.get('a')).toBe(colors.get('b'));
  });
});
