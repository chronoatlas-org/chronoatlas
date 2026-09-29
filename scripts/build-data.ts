// Compiles the data files into the compact files the website loads:
//   public/data/tiles/<version>/{z}/{x}/{y}.pbf
//                          every territorial assertion joined to its shape, with dates as day
//                          numbers, cut into vector tiles so the browser downloads only what's in
//                          view. Each tile has the fills, the border lines (apart from the fills;
//                          see scripts/lib/outlines.ts), the name labels (scripts/lib/labels.ts),
//                          and from zoom 4 the land parts of borders that take in coastal waters. <version> is a fingerprint of the data, so
//                          browsers never mix tiles from two builds.
//   public/data/tiles.json where the tiles are, and the change index: every day on which the map
//                          changes, so dragging the timeline only redraws when one is crossed
//   public/data/edges.json           where each import's area ends, over land ("Edge of imported
//                          data"), so borders cut at that edge don't read as real borders
//   public/data/sources.json         each source's title and address
//   public/data/events.json          every event's dates, importance, title, and place, for the
//                          timeline's markers and the map's pulse
//   public/data/events/<id>.json     one event in full (summary, sources, effects), for the panel
//   public/data/changes.json         every day a border starts or ends, with its polity and source
//   public/data/dejure-tiles/<version>/…      CShapes' legally recognized borders, its own layer
//   public/data/second-tiles/<version>/…      Cliopatria's borders, the "second opinion" outlines
//   public/data/differ-tiles/<version>/…      where the default map and the second opinion
//                          name different holders ("sources differ"; credits Cliopatria)
//   public/data/coast-tiles/<version>/…       Natural Earth's 1:10m land, sea, and coastline
//                          inside the imports' areas, for the base map up close (zoom 4–7)
//   public/data/contested-tiles/<version>/…   where the sources disagree (computed; carries
//                          CShapes' CC BY-NC-SA license, so it's a layer of its own)
//   public/data/polities/<id>.json   one polity's names, every record that mentions it, and its
//                          figures (land areas), for the territory panel (a visitor downloads
//                          only the ones they open)
//
// Run with: npm run build-data (it also runs automatically before `npm run dev` and the build).
// It validates the data first and refuses to build from invalid data.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { civilToJdn, parseEdtfDate } from '../src/dates/index.ts';
import { formatDayForUrl } from '../src/url/state.ts';
import { loadDataset, ROOT } from './lib/data.ts';
import type { Dataset, Loaded } from './lib/data.ts';
import { boundingBox, computeContested, withinScopes } from './lib/contested.ts';
import { chooseEras, inEra } from './lib/eras.ts';
import type { Era, EraItem } from './lib/eras.ts';
import type { ContestedArea, Link, ReviewedScope, TimedShape } from './lib/contested.ts';
import { areaKm2, cleanMultiPolygon, simplifyLine } from './lib/geometry.ts';
import type { MultiPolygon } from './lib/geometry.ts';
import polygonClipping from 'polygon-clipping';
import { LandIndex, landPart, touchesEdge } from './lib/land.ts';
import { borderLines, boxEdgeOnLand, LandDistance } from './lib/outlines.ts';
import { labelPoint } from './lib/labels.ts';
import { pickNames } from '../src/map/names.ts';
import { buildTiles } from './lib/tiles.ts';
import type { Bounds } from './lib/tiles.ts';
import { validateDataset } from './lib/validate-data.ts';
import { TERRITORIAL_RELATIONS } from './lib/types.ts';
import type { Assertion, Citation, Polity, PolityName, Relation, ShapeFeature } from './lib/types.ts';
import type { AtlasName } from '../src/map/names.ts';
import type { BorderChange, ContestedEntry, EventFile, FigureEntry, PolityFile, PolityRecord, SourcesFile } from '../src/panel/model.ts';
import { DEFAULT_IMPORTANCE, eventDays } from '../src/timeline/events.ts';
import type { TimelineEvent } from '../src/timeline/events.ts';

const OUT_DIR = join(ROOT, 'public', 'data');
const TILE_LAYER = 'borders';
/** Import folders whose assertions are legally recognized (de jure) borders, shown as their own view. */
export const DE_JURE_FOLDERS = ['data/imports/cshapes-2-0/'];
export const isDejure = (file: string) => DE_JURE_FOLDERS.some((folder) => file.startsWith(folder));
/** Import folders shown as a "second opinion": outlines over the default map (Cliopatria). */
export const SECOND_OPINION_FOLDERS = ['data/imports/cliopatria/'];
export const isSecondOpinion = (file: string) => SECOND_OPINION_FOLDERS.some((folder) => file.startsWith(folder));
/** Highest zoom with its own tiles. At zoom 7 a tile unit is about 40 m, finer than the data. */
const TILE_MAX_ZOOM = 7;
/** Stands in for "no end yet" in day-number comparisons: a day far in the future. */
export const FAR_FUTURE = 99_999_999;
/** How many fill colors the map's palette has (see src/map/historical.ts). */
const PALETTE_SIZE = 8;

/**
 * Day-number ranges for an assertion: s0–s1 = when it may have started, e0–e1 = when it may have
 * ended. It certainly applied from s1 until e0, and may have applied from s0 until e1 (exclusive:
 * e1 is the last day that could have been the first day it no longer applied). The map, the
 * panel, land areas, and contested areas all count it until e1, lighter where it's uncertain.
 */
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

/** About half a degree: shapes with corners in the same square of this size count as touching. */
const CELL_DEGREES = 0.5;

/** The grid squares a shape's corners fall in (as numbers), to find which shapes touch. */
export function shapeCells(shape: MultiPolygon): Set<number> {
  const cells = new Set<number>();
  for (const polygon of shape) {
    for (const ring of polygon) {
      for (const [x, y] of ring) cells.add((Math.floor(x / CELL_DEGREES) + 2000) * 10_000 + (Math.floor(y / CELL_DEGREES) + 2000));
    }
  }
  return cells;
}

/**
 * Picks a fill color for each polity so that polities which might touch get different colors.
 * "Might touch" means that, during overlapping periods, their shapes have corners in a shared grid
 * square (`cells`, from shapeCells); for items without cells, that their bounding boxes overlap,
 * which is cruder: worldwide, large empires' boxes overlap nearly everything, and the eight colors
 * ran out (Phase 5). Colors are assigned greedily, most-connected polities first.
 */
