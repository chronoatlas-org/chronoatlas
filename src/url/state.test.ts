import { describe, expect, it } from 'vitest';
import { civilToJdn } from '../dates/index.ts';
import { formatDayForUrl, formatHash, parseHash } from './state.ts';

describe('formatDayForUrl', () => {
  it('writes CE and BCE days as EDTF', () => {
    expect(formatDayForUrl(civilToJdn(1937, 7, 1))).toBe('1937-07-01');
    expect(formatDayForUrl(civilToJdn(-220, 3, 15))).toBe('-0220-03-15');
    expect(formatDayForUrl(civilToJdn(0, 1, 1))).toBe('0000-01-01');
    expect(formatDayForUrl(civilToJdn(476, 9, 4))).toBe('0476-09-04');
  });
});

describe('formatHash / parseHash', () => {
  it('round-trips a view', () => {
    const view = { day: civilToJdn(1937, 7, 1), zoom: 4.5, lat: 38.2, lng: 118.9 };
    const hash = formatHash(view);
    expect(hash).toBe('#d=1937-07-01&m=4.5/38.2/118.9');
    expect(parseHash(hash)).toEqual(view);
  });

  it('round-trips BCE days and keeps an explicit language', () => {
    const view = { day: civilToJdn(-9999, 1, 1), zoom: 2, lat: 0, lng: 0, lang: 'ja' };
    expect(parseHash(formatHash(view))).toEqual(view);
  });

  it('round-trips a selected territory, placed before the language', () => {
    const view = { day: civilToJdn(1901, 5, 12), zoom: 4.5, lat: 10, lng: 20, sel: 'testland-north', lang: 'ja' };
    const hash = formatHash(view);
    expect(hash).toBe('#d=1901-05-12&m=4.5/10/20&sel=testland-north&lang=ja');
    expect(parseHash(hash)).toEqual(view);
  });

  it('rounds coordinates to about 11 m and drops trailing zeros', () => {
    expect(formatHash({ day: civilToJdn(2000, 1, 1), zoom: 3.14159, lat: 35.123456, lng: -0.00004 })).toBe(
      '#d=2000-01-01&m=3.14/35.1235/0',
    );
  });
});

describe('parseHash with incomplete or damaged links', () => {
  it('opens a month or year link on its first day', () => {
    expect(parseHash('#d=1937-07').day).toBe(civilToJdn(1937, 7, 1));
    expect(parseHash('#d=1937').day).toBe(civilToJdn(1937, 1, 1));
  });

  it('ignores parts it cannot read, keeping the rest', () => {
    expect(parseHash('#d=not-a-date&m=4/38/118')).toEqual({ zoom: 4, lat: 38, lng: 118 });
    expect(parseHash('#d=1937-07-01&m=4/95/118')).toEqual({ day: civilToJdn(1937, 7, 1) }); // latitude > 90
    expect(parseHash('#m=4/38')).toEqual({});
    expect(parseHash('#lang=<script>')).toEqual({});
    expect(parseHash('')).toEqual({});
  });

  it('round-trips a selected event', () => {
    const view = { day: civilToJdn(1901, 5, 12), zoom: 3, lat: 10, lng: 20, ev: 'testland-treaty' };
    expect(formatHash(view)).toBe('#d=1901-05-12&m=3/10/20&ev=testland-treaty');
    expect(parseHash(formatHash(view))).toEqual(view);
    expect(parseHash('#ev=Not_An_Id').ev).toBeUndefined();
  });

  it('records the legally recognized view, and ignores any other view', () => {
    const view = { day: civilToJdn(1901, 5, 12), zoom: 3, lat: 10, lng: 20, sel: 'testland', view: 'jure' as const };
    expect(formatHash(view)).toBe('#d=1901-05-12&m=3/10/20&sel=testland&v=jure');
    expect(parseHash(formatHash(view))).toEqual(view);
    expect(parseHash('#v=something').view).toBeUndefined();
  });

  it('only accepts selections shaped like our IDs', () => {
    expect(parseHash('#sel=testland').sel).toBe('testland');
    for (const bad of ['Testland', 'test_land', '-testland', 'testland-', 'a--b', '%3Cscript%3E', 'x'.repeat(101)]) {
      expect(parseHash(`#sel=${bad}`).sel, bad).toBeUndefined();
    }
  });

  it('wraps longitudes into -180…180', () => {
    expect(parseHash('#m=3/10/370').lng).toBe(10);
    expect(parseHash('#m=3/10/-190').lng).toBe(170);
  });
});
