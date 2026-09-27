import { describe, expect, it } from 'vitest';
import { segmentOf } from './changes.ts';

describe('segmentOf', () => {
  const changes = [10, 20, 30];

  it('counts the change days on or before the day', () => {
    expect(segmentOf(changes, 5)).toBe(0);
    expect(segmentOf(changes, 10)).toBe(1); // a change day belongs to the stretch it starts
    expect(segmentOf(changes, 19)).toBe(1);
    expect(segmentOf(changes, 20)).toBe(2);
    expect(segmentOf(changes, 1000)).toBe(3);
  });

  it('gives the same answer for every day in a stretch, and a new one across a change', () => {
    const inside = [11, 15, 19].map((d) => segmentOf(changes, d));
    expect(new Set(inside).size).toBe(1);
    expect(segmentOf(changes, 20)).not.toBe(segmentOf(changes, 19));
  });

  it('handles an empty index', () => {
    expect(segmentOf([], 42)).toBe(0);
  });
});
