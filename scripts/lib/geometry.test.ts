// Geometry tests use made-up shapes in an abstract coordinate space, not real places.

import { describe, expect, it } from 'vitest';
import {
  assembleRings,
  buildMultiPolygon,
  cleanMultiPolygon,
  formatFeature,
  pointInRing,
  ringArea,
  simplifyLine,
} from './geometry.ts';
import type { Position, Ring } from './geometry.ts';

const square = (x: number, y: number, size: number): Ring => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
];

describe('simplifyLine', () => {
  it('drops points closer to the line than the tolerance, keeping both ends', () => {
    const line: Position[] = [[0, 0], [1, 0.001], [2, -0.001], [3, 0]];
    expect(simplifyLine(line, 0.01)).toEqual([[0, 0], [3, 0]]);
  });

  it('keeps points farther than the tolerance', () => {
    const line: Position[] = [[0, 0], [1, 1], [2, 0]];
    expect(simplifyLine(line, 0.1)).toEqual(line);
  });
});

describe('assembleRings', () => {
  it('joins segments end to end, reversing where needed', () => {
    const rings = assembleRings([
      [[0, 0], [2, 0]],
      [[2, 2], [2, 0]], // reversed relative to its neighbours
      [[2, 2], [0, 2], [0, 0]],
    ]);
    expect(rings).toHaveLength(1);
    const ring = rings![0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(Math.abs(ringArea(ring))).toBe(4);
  });

  it('returns null when the segments cannot close', () => {
    expect(assembleRings([[[0, 0], [1, 0]], [[5, 5], [6, 6]]])).toBeNull();
  });
});

describe('buildMultiPolygon', () => {
  it('assigns holes to the outer ring that contains them', () => {
    const multi = buildMultiPolygon([square(0, 0, 10), square(20, 0, 10)], [square(22, 2, 2)]);
    expect(multi[0]).toHaveLength(1);
    expect(multi[1]).toHaveLength(2);
  });
});

describe('cleanMultiPolygon', () => {
  it('orients outer rings counter-clockwise and holes clockwise', () => {
    const clockwiseOuter = square(0, 0, 10).reverse();
    const counterClockwiseHole = square(2, 2, 2);
    const [polygon] = cleanMultiPolygon([[clockwiseOuter, counterClockwiseHole]], 4);
    expect(ringArea(polygon[0])).toBeGreaterThan(0);
    expect(ringArea(polygon[1])).toBeLessThan(0);
  });

  it('drops rings that collapse when rounded', () => {
    const tiny: Ring = [[0, 0], [0.00001, 0], [0.00001, 0.00001], [0, 0]];
    expect(cleanMultiPolygon([[tiny]], 4)).toEqual([]);
  });
});

describe('pointInRing', () => {
  it('detects inside and outside points', () => {
    expect(pointInRing([5, 5], square(0, 0, 10))).toBe(true);
    expect(pointInRing([15, 5], square(0, 0, 10))).toBe(false);
  });
});

describe('formatFeature', () => {
  it('writes valid GeoJSON with one coordinate pair per line', () => {
    const text = formatFeature({ id: 'test' }, [[square(0, 0, 1)]]);
    const parsed = JSON.parse(text);
    expect(parsed.geometry.type).toBe('MultiPolygon');
    expect(text.split('\n').filter((l) => /^\[-?\d/.test(l))).toHaveLength(5);
  });
});
