// Turns parsed dates into readable English text, such as "7 July 1937", "c. 1932", or
// "221 BCE". Translations will come with the project's translation system; until then this
// module is English-only, and all wording lives here.

import type { HistoricalDate, HistoricalInterval, IntervalEnd } from './edtf.ts';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Formats an astronomical year for display. Years 1000 and later are shown bare ("1937"),
 * years 1–999 get "CE" ("500 CE"), and year 0 and earlier become BCE (0 → "1 BCE",
 * -220 → "221 BCE").
 */
export function formatYear(year: number): string {
  if (year <= 0) return `${1 - year} BCE`;
  if (year < 1000) return `${year} CE`;
  return String(year);
}

function formatYearRange(start: number, end: number, precision: HistoricalDate['precision']): string {
  if (start === end) return formatYear(start);
  if (precision === 'decade' && start > 0) return `${start}s`;
  if (start <= 0 && end <= 0) return `${1 - start}–${1 - end} BCE`;
  return `${formatYear(start)} – ${formatYear(end)}`;
}

export function formatDate(date: HistoricalDate): string {
  let text: string;
  if (date.day !== undefined && date.month !== undefined) {
    text = `${date.day} ${MONTHS[date.month - 1]} ${formatYear(date.yearStart)}`;
  } else if (date.month !== undefined) {
    text = `${MONTHS[date.month - 1]} ${formatYear(date.yearStart)}`;
  } else {
    text = formatYearRange(date.yearStart, date.yearEnd, date.precision);
  }
  if (date.approximate) text = `c. ${text}`;
  if (date.uncertain) text = `${text}?`;
  return text;
}

function formatEnd(end: IntervalEnd, which: 'start' | 'end'): string {
  if (end.kind === 'date') return formatDate(end);
  if (end.kind === 'open') return which === 'start' ? 'before' : 'onwards';
  return 'unknown';
}

export function formatInterval(interval: HistoricalInterval): string {
  const { start, end } = interval;
  if (start.kind === 'open') return `until ${formatEnd(end, 'end')}`;
  if (end.kind === 'open') return `${formatEnd(start, 'start')} onwards`;
  return `${formatEnd(start, 'start')} – ${formatEnd(end, 'end')}`;
}
