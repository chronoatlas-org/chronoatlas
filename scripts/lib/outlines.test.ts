// Border-line tests use made-up squares of land and made-up borders (Testland), not real places.

import { describe, expect, it } from 'vitest';
import { alongBoxEdge, borderLines, boxEdgeOnLand, LandDistance } from './outlines.ts';
import type { MultiPolygon, Position } from './geometry.ts';

const square = (x: number, y: number, size: number): MultiPolygon => [
  [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]],
];

// Land: a 1° square island at 10–11°E, 10–11°N.
const land = new LandDistance(square(10, 10, 1));

describe('LandDistance', () => {
  it('tells land from sea', () => {
    expect(land.isLand([10.5, 10.5])).toBe(true);
    expect(land.isLand([12, 10.5])).toBe(false);
  });

  it('measures the distance to the coast in km, near it', () => {
    // 0.01° of latitude is about 1.1 km.
    expect(land.distanceKm([10.5, 9.99])).toBeCloseTo(1.1, 1);
    expect(land.nearLand([10.5, 9.99])).toBe(true);
    expect(land.nearLand([10.5, 9.9])).toBe(false); // about 11 km out
  });
});

describe('borderLines', () => {
  const count = (lines: Position[][]) => lines.reduce((n, l) => n + l.length - 1, 0);

  it('keeps a border that follows the coast, and drops a ring drawn out at sea', () => {
    const coast = borderLines(square(10, 10, 1), undefined, land);
    expect(count(coast)).toBe(4);
    const ring = borderLines(square(9.9, 9.9, 1.2), undefined, land); // about 11 km offshore
    expect(ring).toEqual([]);
  });

  it('leaves out the stretches along the edge of the import area, as one continuous line', () => {
    // A square cut by the area's east edge at 11°E: three real sides, one cut.
    const lines = borderLines(square(10, 10, 1), [0, 0, 11, 20], undefined);
    expect(lines).toEqual([
      [[11, 11], [10, 11], [10, 10], [11, 10]],
    ]);
  });

  it('for a coarse shape, keeps only the land border, away from the coast', () => {
    // A made-up polity holding the island's west half, its outline drawn a little off the coast.
    const west: MultiPolygon = [[[[9.99, 9.99], [10.5, 9.99], [10.5, 11.01], [9.99, 11.01], [9.99, 9.99]]]];
    const lines = borderLines(west, undefined, land, [], 3);
    const points = lines.flat();
    expect(lines).toHaveLength(1);
    // Only the line across the island at 10.5°E, stopping about 3 km short of each coast.
    expect(points.every(([x]) => x === 10.5)).toBe(true);
    const ys = points.map(([, y]) => y);
    expect(Math.min(...ys)).toBeGreaterThan(10.02);
    expect(Math.min(...ys)).toBeLessThan(10.06);
    expect(Math.max(...ys)).toBeGreaterThan(10.94);
    expect(Math.max(...ys)).toBeLessThan(10.98);
    // Without the option, its coastal edges are kept too.
    expect(borderLines(west, undefined, land).flat().some(([x]) => x < 10.5)).toBe(true);
  });

  it('knows a cut along the area edge from a border', () => {
    expect(alongBoxEdge([11, 10], [11, 11], [0, 0, 11, 20])).toBe(true);
    expect(alongBoxEdge([10, 10], [11, 10], [0, 0, 11, 20])).toBe(false);
  });
});

describe('boxEdgeOnLand', () => {
  it('draws the area edge only where it crosses land', () => {
    // An area whose south edge (10.5°N) crosses the island between 10°E and 11°E.
    const lines = boxEdgeOnLand([9, 10.5, 12, 12], land, 0.25);
    expect(lines).toHaveLength(1);
    expect(lines[0][0]).toEqual([10, 10.5]);
    expect(lines[0][lines[0].length - 1]).toEqual([11, 10.5]);
  });

  it('draws the whole edge when there is no land to check against', () => {
    const lines = boxEdgeOnLand([0, 0, 1, 1], undefined, 0.5);
    expect(lines).toHaveLength(4);
  });
});
