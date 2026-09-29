// Border lines, written apart from the fills (Phase 3 step 3).
//
// The map used to draw each border by outlining its filled shape. That outlined everything: the
// rings OpenHistoricalMap draws a few kilometres out to sea around islands, and the straight cut
// where an import's area ends, which looks like a real border but isn't one. So the build now
// writes each shape's outline as lines of its own, leaving out:
//   - the parts along the edge of the import's area;
//   - the parts at sea: more than a set distance (2 km) from Natural Earth's land. Borders that
//     follow a coast, within that distance of it, are kept.
//
// The distance test uses a grid of Natural Earth's land edges, so it stays fast for the whole
// area. It's approximate at the edges of the grid's reach (about 5 km), which is far beyond the
// 2 km it's asked about.

import type { MultiPolygon, Position } from './geometry.ts';

type Box = [number, number, number, number];

/** How far from land (km) a stretch of border can be and still count as on land. */
export const SEA_DISTANCE_KM = 2;

/** Grid cell size in degrees: larger than SEA_DISTANCE_KM everywhere in our latitudes. */
const CELL = 0.05;
const KM_PER_DEGREE_LAT = 110.57;
const KM_PER_DEGREE_LON_AT_EQUATOR = 111.32;

/** Answers "is this point on land, or within a few km of it?" for Natural Earth's land. */
export class LandDistance {
  /** Land edges by grid cell, as flat [x1, y1, x2, y2, …] arrays. */
  private readonly cells = new Map<string, number[]>();
  /** Land edges by grid row, for the inside test (a ray cast along the row). */
  private readonly rows = new Map<number, number[]>();

  /** `land` is Natural Earth's land polygons (already cut to the area of interest). */
  constructor(land: MultiPolygon) {
    for (const polygon of land) {
      for (const ring of polygon) {
        for (let i = 1; i < ring.length; i++) this.addEdge(ring[i - 1], ring[i]);
      }
    }
  }

  private addEdge([x1, y1]: Position, [x2, y2]: Position): void {
    const cx0 = Math.floor(Math.min(x1, x2) / CELL);
    const cx1 = Math.floor(Math.max(x1, x2) / CELL);
    const cy0 = Math.floor(Math.min(y1, y2) / CELL);
    const cy1 = Math.floor(Math.max(y1, y2) / CELL);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const key = `${cx},${cy}`;
        const list = this.cells.get(key);
        if (list) list.push(x1, y1, x2, y2);
        else this.cells.set(key, [x1, y1, x2, y2]);
      }
    }
    for (let cy = cy0; cy <= cy1; cy++) {
      const list = this.rows.get(cy);
      if (list) list.push(x1, y1, x2, y2);
      else this.rows.set(cy, [x1, y1, x2, y2]);
    }
  }

  /** Whether the point is inside the land (even-odd rule, so lakes cut out of land count as holes). */
  isLand([x, y]: Position): boolean {
    const edges = this.rows.get(Math.floor(y / CELL));
    if (!edges) return false;
    let inside = false;
    for (let i = 0; i < edges.length; i += 4) {
      const x1 = edges[i], y1 = edges[i + 1], x2 = edges[i + 2], y2 = edges[i + 3];
      if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) inside = !inside;
    }
    return inside;
  }

  /** Distance to the nearest land edge in km, or Infinity when none is within about 5 km. */
  distanceKm([x, y]: Position): number {
    const kx = KM_PER_DEGREE_LON_AT_EQUATOR * Math.cos((y * Math.PI) / 180);
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    let best = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const edges = this.cells.get(`${cx + dx},${cy + dy}`);
        if (!edges) continue;
        for (let i = 0; i < edges.length; i += 4) {
          // Distance to the segment, in a local flat projection (km).
          const ax = (edges[i] - x) * kx, ay = (edges[i + 1] - y) * KM_PER_DEGREE_LAT;
          const bx = (edges[i + 2] - x) * kx, by = (edges[i + 3] - y) * KM_PER_DEGREE_LAT;
          const sx = bx - ax, sy = by - ay;
          const length = sx * sx + sy * sy;
          const t = length === 0 ? 0 : Math.max(0, Math.min(1, -(ax * sx + ay * sy) / length));
          const px = ax + t * sx, py = ay + t * sy;
          best = Math.min(best, Math.hypot(px, py));
        }
      }
    }
    return best;
  }

  /** On land, or within `km` of it. */
  nearLand(point: Position, km = SEA_DISTANCE_KM): boolean {
    return this.isLand(point) || this.distanceKm(point) <= km;
  }
}

