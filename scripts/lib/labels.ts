// Where to put a territory's name on the map: the point inside its largest part that is farthest
// from any edge (the "pole of inaccessibility"), so the label never lands in the sea, in a hole,
// or in a thin strip, as a plain centre point can.
//
// The method: cover the polygon with square cells, and keep splitting the cells that could still
// hold a point farther from the edges than the best found so far (a cell's centre distance plus
// half its diagonal bounds what's inside it). Distances are measured with longitude scaled by the
// cosine of the latitude, so shapes aren't stretched east–west. Written here from that
// description; it's the approach of Mapbox's "polylabel".

import { areaKm2 } from './geometry.ts';
import type { MultiPolygon, Polygon, Position } from './geometry.ts';

/** Signed distance from a point to a polygon's edges: positive inside, negative outside. */
function signedDistance(x: number, y: number, polygon: Polygon): number {
  let inside = false;
  let best = Infinity;
  for (const ring of polygon) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[j];
      if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
      // Distance to the segment a–b.
      let dx = bx - ax;
      let dy = by - ay;
      let px = ax;
      let py = ay;
      if (dx !== 0 || dy !== 0) {
        const t = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy);
        if (t > 1) [px, py] = [bx, by];
        else if (t > 0) [px, py] = [ax + dx * t, ay + dy * t];
      }
      dx = x - px;
      dy = y - py;
      best = Math.min(best, dx * dx + dy * dy);
    }
  }
  return (inside ? 1 : -1) * Math.sqrt(best);
}

interface Cell {
  x: number;
  y: number;
  half: number;
  d: number;
  /** The most any point in the cell could be from the edges. */
  max: number;
}

/**
 * The pole of inaccessibility of one polygon, to within `precision` (in the polygon's own units,
 * after scaling). Coordinates are [x, y] already scaled.
 */
function pole(polygon: Polygon, precision: number): Position {
  const outer = polygon[0];
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of outer) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const size = Math.min(maxX - minX, maxY - minY);
  const cellOf = (x: number, y: number, half: number): Cell => {
    const d = signedDistance(x, y, polygon);
    return { x, y, half, d, max: d + half * Math.SQRT2 };
  };
  // Start from the centre of the bounding box; the queue keeps cells by their best possible distance.
  let best = cellOf((minX + maxX) / 2, (minY + maxY) / 2, 0);
  if (size === 0) return [best.x, best.y];
  const queue: Cell[] = [];
  const half = size / 2;
  for (let x = minX; x < maxX; x += size) {
    for (let y = minY; y < maxY; y += size) queue.push(cellOf(x + half, y + half, half));
  }
  while (queue.length > 0) {
    queue.sort((a, b) => a.max - b.max);
    const cell = queue.pop()!;
    if (cell.d > best.d) best = cell;
    if (cell.max - best.d <= precision) continue;
    const h = cell.half / 2;
    queue.push(cellOf(cell.x - h, cell.y - h, h), cellOf(cell.x + h, cell.y - h, h), cellOf(cell.x - h, cell.y + h, h), cellOf(cell.x + h, cell.y + h, h));
  }
  return [best.x, best.y];
}

/**
 * Where to label a territory: the pole of inaccessibility of its largest part, as
 * [longitude, latitude], found to within about `precisionKm` (default 1 km).
 */
export function labelPoint(shape: MultiPolygon, precisionKm = 1): Position | undefined {
  if (shape.length === 0) return undefined;
  const largest = shape.reduce((a, b) => (areaKm2([b]) > areaKm2([a]) ? b : a));
  // Scale longitude by the cosine of the latitude (at the part's middle), so distances are fair.
  const lats = largest[0].map(([, y]) => y);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  const scaled = largest.map((ring) => ring.map(([x, y]): Position => [x * k, y]));
  const [x, y] = pole(scaled, precisionKm / 111);
  return [x / k, y];
}
