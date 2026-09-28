// Label-point tests use made-up shapes (Testland), not real places.

import { describe, expect, it } from 'vitest';
import { labelPoint } from './labels.ts';
import type { MultiPolygon } from './geometry.ts';

describe('labelPoint', () => {
  it('puts the label in the middle of a square', () => {
    const [x, y] = labelPoint([[[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]]])!;
    expect(x).toBeCloseTo(1, 1);
    expect(y).toBeCloseTo(1, 1);
  });

  it('avoids a hole in the middle, and uses the largest part', () => {
    // A 4° square with a 2° hole in its centre, plus a small island far away.
    const shape: MultiPolygon = [
      [
        [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]],
        [[1, 1], [1, 3], [3, 3], [3, 1], [1, 1]],
      ],
      [[[10, 10], [10.5, 10], [10.5, 10.5], [10, 10.5], [10, 10]]],
    ];
    const [x, y] = labelPoint(shape)!;
    expect(x).toBeLessThan(4);
    const inHole = x > 1 && x < 3 && y > 1 && y < 3;
    expect(inHole).toBe(false);
  });

  it('keeps to the wide part of an L-shape, not its empty corner', () => {
    const shape: MultiPolygon = [[[[0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6], [0, 0]]]];
    const [x, y] = labelPoint(shape)!;
    expect(x < 2 || y < 2).toBe(true);
  });
});
