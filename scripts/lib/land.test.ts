// Land-split tests use made-up squares, not real coastlines.

import { describe, expect, it } from 'vitest';
import { areaKm2 } from './geometry.ts';
import type { MultiPolygon } from './geometry.ts';
import { LandIndex, landPart, touchesEdge } from './land.ts';

const rect = (x0: number, y0: number, x1: number, y1: number): MultiPolygon => [
  [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]],
];

describe('landPart', () => {
  // Land: a 1° × 2° strip. A border 2° × 2° covers it and 1° × 2° of sea.
  const land = new LandIndex([{ type: 'Polygon', coordinates: rect(0, 0, 1, 2)[0] }, { type: 'Polygon', coordinates: rect(30, 30, 31, 31)[0] }], [-10, -10, 40, 40]);

  it('keeps only the land inside a border', () => {
    const border = rect(0, 0, 2, 2);
    expect(areaKm2(landPart(border, land))).toBeCloseTo(areaKm2(rect(0, 0, 1, 2)), 0);
  });

  it('finds no land for a border over open sea', () => {
    expect(landPart(rect(10, 10, 11, 11), land)).toEqual([]);
  });

  it('cuts land to the area it was built for', () => {
    const small = new LandIndex([{ type: 'Polygon', coordinates: rect(0, 0, 4, 4)[0] }], [0, 0, 2, 2]);
    expect(areaKm2(landPart(rect(0, 0, 4, 4), small))).toBeCloseTo(areaKm2(rect(0, 0, 2, 2)), 0);
  });
});

describe('touchesEdge', () => {
  const area: [number, number, number, number] = [0, 0, 10, 10];

  it('spots a shape cut along the edge of an import area', () => {
    expect(touchesEdge(rect(8, 2, 10, 4), area)).toBe(true); // runs along the east edge
    expect(touchesEdge(rect(2, 0, 4, 1), area)).toBe(true); // along the south edge
  });

  it('ignores shapes inside, even one that touches the edge at a single corner', () => {
    expect(touchesEdge(rect(2, 2, 4, 4), area)).toBe(false);
    expect(touchesEdge([[[[9, 8], [10, 10], [8, 9], [9, 8]]]], area)).toBe(false); // meets the corner (10, 10) only
  });
});
