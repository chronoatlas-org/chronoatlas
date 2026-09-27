// Turns dates into readable text, such as "7 July 1937", "c. 1932", or "221 BCE". All wording
// (month names, "BCE", word order) comes from the translation catalogs in src/i18n, so other
// languages only need a catalog.
//
// Never format historical dates with the browser's Intl date formatter: before 1582 it switches
// to the Julian calendar, which would silently shift our (proleptic Gregorian) dates.

import { t } from '../i18n/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import type { HistoricalDate, HistoricalInterval, IntervalEnd } from './edtf.ts';
import { jdnToCivil } from './jdn.ts';

export function monthName(month: number): string {
  return t(`date.month.${month}` as MessageKey);
}

export function monthShortName(month: number): string {
  return t(`date.monthShort.${month}` as MessageKey);
}

/**
 * Formats an astronomical year for display. Years 1000 and later are shown bare ("1937"),
 * years 1–999 get "CE" ("500 CE"), and year 0 and earlier become BCE (0 → "1 BCE",
 * -220 → "221 BCE").
 */
export function formatYear(year: number): string {
  if (year <= 0) return t('date.yearBce', { year: 1 - year });
  if (year < 1000) return t('date.yearCe', { year });
  return String(year);
}

function formatYearRange(start: number, end: number, precision: HistoricalDate['precision']): string {
  if (start === end) return formatYear(start);
  if (precision === 'decade' && start > 0) return t('date.decade', { year: start });
  if (start <= 0 && end <= 0) return t('date.yearRangeBce', { start: 1 - start, end: 1 - end });
  return t('date.yearRange', { start: formatYear(start), end: formatYear(end) });
}

function formatDayMonthYear(day: number, month: number, year: number): string {
  return t('date.dayMonthYear', { day, month: monthName(month), year: formatYear(year) });
}

/** Formats a single day, given as a Julian Day Number, e.g. "7 July 1937". */
export function formatDay(jdn: number): string {
  const { year, month, day } = jdnToCivil(jdn);
  return formatDayMonthYear(day, month, year);
}

export function formatDate(date: HistoricalDate): string {
  let text: string;
  if (date.day !== undefined && date.month !== undefined) {
    text = formatDayMonthYear(date.day, date.month, date.yearStart);
  } else if (date.month !== undefined) {
    text = t('date.monthYear', { month: monthName(date.month), year: formatYear(date.yearStart) });
  } else {
    text = formatYearRange(date.yearStart, date.yearEnd, date.precision);
  }
  if (date.approximate) text = t('date.approximate', { date: text });
  if (date.uncertain) text = t('date.uncertain', { date: text });
  return text;
}

function formatEnd(end: IntervalEnd): string {
  return end.kind === 'date' ? formatDate(end) : t('date.unknown');
}

export function formatInterval(interval: HistoricalInterval): string {
  const { start, end } = interval;
  if (start.kind === 'open') return t('date.intervalUntil', { end: formatEnd(end) });
  if (end.kind === 'open') return t('date.intervalOnwards', { start: formatEnd(start) });
  return t('date.interval', { start: formatEnd(start), end: formatEnd(end) });
}
