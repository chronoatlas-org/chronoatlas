// Timeline event tests use made-up events (Testland), not real ones.

import { describe, expect, it } from 'vitest';
import { civilToJdn } from '../dates/index.ts';
import { adjacentEvent, eventDays, eventNear, eventsInView, eventsOnDay, minImportance } from './events.ts';
import type { TimelineEvent } from './events.ts';

const day = (y: number, m: number, d: number) => civilToJdn(y, m, d);

const events: TimelineEvent[] = [
  { id: 'founding-of-testland', title: 'Founding of Testland', s0: day(1901, 5, 12), s1: day(1901, 5, 12), importance: 5 },
  { id: 'testland-fair', title: 'Testland fair', s0: day(1901, 6, 1), s1: day(1901, 6, 30), importance: 1 },
  { id: 'testland-treaty', title: 'Treaty of Testland', s0: day(1903, 1, 1), s1: day(1903, 12, 31), importance: 3, inexact: true },
];

describe('eventDays', () => {
  it('turns exact, imprecise, and range dates into day ranges', () => {
    expect(eventDays('1901-05-12')).toEqual({ s0: day(1901, 5, 12), s1: day(1901, 5, 12), inexact: false });
    expect(eventDays('1901-05')).toEqual({ s0: day(1901, 5, 1), s1: day(1901, 5, 31), inexact: false });
    expect(eventDays('1901~')).toEqual({ s0: day(1901, 1, 1), s1: day(1901, 12, 31), inexact: true });
    expect(eventDays('1901-05/1901-09')).toEqual({ s0: day(1901, 5, 1), s1: day(1901, 9, 30), inexact: false });
  });

  it('marks ranges with an open or unknown end as inexact', () => {
    expect(eventDays('1901-05-12/..')).toEqual({ s0: day(1901, 5, 12), s1: day(1901, 5, 12), inexact: true });
    expect(eventDays('/1901')).toEqual({ s0: day(1901, 1, 1), s1: day(1901, 12, 31), inexact: true });
  });
});

describe('which events show', () => {
  it('shows only major events when zoomed far out, and everything when zoomed in', () => {
    expect(minImportance(365.2425 * 2000)).toBe(5);
    expect(minImportance(365.2425 * 100)).toBe(3);
    expect(minImportance(30)).toBe(1);
  });

  it('keeps events that overlap the visible range at the given importance', () => {
    const ids = (list: TimelineEvent[]) => list.map((e) => e.id);
    expect(ids(eventsInView(events, day(1901, 6, 15), day(1902, 1, 1), 1))).toEqual(['testland-fair']);
    expect(ids(eventsInView(events, day(1901, 1, 1), day(1904, 1, 1), 3))).toEqual(['founding-of-testland', 'testland-treaty']);
  });
});

describe('moving between events', () => {
  it('finds the next and previous shown event, skipping minor ones when zoomed out', () => {
    expect(adjacentEvent(events, day(1901, 5, 12), 1, 1)?.id).toBe('testland-fair');
    expect(adjacentEvent(events, day(1901, 5, 12), 1, 3)?.id).toBe('testland-treaty');
    expect(adjacentEvent(events, day(1903, 1, 1), -1, 1)?.id).toBe('testland-fair');
    expect(adjacentEvent(events, day(1900, 1, 1), -1, 1)).toBeUndefined();
  });

  it('finds the event a click landed on, within a tolerance', () => {
    expect(eventNear(events, day(1901, 5, 14), 3, 1)?.id).toBe('founding-of-testland');
    expect(eventNear(events, day(1901, 6, 10), 3, 1)?.id).toBe('testland-fair'); // inside the range
    expect(eventNear(events, day(1902, 6, 1), 3, 1)).toBeUndefined();
  });

  it('lists the events covering a day, most important first', () => {
    expect(eventsOnDay(events, day(1903, 5, 1), 1).map((e) => e.id)).toEqual(['testland-treaty']);
    expect(eventsOnDay(events, day(1901, 5, 12), 1).map((e) => e.id)).toEqual(['founding-of-testland']);
  });
});