/** Whether a segment runs along one edge of the box (a cut, not a border). */
export function alongBoxEdge([x1, y1]: Position, [x2, y2]: Position, [w, s, e, n]: Box, tolerance = 1e-6): boolean {
  const on = (a: number, b: number, v: number) => Math.abs(a - v) < tolerance && Math.abs(b - v) < tolerance;
  return on(x1, x2, w) || on(x1, x2, e) || on(y1, y2, s) || on(y1, y2, n);
}

/**
 * A shape's outline as lines, without the stretches along the import's area edge (`box`) and,
 * when `land` is given, without the stretches at sea. A stretch counts as at sea when its middle
 * and one of its ends are both farther than SEA_DISTANCE_KM from land.
 */
export function borderLines(shape: MultiPolygon, box: Box | undefined, land: LandDistance | undefined, cuts: readonly Box[] = []): Position[][] {
  const lines: Position[][] = [];
  for (const polygon of shape) {
    for (const ring of polygon) {
      const pieces: Position[][] = [];
      let current: Position[] = [];
      const flush = () => {
        if (current.length >= 2) pieces.push(current);
        current = [];
      };
      for (let i = 1; i < ring.length; i++) {
        const a = ring[i - 1];
        const b = ring[i];
        const cut = (box !== undefined && alongBoxEdge(a, b, box)) || cuts.some((c) => alongBoxEdge(a, b, c));
        const atSea =
          !cut &&
          land !== undefined &&
          !land.nearLand([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]) &&
          (!land.nearLand(a) || !land.nearLand(b));
        if (cut || atSea) {
          flush();
          continue;
        }
        if (current.length === 0) current.push(a);
        current.push(b);
      }
      flush();
      // A ring is a loop: when it was cut somewhere in the middle, its last stretch continues
      // into its first, so join them into one line.
      if (pieces.length > 1) {
        const first = pieces[0];
        const last = pieces[pieces.length - 1];
        const end = last[last.length - 1];
        if (end[0] === first[0][0] && end[1] === first[0][1]) {
          pieces[0] = [...last, ...first.slice(1)];
          pieces.pop();
        }
      }
      lines.push(...pieces);
    }
  }
  return lines;
}

/**
 * The land parts of a box's edges, as lines: where the imported data ends. Each edge is walked in
 * steps of about 0.05°, and the steps whose middle is on land are kept.
 */
export function boxEdgeOnLand([w, s, e, n]: Box, land: LandDistance | undefined, step = CELL): Position[][] {
  const edges: [Position, Position][] = [
    [[w, s], [e, s]],
    [[e, s], [e, n]],
    [[e, n], [w, n]],
    [[w, n], [w, s]],
  ];
  const lines: Position[][] = [];
  for (const [a, b] of edges) {
    const count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    let current: Position[] = [];
    for (let i = 0; i < count; i++) {
      const p = (t: number): Position => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const from = p(i / count);
      const to = p((i + 1) / count);
      const onLand = land === undefined || land.isLand([(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]);
      if (onLand) {
        if (current.length === 0) current.push(from);
        current.push(to);
      } else if (current.length > 0) {
        lines.push(current);
        current = [];
      }
    }
    if (current.length > 0) lines.push(current);
  }
  return lines;
}
