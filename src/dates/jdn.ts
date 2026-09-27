// Calendar arithmetic on Julian Day Numbers (JDN).
//
// A Julian Day Number counts whole days in one unbroken sequence, so any two dates can be
// compared or subtracted as plain integers, including BCE dates. Day 0 is 24 November 4714 BCE
// in the proleptic Gregorian calendar, and day 2,451,545 is 1 January 2000.
//
// Conventions (see docs/architecture.md#dates):
// - Years use astronomical numbering, as in ISO 8601: year 0 = 1 BCE, year -1 = 2 BCE, and so on.
// - Dates use the proleptic Gregorian calendar (the Gregorian rules extended backwards before
//   1582). Dates recorded in other calendars must be converted before they go in the data.
//
// We deliberately don't use JavaScript's `Date` here. Its API is built around times of day and
// time zones, and date-formatting libraries built on it often switch silently to the Julian
// calendar before 1582.
//
// The algorithms follow Howard Hinnant's "chrono-Compatible Low-Level Date Algorithms"
// (https://howardhinnant.github.io/date_algorithms.html). They count in 400-year cycles
// ("eras") that start on 1 March, which puts the leap day at the end of each counting year.

export interface CivilDate {
  /** Astronomical year: 0 = 1 BCE, -1 = 2 BCE. */
  year: number;
  /** 1 = January … 12 = December. */
  month: number;
  /** 1–31. */
  day: number;
}

/** Days in one 400-year Gregorian cycle. */
const DAYS_PER_ERA = 146097;
/** JDN of 1 March in year 0, the start of the era the algorithm counts from. */
const JDN_OF_ERA_ZERO = 1721120;

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Converts a proleptic Gregorian date to its Julian Day Number. */
export function civilToJdn(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year; // January and February count as the previous year
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400; // 0–399
  const monthFromMarch = (month + 9) % 12; // March = 0 … February = 11
  const dayOfYear = Math.floor((153 * monthFromMarch + 2) / 5) + day - 1; // 0–365
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * DAYS_PER_ERA + dayOfEra + JDN_OF_ERA_ZERO;
}

/** Converts a Julian Day Number to its proleptic Gregorian date. */
export function jdnToCivil(jdn: number): CivilDate {
  const z = jdn - JDN_OF_ERA_ZERO;
  const era = Math.floor(z / DAYS_PER_ERA);
  const dayOfEra = z - era * DAYS_PER_ERA; // 0–146096
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) /
      365,
  ); // 0–399
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthFromMarch = Math.floor((5 * dayOfYear + 2) / 153); // 0–11
  const day = dayOfYear - Math.floor((153 * monthFromMarch + 2) / 5) + 1;
  const month = monthFromMarch < 10 ? monthFromMarch + 3 : monthFromMarch - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

/** First and last day (JDN, inclusive) of a range of whole years. */
export function yearsToJdnRange(firstYear: number, lastYear: number): [number, number] {
  return [civilToJdn(firstYear, 1, 1), civilToJdn(lastYear, 12, 31)];
}
