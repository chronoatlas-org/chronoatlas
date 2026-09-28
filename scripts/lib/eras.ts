// Splits time into eras for the tiles (Phase 5, decision 10). A tile set that covered every year
// at once would put thousands of overlapping records into each tile, so the build writes one set
// of tiles per era, and the map loads only the era of the day shown.
//
// Eras follow the data: each is as long as it can be while every tile set's shapes in it stay
// within a budget (about 6 MB, measured in Phase 5 step 2). So there are long eras where records
// are few (antiquity) and short ones where they are many (the twentieth century). A record that
// spans two eras goes into both. Era boundaries fall on 1 January of whole years: every 50 years
// before 1500 and every 10 years from then, so they read as round years.
//
// The first era starts, and the last one ends, at the edges of time the map can show, so every day
// belongs to exactly one era.

import { civilToJdn, jdnToCivil } from '../../src/dates/index.ts';
import type { Era } from '../../src/map/eras.ts';

export type { Era } from '../../src/map/eras.ts';
export { eraOf, inEra } from '../../src/map/eras.ts';

/** Something drawn on the map for a stretch of days [s0, e0), in one tile set, and its size. */
export interface EraItem {
  set: string;
  s0: number;
  /** The last day it may still apply, exclusive (a record's uncertain end, e1, when it has one). */
  e0: number;
  /** Its size in bytes (its geometry as JSON), to keep each era's tiles small. */
  bytes: number;
}

/** Tile sets whose shapes in one era stay within this many bytes (decision 10: about 6 MB). */
export const ERA_BUDGET_BYTES = 6_000_000;

/** Years between candidate era boundaries: 50 before 1500, 10 from then. */
const step = (year: number) => (year < 1500 ? 50 : 10);
const jan1 = (year: number) => civilToJdn(year, 1, 1);

/**
 * The eras for these items. `far` is the day beyond which nothing is drawn (the build's
 * FAR_FUTURE); the first era starts at -far and the last ends at far.
 */
export function chooseEras(items: readonly EraItem[], far: number, budget = ERA_BUDGET_BYTES): Era[] {
  const sets = [...new Set(items.map((i) => i.set))];
  /** The largest set's total size over the days [a, b). */
  const size = (a: number, b: number) =>
    Math.max(0, ...sets.map((set) => items.reduce((n, i) => (i.set === set && i.s0 < b && i.e0 > a ? n + i.bytes : n), 0)));
  if (items.length === 0 || size(-far, far) <= budget) return [{ start: -far, end: far }];

  // The years with records: from the earliest start to the latest end that isn't open-ended.
  const finite = (day: number) => Math.abs(day) < far;
  const starts = items.map((i) => i.s0).filter(finite);
  const ends = items.map((i) => i.e0).filter(finite);
  const first = jdnToCivil(Math.min(...starts)).year;
  const last = jdnToCivil(Math.max(...starts, ...ends)).year + 1;

  const boundaries: number[] = [];
  let a = Math.floor(first / step(first)) * step(first);
  while (a < last) {
    let b = a + step(a);
    while (b < last && size(jan1(a), jan1(b + step(b))) <= budget) b += step(b);
    boundaries.push(b);
    a = b;
  }
  // Eras between the boundaries, with the first and last reaching to the edges of time.
  const inner = boundaries.slice(0, -1).map(jan1);
  const edges = [-far, ...inner, far];
  return edges.slice(0, -1).map((start, i) => ({ start, end: edges[i + 1] }));
}
