// The timeline's arithmetic, kept free of any browser code so it can be tested on its own.
//
// Time is measured in Julian Day Numbers (see src/dates). The timeline's position is a
// fractional day number: day N covers positions [N, N+1), so the selected day is
// Math.floor(position).

import { civilToJdn, daysInMonth, jdnToCivil } from '../dates/index.ts';

export type TickKind = 'day' | 'month' | 'year';

export interface TickUnit {
  kind: TickKind;
  /** How many days, months, or years between ticks. */
  step: number;
  /** Average length of one step, in days, used to choose a unit for the zoom level. */
  approxDays: number;
}

export interface Tick {
  jdn: number;
  kind: TickKind;
  /** Astronomical year, month (1–12), and day of the tick, for labelling. */
  year: number;
  month: number;
  day: number;
}

const DAYS_PER_YEAR = 365.2425; // average Gregorian year
const DAYS_PER_MONTH = DAYS_PER_YEAR / 12;

/** Tick spacings from finest to coarsest. */
export const TICK_UNITS: readonly TickUnit[] = [
  ...[1, 2, 5, 10, 15].map((step) => ({ kind: 'day' as const, step, approxDays: step })),
  ...[1, 3, 6].map((step) => ({ kind: 'month' as const, step, approxDays: step * DAYS_PER_MONTH })),
  ...[1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000].map((step) => ({
    kind: 'year' as const,
    step,
    approxDays: step * DAYS_PER_YEAR,
  })),
];

/** Picks the finest tick unit whose ticks are at least `minSpacingPx` apart. */
export function chooseTickUnit(daysPerPixel: number, minSpacingPx: number): TickUnit {
  for (const unit of TICK_UNITS) {
    if (unit.approxDays / daysPerPixel >= minSpacingPx) return unit;
  }
  return TICK_UNITS[TICK_UNITS.length - 1];
}

/** Floor-style remainder that stays non-negative for negative numbers. */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Whether a year gets a tick for a given step. CE years align to round numbers (100, 200). BCE
 * years align to round BCE numbers (100 BCE, 200 BCE), which are astronomical years -99, -199.
 */
function isYearTick(year: number, step: number): boolean {
  return year >= 1 ? year % step === 0 : mod(1 - year, step) === 0;
}

/** Days of the month that get a tick for a multi-day step, e.g. step 5 → 1, 6, 11, 16, 21, 26. */
function dayTicksInMonth(year: number, month: number, step: number): number[] {
  const last = daysInMonth(year, month);
  const days: number[] = [];
  // Skip a tick that would sit too close to the next month's day 1.
  for (let d = 1; d <= last && (d === 1 || d + step / 2 <= last + 1); d += step) days.push(d);
  return days;
}

/** All ticks of `unit` between two day numbers (inclusive), aligned to calendar boundaries. */
export function generateTicks(unit: TickUnit, fromJdn: number, toJdn: number): Tick[] {
  const ticks: Tick[] = [];
  const start = jdnToCivil(Math.floor(fromJdn));
  const end = jdnToCivil(Math.ceil(toJdn));

  if (unit.kind === 'year') {
    for (let year = start.year; year <= end.year + 1; year++) {
      if (!isYearTick(year, unit.step)) continue;
      const jdn = civilToJdn(year, 1, 1);
      if (jdn >= fromJdn && jdn <= toJdn) ticks.push({ jdn, kind: 'year', year, month: 1, day: 1 });
    }
    return ticks;
  }

  // Walk month by month, counting months as one continuous number so steps align across years.
  const firstMonth = start.year * 12 + (start.month - 1);
  const lastMonth = end.year * 12 + (end.month - 1);
  for (let m = firstMonth; m <= lastMonth; m++) {
    const year = Math.floor(m / 12);
    const month = mod(m, 12) + 1;
    let days: number[];
    if (unit.kind === 'month') days = mod(m, unit.step) === 0 ? [1] : [];
    else days = dayTicksInMonth(year, month, unit.step);
    for (const day of days) {
      const jdn = civilToJdn(year, month, day);
      if (jdn >= fromJdn && jdn <= toJdn) ticks.push({ jdn, kind: unit.kind, year, month, day });
    }
  }
  return ticks;
}

/**
 * Moves a day by whole calendar units, e.g. one month from 31 January lands on 28 or 29
 * February. Used for keyboard stepping, so each key press moves by one tick unit.
 */
export function stepDay(jdn: number, unit: TickUnit, direction: number): number {
  if (unit.kind === 'day') return jdn + unit.step * direction;
  const { year, month, day } = jdnToCivil(jdn);
  let totalMonths = year * 12 + (month - 1);
  totalMonths += (unit.kind === 'month' ? unit.step : unit.step * 12) * direction;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = mod(totalMonths, 12) + 1;
  return civilToJdn(newYear, newMonth, Math.min(day, daysInMonth(newYear, newMonth)));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
