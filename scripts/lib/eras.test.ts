import { describe, expect, it } from 'vitest';
import { civilToJdn } from '../../src/dates/index.ts';
import { chooseEras, eraOf, inEra } from './eras.ts';
import type { EraItem } from './eras.ts';

const FAR = 99_999_999;
const year = (y: number) => civilToJdn(y, 1, 1);
// Made-up records (Testland), each 1 MB, one per decade from 1800 to 1990.
const decades: EraItem[] = Array.from({ length: 20 }, (_, i) => ({ set: 'test', s0: year(1800 + 10 * i), e0: year(1810 + 10 * i), bytes: 1_000_000 }));

describe('chooseEras', () => {
  it('keeps one era for everything when it fits the budget', () => {
    expect(chooseEras(decades, FAR, 50_000_000)).toEqual([{ start: -FAR, end: FAR }]);
    expect(chooseEras([], FAR)).toEqual([{ start: -FAR, end: FAR }]);
  });

  it('splits into eras of whole years that stay within the budget, covering every day', () => {
    const eras = chooseEras(decades, FAR, 3_000_000);
    expect(eras[0].start).toBe(-FAR);
    expect(eras.at(-1)!.end).toBe(FAR);
    for (let i = 1; i < eras.length; i++) expect(eras[i].start).toBe(eras[i - 1].end);
    // Three decades' records fit each inner era.
    expect(eras.slice(1, 3).map((e) => [e.start, e.end])).toEqual([
      [year(1830), year(1860)],
      [year(1860), year(1890)],
    ]);
    for (const era of eras) {
      const bytes = decades.filter((d) => inEra(era, d.s0, d.e0)).reduce((n, d) => n + d.bytes, 0);
      expect(bytes).toBeLessThanOrEqual(3_000_000);
    }
  });

  it('measures each tile set on its own', () => {
    const twoSets = [...decades, ...decades.map((d) => ({ ...d, set: 'other' }))];
    expect(chooseEras(twoSets, FAR, 3_000_000)).toEqual(chooseEras(decades, FAR, 3_000_000));
  });

  it('steps by 50 years before 1500 (and handles BCE)', () => {
    const old: EraItem[] = [-500, -400, -300, -200].map((y) => ({ set: 'test', s0: year(y), e0: year(y + 100), bytes: 2_000_000 }));
    const eras = chooseEras(old, FAR, 2_000_000);
    for (const era of eras.slice(1)) expect([-450, -400, -350, -300, -250, -200, -150, -100].map(year)).toContain(era.start);
  });
});

describe('eraOf', () => {
  it('finds the era holding a day', () => {
    const eras = [
      { start: -FAR, end: 10 },
      { start: 10, end: 20 },
      { start: 20, end: FAR },
    ];
    expect([eraOf(eras, -5), eraOf(eras, 10), eraOf(eras, 19), eraOf(eras, 20), eraOf(eras, 1e7)]).toEqual([0, 1, 1, 2, 2]);
  });
});
