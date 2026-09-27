// Parses dates written in EDTF (Extended Date/Time Format, https://www.loc.gov/standards/datetime/),
// the format used in our data files, into ranges of Julian Day Numbers.
//
// Every date becomes a range from the first to the last day it could mean, so mixed precision is
// handled uniformly: "1937-07-07" is one day, "1937-07" is 31 days, and "193X" is ten years.
//
// Supported (EDTF level 0 plus most of level 1):
//   1985-04-12   1985-04   1985            day, month, or year
//   -0220        0000                      BCE years (astronomical: 0000 = 1 BCE, -0220 = 221 BCE)
//   Y170000002   Y-170000002               years beyond four digits
//   1984?  2004-06~  2004-06-11%           uncertain (?), approximate (~), both (%)
//   201X   20XX   2004-XX   1985-04-XX     unspecified digits, from the right only
//   1964/2008   1985-04-12/..   /1985      intervals, with open (..) or unknown (empty) ends
//
// Not supported yet, and rejected with a clear error:
//   - Seasons (2001-21). Level 1 doesn't define which months a season covers or which hemisphere
//     it refers to. Use a month interval such as 1938-03/1938-05.
//   - Times of day (1985-04-12T10:00). Historical dates in this project are whole days.
//   - Level 2 features (qualifiers on single components, sets, and so on).
//
// "Approximate" and "uncertain" are recorded as flags. They do NOT widen the range, because EDTF
// doesn't say by how much. Whoever displays the date decides how to show the flag.

import { civilToJdn, daysInMonth, yearsToJdnRange } from './jdn.ts';

export type DatePrecision = 'day' | 'month' | 'year' | 'decade' | 'century' | 'millennium';

export interface HistoricalDate {
  kind: 'date';
  /** The EDTF text this was parsed from. */
  edtf: string;
  /** First possible day, as a Julian Day Number (inclusive). */
  earliest: number;
  /** Last possible day, as a Julian Day Number (inclusive). */
  latest: number;
  precision: DatePrecision;
  /** Marked with ? or % in EDTF: the source isn't sure of this date. */
  uncertain: boolean;
  /** Marked with ~ or % in EDTF: the date is "circa". */
  approximate: boolean;
  /** Range of astronomical years covered (equal, unless digits were unspecified). */
  yearStart: number;
  yearEnd: number;
  /** Present only when the month is known. */
  month?: number;
  /** Present only when the day is known. */
  day?: number;
}

/** An interval end that EDTF marks as open ("..", continues indefinitely). */
export interface OpenEnd {
  kind: 'open';
}

/** An interval end that EDTF leaves empty (exists, but the date is unknown). */
export interface UnknownEnd {
  kind: 'unknown';
}

export type IntervalEnd = HistoricalDate | OpenEnd | UnknownEnd;

export interface HistoricalInterval {
  kind: 'interval';
  edtf: string;
  start: IntervalEnd;
  end: IntervalEnd;
}

export class EdtfError extends Error {
  readonly input: string;

  constructor(input: string, reason: string) {
    super(`Invalid date "${input}": ${reason}`);
    this.name = 'EdtfError';
    this.input = input;
  }
}

// Year: optional minus, four characters of digits followed by any trailing X (1985, 198X, 19XX,
// 1XXX), or a Y-prefixed year of five or more digits. Then an optional month and day (digits or
// XX), then an optional qualifier.
const DATE_PATTERN =
  /^(?:Y(?<bigYear>-?\d{5,})|(?<sign>-?)(?<year>\d{4}|\d{3}X|\d{2}XX|\dXXX))(?:-(?<month>\d{2}|XX))?(?:-(?<day>\d{2}|XX))?(?<qualifier>[?~%])?$/;

const PRECISION_BY_UNSPECIFIED_YEAR_DIGITS: DatePrecision[] = [
  'year',
  'decade',
  'century',
  'millennium',
];

