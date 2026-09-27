import { describe, expect, it } from 'vitest';
import { cycleHeight, nearestHeight, sheetHeights, stepHeight } from './sheet.ts';

describe('bottom sheet heights', () => {
  it('scales the half and full heights with the screen, keeping peek fixed', () => {
    expect(sheetHeights(800)).toEqual({ peek: 112, half: 360, full: 576 });
  });

  it('cycles on tap, and steps without wrapping on arrow keys', () => {
    expect(['peek', 'half', 'full'].map((h) => cycleHeight(h as 'peek'))).toEqual(['half', 'full', 'peek']);
    expect(stepHeight('full', 1)).toBe('full');
    expect(stepHeight('half', 1)).toBe('full');
    expect(stepHeight('peek', -1)).toBe('peek');
  });

  it('snaps a drag to the nearest height', () => {
    const heights = sheetHeights(800);
    expect(nearestHeight(130, heights)).toBe('peek');
    expect(nearestHeight(300, heights)).toBe('half');
    expect(nearestHeight(500, heights)).toBe('full');
  });
});
