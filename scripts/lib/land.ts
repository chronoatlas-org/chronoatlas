// Splits a border's shape into its land part and the rest (coastal waters, as the source draws
// them), using Natural Earth's land polygons. Used to measure land areas, and later (Phase 3) to
// color only the land part.
//
// Natural Earth's land is public domain. Its 1:10m polygons are detailed to a few hundred metres,
// fine enough for small territories like Hong Kong, where the base map's 1:50m coastline isn't.

import polygonClipping from 'polygon-clipping';
import { cleanMultiPolygon } from './geometry.ts';
import type { MultiPolygon, Polygon } from './geometry.ts';

type Box = [number, number, number, number];

const boxOf = (polygon: Polygon): Box => {
  const box: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of polygon[0]) {
    box[0] = Math.min(box[0], x);
    box[1] = Math.min(box[1], y);
    box[2] = Math.max(box[2], x);
    box[3] = Math.max(box[3], y);
  }
  return box;
};
const overlaps = (a: Box, b: Box) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

/** Land polygons with their bounding boxes, cut to an area so later work stays small. */
export class LandIndex {
  private readonly pieces: { polygon: Polygon; box: Box }[];

  /** `land` is a list of (Multi)Polygon geometries; `area` is west, south, east, north. */
  constructor(land: readonly { type: string; coordinates: unknown }[], area: Box) {
    const [w, s, e, n] = area;
    const frame: MultiPolygon = [[[[w, s], [e, s], [e, n], [w, n], [w, s]]]];
    const polygons = land.flatMap((g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as Polygon[]);
    const inArea = polygons.filter((p) => overlaps(boxOf(p), area));
    // One cut to the area. Natural Earth's land polygons don't overlap, so this is a plain clip.
    const clipped = polygonClipping.intersection(inArea as never, frame as never) as MultiPolygon;
    this.pieces = clipped.map((polygon) => ({ polygon, box: boxOf(polygon) }));
  }

  /** The land polygons whose boxes touch `box`. */
  near(box: Box): MultiPolygon {
    return this.pieces.filter((p) => overlaps(p.box, box)).map((p) => p.polygon);
  }
}

/** The part of `shape` that is land. (The rest is water inside the border.) */
export function landPart(shape: MultiPolygon, land: LandIndex): MultiPolygon {
  const box = shape.reduce<Box>((all, polygon) => {
    const b = boxOf(polygon);
    return [Math.min(all[0], b[0]), Math.min(all[1], b[1]), Math.max(all[2], b[2]), Math.max(all[3], b[3])];
  }, [Infinity, Infinity, -Infinity, -Infinity]);
  const nearby = land.near(box);
  if (nearby.length === 0) return [];
  return cleanMultiPolygon(polygonClipping.intersection(shape as never, nearby as never) as MultiPolygon, 4);
}

/**
 * Whether a shape was cut at the edge of an import's area (its outline runs along that edge), so
 * it's only the part of the territory inside the area.
 */
export function touchesEdge(shape: MultiPolygon, area: Box, tolerance = 1e-6): boolean {
  const [w, s, e, n] = area;
  for (const polygon of shape) {
    for (const ring of polygon) {
      for (let i = 1; i < ring.length; i++) {
        const [x1, y1] = ring[i - 1];
        const [x2, y2] = ring[i];
        const alongWestOrEast = (Math.abs(x1 - w) < tolerance && Math.abs(x2 - w) < tolerance) || (Math.abs(x1 - e) < tolerance && Math.abs(x2 - e) < tolerance);
        const alongSouthOrNorth = (Math.abs(y1 - s) < tolerance && Math.abs(y2 - s) < tolerance) || (Math.abs(y1 - n) < tolerance && Math.abs(y2 - n) < tolerance);
        if (alongWestOrEast || alongSouthOrNorth) return true;
      }
    }
  }
  return false;
}
