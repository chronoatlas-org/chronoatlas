// Compiles the data files into the compact files the website loads:
//   public/data/borders.geojson   every territorial assertion joined to its shape, with dates as
//                                 day numbers, ready for the map to filter by the selected day
//   public/data/atlas.json        polity names (with their dates) and source details
//
// Run with: npm run build-data (it also runs automatically before `npm run dev` and the build).
// It validates the data first and refuses to build from invalid data.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEdtfDate } from '../src/dates/index.ts';
import { loadDataset, ROOT } from './lib/data.ts';
import type { Dataset } from './lib/data.ts';
import { validateDataset } from './lib/validate-data.ts';
import { TERRITORIAL_RELATIONS } from './lib/types.ts';
import type { Assertion, ShapeFeature } from './lib/types.ts';

const OUT_DIR = join(ROOT, 'public', 'data');
/** Stands in for "no end yet" in day-number comparisons: a day far in the future. */
export const FAR_FUTURE = 99_999_999;
/** How many fill colors the map's palette has (see src/map/historical.ts). */
const PALETTE_SIZE = 8;

/** Day-number ranges for an assertion: s0–s1 = when it may have started, e0–e1 = when it may have ended. */
export function dayRanges(start: string, end: string) {
  const s = parseEdtfDate(start);
  if (end === 'ongoing' || end === 'unknown') {
    return { s0: s.earliest, s1: s.latest, e0: FAR_FUTURE, e1: FAR_FUTURE, endUnknown: end === 'unknown' };
  }
  const e = parseEdtfDate(end);
  return { s0: s.earliest, s1: s.latest, e0: e.earliest, e1: e.latest, endUnknown: false };
}

type Box = [number, number, number, number];

function bounds(geometry: ShapeFeature['geometry']): Box {
  const box: Box = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      box[0] = Math.min(box[0], c[0]);
      box[1] = Math.min(box[1], c[1] as number);
      box[2] = Math.max(box[2], c[0]);
      box[3] = Math.max(box[3], c[1] as number);
    } else if (Array.isArray(c)) c.forEach(walk);
  };
  walk(geometry.coordinates);
  return box;
}

/**
 * Picks a fill color for each polity so that polities which might touch get different colors.
 * "Might touch" means their shapes' bounding boxes overlap during overlapping periods, which is a
 * cautious approximation. Colors are assigned greedily, most-connected polities first.
 */
export function assignColors(items: { polity: string; box: Box; s0: number; e0: number }[]): Map<string, number> {
  const neighbours = new Map<string, Set<string>>();
  for (const item of items) neighbours.set(item.polity, neighbours.get(item.polity) ?? new Set());
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.polity === b.polity) continue;
      const overlapInTime = a.s0 < b.e0 && b.s0 < a.e0;
      const overlapInSpace = a.box[0] <= b.box[2] && b.box[0] <= a.box[2] && a.box[1] <= b.box[3] && b.box[1] <= a.box[3];
      if (overlapInTime && overlapInSpace) {
        neighbours.get(a.polity)!.add(b.polity);
        neighbours.get(b.polity)!.add(a.polity);
      }
    }
  }
  const colors = new Map<string, number>();
  const order = [...neighbours.keys()].sort(
    (a, b) => neighbours.get(b)!.size - neighbours.get(a)!.size || a.localeCompare(b),
  );
  for (const polity of order) {
    const used = new Set([...neighbours.get(polity)!].map((n) => colors.get(n)));
    let color = 0;
    while (used.has(color) && color < PALETTE_SIZE - 1) color++;
    colors.set(polity, color);
  }
  return colors;
}

export function buildBorders(ds: Dataset) {
  const shapes = new Map(ds.shapes.map(({ value }) => [value.properties.id, value]));
  const territorial = ds.assertions
    .flatMap(({ value }) => value)
    .filter((a): a is Assertion & { shape: string } => TERRITORIAL_RELATIONS.includes(a.relation) && !!a.shape);

  const items = territorial.map((a) => {
    const shape = shapes.get(a.shape)!;
    return { assertion: a, shape, box: bounds(shape.geometry), ...dayRanges(a.start, a.end) };
  });
  const colors = assignColors(items.map((i) => ({ polity: i.assertion.subject, box: i.box, s0: i.s0, e0: i.e0 })));

  return {
    type: 'FeatureCollection',
    features: items.map(({ assertion: a, shape, s0, s1, e0, e1, endUnknown }) => ({
      type: 'Feature',
      properties: {
        id: a.id,
        polity: a.subject,
        relation: a.relation,
        start: a.start,
        end: a.end,
        s0,
        s1,
        e0,
        e1,
        ...(endUnknown ? { endUnknown: true } : {}),
        source: a.sources[0].source,
        locator: a.sources[0].locator,
        edge: shape.properties.edge_precision,
        color: colors.get(a.subject) ?? 0,
      },
      geometry: shape.geometry,
    })),
  };
}

export function buildAtlas(ds: Dataset) {
  const polities = Object.fromEntries(
    ds.polities.map(({ value: p }) => [
      p.id,
      {
        ...(p.wikidata ? { wikidata: p.wikidata } : {}),
        names: p.names.map((n) => ({
          text: n.text,
          lang: n.lang,
          s0: n.start ? parseEdtfDate(n.start).earliest : null,
          e0: n.end && n.end !== 'ongoing' && n.end !== 'unknown' ? parseEdtfDate(n.end).earliest : null,
        })),
      },
    ]),
  );
  const sources = Object.fromEntries(
    ds.sources.map(({ value: s }) => [
      s.id,
      { title: s.title, ...(s.url ? { url: s.url } : {}), ...(s.attribution ? { attribution: s.attribution } : {}) },
    ]),
  );
  return { polities, sources };
}

function main(): void {
  const ds = loadDataset();
  const problems = validateDataset(ds);
  if (problems.length > 0) {
    console.error(`Not building: the data has ${problems.length} problem(s). Run "npm run validate" for details.`);
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const borders = buildBorders(ds);
  writeFileSync(join(OUT_DIR, 'borders.geojson'), JSON.stringify(borders));
  writeFileSync(join(OUT_DIR, 'atlas.json'), JSON.stringify(buildAtlas(ds)));
  console.log(`Built public/data: ${borders.features.length} border features, ${ds.polities.length} polities.`);
}

// Run only when executed directly (not when imported by tests).
if (import.meta.filename === process.argv[1]) main();