/** Parses a single EDTF date (not an interval). Throws EdtfError if the text isn't valid. */
export function parseEdtfDate(text: string): HistoricalDate {
  if (text.includes('/')) throw new EdtfError(text, 'this is an interval, not a single date');
  if (text.includes('T')) {
    throw new EdtfError(text, 'times of day are not supported; give the date only (YYYY-MM-DD)');
  }

  const match = DATE_PATTERN.exec(text);
  if (!match?.groups) {
    const season = /^-?\d{4}-(2[1-4])/.exec(text);
    if (season) {
      throw new EdtfError(
        text,
        'seasons are not supported (EDTF level 1 does not define their months or hemisphere); ' +
          'use a month interval instead, such as 1938-03/1938-05',
      );
    }
    throw new EdtfError(text, 'expected a form like 1937-07-07, 1937-07, 1937, -0220, or 193X');
  }

  const { bigYear, sign, year, month, day, qualifier } = match.groups;
  const uncertain = qualifier === '?' || qualifier === '%';
  const approximate = qualifier === '~' || qualifier === '%';

  // Letter-prefixed years (Y170000002) are year-only in EDTF level 1.
  if (bigYear !== undefined) {
    if (month !== undefined || day !== undefined) {
      throw new EdtfError(text, 'a Y-prefixed year cannot have a month or day');
    }
    const y = Number(bigYear);
    const [earliest, latest] = yearsToJdnRange(y, y);
    return {
      kind: 'date',
      edtf: text,
      earliest,
      latest,
      precision: 'year',
      uncertain,
      approximate,
      yearStart: y,
      yearEnd: y,
    };
  }

  const unspecifiedDigits = (year.match(/X/g) ?? []).length;
  if (sign === '-' && /^0+$/.test(year)) {
    throw new EdtfError(text, '"-0000" is not a valid year; write 0000');
  }

  if (unspecifiedDigits > 0) {
    if (month !== undefined || day !== undefined) {
      throw new EdtfError(text, 'a year with unspecified digits (X) cannot have a month or day');
    }
    const low = Number(year.replace(/X/g, '0'));
    const high = Number(year.replace(/X/g, '9'));
    // For BCE years the digits count backwards, so -19XX covers -1999 to -1900.
    const [yearStart, yearEnd] = sign === '-' ? [-high, -low] : [low, high];
    const [earliest, latest] = yearsToJdnRange(yearStart, yearEnd);
    const precision = PRECISION_BY_UNSPECIFIED_YEAR_DIGITS[unspecifiedDigits];
    return {
      kind: 'date',
      edtf: text,
      earliest,
      latest,
      precision,
      uncertain,
      approximate,
      yearStart,
      yearEnd,
    };
  }

  const y = Number(sign + year);
  const base = { kind: 'date' as const, edtf: text, uncertain, approximate, yearStart: y, yearEnd: y };

  if (month === undefined || month === 'XX') {
    if (day !== undefined && day !== 'XX') throw new EdtfError(text, 'a day needs a known month');
    const [earliest, latest] = yearsToJdnRange(y, y);
    return { ...base, earliest, latest, precision: 'year' };
  }

  const m = Number(month);
  if (m >= 21 && m <= 24) {
    throw new EdtfError(
      text,
      'seasons are not supported (EDTF level 1 does not define their months or hemisphere); ' +
        'use a month interval instead, such as 1938-03/1938-05',
    );
  }
  if (m < 1 || m > 12) throw new EdtfError(text, `month ${month} does not exist`);

  if (day === undefined || day === 'XX') {
    const earliest = civilToJdn(y, m, 1);
    const latest = civilToJdn(y, m, daysInMonth(y, m));
    return { ...base, earliest, latest, precision: 'month', month: m };
  }

  const d = Number(day);
  if (d < 1 || d > daysInMonth(y, m)) {
    throw new EdtfError(text, `day ${day} does not exist in that month (proleptic Gregorian calendar)`);
  }
  const jdn = civilToJdn(y, m, d);
  return { ...base, earliest: jdn, latest: jdn, precision: 'day', month: m, day: d };
}

/** Parses an EDTF interval such as "1937-07/1938-10" or "1945-08-17/..". */
export function parseEdtfInterval(text: string): HistoricalInterval {
  const parts = text.split('/');
  if (parts.length !== 2) throw new EdtfError(text, 'an interval has exactly one "/"');

  const parseEnd = (part: string): IntervalEnd => {
    if (part === '..') return { kind: 'open' };
    if (part === '') return { kind: 'unknown' };
    return parseEdtfDate(part);
  };
  const start = parseEnd(parts[0]);
  const end = parseEnd(parts[1]);

  if (start.kind !== 'date' && end.kind !== 'date') {
    throw new EdtfError(text, 'at least one end of an interval must be a date');
  }
  if (start.kind === 'date' && end.kind === 'date' && start.earliest > end.latest) {
    throw new EdtfError(text, 'the interval ends before it starts');
  }
  return { kind: 'interval', edtf: text, start, end };
}

/** Parses either a single EDTF date or an interval. */
export function parseEdtf(text: string): HistoricalDate | HistoricalInterval {
  return text.includes('/') ? parseEdtfInterval(text) : parseEdtfDate(text);
}
