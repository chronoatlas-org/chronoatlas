// Where the sources disagree: areas that the default map's source (OpenHistoricalMap) records as
// run by one polity, while a de jure source (CShapes) records a different state as sovereign
// or occupying, on the same days.
//
// Computed at build time and never stored in data/: the result combines OpenHistoricalMap (CC0)
// with CShapes (CC BY-NC-SA 4.0), so it carries CShapes' license and exists only in the build
// output, credited wherever it's shown.
//
// "Different" goes through the crosswalk: our polity and a CShapes unit count as the same when
// the crosswalk says they are the same state, or that ours administered the unit's dependency.
//
// Disagreements smaller than CShapes' own threshold (10,000 km²) are left out. CShapes doesn't
// code territorial changes that small, so it has no view on them: it places Hong Kong inside
// China because of that rule, not as a claim about Hong Kong. The same rule removes the thin
// slivers where two sources' separately simplified borders don't quite meet.

import polygonClipping from 'polygon-clipping';
import { areaKm2, cleanMultiPolygon } from './geometry.ts';
import type { MultiPolygon } from './geometry.ts';

/** CShapes leaves out territorial changes smaller than this (its codebook's coding rules). */
export const MIN_DISAGREEMENT_KM2 = 10_000;

/**
 * A polygon's mean width in km (twice its area over its perimeter): a long strip w km wide comes
 * out close to w. Used to leave out the thin strips where two sources' borders, drawn at different
 * resolutions, don't quite meet.
 */
export function meanWidthKm(polygon: MultiPolygon[number]): number {
  let perimeter = 0;
  for (const ring of polygon) {
    for (let i = 1; i < ring.length; i++) {
      const [x1, y1] = ring[i - 1];
      const [x2, y2] = ring[i];
      const k = Math.cos((((y1 + y2) / 2) * Math.PI) / 180);
      perimeter += Math.hypot((x2 - x1) * 111.32 * k, (y2 - y1) * 110.57);
    }
  }
  return perimeter === 0 ? 0 : (2 * areaKm2([polygon])) / perimeter;
}

type Box = [number, number, number, number];

/** A territorial record with its shape and days, from either side. */
export interface TimedShape {
  /** The assertion's ID. */
  record: string;
  /** Our polity (de facto side), or the CShapes unit (de jure side). */
  holder: string;
  relation: string;
  source: string;
  /** From s0 until e0 (exclusive), as day numbers: every day it may have applied. */
  s0: number;
  e0: number;
  /**
   * The days it certainly applied, from c0 until c1 (exclusive), when that's narrower: its start
   * or end is known only to the month or year. Missing means the same as s0 and e0.
   */
  c0?: number;
  c1?: number;
  shape: string;
  geometry: MultiPolygon;
  box: Box;
}

/** A crosswalk match: from m0 until m1 (exclusive), `polity` goes with the unit. */
export interface Link {
  polity: string;
  m0: number;
  m1: number;
}

export interface ContestedArea {
  id: string;
  facto: string;
  factoRecord: string;
  factoRelation: string;
  factoSource: string;
  jure: string;
  jureRecord: string;
  jureRelation: string;
  jureSource: string;
  s0: number;
  e0: number;
  /** Set when one of the two records may not apply in this period (an uncertain start or end). */
  maybe?: boolean;
  km2: number;
  geometry: MultiPolygon;
}

/**
 * Splits a period at the edges of the days both records certainly applied: the parts outside are
 * only possibly contested. In order, without empty parts.
 */
export function splitByCertainty(start: number, end: number, c0: number, c1: number): { s0: number; e0: number; maybe: boolean }[] {
  const from = Math.min(Math.max(c0, start), end);
  const to = Math.max(Math.min(c1, end), from);
  return [
    { s0: start, e0: from, maybe: true },
    { s0: from, e0: to, maybe: false },
    { s0: to, e0: end, maybe: true },
  ].filter((p) => p.s0 < p.e0);
}

export function boundingBox(multi: MultiPolygon): Box {
  const box: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const polygon of multi) {
    for (const [x, y] of polygon[0]) {
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x);
      box[3] = Math.max(box[3], y);
    }
  }
  return box;
}

const boxesOverlap = (a: Box, b: Box) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

/** The parts of [start, end) that none of the windows cover, in order. */
export function uncovered(start: number, end: number, windows: readonly [number, number][]): [number, number][] {
  const gaps: [number, number][] = [];
  let cursor = start;
  for (const [from, to] of [...windows].sort((a, b) => a[0] - b[0])) {
    if (to <= cursor || from >= end) continue;
    if (from > cursor) gaps.push([cursor, from]);
    cursor = Math.max(cursor, to);
    if (cursor >= end) break;
  }
  if (cursor < end) gaps.push([cursor, end]);
  return gaps;
}

