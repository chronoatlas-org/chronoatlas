import { describe, expect, it } from 'vitest';
import { civilToJdn, jdnToCivil } from '../dates/index.ts';
import { chooseTickUnit, generateTicks, stepDay, TICK_UNITS } from './scale.ts';
import type { TickUnit } from './scale.ts';

const unit = (kind: TickUnit['kind'], step: number) => {
  const found = TICK_UNITS.find((u) => u.kind === kind && u.step === step);
  if (!found) throw new Error(`no unit ${kind} ${step}`);
  return found;
};
const labels = (ticks: ReturnType<typeof generateTicks>) =>
  ticks.map((t) => `${t.year}-${t.month}-${t.day}`);

describe('chooseTickUnit', () => {
  it('uses days when zoomed all the way in', () => {
    expect(chooseTickUnit(1 / 80, 72)).toMatchObject({ kind: 'day', step: 1 });
  });

  it('moves to coarser units as you zoom out', () => {
    expect(chooseTickUnit(1, 72).kind).toBe('month'); // 1 day per pixel
    expect(chooseTickUnit(30, 72).kind).toBe('year'); // about a month per pixel
    expect(chooseTickUnit(10000, 72)).toMatchObject({ kind: 'year', step: 2000 });
  });

  it('always leaves at least the requested spacing when it can', () => {
    for (const dpp of [0.02, 0.3, 3, 40, 500, 5000]) {
      const u = chooseTickUnit(dpp, 72);
      expect(u.approxDays / dpp).toBeGreaterThanOrEqual(72);
    }
  });
});

describe('generateTicks', () => {
  it('puts month ticks on the 1st of each month, aligned across years', () => {
    const ticks = generateTicks(unit('month', 3), civilToJdn(1937, 11, 15), civilToJdn(1938, 8, 1));
    expect(labels(ticks)).toEqual(['1938-1-1', '1938-4-1', '1938-7-1']);
  });

  it('spreads multi-day ticks within each month', () => {
    const ticks = generateTicks(unit('day', 10), civilToJdn(1937, 7, 1), civilToJdn(1937, 7, 31));
    expect(ticks.map((t) => t.day)).toEqual([1, 11, 21]);
  });

  it('aligns BCE year ticks to round BCE numbers', () => {
    // Astronomical -199 = 200 BCE, -99 = 100 BCE; CE ticks at 100, 200.
    const ticks = generateTicks(unit('year', 100), civilToJdn(-300, 6, 1), civilToJdn(250, 1, 1));
    expect(ticks.map((t) => t.year)).toEqual([-299, -199, -99, 100, 200]);
  });

  it('includes a tick exactly on the start or end of the range', () => {
    const jan1 = civilToJdn(1940, 1, 1);
    expect(generateTicks(unit('year', 1), jan1, jan1 + 10).map((t) => t.jdn)).toEqual([jan1]);
  });
});

describe('stepDay', () => {
  it('steps by days, months, and years', () => {
    const d = civilToJdn(1937, 7, 7);
    expect(jdnToCivil(stepDay(d, unit('day', 1), 1))).toEqual({ year: 1937, month: 7, day: 8 });
    expect(jdnToCivil(stepDay(d, unit('month', 1), -1))).toEqual({ year: 1937, month: 6, day: 7 });
    expect(jdnToCivil(stepDay(d, unit('year', 10), 1))).toEqual({ year: 1947, month: 7, day: 7 });
  });

  it('clamps to the end of shorter months', () => {
    const jan31 = civilToJdn(1940, 1, 31);
    expect(jdnToCivil(stepDay(jan31, unit('month', 1), 1))).toEqual({ year: 1940, month: 2, day: 29 });
  });

  it('crosses from BCE to CE correctly', () => {
    // 1 BCE (astronomical 0) plus one year is 1 CE.
    const d = civilToJdn(0, 6, 1);
    expect(jdnToCivil(stepDay(d, unit('year', 1), 1)).year).toBe(1);
  });
});
