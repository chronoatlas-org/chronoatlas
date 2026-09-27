// Geometry helpers for the import scripts: simplifying lines, assembling OpenStreetMap-style
// boundary rings, and writing GeoJSON in a diff-friendly layout.
//
// Coordinates are [longitude, latitude] in degrees, as in GeoJSON.

export type Position = [number, number];
export type Ring = Position[];
export type Polygon = Ring[]; // first ring is the outer edge, the rest are holes
export type MultiPolygon = Polygon[];

export function samePoint(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/** Squared distance from point p to the segment a–b. */
function segmentDistanceSquared(p: Position, a: Position, b: Position): number {
  let [x, y] = a;
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) [x, y] = b;
    else if (t > 0) [x, y] = [x + dx * t, y + dy * t];
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

/**
 * Douglas–Peucker simplification: drops points that lie within `tolerance` (in degrees) of the
 * simplified line. The first and last points are always kept exactly, so lines that meet at
 * their ends still meet after simplification.
 */
export function simplifyLine(points: Position[], tolerance: number): Position[] {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const toleranceSquared = tolerance * tolerance;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let maxDistance = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistanceSquared(points[i], points[first], points[last]);
      if (d > maxDistance) {
        maxDistance = d;
        index = i;
      }
    }
    if (index !== -1 && maxDistance > toleranceSquared) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/**
 * Joins line segments into closed rings by matching their end points, reversing segments where
 * needed. This is how OpenStreetMap-style boundary relations are turned into polygons. Returns
 * null if the segments can't be joined into closed rings (a broken boundary).
 */
export function assembleRings(lines: Position[][]): Ring[] | null {
  const remaining = lines.filter((l) => l.length >= 2).map((l) => l.slice());
  const rings: Ring[] = [];
  while (remaining.length > 0) {
    let ring = remaining.pop()!;
    while (!samePoint(ring[0], ring[ring.length - 1])) {
      const end = ring[ring.length - 1];
      const i = remaining.findIndex((l) => samePoint(l[0], end) || samePoint(l[l.length - 1], end));
      if (i === -1) return null;
      let next = remaining.splice(i, 1)[0];
      if (!samePoint(next[0], end)) next = next.reverse();
      ring = ring.concat(next.slice(1));
    }
    rings.push(ring);
  }
  return rings;
}

/** Signed area (shoelace formula, in square degrees). Positive means counter-clockwise. */
export function ringArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return sum / 2;
}

/** Ray-casting test: is the point inside the ring? */
export function pointInRing(point: Position, ring: Ring): boolean {
  let inside = false;
  const [x, y] = point;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Groups outer rings and holes into polygons: each hole goes to the outer ring containing it. */
export function buildMultiPolygon(outers: Ring[], inners: Ring[]): MultiPolygon {
  const polygons: MultiPolygon = outers.map((outer) => [outer]);
  for (const inner of inners) {
    const owner = polygons.find((p) => pointInRing(inner[0], p[0]));
    if (owner) owner.push(inner);
  }
  return polygons;
}

/**
 * Rounds coordinates, removes repeated points and rings too small to have an area, and orients
 * rings as GeoJSON requires (RFC 7946): outer edges counter-clockwise, holes clockwise.
 */
export function cleanMultiPolygon(multi: MultiPolygon, decimals: number): MultiPolygon {
  const factor = 10 ** decimals;
  const round = (n: number) => Math.round(n * factor) / factor;
  const cleanRing = (ring: Ring, outer: boolean): Ring | null => {
    const out: Ring = [];
    for (const [x, y] of ring) {
      const p: Position = [round(x), round(y)];
      if (out.length === 0 || !samePoint(out[out.length - 1], p)) out.push(p);
    }
    if (!samePoint(out[0], out[out.length - 1])) out.push(out[0]);
    if (out.length < 4 || ringArea(out) === 0) return null;
    if (ringArea(out) > 0 !== outer) out.reverse();
    return out;
  };
  const result: MultiPolygon = [];
  for (const polygon of multi) {
    const outer = cleanRing(polygon[0], true);
    if (!outer) continue;
    const holes = polygon.slice(1).map((h) => cleanRing(h, false)).filter((h): h is Ring => h !== null);
    result.push([outer, ...holes]);
  }
  return result;
}

/**
 * Writes a GeoJSON Feature with one coordinate pair per line, so a change to a border shows up
 * as a small, readable diff (GitHub also draws GeoJSON diffs as maps).
 */
export function formatFeature(properties: Record<string, unknown>, multi: MultiPolygon): string {
  const ring = (r: Ring) => '[\n' + r.map((p) => `[${p[0]},${p[1]}]`).join(',\n') + '\n]';
  const polygon = (p: Polygon) => '[\n' + p.map(ring).join(',\n') + '\n]';
  return (
    '{\n"type": "Feature",\n' +
    `"properties": ${JSON.stringify(properties)},\n` +
    '"geometry": {"type": "MultiPolygon", "coordinates": [\n' +
    multi.map(polygon).join(',\n') +
    '\n]}\n}\n'
  );
}
