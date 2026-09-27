import { describe, expect, it } from 'vitest';
import { civilToJdn } from '../src/dates/index.ts';
import { assignColors, changeDays, dayRanges, FAR_FUTURE } from './build-data.ts';

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