export function assignColors(items: { polity: string; box: Box; s0: number; e0: number; cells?: ReadonlySet<number> }[]): Map<string, number> {
  const neighbours = new Map<string, Set<string>>();
  for (const item of items) neighbours.set(item.polity, neighbours.get(item.polity) ?? new Set());
  const link = (a: string, b: string) => {
    if (a === b) return;
    neighbours.get(a)!.add(b);
    neighbours.get(b)!.add(a);
  };
  // Shared grid squares: in each square, sweep through time, pairing only what overlaps in time.
  const byCell = new Map<number, (typeof items)[number][]>();
  for (const item of items) {
    for (const cell of item.cells ?? []) {
      const list = byCell.get(cell);
      if (list) list.push(item);
      else byCell.set(cell, [item]);
    }
  }
  for (const list of byCell.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.s0 - b.s0);
    let active: (typeof items)[number][] = [];
    for (const item of list) {
      active = active.filter((other) => other.e0 > item.s0);
      for (const other of active) link(item.polity, other.polity);
      active.push(item);
    }
  }
  // Bounding boxes, for items without cells.
  const withoutCells = items.filter((i) => !i.cells);
  for (let i = 0; i < withoutCells.length; i++) {
    for (let j = i + 1; j < withoutCells.length; j++) {
      const a = withoutCells[i];
      const b = withoutCells[j];
      const overlapInTime = a.s0 < b.e0 && b.s0 < a.e0;
      const overlapInSpace = a.box[0] <= b.box[2] && b.box[0] <= a.box[2] && a.box[1] <= b.box[3] && b.box[1] <= a.box[3];
      if (overlapInTime && overlapInSpace) link(a.polity, b.polity);
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

/**
 * Records ready for assignColors: each shape's grid squares (which shapes touch), worked out once
 * per shape, however many records use it.
 */
function colorItems(records: readonly { polity: string; shape: ShapeFeature; box: Box; s0: number; e1: number }[]) {
  const cellsOf = new Map<string, Set<number>>();
  const cells = (shape: ShapeFeature) => {
    const id = shape.properties.id;
    if (!cellsOf.has(id)) cellsOf.set(id, shapeCells(asMultiPolygon(shape.geometry)));
    return cellsOf.get(id)!;
  };
  return records.map((r) => ({ polity: r.polity, box: r.box, s0: r.s0, e0: r.e1, cells: cells(r.shape) }));
}

/**
 * One set of colors for the default map and the baseline, so a state keeps
 * its color where OpenHistoricalMap's area ends and Cliopatria's borders take over: a Cliopatria
 * polity that its reviewed crosswalk matches to one of ours (same-state) takes that polity's color.
 * Neighbours are worked out from what each layer draws (the default map during its imports' years,
 * the baseline outside them), so the same pairs are told apart as when each layer had its own.
 */
export function mapColors(ds: Dataset): Map<string, number> {
  // Polities colored alike: each matched Cliopatria polity with ours (only the second opinion's own
  // crosswalk; CShapes' links a unit to several of our states, which must keep their own colors).
  const parent = new Map<string, string>();
  const find = (p: string): string => {
    let root = p;
    while (parent.has(root)) root = parent.get(root)!;
    return root;
  };
  for (const { file, value } of ds.crosswalks) {
    if (!isSecondOpinion(file)) continue;
    for (const entry of value) {
      for (const m of entry.matches) {
        if (m.kind !== 'same-state') continue;
        const [a, b] = [find(m.polity), find(entry.unit)];
        if (a !== b) parent.set(b, a);
      }
    }
  }
  const coverage = defaultCoverage(ds);
  const shapes = new Map(ds.shapes.map(({ value }) => [value.properties.id, value]));
  const records = [
    { data: splitAtCoverage(ds, onDefaultMap, coverage, 'during'), include: onDefaultMap },
    { data: splitAtCoverage(ds, isSecondOpinion, coverage, 'outside'), include: isSecondOpinion },
  ].flatMap(({ data, include }) => {
    const pieces = new Map(data.shapes.map(({ value }) => [value.properties.id, value]));
    return data.assertions
      .filter(({ file }) => include(file))
      .flatMap(({ value }) => value)
      .filter((a): a is Assertion & { shape: string } => TERRITORIAL_RELATIONS.includes(a.relation) && !!a.shape && (pieces.has(a.shape) || shapes.has(a.shape)))
      .map((a) => {
        const shape = pieces.get(a.shape) ?? shapes.get(a.shape)!;
        const { s0, e1 } = dayRanges(a.start, a.end);
        return { polity: find(a.subject), shape, box: bounds(shape.geometry), s0, e1 };
      });
  });
  const byGroup = assignColors(colorItems(records));
  const colors = new Map<string, number>();
  for (const { value } of ds.assertions) for (const a of value) if (byGroup.has(find(a.subject))) colors.set(a.subject, byGroup.get(find(a.subject))!);
  return colors;
}

/**
 * Whether an assertions file belongs on the default map (the de facto view): our own data and
 * OpenHistoricalMap. Every other import is its own layer, never mixed into this one: each source
 * ships separately, and some (CShapes) have license terms that keep them apart.
 */
export function onDefaultMap(file: string): boolean {
  return !file.startsWith('data/imports/') || file.startsWith('data/imports/openhistoricalmap/');
}

/**
 * What the build needs to write border lines apart from the fills: each import folder's area (the
 * lines leave out its edges) and, when available, the land (the lines leave out stretches at sea).
 */
export interface OutlineContext {
  areas: ReadonlyMap<string, Box>;
  /**
   * More boxes whose edges are cuts, not borders, for every line in the layer: the edge of
   * OpenHistoricalMap's area, where Cliopatria's baseline and second opinion are cut (Phase 5).
   */
  cuts?: readonly Box[];
  land?: LandDistance;
  /** The land polygons themselves, to cut the default map's fills at the coast. */
  landPolygons?: LandIndex;
}

/**
 * How precise a border line is, as the tiles carry it (only when it's not a plain line): 1 for an
 * approximate line, 2 for a frontier zone. Treaty lines and unknown precision are drawn alike, as
 * solid lines (Phase 3 decision 3), and the panel says which.
 */
export const EDGE_CODES: Record<string, number> = { 'approximate-line': 1, 'frontier-zone': 2 };

/** From this zoom the map cuts fills at the coast and uses Natural Earth's 1:10m coastline. */
export const COAST_MIN_ZOOM = 4;
/** A border is cut at the coast only when coastal waters are at least this share of its area. */
const WATER_SHARE = 0.01;
/** Simplification of the land parts, in degrees: the same as the imports' (about 500 m). */
const LAND_SIMPLIFY = 0.005;

/**
 * The land part of a border, simplified like the imported borders, or undefined when the border
 * takes in less than WATER_SHARE of water (then the whole shape is filled, as it's drawn).
 */
export function coastCut(shape: MultiPolygon, land: LandIndex): MultiPolygon | undefined {
  const part = landPart(shape, land);
  const total = areaKm2(shape);
  if (total - areaKm2(part) < WATER_SHARE * total) return undefined;
  return part
    .map((polygon) => polygon.map((ring) => simplifyLine(ring, LAND_SIMPLIFY)).filter((ring) => ring.length >= 4))
    .filter((polygon) => polygon.length > 0);
}

/**
 * Label points for a layer's records (see buildBorderLayer): each at the point of the record's
 * land part (or shape) farthest from its edges, carrying the English name and the local name that
 * apply, split into stretches of time where the polity's names change. `a` (thousands of km²)
 * lets the map place larger territories' names first.
 */
function buildLabels(
  ds: Dataset,
  items: readonly { assertion: Assertion; shape: ShapeFeature; s0: number; s1: number; e0: number; e1: number }[],
  landPartOf: (shape: ShapeFeature) => MultiPolygon | undefined,
  labelExtra: (shape: ShapeFeature) => Record<string, string> = () => ({}),
): GeoJSON.Feature[] {
  const names = new Map(ds.polities.map(({ value }) => [value.id, value.names.map((n) => ({ text: n.text, lang: n.lang, ...nameDays(n) }))]));
  const points = new Map<string, { at: GeoJSON.Position; a: number } | null>();
  const pointOf = (shape: ShapeFeature) => {
    const id = shape.properties.id;
    if (!points.has(id)) {
      const geometry = landPartOf(shape) ?? asMultiPolygon(shape.geometry);
      const at = labelPoint(geometry);
      points.set(id, at ? { at: [Number(at[0].toFixed(4)), Number(at[1].toFixed(4))], a: Math.round(areaKm2(geometry) / 1000) } : null);
    }
    return points.get(id);
  };
  return items.flatMap(({ assertion: a, shape, s0, s1, e0, e1 }) => {
    const point = pointOf(shape);
    const polityNames = names.get(a.subject) ?? [];
    if (!point || polityNames.length === 0) return [];
    // Cut the record's days wherever one of its polity's names starts or stops.
    const cuts = [...new Set(polityNames.flatMap((n) => [n.s0, n.e0]).filter((d): d is number => d !== null && d > s0 && d < e1))].sort((x, y) => x - y);
    const bounds = [s0, ...cuts, e1];
    const pieces: { from: number; to: number; primary: string; local?: string }[] = [];
    for (let i = 0; i + 1 < bounds.length; i++) {
      const chosen = pickNames(polityNames, bounds[i], 'en');
      if (!chosen) continue;
      const last = pieces[pieces.length - 1];
      if (last && last.to === bounds[i] && last.primary === chosen.primary && last.local === chosen.local) last.to = bounds[i + 1];
      else pieces.push({ from: bounds[i], to: bounds[i + 1], primary: chosen.primary, ...(chosen.local ? { local: chosen.local } : {}) });
    }
    return pieces.map((piece): GeoJSON.Feature => {
      const isLast = piece.to === e1;
      return {
        type: 'Feature',
        properties: {
          id: a.id,
          polity: a.subject,
          s0: piece.from,
          s1: piece.from === s0 ? s1 : piece.from,
          // The last piece ends as the record does (uncertainly, when its end is); the others end
          // exactly where a name changes.
          e0: isLast ? e0 : piece.to,
          ...(isLast && e1 > e0 ? { e1 } : {}),
          name: piece.primary,
          ...(piece.local ? { local: piece.local } : {}),
          a: point.a,
          ...labelExtra(shape),
        },
        geometry: { type: 'Point', coordinates: point.at },
      };
    });
  });
}

/** The import folder an assertions file belongs to ("data/imports/<name>"), if any. */
const folderOf = (file: string) => /^(data\/imports\/[^/]+)\//.exec(file)?.[1];

export function buildBorders(ds: Dataset, outlines?: OutlineContext, colors?: ReadonlyMap<string, number>) {
  // Only during the years its imports cover: outside them, the baseline (Phase 5, decision 2).
  return buildBorderLayer(splitAtCoverage(ds, onDefaultMap, defaultCoverage(ds), 'during'), onDefaultMap, undefined, outlines, true, true, undefined, colors);
}

/**
 * The de jure view: CShapes' borders, colored by the state CShapes records as sovereign (so a
 * colony shares its owner's color). `dep` marks colonies, protectorates, mandates, and occupied
 * units.
 */
export function buildDejure(ds: Dataset, outlines?: OutlineContext) {
  return buildBorderLayer(
    ds,
    isDejure,
    (shape): Record<string, number> => {
      const status = shape.properties.cshapes_status;
      return typeof status === 'string' && status !== 'independent' ? { dep: 1 } : {};
    },
    outlines,
    false,
    true,
    // A dependency's label names the unit itself ("Korea") and its status; its record names the
    // state holding it (sovereign, or occupying), which the map adds ("Colony of Japan").
    (shape): Record<string, string> => {
      const { cshapes_status: status, cshapes_name: unit } = shape.properties;
      return typeof status === 'string' && status !== 'independent' && typeof unit === 'string' ? { unit, status } : {};
    },
  );
}

/** The "second opinion" layer: Cliopatria's borders, drawn as outlines over the default map. */
export function buildSecondOpinion(ds: Dataset, outlines?: OutlineContext) {
  // Beside the default map only: inside its imports' area and years (Phase 5, decision 2).
  const coverage = defaultCoverage(ds);
  return buildBorderLayer(splitAtCoverage(ds, isSecondOpinion, coverage, 'inside'), isSecondOpinion, undefined, cutAt(outlines, coverage));
}

/**
 * The baseline (Phase 5, decision 2): Cliopatria's borders wherever the default map has no import,
 * filled and named. Its fills aren't cut at the coast (decision 11): the map draws the sea over
 * them up close.
 */
export function buildBaseline(ds: Dataset, outlines?: OutlineContext, colors?: ReadonlyMap<string, number>) {
  const coverage = defaultCoverage(ds);
  return buildBorderLayer(splitAtCoverage(ds, isSecondOpinion, coverage, 'outside'), isSecondOpinion, undefined, cutAt(outlines, coverage), false, true, undefined, colors);
}

/** The outline context with the coverage boxes' edges as cuts too. */
const cutAt = (outlines: OutlineContext | undefined, coverage: readonly ReviewedScope[]): OutlineContext | undefined =>
  outlines && { ...outlines, cuts: [...(outlines.cuts ?? []), ...coverage.map((c) => c.box)] };

/**
 * One source's borders: the fills (`collection`), and the lines (`lines`) drawn apart from them,
 * without the edges of the import's area or, given the land, the stretches at sea.
 */
function buildBorderLayer(
  ds: Dataset,
  include: (file: string) => boolean,
  extra: (shape: ShapeFeature) => Record<string, number> = () => ({}),
  outlines?: OutlineContext,
  cutAtCoast = false,
  withLabels = false,
  labelExtra: (shape: ShapeFeature) => Record<string, string> = () => ({}),
  // Colors worked out across layers (mapColors); without them, the layer colors its own polities.
  givenColors?: ReadonlyMap<string, number>,
) {
  const shapes = new Map(ds.shapes.map(({ value }) => [value.properties.id, value]));
  const territorial = ds.assertions
    .filter(({ file }) => include(file))
    .flatMap(({ file, value }) => value.map((a) => ({ a, folder: folderOf(file) })))
    .filter((x): x is { a: Assertion & { shape: string }; folder: string | undefined } => TERRITORIAL_RELATIONS.includes(x.a.relation) && !!x.a.shape);

  const items = territorial.map(({ a, folder }) => {
    const shape = shapes.get(a.shape)!;
    return { assertion: a, folder, shape, box: bounds(shape.geometry), ...dayRanges(a.start, a.end) };
  });
  const colors = givenColors ?? assignColors(colorItems(items.map((i) => ({ polity: i.assertion.subject, shape: i.shape, box: i.box, s0: i.s0, e1: i.e1 }))));

  // Fills that stop at the coast (the default map only): each shape's land part, worked out once
  // per shape. Shapes with next to no coastal waters have none, and are filled whole.
  const landOf = new Map<string, MultiPolygon | undefined>();
  const landPartOf = (shape: ShapeFeature) => {
    const id = shape.properties.id;
    if (!cutAtCoast || !outlines?.landPolygons) return undefined;
    if (!landOf.has(id)) landOf.set(id, coastCut(asMultiPolygon(shape.geometry), outlines.landPolygons));
    return landOf.get(id);
  };

  // Only what the map itself uses goes into the tiles, because it's repeated in every tile. The
  // territory panel gets the rest (dates as written, sources) from the polity files.
  const fillProperties = ({ assertion: a, shape, s0, s1, e0, e1, endUnknown }: (typeof items)[number]) => ({
    id: a.id,
    polity: a.subject,
    relation: a.relation,
    s0,
    s1,
    e0,
    // Only when the end is uncertain (a month or a year), to keep the tiles small.
    ...(e1 > e0 ? { e1 } : {}),
    ...(endUnknown ? { endUnknown: true } : {}),
    color: colors.get(a.subject) ?? 0,
    ...extra(shape),
  });
  const collection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: items.map((item) => ({
      type: 'Feature',
      // `coast`: this shape also has a land part (in `land`); up close, the whole shape is only a
      // faint tint of coastal waters, and the land part is filled.
      properties: { ...fillProperties(item), ...(landPartOf(item.shape) ? { coast: 1 } : {}) },
      geometry: item.shape.geometry as GeoJSON.Geometry,
    })),
  };
  const land: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: items.flatMap((item) => {
      const part = landPartOf(item.shape);
      return part && part.length > 0
        ? [{ type: 'Feature' as const, properties: fillProperties(item), geometry: { type: 'MultiPolygon' as const, coordinates: part } }]
        : [];
    }),
  };
  // The lines: each shape's outline is worked out once, however many records use the shape.
  const outlineOf = new Map<string, GeoJSON.Position[][]>();
  const lines: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: items.flatMap(({ assertion: a, folder, shape, s0, e0, e1 }) => {
      const key = `${a.shape} ${folder ?? ''}`;
      let coordinates = outlineOf.get(key);
      if (!coordinates) {
        const area = folder ? outlines?.areas.get(folder) : undefined;
        coordinates = borderLines(asMultiPolygon(shape.geometry), area, outlines?.land, outlines?.cuts);
        outlineOf.set(key, coordinates);
      }
      if (coordinates.length === 0) return [];
      return [
        {
          type: 'Feature' as const,
          // What the line layers filter on: which record and polity, and when (no s1: lines aren't
          // drawn lighter while a start is uncertain; the fill is).
          properties: {
            id: a.id,
            polity: a.subject,
            s0,
            e0,
            ...(e1 > e0 ? { e1 } : {}),
            ...(EDGE_CODES[shape.properties.edge_precision] ? { ep: EDGE_CODES[shape.properties.edge_precision] } : {}),
            ...extra(shape),
          },
          geometry: { type: 'MultiLineString' as const, coordinates },
        },
      ];
    }),
  };
  const dataBounds = items.reduce<Bounds>(
    (all, { box }) => [Math.min(all[0], box[0]), Math.min(all[1], box[1]), Math.max(all[2], box[2]), Math.max(all[3], box[3])],
    [180, 90, -180, -90],
  );
  // Names on the map: one point per record, inside its land (or its shape), with the name its
  // source gives, split where the name changes during the record.
  const labels: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: withLabels ? buildLabels(ds, items, landPartOf, labelExtra) : [] };

  // The sources of this layer's records, so the panel can name them even where they have nothing.
  const sources = [...new Set(items.map(({ assertion: a }) => a.sources[0].source))].sort();
  // The kinds of imprecise line this layer has, so the legend only explains what the map can show.
  const precision = [...new Set(items.map(({ shape }) => shape.properties.edge_precision).filter((e) => EDGE_CODES[e]))].sort();
  return { collection, lines, land, labels, bounds: dataBounds, sources, precision };
}

