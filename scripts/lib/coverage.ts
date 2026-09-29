// How much OpenHistoricalMap covers, by region and period (Phase 5 step 9), so the maintainers can
// choose the next region to import (decision 8). Pure, so it's tested; scripts/measure-ohm.ts
// downloads the boundaries and prints the table.

import { EdtfError, parseEdtfDate } from '../../src/dates/index.ts';

type Box = [number, number, number, number];

/** Broad regions, as boxes (west, south, east, north); a boundary goes to the first holding its middle. */
export const REGIONS: readonly { name: string; box: Box }[] = [
  { name: 'East Asia (our import’s area)', box: [73, 10, 150, 55] },
  { name: 'Europe', box: [-25, 34, 45, 72] },
  { name: 'North Africa and West Asia', box: [-20, 12, 63, 42] },
  { name: 'Sub-Saharan Africa', box: [-20, -40, 55, 12] },
  { name: 'Central and South Asia', box: [45, 0, 92, 55] },
  { name: 'Northern Asia', box: [45, 55, 180, 82] },
  { name: 'Southeast Asia and Oceania', box: [90, -50, 180, 10] },
  { name: 'North America', box: [-170, 24, -50, 85] },
  { name: 'Central America and the Caribbean', box: [-120, 5, -55, 24] },
  { name: 'South America', box: [-90, -60, -30, 5] },
];
export const ELSEWHERE = 'Elsewhere';

/** Periods, as years [from, until); a boundary counts in every period its dates overlap. */
export const PERIODS: readonly { name: string; from: number; until: number }[] = [
  { name: 'before 1500', from: -1e6, until: 1500 },
  { name: '1500–1799', from: 1500, until: 1800 },
  { name: '1800–1899', from: 1800, until: 1900 },
  { name: '1900–1949', from: 1900, until: 1950 },
  { name: '1950–1999', from: 1950, until: 2000 },
  { name: '2000 on', from: 2000, until: 1e6 },
];

/** One boundary relation as Overpass gives it with `out tags bb`. */
export interface BoundaryRelation {
  id: number;
  tags?: Record<string, string>;
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
}

export interface CoverageTable {
  /** Boundaries per region and period (by name). */
  counts: Record<string, Record<string, number>>;
  /** Boundaries per region in all. */
  totals: Record<string, number>;
  /** Boundaries left out: no start date, a date that doesn't parse, or no bounds. */
  noStart: number;
  unparsed: number;
  noBounds: number;
}

/** The year a date string starts in, or undefined when it doesn't parse (EDTF, as the import reads it). */
function yearOf(date: string, end: 'earliest' | 'latest'): number | undefined {
  try {
    const d = parseEdtfDate(date);
    const day = end === 'earliest' ? d.earliest : d.latest;
    // Julian Day Number 1721426 is 1 January 1 CE; 365.2425 days a year is close enough to bucket.
    return Math.floor((day - 1721426) / 365.2425) + 1;
  } catch (error) {
    if (error instanceof EdtfError) return undefined;
    throw error;
  }
}

/** The region holding a point (the first in REGIONS), or ELSEWHERE. */
export function regionOf(lon: number, lat: number): string {
  return REGIONS.find(({ box: [w, s, e, n] }) => lon >= w && lon < e && lat >= s && lat < n)?.name ?? ELSEWHERE;
}

/** Counts the boundaries by region (their bounding box's middle) and period (their dates). */
export function coverageTable(relations: readonly BoundaryRelation[]): CoverageTable {
  const table: CoverageTable = { counts: {}, totals: {}, noStart: 0, unparsed: 0, noBounds: 0 };
  for (const r of relations) {
    const start = r.tags?.start_date;
    if (!start) {
      table.noStart++;
      continue;
    }
    if (!r.bounds) {
      table.noBounds++;
      continue;
    }
    const from = yearOf(start, 'earliest');
    const endTag = r.tags?.end_date;
    const until = endTag ? yearOf(endTag, 'earliest') : 1e6;
    if (from === undefined || until === undefined) {
      table.unparsed++;
      continue;
    }
    const { minlat, minlon, maxlat, maxlon } = r.bounds;
    const region = regionOf((minlon + maxlon) / 2, (minlat + maxlat) / 2);
    table.totals[region] = (table.totals[region] ?? 0) + 1;
    const row = (table.counts[region] ??= {});
    for (const period of PERIODS) {
      if (from < period.until && Math.max(until, from + 1) > period.from) row[period.name] = (row[period.name] ?? 0) + 1;
    }
  }
  return table;
}

/** The table as Markdown: one row per region (in REGIONS' order, then ELSEWHERE), one column per period. */
export function coverageMarkdown(table: CoverageTable): string {
  const regions = [...REGIONS.map((r) => r.name), ELSEWHERE].filter((name) => table.totals[name]);
  return [
    `| Region | ${PERIODS.map((p) => p.name).join(' | ')} | All |`,
    `|---|${PERIODS.map(() => '---:').join('|')}|---:|`,
    ...regions.map((name) => `| ${name} | ${PERIODS.map((p) => table.counts[name]?.[p.name] ?? 0).join(' | ')} | ${table.totals[name]} |`),
    '',
    `Left out: ${table.noStart} without a start date (the import skips those too), ${table.unparsed} with a date that doesn't parse, ${table.noBounds} without bounds.`,
  ].join('\n');
}
