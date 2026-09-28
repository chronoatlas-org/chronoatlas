// Contested-area tests use made-up squares and polities (Testland), not real places.

import { describe, expect, it } from 'vitest';
import { boundingBox, computeContested, splitByCertainty, uncovered } from './contested.ts';
import type { Link, TimedShape } from './contested.ts';
import type { MultiPolygon } from './geometry.ts';

const square = (x: number, y: number, size: number): MultiPolygon => [
  [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]],
];

function shape(record: string, holder: string, geometry: MultiPolygon, s0: number, e0: number, relation = 'administers'): TimedShape {
  return { record, holder, relation, source: 'test-source', s0, e0, shape: record, geometry, box: boundingBox(geometry) };
}

describe('uncovered', () => {
  it('returns the parts of a period that no window covers', () => {
    expect(uncovered(0, 100, [])).toEqual([[0, 100]]);
    expect(uncovered(0, 100, [[20, 40], [60, 200]])).toEqual([[0, 20], [40, 60]]);
    expect(uncovered(0, 100, [[-50, 150]])).toEqual([]);
  });
});

describe('splitByCertainty', () => {
  it('marks the parts of a period outside the certain days as only possibly contested', () => {
    expect(splitByCertainty(0, 100, 0, 100)).toEqual([{ s0: 0, e0: 100, maybe: false }]);
    expect(splitByCertainty(0, 100, 20, 60)).toEqual([
      { s0: 0, e0: 20, maybe: true },
      { s0: 20, e0: 60, maybe: false },
      { s0: 60, e0: 100, maybe: true },
    ]);
    // No certain overlap at all: the whole period is only possible.
    expect(splitByCertainty(0, 100, 150, 200)).toEqual([{ s0: 0, e0: 100, maybe: true }]);
  });
});

describe('computeContested', () => {
  // Testland (de facto) runs a 2° square; the de jure source gives "Unit A" sovereignty over it.
  const testland = shape('facto-1', 'testland', square(0, 0, 2), 100, 300);
  const unitA = shape('jure-1', 'unit-a', square(0, 0, 2), 0, 1000, 'sovereign');

  it('marks the area when the two sources name polities the crosswalk does not link', () => {
    const [area, ...rest] = computeContested([testland], [unitA], new Map());
    expect(rest).toEqual([]);
    expect(area).toMatchObject({ facto: 'testland', jure: 'unit-a', jureRelation: 'sovereign', s0: 100, e0: 300 });
    expect(area.km2).toBeGreaterThan(49_000); // about 2° × 2° at the equator
  });

  it('marks nothing while the crosswalk links them, and only the unlinked days otherwise', () => {
    const always = new Map<string, Link[]>([['unit-a', [{ polity: 'testland', m0: -Infinity, m1: Infinity }]]]);
    expect(computeContested([testland], [unitA], always)).toEqual([]);
    const until200 = new Map<string, Link[]>([['unit-a', [{ polity: 'testland', m0: -Infinity, m1: 200 }]]]);
    expect(computeContested([testland], [unitA], until200).map((a) => [a.s0, a.e0])).toEqual([[200, 300]]);
  });

  it('marks the days when a record may not apply (an uncertain start or end) as possibly contested', () => {
    // Testland's record may have started from day 100 but certainly by 150, and may have ended
    // from day 250 but certainly by 300.
    const uncertain = { ...testland, c0: 150, c1: 250 };
    expect(computeContested([uncertain], [unitA], new Map()).map((a) => [a.s0, a.e0, a.maybe ?? false])).toEqual([
      [100, 150, true],
      [150, 250, false],
      [250, 300, true],
    ]);
  });

  it('leaves out disagreements smaller than 10,000 km², the size CShapes does not code', () => {
    const tiny = shape('facto-2', 'testland', square(0, 0, 0.5), 100, 300); // about 3,100 km²
    expect(computeContested([tiny], [unitA], new Map())).toEqual([]);
  });

  it('ignores records that do not overlap in time or in space', () => {
    const later = shape('facto-3', 'testland', square(0, 0, 2), 2000, 3000);
    const elsewhere = shape('facto-4', 'testland', square(20, 20, 2), 100, 300);
    expect(computeContested([later, elsewhere], [unitA], new Map())).toEqual([]);
  });
});