const asMultiPolygon = (geometry: ShapeFeature['geometry']): MultiPolygon =>
  (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates) as MultiPolygon;

/** Territorial assertions from some files, with their shapes and days, for comparing sources. */
function timedShapes(ds: Dataset, include: (file: string) => boolean, relations: readonly string[]): TimedShape[] {
  const shapes = new Map(ds.shapes.map(({ value }) => [value.properties.id, value]));
  return ds.assertions
    .filter(({ file }) => include(file))
    .flatMap(({ value }) => value)
    .filter((a) => relations.includes(a.relation) && a.shape && shapes.has(a.shape))
    .map((a) => {
      const geometry = asMultiPolygon(shapes.get(a.shape!)!.geometry);
      // Every day it may have applied, and, when narrower, the days it certainly did.
      const { s0, s1, e0, e1 } = dayRanges(a.start, a.end);
      const certain = { ...(s1 > s0 ? { c0: s1 } : {}), ...(e1 > e0 ? { c1: e0 } : {}) };
      return { record: a.id, holder: a.subject, relation: a.relation, source: a.sources[0].source, s0, e0: e1, ...certain, shape: a.shape!, geometry, box: boundingBox(geometry) };
    });
}

/**
 * Where and when the default map's imports hold their data: each default-map import's area and
 * years (from its manifest's settings), as boxes and days [d0, d1). Outside these, Cliopatria is
 * the baseline (Phase 5, decision 2).
 */
export function defaultCoverage(ds: Dataset): ReviewedScope[] {
  return [...importSettings(ds)]
    .filter(([folder]) => onDefaultMap(`${folder}/`))
    .map(([, { box, fromYear, toYear }]) => ({
      box,
      d0: fromYear !== undefined ? civilToJdn(fromYear, 1, 1) : -FAR_FUTURE,
      d1: toYear !== undefined ? civilToJdn(toYear + 1, 1, 1) : FAR_FUTURE,
    }));
}

