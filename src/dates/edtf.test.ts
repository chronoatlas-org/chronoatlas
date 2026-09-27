// Most examples below are the syntax examples from the EDTF specification
// (https://www.loc.gov/standards/datetime/). They test the format, not historical facts.

import { describe, expect, it } from 'vitest';
import { EdtfError, parseEdtf, parseEdtfDate, parseEdtfInterval } from './edtf.ts';
import type { HistoricalDate } from './edtf.ts';
import { civilToJdn } from './jdn.ts';

/** Number of days a parsed date covers. */
const span = (d: HistoricalDate) => d.latest - d.earliest + 1;

describe('parseEdtfDate: level 0', () => {
  it('parses a complete date as a single day', () => {
    const d = parseEdtfDate('1985-04-12');
    expect(d).toMatchObject({ precision: 'day', yearStart: 1985, month: 4, day: 12 });
    expect(d.earliest).toBe(civilToJdn(1985, 4, 12));
    expect(span(d)).toBe(1);
  });

  it('parses a year and month as every day of that month', () => {
    const d = parseEdtfDate('1985-04');
    expect(d).toMatchObject({ precision: 'month', month: 4 });
    expect(d.earliest).toBe(civilToJdn(1985, 4, 1));
    expect(d.latest).toBe(civilToJdn(1985, 4, 30));
  });

  it('parses a year as every day of that year', () => {
    expect(span(parseEdtfDate('1985'))).toBe(365);
    expect(span(parseEdtfDate('2000'))).toBe(366); // leap year
  });

  it('accepts 29 February only in leap years', () => {
    expect(parseEdtfDate('2000-02-29').precision).toBe('day');
    expect(() => parseEdtfDate('1900-02-29')).toThrow(EdtfError);
  });
});

describe('parseEdtfDate: BCE years (astronomical numbering)', () => {
  it('treats 0000 as a valid year (1 BCE)', () => {
    const d = parseEdtfDate('0000');
    expect(d.yearStart).toBe(0);
    expect(span(d)).toBe(366); // year 0 is a Gregorian leap year
  });

  it('parses negative years', () => {
    const d = parseEdtfDate('-1985');
    expect(d.yearStart).toBe(-1985);
    expect(d.earliest).toBe(civilToJdn(-1985, 1, 1));
  });

  it('parses negative years with a month and day', () => {
    expect(parseEdtfDate('-0220-03-15').earliest).toBe(civilToJdn(-220, 3, 15));
  });

  it('rejects "-0000"', () => {
    expect(() => parseEdtfDate('-0000')).toThrow(/write 0000/);
  });
});

describe('parseEdtfDate: level 1', () => {
  it('parses Y-prefixed years beyond four digits', () => {
    expect(parseEdtfDate('Y170000002').yearStart).toBe(170000002);
    expect(parseEdtfDate('Y-170000002').yearStart).toBe(-170000002);
    expect(() => parseEdtfDate('Y170000002-01')).toThrow(EdtfError);
  });

  it('records uncertain (?), approximate (~), and both (%)', () => {
    expect(parseEdtfDate('1984?')).toMatchObject({ uncertain: true, approximate: false });
    expect(parseEdtfDate('2004-06~')).toMatchObject({ uncertain: false, approximate: true });
    expect(parseEdtfDate('2004-06-11%')).toMatchObject({ uncertain: true, approximate: true });
  });

  it('does not widen the range for approximate dates', () => {
    expect(span(parseEdtfDate('1932~'))).toBe(span(parseEdtfDate('1932')));
  });

  it('turns unspecified year digits into decades, centuries, and millennia', () => {
    expect(parseEdtfDate('201X')).toMatchObject({ precision: 'decade', yearStart: 2010, yearEnd: 2019 });
    expect(parseEdtfDate('20XX')).toMatchObject({ precision: 'century', yearStart: 2000, yearEnd: 2099 });
    expect(parseEdtfDate('1XXX')).toMatchObject({ precision: 'millennium', yearStart: 1000, yearEnd: 1999 });
  });

  it('counts unspecified digits backwards for BCE years', () => {
    expect(parseEdtfDate('-02XX')).toMatchObject({ yearStart: -299, yearEnd: -200 });
  });

  it('treats an unspecified month or day as year or month precision', () => {
    const yearOnly = parseEdtfDate('2004-XX');
    expect(yearOnly.precision).toBe('year');
    expect(yearOnly.month).toBeUndefined();
    const d = parseEdtfDate('1985-04-XX');
    expect(d).toMatchObject({ precision: 'month', month: 4 });
    expect(d.day).toBeUndefined();
    expect(span(d)).toBe(30);
  });
});

describe('parseEdtfDate: invalid input', () => {
  const invalid: [string, RegExp][] = [
    ['', /expected a form/],
    ['85', /expected a form/],
    ['1985-4-12', /expected a form/],
    ['19X5', /expected a form/], // X only allowed from the right
    ['XXXX', /expected a form/],
    ['1985-13', /month 13 does not exist/],
    ['1985-02-30', /day 30 does not exist/],
    ['2001-21', /seasons are not supported/],
    ['1985-04-12T10:00', /times of day are not supported/],
    ['198X-04', /cannot have a month or day/],
    ['1985-XX-12', /a day needs a known month/],
    ['1985/1986', /interval, not a single date/],
  ];
  it.each(invalid)('rejects %j', (input, message) => {
    expect(() => parseEdtfDate(input)).toThrow(message);
  });
});

describe('parseEdtfInterval', () => {
  it('parses intervals at year, month, and day precision', () => {
    const i = parseEdtfInterval('2004-02-01/2005-02-08');
    expect(i.start).toMatchObject({ kind: 'date', precision: 'day', yearStart: 2004 });
    expect(i.end).toMatchObject({ kind: 'date', precision: 'day', yearStart: 2005 });
    expect(parseEdtfInterval('1964/2008').end).toMatchObject({ precision: 'year' });
    expect(parseEdtfInterval('2004-06/2006-08').start).toMatchObject({ precision: 'month' });
  });

  it('parses open ("..") and unknown (empty) ends', () => {
    expect(parseEdtfInterval('1985-04-12/..').end).toEqual({ kind: 'open' });
    expect(parseEdtfInterval('../1985-04-12').start).toEqual({ kind: 'open' });
    expect(parseEdtfInterval('1985-04-12/').end).toEqual({ kind: 'unknown' });
    expect(parseEdtfInterval('/1985-04-12').start).toEqual({ kind: 'unknown' });
  });

  it('allows the two ends to overlap when their precision differs', () => {
    expect(() => parseEdtfInterval('1937/1937-07')).not.toThrow();
  });

  it('rejects intervals that end before they start, or have no dates', () => {
    expect(() => parseEdtfInterval('1986/1985')).toThrow(/ends before it starts/);
    expect(() => parseEdtfInterval('../..')).toThrow(/at least one end/);
    expect(() => parseEdtfInterval('/')).toThrow(/at least one end/);
    expect(() => parseEdtfInterval('1985/1986/1987')).toThrow(/exactly one/);
  });
});

describe('parseEdtf', () => {
  it('returns a date or an interval depending on the input', () => {
    expect(parseEdtf('1985').kind).toBe('date');
    expect(parseEdtf('1985/1986').kind).toBe('interval');
  });
});
