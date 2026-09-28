// Eras: the stretches of time the tiles are split into (Phase 5, decision 10). The build chooses
// them (scripts/lib/eras.ts) and lists them in tiles.json; the map loads the tiles of the era that
// holds the day shown. Shared by the site and the build, so imports use explicit .ts extensions.

/** An era: the days [start, end), as Julian Day Numbers. */
export interface Era {
  start: number;
  end: number;
}

/** The index of the era holding `day`, given eras in order that together cover every day. */
export function eraOf(eras: readonly Era[], day: number): number {
  let lo = 0;
  let hi = eras.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (eras[mid].start <= day) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Whether something drawn over the days [s0, e0) appears in an era. */
export const inEra = (era: Era, s0: number, e0: number): boolean => s0 < era.end && e0 > era.start;
