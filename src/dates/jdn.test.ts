import { describe, expect, it } from 'vitest';
import { civilToJdn, daysInMonth, isLeapYear, jdnToCivil } from './jdn.ts';

// An independent cross-check. JavaScript's Date implements the proleptic Gregorian calendar
// with astronomical year numbering (ECMAScript spec, "Time Values and Time Range"). We never use
// it in the app, but it's a good referee for our own arithmetic in tests.
function jdnViaJsDate(year: number, month: number, day: number): number {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day); // unlike Date.UTC, handles years 0–99 correctly
  return Math.round(d.getTime() / 86_400_000) + 2440588; // 2440588 = JDN of 1970-01-01
}

describe('civilToJdn', () => {
  // Reference values from https://en.wikipedia.org/wiki/Julian_day (retrieved 2026-09-27):
  // JDN 2451545 is 1 January 2000, and JDN 0 is 24 November 4714 BC in the proleptic
  // Gregorian calendar, which is astronomical year -4713.
  it('matches documented reference days', () => {
    expect(civilToJdn(2000, 1, 1)).toBe(2451545);
    expect(civilToJdn(-4713, 11, 24)).toBe(0);
  });

  it('agrees with JavaScript Date across 40,000 years', () => {
    for (let year = -20000; year <= 20000; year += 37) {
      for (let month = 1; month <= 12; month++) {
        for (const day of [1, 15, daysInMonth(year, month)]) {
          expect(civilToJdn(year, month, day), `${year}-${month}-${day}`).toBe(
            jdnViaJsDate(year, month, day),
          );
        }
      }
    }
  });
});

describe('jdnToCivil', () => {
  it('is the exact inverse of civilToJdn for every day from 5000 BCE to 3000 CE', () => {
    const first = civilToJdn(-5000, 1, 1);
    const last = civilToJdn(3000, 12, 31);
    let previous = jdnToCivil(first - 1);
    for (let jdn = first; jdn <= last; jdn++) {
      const date = jdnToCivil(jdn);
      // Round trip back to the same day number.
      if (civilToJdn(date.year, date.month, date.day) !== jdn) {
        throw new Error(`round trip failed at JDN ${jdn}: ${JSON.stringify(date)}`);
      }
      // Consecutive day numbers are consecutive calendar days.
      const nextDay = previous.day === daysInMonth(previous.year, previous.month);
      const expected = nextDay
        ? previous.month === 12
          ? { year: previous.year + 1, month: 1, day: 1 }
          : { year: previous.year, month: previous.month + 1, day: 1 }
        : { year: previous.year, month: previous.month, day: previous.day + 1 };
      if (date.year !== expected.year || date.month !== expected.month || date.day !== expected.day) {
        throw new Error(`JDN ${jdn} is ${JSON.stringify(date)}, expected ${JSON.stringify(expected)}`);
      }
      previous = date;
    }
  });

  it('handles very large and very small years', () => {
    for (const year of [-170000002, -1000000, 1000000, 170000002]) {
      const jdn = civilToJdn(year, 3, 1);
      expect(jdnToCivil(jdn)).toEqual({ year, month: 3, day: 1 });
    }
  });
});

describe('isLeapYear (Gregorian rules, astronomical years)', () => {
  it('follows the divisible-by-4, except-100, except-400 rule', () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2023)).toBe(false);
  });

  it('applies the same rule to year 0 and negative years', () => {
    expect(isLeapYear(0)).toBe(true); // divisible by 400
    expect(isLeapYear(-4)).toBe(true);
    expect(isLeapYear(-100)).toBe(false);
    expect(isLeapYear(-400)).toBe(true);
    expect(isLeapYear(-1)).toBe(false);
  });
});

describe('daysInMonth', () => {
  it('gives February 29 days only in leap years', () => {
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
  });

  it('knows the 30-day months', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => daysInMonth(2023, m))).toEqual([
      31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ]);
  });
});