/**
 * A copy of the dataset in which the territorial records of the files `include` accepts are cut at
 * the edges of the coverage scopes:
 *   - 'outside' keeps what lies outside every scope: the days before and after a scope whole, and
 *     during it the part of the shape outside its box (Cliopatria's baseline);
 *   - 'inside' keeps only the part inside a scope's box during its days (Cliopatria's second
 *     opinion, beside OpenHistoricalMap);
 *   - 'during' keeps whole shapes, but only during the scopes' days (OpenHistoricalMap, whose import
 *     is complete only for its years).
 * Each piece keeps its record's ID, and its dates stay as written except where a scope cuts them
 * (then the cut's day, which is exact). Cut shapes get IDs of their own ("<shape>~out", "~in"),
 * which exist only in the build. With no scopes, 'outside' and 'during' keep everything and
 * 'inside' nothing.
 */
export function splitAtCoverage(ds: Dataset, include: (file: string) => boolean, scopes: readonly ReviewedScope[], mode: 'outside' | 'inside' | 'during'): Dataset {
  if (scopes.length === 0) return mode === 'inside' ? { ...ds, assertions: ds.assertions.filter(({ file }) => !include(file)) } : ds;
  const shapes = new Map(ds.shapes.map(({ value }) => [value.properties.id, value]));
  const cutShapes = new Map<string, Loaded<ShapeFeature>>();
  const cut = (shape: ShapeFeature, file: string, box: Box, how: 'out' | 'in'): string | undefined => {
    const id = `${shape.properties.id}~${how}`;
    if (!cutShapes.has(id)) {
      const geometry = asMultiPolygon(shape.geometry);
      const [w, s, e, n] = box;
      const frame = [[[[w, s], [e, s], [e, n], [w, n], [w, s]]]];
      const clipped = how === 'out' ? polygonClipping.difference(geometry as never, frame as never) : polygonClipping.intersection(geometry as never, frame as never);
      const result = cleanMultiPolygon(clipped as MultiPolygon, 4);
      if (result.length === 0) return undefined;
      cutShapes.set(id, { file, value: { ...shape, properties: { ...shape.properties, id }, geometry: { type: 'MultiPolygon', coordinates: result } } });
    }
    return id;
  };
  const touches = (shape: ShapeFeature, [w, s, e, n]: Box) => {
    const [bw, bs, be, bn] = bounds(shape.geometry);
    return bw < e && be > w && bs < n && bn > s;
  };
  const within = (shape: ShapeFeature, [w, s, e, n]: Box) => {
    const [bw, bs, be, bn] = bounds(shape.geometry);
    return bw >= w && be <= e && bs >= s && bn <= n;
  };
  /** A day as EDTF (1901-05-12; -0040-01-01 for 41 BCE). */
  const edtfDay = (jdn: number) => formatDayForUrl(jdn);

  /** One record cut at one scope, keeping what `mode` asks for. */
  const splitOne = (file: string, p: Assertion, { box, d0, d1 }: ReviewedScope): Assertion[] => {
    const piece = shapes.get(p.shape!) ?? cutShapes.get(p.shape!)?.value;
    if (!piece) return [];
    const { s0, e1 } = dayRanges(p.start, p.end);
    const before = s0 < d0 ? { ...p, end: e1 <= d0 ? p.end : edtfDay(d0) } : undefined;
    const during = s0 < d1 && e1 > d0 ? { ...p, start: s0 >= d0 ? p.start : edtfDay(d0), end: e1 <= d1 ? p.end : edtfDay(d1) } : undefined;
    const after = e1 > d1 ? { ...p, start: s0 >= d1 ? p.start : edtfDay(d1) } : undefined;
    if (mode === 'during') return during ? [during] : [];
    if (mode === 'inside') {
      if (!during || !touches(piece, box)) return [];
      if (within(piece, box)) return [during];
      const id = cut(piece, file, box, 'in');
      return id ? [{ ...during, shape: id }] : [];
    }
    const kept: Assertion[] = [...(before ? [before] : []), ...(after ? [after] : [])];
    if (during && !touches(piece, box)) kept.push(during);
    else if (during && !within(piece, box)) {
      const id = cut(piece, file, box, 'out');
      if (id) kept.push({ ...during, shape: id });
    }
    return kept;
  };

  const assertions = ds.assertions.map(({ file, value }) => {
    if (!include(file) || !Array.isArray(value)) return { file, value };
    const pieces = value.flatMap((a): Assertion[] => {
      if (!a.shape || !shapes.has(a.shape) || !TERRITORIAL_RELATIONS.includes(a.relation)) return mode === 'inside' ? [] : [a];
      // Inside and during: a piece for each scope (they don't overlap). Outside: every scope is
      // taken away in turn.
      if (mode !== 'outside') return scopes.flatMap((scope) => splitOne(file, a, scope));
      let parts: Assertion[] = [a];
      for (const scope of scopes) parts = parts.flatMap((p) => splitOne(file, p, scope));
      return parts;
    });
    return { file, value: pieces };
  });
  return { ...ds, assertions, shapes: [...ds.shapes, ...cutShapes.values()] };
}

export interface CrosswalkLink extends Link {
  unit: string;
  kind: 'same-state' | 'dependency';
}

/** The crosswalks' matches, as day ranges (m1 exclusive; open ends are infinite). */
export function crosswalkLinks(ds: Dataset): CrosswalkLink[] {
  return ds.crosswalks.flatMap(({ value }) =>
    value.flatMap((entry) =>
      entry.matches.map((m) => ({
        unit: entry.unit,
        polity: m.polity,
        kind: m.kind,
        m0: m.from ? parseEdtfDate(m.from).earliest : -Infinity,
        m1: m.until ? parseEdtfDate(m.until).earliest : Infinity,
      })),
    ),
  );
}

/** Natural Earth's 1:10m land, used to measure land areas (public domain). */
const LAND_FOLDER = join(ROOT, 'data', 'imports', 'natural-earth');
const LAND_FILE = join(LAND_FOLDER, 'ne_10m_land.geojson');

/**
 * The land area a polity holds on the default map, in one relation (administers, occupies, …),
 * over a stretch of time in which the same records apply. When several records apply at once,
 * it's measured over all of them together, so any overlap counts once.
 */
export interface AreaFigure {
  relation: Relation;
  /** When it applies: from s0 until e0 (exclusive), as day numbers. */
  s0: number;
  e0: number;
  /** The records measured. */
  records: string[];
  /** Land inside the borders, in km² (measured on the globe). */
  landKm2: number;
  /** Everything inside the borders, including coastal waters, in km². */
  totalKm2: number;
  /** Set when a shape was cut at the edge of its import's area: that area, in words. */
  partOf?: string;
  /** The records' sources, then the land polygons'. */
  sources: Citation[];
}

/** Rounds to 3 significant figures: neither the borders nor the coastline is more precise. */
const roughly = (km2: number) => Number(km2.toPrecision(3));

/** An area such as "10°N–55°N, 73°E–150°E" (west, south, east, north in degrees). */
function describeArea([w, s, e, n]: Box): string {
  const lat = (v: number) => `${Math.abs(v)}°${v < 0 ? 'S' : 'N'}`;
  const lon = (v: number) => `${Math.abs(v)}°${v < 0 ? 'W' : 'E'}`;
  return `${lat(s)}–${lat(n)}, ${lon(w)}–${lon(e)}`;
}

/** Each import folder's settings from its manifest: its area (settings.bbox) and years. */
function importSettings(ds: Dataset): Map<string, { box: Box; fromYear?: number; toYear?: number }> {
  const settings = new Map<string, { box: Box; fromYear?: number; toYear?: number }>();
  for (const folder of ds.imports) {
    const file = join(ds.root ?? ROOT, folder, 'manifest.json');
    if (!existsSync(file)) continue;
    const s = JSON.parse(readFileSync(file, 'utf8')).settings;
    if (s?.bbox) settings.set(folder, { box: [s.bbox.west, s.bbox.south, s.bbox.east, s.bbox.north], fromYear: s.fromYear, toYear: s.toYear });
  }
  return settings;
}

/** Each import folder's area, from the settings.bbox its manifest records. */
function importAreas(ds: Dataset): Map<string, Box> {
  return new Map([...importSettings(ds)].map(([folder, { box }]) => [folder, box]));
}

/**
 * Natural Earth's 1:10m land around the imports' areas (a degree wider, so the edges of the areas
 * are well inside it), or undefined when there are no areas or no land file.
 */
export function loadLand(ds: Dataset): LandIndex | undefined {
  const areas = [...importAreas(ds).values()];
  if (areas.length === 0 || !existsSync(LAND_FILE)) return undefined;
  const extent: Box = [
    Math.min(...areas.map((a) => a[0])) - 1,
    Math.min(...areas.map((a) => a[1])) - 1,
    Math.max(...areas.map((a) => a[2])) + 1,
    Math.max(...areas.map((a) => a[3])) + 1,
  ];
  const land = JSON.parse(readFileSync(LAND_FILE, 'utf8')).features.map((f: { geometry: ShapeFeature['geometry'] }) => f.geometry);
  return new LandIndex(land, extent);
}

/**
 * public/data/edges.json: where each import's area ends, over land, while its years apply, so
 * the map can draw "Edge of imported data" instead of letting borders stop in a straight line.
 * Imports that share an area and years share one edge.
 */
