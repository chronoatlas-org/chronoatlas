// Coverage tests use made-up boundaries (Testland), not real ones.

import { describe, expect, it } from 'vitest';
import { coverageMarkdown, coverageTable, regionOf } from './coverage.ts';
import type { BoundaryRelation } from './coverage.ts';

describe('coverageTable', () => {
  const box = (lon: number, lat: number) => ({ minlon: lon - 1, maxlon: lon + 1, minlat: lat - 1, maxlat: lat + 1 });
  const relations: BoundaryRelation[] = [
    // In Europe from 1890 to 1920: two periods.
    { id: 1, tags: { name: 'Testland', start_date: '1890', end_date: '1920' }, bounds: box(10, 50) },
    // In East Asia, from 1950 with no end: two periods.
    { id: 2, tags: { name: 'Otherland', start_date: '1950-05' }, bounds: box(110, 30) },
    // Left out.
    { id: 3, tags: { name: 'Nodate' }, bounds: box(10, 50) },
    { id: 4, tags: { name: 'Baddate', start_date: 'sometime' }, bounds: box(10, 50) },
    { id: 5, tags: { name: 'Nobounds', start_date: '1900' } },
  ];
  const table = coverageTable(relations);

  it('counts each boundary in its region and in every period its dates overlap', () => {
    expect(table.counts['Europe']).toEqual({ '1800–1899': 1, '1900–1949': 1 });
    expect(table.counts['East Asia (our import’s area)']).toEqual({ '1950–1999': 1, '2000 on': 1 });
    expect(table.totals).toEqual({ Europe: 1, 'East Asia (our import’s area)': 1 });
  });

  it('says what it left out', () => {
    expect([table.noStart, table.unparsed, table.noBounds]).toEqual([1, 1, 1]);
    expect(coverageMarkdown(table)).toMatch(/Left out: 1 without a start date/);
  });

  it('puts a point in the first region holding it, and the rest elsewhere', () => {
    expect(regionOf(110, 30)).toBe('East Asia (our import’s area)');
    expect(regionOf(0, -80)).toBe('Elsewhere');
  });
});
