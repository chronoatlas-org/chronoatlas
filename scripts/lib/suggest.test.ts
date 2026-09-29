// Suggestion tests use made-up polities and units (Testland), not real ones.

import { describe, expect, it } from 'vitest';
import { suggest } from './suggest.ts';

describe('suggest', () => {
  const totals = new Map([
    ['clio-testland', 1000],
    ['clio-empire', 3000],
    ['clio-colony', 200],
    ['clio-rebels', 100],
  ]);
  const overlap = (polity: string, unit: string, home: boolean, km2: number, unitKm2: number, days = [10, 20]) => ({
    polity, holder: 'unit-testland', unit, home, km2, unitKm2, days,
  });
  const overlaps = [
    // Testland's own government: nearly all of the home unit, and nearly all inside it.
    overlap('clio-testland', 'unit-testland', true, 900, 1000, [10, 20, 30]),
    // An empire reaching far beyond the home unit: only a third of it inside, but it held all of the unit.
    overlap('clio-empire', 'unit-testland', true, 1000, 1000),
    // A colony, held whole.
    overlap('clio-colony', 'unit-colony', false, 180, 200),
    // Rebels wholly inside the home unit, but holding a tenth of it.
    overlap('clio-rebels', 'unit-testland', true, 100, 1000),
    // The empire also occupying most of a neighbour's small unit, a sliver of its own territory.
    { polity: 'clio-empire', holder: 'unit-neighbour', unit: 'unit-neighbour', home: true, km2: 80, unitKm2: 100, days: [20] },
  ];
  const { suggestions, inside, unmatched } = suggest(overlaps, totals);

  it('suggests a holder whose unit the polity held most of: the same state for its home unit, else a dependency', () => {
    expect(suggestions.map((s) => [s.polity, s.kind, s.units])).toEqual([
      ['clio-colony', 'dependency', ['unit-colony']],
      ['clio-empire', 'same-state', ['unit-testland']],
      ['clio-testland', 'same-state', ['unit-testland']],
    ]);
    expect(suggestions[2]).toMatchObject({ share: 0.9, held: 0.9, first: 10, last: 30 });
  });

  it('never suggests a polity that only lay inside a unit: it lists it for a closer look', () => {
    expect(suggestions.some((s) => s.polity === 'clio-rebels')).toBe(false);
    expect(inside).toContainEqual({ polity: 'clio-rebels', holder: 'unit-testland', unit: 'unit-testland', share: 1, held: 0.1, why: 'inside' });
    expect(unmatched).toEqual([{ polity: 'clio-rebels', best: 0.1 }]);
  });

  it('suggests only the main holder: another state\'s unit it held most of is listed as a possible occupation', () => {
    expect(suggestions.filter((s) => s.polity === 'clio-empire').map((s) => s.holder)).toEqual(['unit-testland']);
    expect(inside).toContainEqual(expect.objectContaining({ polity: 'clio-empire', unit: 'unit-neighbour', why: 'beyond' }));
  });
});