export function buildEdges(ds: Dataset, land?: LandDistance): GeoJSON.FeatureCollection {
  const seen = new Set<string>();
  const features: GeoJSON.Feature[] = [];
  // Only the default map's imports: the others cover the whole world since Phase 5, and beyond the
  // default map's area the map continues with the baseline, not "no data".
  for (const [folder, { box, fromYear, toYear }] of [...importSettings(ds)].filter(([f]) => onDefaultMap(`${f}/`))) {
    const s0 = fromYear !== undefined ? parseEdtfDate(String(fromYear).padStart(4, '0')).earliest : -FAR_FUTURE;
    const e0 = toYear !== undefined ? parseEdtfDate(String(toYear + 1).padStart(4, '0')).earliest : FAR_FUTURE;
    const key = `${box.join(',')} ${s0} ${e0}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const coordinates = boxEdgeOnLand(box, land);
    if (coordinates.length > 0) {
      features.push({ type: 'Feature', properties: { folder, s0, e0 }, geometry: { type: 'MultiLineString', coordinates } });
    }
  }
  return { type: 'FeatureCollection', features };
}

/**
 * The land areas of every polity on the default map, per relation and stretch of time (see
 * AreaFigure). `areas` gives each import folder's area, to tell when a shape was cut at its edge;
 * `landSource` cites the land polygons.
 */
export function computeAreas(
  ds: Dataset,
  land: LandIndex,
  areas: ReadonlyMap<string, Box>,
  landSource: Citation,
): Map<string, AreaFigure[]> {
  const shapes = new Map(ds.shapes.map(({ value }) => [value.properties.id, asMultiPolygon(value.geometry)]));
  interface Item {
    a: Assertion & { shape: string };
    area?: Box;
    s0: number;
    e0: number;
  }
  const groups = new Map<string, Item[]>();
  for (const { file, value } of ds.assertions) {
    if (!onDefaultMap(file)) continue;
    const folder = /^(data\/imports\/[^/]+)\//.exec(file)?.[1];
    const area = folder ? areas.get(folder) : undefined;
    for (const a of value) {
      if (!TERRITORIAL_RELATIONS.includes(a.relation) || !a.shape || !shapes.has(a.shape)) continue;
      // Counted until the last day it could have ended, as the map shows it.
      const { s0, e1 } = dayRanges(a.start, a.end);
      const key = `${a.subject} ${a.relation}`;
      groups.set(key, [...(groups.get(key) ?? []), { a: a as Item['a'], area, s0, e0: e1 }]);
    }
  }

  // The same set of shapes is measured once, however many stretches of time it appears in.
  const measured = new Map<string, Pick<AreaFigure, 'landKm2' | 'totalKm2' | 'partOf'>>();
  const measure = (items: Item[]) => {
    const ids = [...new Set(items.map((i) => i.a.shape))].sort();
    let m = measured.get(ids.join(' '));
    if (!m) {
      const geometries = ids.map((id) => shapes.get(id)!);
      const all = geometries.length === 1 ? geometries[0] : (polygonClipping.union(...(geometries as [never])) as MultiPolygon);
      const cut = items.find((i) => i.area && touchesEdge(shapes.get(i.a.shape)!, i.area));
      m = {
        landKm2: roughly(areaKm2(landPart(all, land))),
        totalKm2: roughly(areaKm2(all)),
        ...(cut ? { partOf: describeArea(cut.area!) } : {}),
      };
      measured.set(ids.join(' '), m);
    }
    return m;
  };

  const byPolity = new Map<string, AreaFigure[]>();
  for (const items of groups.values()) {
    const days = [...new Set(items.flatMap((i) => [i.s0, i.e0]))].sort((x, y) => x - y);
    for (let k = 0; k + 1 < days.length; k++) {
      const active = items.filter((i) => i.s0 <= days[k] && days[k] < i.e0);
      if (active.length === 0) continue;
      const m = measure(active);
      // No land under the border in the coastline data (a rock too small for it, say): leave the
      // figure out rather than show 0.
      if (m.landKm2 === 0) continue;
      const cited = new Map([...active.flatMap((i) => i.a.sources), landSource].map((c) => [`${c.source} ${c.locator}`, c]));
      const { subject, relation } = active[0].a;
      byPolity.set(subject, [
        ...(byPolity.get(subject) ?? []),
        { relation, s0: days[k], e0: days[k + 1], records: active.map((i) => i.a.id).sort(), ...m, sources: [...cited.values()] },
      ]);
    }
  }
  for (const figures of byPolity.values()) figures.sort((x, y) => x.s0 - y.s0 || x.relation.localeCompare(y.relation));
  return byPolity;
}

/**
 * The base map up close (from COAST_MIN_ZOOM), inside the imports' areas: Natural Earth's 1:10m
 * land and the sea around it, both as fills, and the coastline without the straight cuts at the
 * area's edge. The map draws these over the coarser 1:50m base map there, so the coast matches
 * where the fills are cut.
 */
export function buildCoast(land: LandIndex, box: Box): GeoJSON.FeatureCollection {
  const [w, s, e, n] = box;
  const frame: MultiPolygon = [[[[w, s], [e, s], [e, n], [w, n], [w, s]]]];
  const inside = polygonClipping.intersection(land.all() as never, frame as never) as MultiPolygon;
  const sea = polygonClipping.difference(frame as never, inside as never) as MultiPolygon;
  const coast = borderLines(inside, box, undefined);
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { kind: 'land' }, geometry: { type: 'MultiPolygon', coordinates: inside } },
      { type: 'Feature', properties: { kind: 'sea' }, geometry: { type: 'MultiPolygon', coordinates: sea } },
      { type: 'Feature', properties: { kind: 'coast' }, geometry: { type: 'MultiLineString', coordinates: coast } },
    ],
  };
}

/** computeAreas with Natural Earth's land polygons (from loadLand). */
export function buildAreas(ds: Dataset, land = loadLand(ds)): Map<string, AreaFigure[]> {
  if (!land) return new Map();
  const release = JSON.parse(readFileSync(join(LAND_FOLDER, 'manifest.json'), 'utf8')).release;
  return computeAreas(ds, land, importAreas(ds), { source: 'natural-earth', locator: `1:10m land, release ${release}` });
}

/** Where the default map's source and a de jure source disagree (see scripts/lib/contested.ts). */
export function buildContested(ds: Dataset): ContestedArea[] {
  const byUnit = new Map<string, Link[]>();
  for (const link of crosswalkLinks(ds)) byUnit.set(link.unit, [...(byUnit.get(link.unit) ?? []), link]);
  const areas = computeContested(
    timedShapes(ds, onDefaultMap, ['administers', 'controls', 'occupies']),
    timedShapes(ds, isDejure, ['sovereign', 'occupies']),
    byUnit,
  );
  // Only where the de jure source's crosswalk has been reviewed (Phase 5 decision 6). A dataset
  // made by hand (in tests) that doesn't say is taken as reviewed everywhere.
  return ds.crosswalkScopes ? withinScopes(areas, reviewedScopes(ds, isDejure)) : areas;
}

/** The reviewed scopes (crosswalk-reviewed.yaml) of the import folders `include` accepts, as boxes and days. */
export function reviewedScopes(ds: Dataset, include: (file: string) => boolean): ReviewedScope[] {
  return (ds.crosswalkScopes ?? [])
    .filter(({ file }) => include(file))
    .flatMap(({ value }) => value)
    .map((scope) => ({
      box: [scope.area.west, scope.area.south, scope.area.east, scope.area.north] as Box,
      d0: parseEdtfDate(scope.from).earliest,
      d1: parseEdtfDate(scope.until).earliest,
    }));
}

/**
 * "Sources differ" areas are shown only where a difference is at least this large and this wide:
 * Cliopatria works at about 40 km² resolution (a pixel of about 6 km), so its borders wander a few
 * kilometres either side of the others', leaving thin strips that aren't a real disagreement.
 * Proposed from measurements (Phase 3 step 7), for the maintainers to approve.
 */
export const DIFFER_MIN_KM2 = 1_000;
export const DIFFER_MIN_WIDTH_KM = 10;

/**
 * Where the default map's source and the second opinion (Cliopatria) name different holders on
 * the same days: both record control, so where they differ, the sources simply differ (not a
 * dispute in the world; that's "contested"). The crosswalk decides what counts as the same polity.
 */
export function buildDiffer(ds: Dataset): ContestedArea[] {
  const byUnit = new Map<string, Link[]>();
  for (const link of crosswalkLinks(ds)) byUnit.set(link.unit, [...(byUnit.get(link.unit) ?? []), link]);
  const areas = computeContested(
    timedShapes(ds, onDefaultMap, ['administers', 'controls', 'occupies']),
    timedShapes(ds, isSecondOpinion, ['controls']),
    byUnit,
    DIFFER_MIN_KM2,
    DIFFER_MIN_WIDTH_KM,
  );
  // Only where both are on the map: inside the default map's imports' area and years (Phase 5).
  const coverage = defaultCoverage(ds);
  return coverage.length > 0 ? withinScopes(areas, coverage) : areas;
}

/** The contested areas as a layer: only what the map needs (who, and when). */
export function contestedCollection(areas: readonly ContestedArea[]) {
  const collection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: areas.map((a) => ({
      type: 'Feature',
      properties: { id: a.id, facto: a.facto, jure: a.jure, s0: a.s0, e0: a.e0, ...(a.maybe ? { maybe: 1 } : {}) },
      geometry: { type: 'MultiPolygon', coordinates: a.geometry } as GeoJSON.MultiPolygon,
    })),
  };
  const bounds = areas.reduce<Bounds>((all, a) => {
    const b = boundingBox(a.geometry);
    return [Math.min(all[0], b[0]), Math.min(all[1], b[1]), Math.max(all[2], b[2]), Math.max(all[3], b[3])];
  }, [180, 90, -180, -90]);
  // A "Contested" label for each area, at its point farthest from its edges.
  const labels: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: areas.flatMap((a) => {
      const at = labelPoint(a.geometry);
      return at
        ? [{ type: 'Feature' as const, properties: { s0: a.s0, e0: a.e0, ...(a.maybe ? { maybe: 1 } : {}), a: Math.round(a.km2 / 1000) }, geometry: { type: 'Point' as const, coordinates: at } }]
        : [];
    }),
  };
  return { collection, labels, bounds };
}

/**
 * The change index: every day on which some border starts (s0), stops being uncertain (s1), may
 * have ended (e0), or has certainly ended (e1). The map's filter and styling only compare the day
 * against these values, so the map looks identical between two consecutive change days.
 */
export function changeDays(collection: GeoJSON.FeatureCollection): number[] {
  const days = new Set<number>();
  for (const { properties } of collection.features) {
    for (const key of ['s0', 's1', 'e0', 'e1']) {
      const day = properties?.[key];
      if (typeof day === 'number' && Math.abs(day) < FAR_FUTURE) days.add(day);
    }
  }
  return [...days].sort((a, b) => a - b);
}

/**
 * public/data/events.json: every event's day range, importance, and title, sorted by start, for
 * the timeline's markers. (Summaries and sources stay out of it; the panel will load them.)
 */
export function buildEvents(ds: Dataset): { events: TimelineEvent[] } {
  const events = ds.events
    .map(({ value: e }): TimelineEvent => {
      const { s0, s1, inexact } = eventDays(e.date);
      return {
        id: e.id,
        title: e.title,
        date: e.date,
        s0,
        s1,
        importance: e.importance ?? DEFAULT_IMPORTANCE,
        ...(inexact ? { inexact } : {}),
        ...(e.location ? { at: [...e.location.coordinates, e.location.precision_km] as [number, number, number] } : {}),
      };
    })
    .sort((a, b) => a.s0 - b.s0 || a.id.localeCompare(b.id));
  return { events };
}

/**
 * public/data/events/<id>.json: everything the panel shows about one event, with the records it
 * started or ended ("effects") written out in full, and names for the polities it mentions.
 */
export function buildEventFiles(ds: Dataset): EventFile[] {
  const polities = new Map(ds.polities.map(({ value }) => [value.id, value]));
  const assertions = new Map(ds.assertions.flatMap(({ value }) => value).map((a) => [a.id, a]));
  return ds.events.map(({ value: e }) => {
    // The validator guarantees every effect names an existing assertion.
    const effects = (e.effects ?? []).map((id) => assertionRecord(assertions.get(id)!));
    const mentioned = new Set([...(e.polities ?? []), ...effects.flatMap((r) => [r.subject, ...(r.object ? [r.object] : [])])]);
    return {
      id: e.id,
      ...(e.wikidata ? { wikidata: e.wikidata } : {}),
      title: e.title,
      date: e.date,
      importance: e.importance ?? DEFAULT_IMPORTANCE,
      ...(e.location ? { location: e.location } : {}),
      summary: e.summary,
      ...(e.polities?.length ? { polities: e.polities } : {}),
      ...(effects.length ? { effects } : {}),
      sources: e.sources,
      ...(mentioned.size ? { related: namesFor(mentioned, polities) } : {}),
    };
  });
}

/**
 * public/data/changes.json: every day a territorial record starts or ends, with its polity, the
 * date as written, and its source, sorted by day. The "around this date" list reads it. (The
 * change index in tiles.json has the days only.)
 */
export function buildChanges(ds: Dataset): { changes: BorderChange[] } {
  const changes: BorderChange[] = [];
  for (const a of ds.assertions.flatMap(({ value }) => value)) {
    if (!TERRITORIAL_RELATIONS.includes(a.relation)) continue;
    const { s0, e0 } = dayRanges(a.start, a.end);
    const common = { polity: a.subject, record: a.id, relation: a.relation, source: a.sources[0] };
    changes.push({ day: s0, kind: 'start', date: a.start, ...common });
    if (e0 < FAR_FUTURE) changes.push({ day: e0, kind: 'end', date: a.end, ...common });
  }
  changes.sort((x, y) => x.day - y.day || x.polity.localeCompare(y.polity) || x.record.localeCompare(y.record));
  return { changes };
}

/** public/data/sources.json: each source's title and address, shared by all polity files. */
export function buildSources(ds: Dataset): SourcesFile {
  const sources = Object.fromEntries(
    ds.sources.map(({ value: s }) => [
      s.id,
      { title: s.title, ...(s.url ? { url: s.url } : {}), ...(s.attribution ? { attribution: s.attribution } : {}) },
    ]),
  );
  return { sources };
}

/** A name's day range, for choosing which name applies on a day (see src/map/names.ts). */
function nameDays(n: PolityName) {
  return {
    s0: n.start ? parseEdtfDate(n.start).earliest : null,
    e0: n.end && n.end !== 'ongoing' && n.end !== 'unknown' ? parseEdtfDate(n.end).earliest : null,
  };
}

/**
 * An assertion as the panel shows it: dates as written plus day numbers, and for a territorial
 * record, its shape's area and how precise its border is (`edges` gives each shape's).
 */
function assertionRecord(a: Assertion, km2?: ReadonlyMap<string, number>, edges?: ReadonlyMap<string, string>): PolityRecord {
  const { s0, s1, e0, e1 } = dayRanges(a.start, a.end);
  const area = a.shape ? km2?.get(a.shape) : undefined;
  return {
    id: a.id,
    relation: a.relation,
    subject: a.subject,
    ...(a.object ? { object: a.object } : {}),
    ...(a.recognized_by ? { recognized_by: a.recognized_by } : {}),
    start: a.start,
    end: a.end,
    s0,
    s1,
    e0,
    ...(e1 > e0 ? { e1 } : {}),
    sources: a.sources,
    ...(a.notes ? { notes: a.notes } : {}),
    ...(area !== undefined ? { km2: Math.round(area) } : {}),
    ...(a.shape && edges?.get(a.shape) ? { edge: edges.get(a.shape) } : {}),
  };
}

/** Just enough about each of some polities to name them: their names with day ranges. */
function namesFor(ids: Iterable<string>, polities: Map<string, Polity>): Record<string, AtlasName[]> {
  return Object.fromEntries(
    [...ids].map((id) => [id, (polities.get(id)?.names ?? []).map((n) => ({ text: n.text, lang: n.lang, ...nameDays(n) }))]),
  );
}

/**
 * public/data/polities/<id>.json: everything the territory panel shows about one polity, so a
 * visitor downloads only the polities they open. Each file has all the polity's names and every
 * assertion that mentions it (as subject, or as the other polity in a relation).
 */
export function buildPolityFiles(
  ds: Dataset,
  contested: readonly ContestedArea[] = [],
  areas: ReadonlyMap<string, AreaFigure[]> = new Map(),
  differ: readonly ContestedArea[] = [],
): PolityFile[] {
  const polities = new Map(ds.polities.map(({ value }) => [value.id, value]));
  const mentions = new Map<string, Assertion[]>();
  for (const a of ds.assertions.flatMap(({ value }) => value)) {
    for (const id of new Set([a.subject, ...(a.object ? [a.object] : [])])) {
      mentions.set(id, [...(mentions.get(id) ?? []), a]);
    }
  }
  const shapes = new Map(ds.shapes.map(({ value }) => [value.properties.id, asMultiPolygon(value.geometry)]));
  const km2 = new Map([...shapes].map(([id, geometry]) => [id, areaKm2(geometry)]));
  const edges = new Map(ds.shapes.map(({ value }) => [value.properties.id, value.properties.edge_precision]));
  // The area Cliopatria gives for each of its shapes (its `Area` column), in km².
  const givenAreas = new Map(
    ds.shapes.flatMap(({ value }) => (typeof value.properties.cliopatria_area_km2 === 'number' ? [[value.properties.id, value.properties.cliopatria_area_km2] as const] : [])),
  );
  const links = crosswalkLinks(ds);

  /** Whether two territorial records share land (at least CShapes' 10,000 km²) on the same days. */
  const shareLand = (a: Assertion, b: Assertion) => {
    const ra = dayRanges(a.start, a.end);
    const rb = dayRanges(b.start, b.end);
    if (Math.max(ra.s0, rb.s0) >= Math.min(ra.e1, rb.e1) || !a.shape || !b.shape) return false;
    const overlap = polygonClipping.intersection(shapes.get(a.shape) as never, shapes.get(b.shape) as never) as MultiPolygon;
    return areaKm2(overlap) >= 10_000;
  };

  return ds.polities.map(({ value: p }) => {
    const own = (mentions.get(p.id) ?? []).map((a) => assertionRecord(a, km2, edges));

    // Records of the de jure units the crosswalk links to this polity. A same-state link brings
    // all of the unit's records; a dependency link only those that share land with this polity's
    // own records (the United Kingdom's record for India, not for Burma, in the British Raj).
    const ownTerritorial = (mentions.get(p.id) ?? []).filter((a) => a.subject === p.id && a.shape);
    const linked: PolityRecord[] = [];
    for (const link of links.filter((l) => l.polity === p.id)) {
      for (const a of mentions.get(link.unit) ?? []) {
        if (a.subject !== link.unit) continue;
        const { s0, e1 } = dayRanges(a.start, a.end);
        if (Math.max(s0, link.m0) >= Math.min(e1, link.m1)) continue;
        if (link.kind === 'dependency' && !ownTerritorial.some((o) => shareLand(o, a))) continue;
        linked.push({
          ...assertionRecord(a, km2, edges),
          via: link.unit,
          link: link.kind,
          ...(Number.isFinite(link.m0) ? { m0: link.m0 } : {}),
          ...(Number.isFinite(link.m1) ? { m1: link.m1 } : {}),
        });
      }
    }
    const records = [...own, ...linked].sort((a, b) => a.s0 - b.s0 || a.id.localeCompare(b.id));

    // Where the sources disagree over this polity's territory: as the default map's side, as the
    // other source's unit itself, or through a record the crosswalk links to it. Contested areas
    // (against the legal borders) and "sources differ" areas (against the second opinion) alike.
    const linkedWindows = new Map(linked.map((r) => [r.id, [r.m0 ?? -Infinity, r.m1 ?? Infinity] as const]));
    const entriesFrom = (found: readonly ContestedArea[]) => {
      const entries: ContestedEntry[] = [];
      for (const c of found) {
        if (c.facto === p.id) {
          entries.push({ side: 'facto', other: c.jure, relation: c.jureRelation, source: c.jureSource, s0: c.s0, e0: c.e0, ...(c.maybe ? { maybe: true } : {}), km2: c.km2 });
        }
        const window = c.jure === p.id ? ([-Infinity, Infinity] as const) : linkedWindows.get(c.jureRecord);
        if (window) {
          const s0 = Math.max(c.s0, window[0]);
          const e0 = Math.min(c.e0, window[1]);
          if (s0 < e0) entries.push({ side: 'jure', other: c.facto, relation: c.factoRelation, source: c.factoSource, s0, e0, ...(c.maybe ? { maybe: true } : {}), km2: c.km2 });
        }
      }
      entries.sort((a, b) => a.s0 - b.s0 || a.other.localeCompare(b.other));
      // Merge back-to-back periods that would read the same in the panel (it shows areas to 2
      // significant figures), so a long disagreement split by many small changes stays one entry.
      const shown = (km2: number) => Number(km2.toPrecision(2));
      const merged: ContestedEntry[] = [];
      for (const entry of entries) {
        const same = merged.find(
          (m) =>
            m.e0 === entry.s0 &&
            m.side === entry.side &&
            m.other === entry.other &&
            m.relation === entry.relation &&
            m.source === entry.source &&
            !!m.maybe === !!entry.maybe &&
            shown(m.km2) === shown(entry.km2),
        );
        if (same) same.e0 = entry.e0;
        else merged.push({ ...entry });
      }
      return merged;
    };
    const disputes = entriesFrom(contested);
    const differences = entriesFrom(differ);

    // Figures: this polity's land areas (computed by computeAreas), then any sourced figures
    // from data/figures/.
    const figures: FigureEntry[] = [];
    for (const f of areas.get(p.id) ?? []) {
      const water = roughly(f.totalKm2 - f.landKm2);
      figures.push({
        metric: 'area-km2',
        value: f.landKm2,
        basis: 'computed-from-shape',
        s0: f.s0,
        e0: f.e0,
        relation: f.relation,
        records: f.records,
        ...(f.partOf ? { partOf: f.partOf } : {}),
        // Coastal waters inside the border, when they're more than a sliver.
        ...(water >= f.totalKm2 * 0.01 ? { waterKm2: water } : {}),
        sources: f.sources,
      });
    }
    // Areas a source gives for its own shapes (Cliopatria's `Area`, Phase 5 decision 7), instead of
    // measuring its 12,000 rows on every build: one per record, for the days it certainly covers
    // (a yearly row's years), credited to the record's source.
    for (const a of mentions.get(p.id) ?? []) {
      const given = a.subject === p.id && a.shape ? givenAreas.get(a.shape) : undefined;
      if (given === undefined || !TERRITORIAL_RELATIONS.includes(a.relation)) continue;
      const { s0, e0 } = dayRanges(a.start, a.end);
      figures.push({
        metric: 'area-km2',
        value: roughly(given),
        basis: 'computed-from-shape',
        computedBy: a.sources[0].source,
        s0,
        e0,
        relation: a.relation,
        records: [a.id],
        sources: [a.sources[0]],
      });
    }
    for (const f of ds.figures.flatMap(({ value }) => value).filter((f) => f.polity === p.id)) {
      const when = parseEdtfDate(f.date);
      figures.push({
        metric: f.metric,
        ...(f.value !== undefined ? { value: f.value } : {}),
        ...(f.low !== undefined ? { low: f.low } : {}),
        ...(f.high !== undefined ? { high: f.high } : {}),
        basis: f.basis,
        ...(f.basis_detail ? { basisDetail: f.basis_detail } : {}),
        date: f.date,
        s0: when.earliest,
        e0: when.latest + 1,
        sources: f.sources,
        ...(f.notes ? { notes: f.notes } : {}),
      });
    }

    // Other polities the records mention, with just enough to name them.
    const others = new Set([
      ...records.flatMap((r) => [r.subject, r.object ?? '', ...(r.recognized_by ?? []), r.via ?? '']),
      ...disputes.map((d) => d.other),
      ...differences.map((d) => d.other),
    ]);
    others.delete(p.id);
    others.delete('');
    const related = namesFor(others, polities);

    return {
      id: p.id,
      ...(p.wikidata ? { wikidata: p.wikidata } : {}),
      names: p.names.map((n) => ({
        text: n.text,
        lang: n.lang,
        ...(n.start ? { start: n.start } : {}),
        ...(n.end ? { end: n.end } : {}),
        ...nameDays(n),
        sources: n.sources,
      })),
      records,
      ...(figures.length > 0 ? { figures } : {}),
      ...(disputes.length > 0 ? { contested: disputes } : {}),
      ...(differences.length > 0 ? { differ: differences } : {}),
      ...(p.notes ? { notes: p.notes } : {}),
      ...(others.size > 0 ? { related } : {}),
    };
  });
}

type ExtraLayers = NonNullable<Parameters<typeof buildTiles>[1]['extraLayers']>;

/** A tile set that changes with time, and is split into eras (Phase 5, decision 10). */
export interface TimedTileSet {
  /** Its name in tiles.json ('borders' for the default map, which sits at the top level). */
  key: string;
  dir: string;
  layer: string;
  collection: GeoJSON.FeatureCollection;
  bounds: Bounds;
  sources?: string[];
  extraLayers?: ExtraLayers;
}

/** The days a feature is drawn: from s0 until its last possible end (e1 when it has one), exclusive. */
const drawnDays = (f: GeoJSON.Feature): [number, number] => {
  const p = f.properties ?? {};
  return [typeof p.s0 === 'number' ? p.s0 : -FAR_FUTURE, typeof p.e1 === 'number' ? p.e1 : typeof p.e0 === 'number' ? p.e0 : FAR_FUTURE];
};

/** The features drawn at some point in an era. */
export function forEra(collection: GeoJSON.FeatureCollection, era: Era): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: collection.features.filter((f) => inEra(era, ...drawnDays(f))) };
}

function extraForEra(layers: ExtraLayers | undefined, era: Era): ExtraLayers | undefined {
  if (!layers) return undefined;
  return Object.fromEntries(
    Object.entries(layers).map(([name, l]) => [name, 'collection' in l ? { collection: forEra(l.collection, era), minZoom: l.minZoom } : forEra(l, era)]),
  );
}

/** Every feature of a tile set, with its days and size, for choosing eras. */
export function eraItems(set: TimedTileSet): EraItem[] {
  const collections = [set.collection, ...Object.values(set.extraLayers ?? {}).map((l) => ('collection' in l ? l.collection : l))];
  return collections.flatMap((c) =>
    c.features.map((f) => {
      const [s0, e0] = drawnDays(f);
      return { set: set.dir, s0, e0, bytes: JSON.stringify(f.geometry).length };
    }),
  );
}

function main(): void {
  const ds = loadDataset();
  const problems = validateDataset(ds);
  if (problems.length > 0) {
    console.error(`Not building: the data has ${problems.length} problem(s). Run "npm run validate" for details.`);
    process.exit(1);
  }
  // Start clean, so tiles from earlier builds (and the old single-file format) don't linger.
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  /**
   * Writes one layer's tiles under public/data/<dir>/<version>/, leaving out empty tiles (MapLibre
   * draws nothing for a tile that isn't there). More layers can go in the same tiles (the border
   * lines as `lines`, the land parts as `land`). The version is a fingerprint of the contents, so
   * two eras with the same contents share their tiles.
   */
  const writtenVersions = new Map<string, { count: number; bytes: number }>();
  const writeTiles = (dir: string, layer: string, collection: GeoJSON.FeatureCollection, bounds: Bounds, extraLayers?: ExtraLayers, minZoom = 0) => {
    const version = createHash('sha256').update(dir).update(JSON.stringify(collection)).update(JSON.stringify(extraLayers ?? null)).digest('hex').slice(0, 12);
    if (!writtenVersions.has(version)) {
      let count = 0;
      let bytes = 0;
      for (const tile of buildTiles(collection, { layer, minZoom, maxZoom: TILE_MAX_ZOOM, bounds, extraLayers })) {
        if (tile.empty) continue;
        const file = join(OUT_DIR, dir, version, String(tile.z), String(tile.x), `${tile.y}.pbf`);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, tile.data);
        count++;
        bytes += tile.data.length;
      }
      writtenVersions.set(version, { count, bytes });
    }
    return version;
  };

  // Natural Earth's land, for the border lines (which leave out stretches at sea) and land areas.
  const land = loadLand(ds);
  const outlines: OutlineContext = { areas: importAreas(ds), land: land ? new LandDistance(land.all()) : undefined, landPolygons: land };
  // One set of colors for the default map and the baseline, so a state keeps its color where one
  // gives way to the other.
  const colors = mapColors(ds);
  const borders = buildBorders(ds, outlines, colors);
  const dejure = buildDejure(ds, outlines);
  const second = buildSecondOpinion(ds, outlines);
  const baseline = buildBaseline(ds, outlines, colors);
  const edges = buildEdges(ds, outlines.land);
  writeFileSync(join(OUT_DIR, 'edges.json'), JSON.stringify(edges));
  const contested = buildContested(ds);
  const contestedLayer = contestedCollection(contested);
  // Where the default map and the second opinion differ (combines OpenHistoricalMap, CC0, with
  // Cliopatria, CC BY 4.0, so it's credited to Cliopatria wherever it's shown).
  const differ = buildDiffer(ds);
  const differLayer = contestedCollection(differ);

  // Every tile set that changes with time, split into the same eras (Phase 5, decision 10). The
  // land parts only matter up close, so they're left out of the default tiles below COAST_MIN_ZOOM.
  const timed: TimedTileSet[] = [
    { key: 'borders', dir: 'tiles', layer: TILE_LAYER, collection: borders.collection, bounds: borders.bounds, sources: borders.sources, extraLayers: { lines: borders.lines, labels: borders.labels, land: { collection: borders.land, minZoom: COAST_MIN_ZOOM } } },
    { key: 'dejure', dir: 'dejure-tiles', layer: 'dejure', collection: dejure.collection, bounds: dejure.bounds, sources: dejure.sources, extraLayers: { lines: dejure.lines, labels: dejure.labels } },
    { key: 'second', dir: 'second-tiles', layer: 'second', collection: second.collection, bounds: second.bounds, sources: second.sources, extraLayers: { lines: second.lines } },
    // The baseline only when there's something outside the default map's imports (Phase 5).
    ...(baseline.collection.features.length > 0
      ? [{ key: 'baseline', dir: 'baseline-tiles', layer: 'baseline', collection: baseline.collection, bounds: baseline.bounds, sources: baseline.sources, extraLayers: { lines: baseline.lines, labels: baseline.labels } }]
      : []),
    { key: 'contested', dir: 'contested-tiles', layer: 'contested', collection: contestedLayer.collection, bounds: contestedLayer.bounds, extraLayers: { labels: contestedLayer.labels } },
    { key: 'differ', dir: 'differ-tiles', layer: 'differ', collection: differLayer.collection, bounds: differLayer.bounds, extraLayers: { labels: differLayer.labels } },
  ];
  const eras = chooseEras(timed.flatMap(eraItems), FAR_FUTURE);
  const versions = timed.map((set) =>
    eras.map((era) => writeTiles(set.dir, set.layer, forEra(set.collection, era), set.bounds, extraForEra(set.extraLayers, era))),
  );
  // The base map up close, over the imports' areas (all of them together). It doesn't change with time.
  const areaList = [...importAreas(ds).values()];
  const coastBox: Box | undefined = areaList.length
    ? [Math.min(...areaList.map((a) => a[0])), Math.min(...areaList.map((a) => a[1])), Math.max(...areaList.map((a) => a[2])), Math.max(...areaList.map((a) => a[3]))]
    : undefined;
  const coastVersion = land && coastBox ? writeTiles('coast-tiles', 'coast', buildCoast(land, coastBox), coastBox, undefined, COAST_MIN_ZOOM) : undefined;
  const tileCount = [...writtenVersions.values()].reduce((n, t) => n + t.count, 0);
  const tileBytes = [...writtenVersions.values()].reduce((n, t) => n + t.bytes, 0);

  // Each era's change index: the map only redraws on these days, so they cover every layer it can
  // show (labels change name on their own days, inside a record) and the edge of the imported data.
  const allTimed: GeoJSON.Feature[] = [
    ...timed.flatMap((set) => [set.collection, ...Object.values(set.extraLayers ?? {}).map((l) => ('collection' in l ? l.collection : l))].flatMap((c) => c.features)),
    ...edges.features,
  ];
  const eraIndex = eras.map((era) => ({
    start: era.start,
    end: era.end,
    changes: changeDays(forEra({ type: 'FeatureCollection', features: allTimed }, era)).filter((day) => day > era.start && day < era.end),
  }));
  const extra = Object.fromEntries([
    ...timed.slice(1).map((set, i) => [
      set.key,
      { dir: set.dir, layer: set.layer, bounds: set.bounds, versions: versions[i + 1], ...(set.sources ? { sources: set.sources } : {}) },
    ]),
    ...(coastVersion && coastBox ? [['coast', { dir: 'coast-tiles', layer: 'coast', bounds: coastBox, version: coastVersion, minzoom: COAST_MIN_ZOOM }]] : []),
  ]);
  writeFileSync(
    join(OUT_DIR, 'tiles.json'),
    JSON.stringify({
      layer: TILE_LAYER,
      minzoom: 0,
      maxzoom: TILE_MAX_ZOOM,
      bounds: borders.bounds,
      sources: borders.sources,
      precision: borders.precision,
      eras: eraIndex,
      versions: versions[0],
      extra,
    }),
  );
  // Which polity pairs disagree, and where, so a crosswalk mistake shows up here first.
  const pairs = new Map<string, number>();
  for (const c of contested) pairs.set(`${c.facto} vs ${c.jure}`, Math.max(pairs.get(`${c.facto} vs ${c.jure}`) ?? 0, c.km2));
  console.log(`Contested (largest area per pair of polities): ${[...pairs].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toLocaleString('en')} km²`).join('; ') || 'none'}`);
  const differPairs = new Map<string, number>();
  for (const c of differ) differPairs.set(`${c.facto} vs ${c.jure}`, Math.max(differPairs.get(`${c.facto} vs ${c.jure}`) ?? 0, c.km2));
  console.log(`Sources differ (largest area per pair): ${[...differPairs].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toLocaleString('en')} km²`).join('; ') || 'none'}`);
  writeFileSync(join(OUT_DIR, 'sources.json'), JSON.stringify(buildSources(ds)));
  writeFileSync(join(OUT_DIR, 'changes.json'), JSON.stringify(buildChanges(ds)));
  writeFileSync(join(OUT_DIR, 'events.json'), JSON.stringify(buildEvents(ds)));
  mkdirSync(join(OUT_DIR, 'events'));
  for (const file of buildEventFiles(ds)) writeFileSync(join(OUT_DIR, 'events', `${file.id}.json`), JSON.stringify(file));
  mkdirSync(join(OUT_DIR, 'polities'));
  let polityBytes = 0;
  const areas = buildAreas(ds, land);
  for (const file of buildPolityFiles(ds, contested, areas, differ)) {
    const json = JSON.stringify(file);
    writeFileSync(join(OUT_DIR, 'polities', `${file.id}.json`), json);
    polityBytes += json.length;
  }
  console.log(
    `Built public/data: ${borders.collection.features.length} border features, ${dejure.collection.features.length} de jure, ` +
      `${second.collection.features.length} second-opinion, ${baseline.collection.features.length} baseline, ` +
      `${contested.length} contested, in ${tileCount} tiles ` +
      `(${(tileBytes / 1e6).toFixed(1)} MB, zoom 0–${TILE_MAX_ZOOM}, empty tiles left out) in ${eras.length} era${eras.length === 1 ? '' : 's'}, ` +
      `${eraIndex.reduce((n, e) => n + e.changes.length, 0)} change days, ` +
      `${ds.polities.length} polity files (${(polityBytes / 1e3).toFixed(0)} KB), ${ds.events.length} events.`,
  );
}

// Run only when executed directly (not when imported by tests).
if (import.meta.filename === process.argv[1]) main();
