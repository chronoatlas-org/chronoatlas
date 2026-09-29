import { describe, expect, it } from 'vitest';
import { shapeCellSet, uncoveredCount } from './cells.ts';
import type { MultiPolygon } from './geometry.ts';

// Made-up Testland squares, not real places.
const square = (x: number, y: number, size: number): MultiPolygon[number] => [
  [[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]],
];

describe('shapeCellSet', () => {
  it('takes the cells whose centres lie inside', () => {
    // A 1° square holds 10 × 10 cells of 0.1°.
    expect(shapeCellSet([square(0, 0, 1)]).size).toBe(100);
    expect(shapeCellSet([square(10.02, 20.02, 0.05)]).size).toBe(1); // holds the centre 10.05, 20.05
    expect(shapeCellSet([square(10.06, 20.06, 0.02)]).size).toBe(0); // holds no centre
  });

  it('leaves out holes, and counts separate parts', () => {
    const holed: MultiPolygon = [[...square(0, 0, 1), ...square(0.2, 0.2, 0.5)]];
    expect(shapeCellSet(holed).size).toBe(75);
    expect(shapeCellSet([square(0, 0, 1), square(5, 5, 1)]).size).toBe(200);
  });
});

describe('uncoveredCount', () => {
  it('counts the cells no cover has', () => {
    const whole = shapeCellSet([square(0, 0, 1)]);
    const left = shapeCellSet([square(0, 0, 0.5)].map((s) => [s[0].map(([x, y]) => [x, y * 2])]) as MultiPolygon);
    expect(uncoveredCount(whole, [])).toBe(100);
    expect(uncoveredCount(whole, [whole])).toBe(0);
    expect(uncoveredCount(whole, [left])).toBe(50);
  });
});
