import { describe, expect, it } from 'vitest';
import { parseEdtfDate, parseEdtfInterval } from './edtf.ts';
import { formatDate, formatDay, formatInterval, formatYear } from './format.ts';
import { civilToJdn } from './jdn.ts';

const show = (edtf: string) => formatDate(parseEdtfDate(edtf));

describe('formatYear', () => {
  it('converts astronomical years to BCE/CE labels', () => {
    expect(formatYear(1937)).toBe('1937');
    expect(formatYear(1000)).toBe('1000');
    expect(formatYear(500)).toBe('500 CE');
    expect(formatYear(1)).toBe('1 CE');
    expect(formatYear(0)).toBe('1 BCE');
    expect(formatYear(-220)).toBe('221 BCE');
  });
});

describe('formatDate', () => {
  it('shows day, month, and year precision', () => {
    expect(show('1985-04-12')).toBe('12 April 1985');
    expect(show('1985-04')).toBe('April 1985');
    expect(show('1985')).toBe('1985');
    expect(show('-0220-03-15')).toBe('15 March 221 BCE');
  });

  it('marks approximate and uncertain dates', () => {
    expect(show('1932~')).toBe('c. 1932');
    expect(show('1984?')).toBe('1984?');
    expect(show('2004-06-11%')).toBe('c. 11 June 2004?');
  });

  it('shows year ranges from unspecified digits', () => {
    expect(show('193X')).toBe('1930s');
    expect(show('19XX')).toBe('1900 – 1999');
    expect(show('-02XX')).toBe('300–201 BCE');
  });

  it('shows a date with a time of day as its day, and "one of a set" as its range', () => {
    expect(show('2004-01-01T10:10:10+05:00')).toBe('1 January 2004');
    expect(show('[1760-12-03..1760-12-05]')).toBe('3 December 1760 to 5 December 1760, not known which');
    expect(show('[1667,1668,1670..1672]')).toBe('1667 to 1672, not known which');
    expect(show('[1760-12-03]')).toBe('3 December 1760');
  });
});

describe('formatDay', () => {
  it('formats a Julian Day Number as a full date', () => {
    expect(formatDay(civilToJdn(1985, 4, 12))).toBe('12 April 1985');
    expect(formatDay(civilToJdn(-220, 3, 15))).toBe('15 March 221 BCE');
  });
});

describe('formatInterval', () => {
  it('formats closed, open, and unknown ends', () => {
    expect(formatInterval(parseEdtfInterval('1937-07/1938-10'))).toBe('July 1937 – October 1938');
    expect(formatInterval(parseEdtfInterval('1985/..'))).toBe('1985 onwards');
    expect(formatInterval(parseEdtfInterval('../1985'))).toBe('until 1985');
    expect(formatInterval(parseEdtfInterval('1985/'))).toBe('1985 – unknown');
  });
});
