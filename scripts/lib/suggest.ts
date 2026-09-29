// Crosswalk suggestions (Phase 5 step 8): which of a legal source's units are the same state as,
// or hold as a dependency, each polity the map draws (Cliopatria's, where it's the map). Pure, so
// it's tested; scripts/suggest-crosswalk.ts measures the overlaps and writes the report.
//
// Suggestions are only a starting point for a maintainer's review. Nothing here is written into a
// crosswalk: the approved rule is that every link is reviewed by a person (decision 6).

/** How much a polity and one legal unit shared, over the days sampled on which they overlapped. */
export interface Overlap {
  /** The map's polity (e.g. cliopatria-german-empire). */
  polity: string;
  /** The legal source's holder (e.g. cshapes-255), the unit (e.g. its own, or a colony it held),
   * and whether the unit is the holder's home unit (true) or a dependency (false). */
  holder: string;
  unit: string;
  home: boolean;
  /** Shared area in km², summed over those days. */
  km2: number;
  /** The unit's own area in km² (inside the region), summed over the same days. */
  unitKm2: number;
  /** The days sampled on which they overlapped (as day numbers). */
  days: number[];
}

export interface Suggestion {
  polity: string;
  holder: string;
  kind: 'same-state' | 'dependency';
  /** The units that suggest it (the polity held most of each). */
  units: string[];
  /** Of the polity's territory, the share inside those units; and of those units, the share the polity held. */
  share: number;
  held: number;
  /** The first and last day sampled on which they overlapped. */
  first: number;
  last: number;
}

/**
 * A unit to look at closer: the polity lay mostly inside it without holding most of it (`inside`:
 * a breakaway state, rival government, or occupation zone), or held most of it though it was
 * another state's (`beyond`: an occupation or annexation, or a year of transition).
 */
export interface Inside {
  polity: string;
  holder: string;
  unit: string;
  share: number;
  held: number;
  why: 'inside' | 'beyond';
}

/** A link is suggested where the polity held at least this share of a unit. */
export const SUGGEST_MIN_HELD = 0.5;
/** A polity at least this much inside a unit it didn't mostly hold is listed for a closer look. */
export const INSIDE_MIN_SHARE = 0.5;

/**
 * For each polity, its main holder (the one whose units held most of the polity's territory),
 * when the polity held most of one of that holder's units (at least SUGGEST_MIN_HELD of the unit,
 * summed over the days sampled): as the same state for the holder's home unit, as a dependency for
 * its others. Both tests matter, since "contested" exists for what a link would hide: a breakaway
 * state, rival government, or occupation zone lies inside a unit without holding most of it, and
 * an occupying power holds most of another state's unit while most of its own territory lies
 * elsewhere. Those are listed in `inside` for a closer look; polities with no suggestion at all
 * in `unmatched`, with the most of any unit they held. `totals` gives each polity's own km²,
 * summed over the days sampled.
 */
export function suggest(
  overlaps: readonly Overlap[],
  totals: ReadonlyMap<string, number>,
): { suggestions: Suggestion[]; inside: Inside[]; unmatched: { polity: string; best: number }[] } {
  const suggestions: Suggestion[] = [];
  const inside: Inside[] = [];
  const unmatched: { polity: string; best: number }[] = [];
  for (const [polity, total] of [...totals].sort(([a], [b]) => a.localeCompare(b))) {
    const found = overlaps.filter((o) => o.polity === polity);
    const held = (o: Overlap) => (o.unitKm2 > 0 ? o.km2 / o.unitKm2 : 0);
    const share = (km2: number) => (total > 0 ? km2 / total : 0);
    // The main holder: the one whose units held most of the polity.
    const byHolder = new Map<string, number>();
    for (const o of found) byHolder.set(o.holder, (byHolder.get(o.holder) ?? 0) + o.km2);
    const main = [...byHolder].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    // Group the main holder's units the polity held most of by kind.
    const groups = new Map<string, Overlap[]>();
    for (const o of found.filter((o) => o.holder === main && held(o) >= SUGGEST_MIN_HELD)) {
      const key = `${o.holder}|${o.home}`;
      groups.set(key, [...(groups.get(key) ?? []), o]);
    }
    for (const group of groups.values()) {
      const km2 = group.reduce((n, o) => n + o.km2, 0);
      const unitKm2 = group.reduce((n, o) => n + o.unitKm2, 0);
      const days = group.flatMap((o) => o.days);
      suggestions.push({
        polity,
        holder: group[0].holder,
        kind: group[0].home ? 'same-state' : 'dependency',
        units: [...new Set(group.map((o) => o.unit))].sort(),
        share: share(km2),
        held: km2 / unitKm2,
        first: Math.min(...days),
        last: Math.max(...days),
      });
    }
    for (const o of found) {
      const entry = { polity, holder: o.holder, unit: o.unit, share: share(o.km2), held: held(o) };
      if (held(o) < SUGGEST_MIN_HELD && share(o.km2) >= INSIDE_MIN_SHARE) inside.push({ ...entry, why: 'inside' });
      else if (held(o) >= SUGGEST_MIN_HELD && o.holder !== main) inside.push({ ...entry, why: 'beyond' });
    }
    if (groups.size === 0) unmatched.push({ polity, best: Math.max(0, ...found.map(held)) });
  }
  suggestions.sort((a, b) => a.holder.localeCompare(b.holder) || a.polity.localeCompare(b.polity));
  return { suggestions, inside, unmatched };
}
