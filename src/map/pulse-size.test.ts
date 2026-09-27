import { describe, expect, it } from 'vitest';
import { pulseRadiusPx } from './pulse-size.ts';

describe('pulseRadiusPx', () => {
  it('matches the area the precision covers, at the equator', () => {
    // At zoom 0 one pixel is about 78 km at the equator, so 780 km is about 10 px (raised to 14).
    expect(pulseRadiusPx(780, 0, 0)).toBe(14);
    // At zoom 5, one pixel is about 2.4 km, so 100 km is about 41 px.
    expect(pulseRadiusPx(100, 0, 5)).toBeCloseTo(40.9, 0);
  });

  it('grows away from the equator, where each pixel covers less ground', () => {
    expect(pulseRadiusPx(100, 60, 5)).toBeGreaterThan(pulseRadiusPx(100, 0, 5));
  });

  it('stays between a noticeable minimum and a sensible maximum', () => {
    expect(pulseRadiusPx(0, 0, 2)).toBe(14);
    expect(pulseRadiusPx(5000, 0, 8)).toBe(400);
  });
});
