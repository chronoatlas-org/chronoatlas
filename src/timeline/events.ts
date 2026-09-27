// Events on the timeline: which ones show at the current zoom, which is next or previous, and
// which one a click landed on. Kept apart from the drawing code (timeline.ts) so it can be tested.
//
// The build writes the list to public/data/events.json (scripts/build-data.ts), sorted by s0.

import { parseEdtf } from '../dates/index.ts';

export interface TimelineEvent {
  id: string;
  title: string;
  /** The first and last day it may have happened (inclusive). One day for an exact date. */
  s0: number;
  s1: number;
  /** 1 (minor) to 5 (major). Decides from which zoom level it shows. */
  importance: number;
  /** The date is approximate or uncertain, or an end is open: drawn hollow, never as exact. */
  inexact?: boolean;
  /** Where it happened, if the data says: [longitude, latitude, precision in km]. */
  at?: [number, number, number];
}

/** Events without an importance count as middling. */
export const DEFAULT_IMPORTANCE = 3;

/** Day range and exactness of an event date written in EDTF (a date or an interval). */
export function eventDays(edtf: string): { s0: number; s1: number; inexact: boolean } {
  const parsed = parseEdtf(edtf);
  if (parsed.kind === 'date') {
    return { s0: parsed.earliest, s1: parsed.latest, inexact: parsed.approximate || parsed.uncertain };
  }
  const { start, end } = parsed;
  if (start.kind !== 'date' && end.kind !== 'date') throw new Error(`Event date has no known end: ${edtf}`);
  const s0 = start.kind === 'date' ? start.earliest : (end as { earliest: number }).earliest;
  const s1 = end.kind === 'date' ? end.latest : (start as { latest: number }).latest;
  const flagged = [start, end].some((e) => e.kind !== 'date' || e.approximate || e.uncertain);
  return { s0, s1, inexact: flagged };
}

/**
 * The least important events shown when `visibleDays` days fit across the bar, so a zoomed-out
 * timeline shows only major events and zooming in reveals the rest.
 */
export function minImportance(visibleDays: number): number {
  const years = visibleDays / 365.2425;
  if (years > 1000) return 5;
  if (years > 200) return 4;
  if (years > 50) return 3;
  if (years > 5) return 2;
  return 1;
}

/** Events that show between two day numbers at the given minimum importance. */
export function eventsInView(events: readonly TimelineEvent[], left: number, right: number, min: number): TimelineEvent[] {
  return events.filter((e) => e.importance >= min && e.s1 + 1 >= left && e.s0 <= right);
}

/** The next (+1) or previous (-1) shown event, by start day, strictly after or before `day`. */
export function adjacentEvent(
  events: readonly TimelineEvent[],
  day: number,
  direction: 1 | -1,
  min: number,
): TimelineEvent | undefined {
  const shown = events.filter((e) => e.importance >= min);
  if (direction === 1) return shown.find((e) => e.s0 > day);
  for (let i = shown.length - 1; i >= 0; i--) if (shown[i].s0 < day) return shown[i];
  return undefined;
}

/** The shown event nearest to `day`, if one is within `toleranceDays` of it (for clicks). */
export function eventNear(
  events: readonly TimelineEvent[],
  day: number,
  toleranceDays: number,
  min: number,
): TimelineEvent | undefined {
  let best: TimelineEvent | undefined;
  let bestDistance = Infinity;
  for (const e of events) {
    if (e.importance < min) continue;
    const distance = day < e.s0 ? e.s0 - day : day > e.s1 + 1 ? day - (e.s1 + 1) : 0;
    if (distance <= toleranceDays && distance < bestDistance) {
      best = e;
      bestDistance = distance;
    }
  }
  return best;
}

/** Events that cover a day, most important first, for the timeline's screen-reader text. */
export function eventsOnDay(events: readonly TimelineEvent[], day: number, min: number): TimelineEvent[] {
  return events.filter((e) => e.importance >= min && e.s0 <= day && day <= e.s1).sort((a, b) => b.importance - a.importance);
}

/**
 * Events with a place whose start the playhead just passed, moving forward from `fromDay` to
 * `toDay`: these get a pulse on the map. Most important first, at most `limit`, so a fast jump
 * across decades doesn't set off dozens at once.
 */
export function crossedEvents(
  events: readonly TimelineEvent[],
  fromDay: number,
  toDay: number,
  min: number,
  limit = 3,
): TimelineEvent[] {
  if (toDay <= fromDay) return [];
  return events
    .filter((e) => e.at && e.importance >= min && e.s0 > fromDay && e.s0 <= toDay)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, limit);
}