/**
 * Every area and period where a de facto record and a de jure record overlap but name polities
 * the crosswalk doesn't link. `links` lists, for each de jure unit, the polities it goes with.
 */
export function computeContested(
  defacto: readonly TimedShape[],
  dejure: readonly TimedShape[],
  links: ReadonlyMap<string, readonly Link[]>,
  minKm2 = MIN_DISAGREEMENT_KM2,
  minWidthKm = 0,
): ContestedArea[] {
  const results: ContestedArea[] = [];
  const overlaps = new Map<string, MultiPolygon>(); // by pair of shapes, which repeat across periods
  for (const f of defacto) {
    for (const j of dejure) {
      const from = Math.max(f.s0, j.s0);
      const to = Math.min(f.e0, j.e0);
      if (from >= to || !boxesOverlap(f.box, j.box)) continue;
      const windows = (links.get(j.holder) ?? []).filter((l) => l.polity === f.holder).map((l): [number, number] => [l.m0, l.m1]);
      const periods = uncovered(from, to, windows);
      if (periods.length === 0) continue;

      const key = `${f.shape}|${j.shape}`;
      let pieces = overlaps.get(key);
      if (!pieces) {
        const overlap = polygonClipping.intersection(f.geometry as never, j.geometry as never) as MultiPolygon;
        pieces = cleanMultiPolygon(overlap, 4).filter((polygon) => areaKm2([polygon]) >= minKm2 && (minWidthKm === 0 || meanWidthKm(polygon) >= minWidthKm));
        overlaps.set(key, pieces);
      }
      if (pieces.length === 0) continue;
      const km2 = Math.round(areaKm2(pieces));
      const c0 = Math.max(f.c0 ?? f.s0, j.c0 ?? j.s0);
      const c1 = Math.min(f.c1 ?? f.e0, j.c1 ?? j.e0);
      for (const { s0, e0, maybe } of periods.flatMap(([from, to]) => splitByCertainty(from, to, c0, c1))) {
        results.push({
          id: `${f.record}~${j.record}~${s0}`,
          facto: f.holder,
          factoRecord: f.record,
          factoRelation: f.relation,
          factoSource: f.source,
          jure: j.holder,
          jureRecord: j.record,
          jureRelation: j.relation,
          jureSource: j.source,
          s0,
          e0,
          ...(maybe ? { maybe } : {}),
          km2,
          geometry: pieces,
        });
      }
    }
  }
  return results;
}

/** Where and when a crosswalk has been reviewed: a box (west, south, east, north) and days [d0, d1). */
export interface ReviewedScope {
  box: Box;
  d0: number;
  d1: number;
  /** Only for the administered records of this source (the map it was reviewed against); absent: all. */
  map?: string;
}

/**
 * Keeps only the parts of contested areas inside the places and years where the crosswalk has
 * been reviewed (Phase 5 decision 6): elsewhere, a difference may only mean that no one has said
 * yet which units are the same state. Each area is cut to each scope's box and days; the pieces
 * keep their area's fields, with the area and ID of the piece. A scope with a `map` counts only for
 * areas whose administered side comes from that source.
 */
export function withinScopes(areas: readonly ContestedArea[], scopes: readonly ReviewedScope[]): ContestedArea[] {
  const kept: ContestedArea[] = [];
  for (const area of areas) {
    const [w, s, e, n] = boundingBox(area.geometry);
    scopes.forEach((scope, i) => {
      if (scope.map !== undefined && scope.map !== area.factoSource) return;
      const s0 = Math.max(area.s0, scope.d0);
      const e0 = Math.min(area.e0, scope.d1);
      if (s0 >= e0) return;
      const [bw, bs, be, bn] = scope.box;
      if (w >= be || e <= bw || s >= bn || n <= bs) return;
      const inside = w >= bw && e <= be && s >= bs && n <= bn;
      const geometry = inside
        ? area.geometry
        : cleanMultiPolygon(polygonClipping.intersection(area.geometry as never, [[[[bw, bs], [be, bs], [be, bn], [bw, bn], [bw, bs]]]] as never) as MultiPolygon, 4);
      if (geometry.length === 0) return;
      const whole = inside && s0 === area.s0 && e0 === area.e0;
      kept.push({
        ...area,
        ...(whole ? {} : { id: `${area.id}-s${i}`, km2: Math.round(areaKm2(geometry)) }),
        s0,
        e0,
        geometry,
      });
    });
  }
  return kept;
}
