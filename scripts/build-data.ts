// Compiles the data files into the compact files the website loads:
//   public/data/tiles/<version>/{z}/{x}/{y}.pbf
//                          every territorial assertion joined to its shape, with dates as day
//                          numbers, cut into vector tiles so the browser downloads only what's in
//                          view. Each tile has two layers: the fills, and the border lines
//                          (apart from the fills; see scripts/lib/outlines.ts). <version> is a
//                          fingerprint of the data, so browsers never mix tiles from two builds.
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
import { parseEdtfDate } from '../src/dates/index.ts';
import { loadDataset, ROOT } from './lib/data.ts';
import type { Dataset } from './lib/data.ts';
import { boundingBox, computeContested } from './lib/contested.ts';
import type { ContestedArea, Link, TimedShape } from './lib/contested.ts';
import { areaKm2 } from './lib/geometry.ts';
import type { MultiPolygon } from './lib/geometry.ts';
import polygonClipping from 'polygon-clipping';
import { LandIndex, landPart, touchesEdge } from './lib/land.ts';
import { borderLines, boxEdgeOnLand, LandDistance } from './lib/outlines.ts';
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
const isDejure = (file: string) => DE_JURE_FOLDERS.some((folder) => file.startsWith(folder));
/** Import folders shown as a "second opinion": outlines over the default map (Cliopatria). */
export const SECOND_OPINION_FOLDERS = ['data/imports/cliopatria/'];
const isSecondOpinion = (file: string) => SECOND_OPINION_FOLDERS.some((folder) => file.startsWith(folder));
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
  land?: LandDistance;
}

/** The import folder an assertions file belongs to ("data/imports/<name>"), if any. */
const folderOf = (file: string) => /^(data\/imports\/[^/]+)\//.exec(file)?.[1];

export function buildBorders(ds: Dataset, outlines?: OutlineContext) {
  return buildBorderLayer(ds, onDefaultMap, undefined, outlines);
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
  );
}

/** The "second opinion" layer: Cliopatria's borders, drawn as outlines over the default map. */
export function buildSecondOpinion(ds: Dataset, outlines?: OutlineContext) {
  return buildBorderLayer(ds, isSecondOpinion, undefined, outlines);
}

/**
 * One source's borders: the fills (`collection`), and the lines (`lines`) drawn apart from them,
 * without the edges of the import's area or, given the land, the stretches at sea.
 */
function buildBorderLayer(
  ds: Dataset,
  include: (file: string) => boolean,
  extra: (shape: ShapeFeature) => Record<string, number> = () => ({}),
  outlines?: OutlineContext,
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
  const colors = assignColors(items.map((i) => ({ polity: i.assertion.subject, box: i.box, s0: i.s0, e0: i.e1 })));

  // Only what the map itself uses goes into the tiles, because it's repeated in every tile. The
  // territory panel gets the rest (dates as written, sources) from the polity files.
  const collection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: items.map(({ assertion: a, shape, s0, s1, e0, e1, endUnknown }) => ({
      type: 'Feature',
      properties: {
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
      },
      geometry: shape.geometry as GeoJSON.Geometry,
    })),
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
        coordinates = borderLines(asMultiPolygon(shape.geometry), area, outlines?.land);
        outlineOf.set(key, coordinates);
      }
      if (coordinates.length === 0) return [];
      return [
        {
          type: 'Feature' as const,
          // What the line layers filter on: which record and polity, and when (no s1: lines aren't
          // drawn lighter while a start is uncertain; the fill is).
          properties: { id: a.id, polity: a.subject, s0, e0, ...(e1 > e0 ? { e1 } : {}), ...extra(shape) },
          geometry: { type: 'MultiLineString' as const, coordinates },
        },
      ];
    }),
  };
  const dataBounds = items.reduce<Bounds>(
    (all, { box }) => [Math.min(all[0], box[0]), Math.min(all[1], box[1]), Math.max(all[2], box[2]), Math.max(all[3], box[3])],
    [180, 90, -180, -90],
  );
  return { collection, lines, bounds: dataBounds };
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
    const file = join(ROOT, folder, 'manifest.json');
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
  for (const [folder, { box, fromYear, toYear }] of importSettings(ds)) {
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
  return computeContested(
    timedShapes(ds, onDefaultMap, ['administers', 'controls', 'occupies']),
    timedShapes(ds, isDejure, ['sovereign', 'occupies']),
    byUnit,
  );
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
  return { collection, bounds };
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

/** An assertion as the panel shows it: dates as written plus day numbers. */
function assertionRecord(a: Assertion, km2?: ReadonlyMap<string, number>): PolityRecord {
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
    const own = (mentions.get(p.id) ?? []).map((a) => assertionRecord(a, km2));

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
          ...assertionRecord(a, km2),
          via: link.unit,
          link: link.kind,
          ...(Number.isFinite(link.m0) ? { m0: link.m0 } : {}),
          ...(Number.isFinite(link.m1) ? { m1: link.m1 } : {}),
        });
      }
    }
    const records = [...own, ...linked].sort((a, b) => a.s0 - b.s0 || a.id.localeCompare(b.id));

    // Where the sources disagree over this polity's territory: as the de facto side, as the
    // de jure unit itself, or through a record the crosswalk links to it.
    const linkedWindows = new Map(linked.map((r) => [r.id, [r.m0 ?? -Infinity, r.m1 ?? Infinity] as const]));
    const disputes: ContestedEntry[] = [];
    for (const c of contested) {
      if (c.facto === p.id) {
        disputes.push({ side: 'facto', other: c.jure, relation: c.jureRelation, source: c.jureSource, s0: c.s0, e0: c.e0, ...(c.maybe ? { maybe: true } : {}), km2: c.km2 });
      }
      const window = c.jure === p.id ? ([-Infinity, Infinity] as const) : linkedWindows.get(c.jureRecord);
      if (window) {
        const s0 = Math.max(c.s0, window[0]);
        const e0 = Math.min(c.e0, window[1]);
        if (s0 < e0) disputes.push({ side: 'jure', other: c.facto, relation: c.factoRelation, source: c.factoSource, s0, e0, ...(c.maybe ? { maybe: true } : {}), km2: c.km2 });
      }
    }
    disputes.sort((a, b) => a.s0 - b.s0 || a.other.localeCompare(b.other));

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
      ...(p.notes ? { notes: p.notes } : {}),
      ...(others.size > 0 ? { related } : {}),
    };
  });
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
   * Writes one layer's tiles under public/data/<dir>/<version>/ and says where they went. Its
   * border lines go in the same tiles, as the layer `lines`.
   */
  const writeTileSet = (dir: string, layer: string, collection: GeoJSON.FeatureCollection, bounds: Bounds, lines?: GeoJSON.FeatureCollection) => {
    const version = createHash('sha256').update(JSON.stringify(collection)).update(JSON.stringify(lines ?? null)).digest('hex').slice(0, 12);
    let count = 0;
    let bytes = 0;
    const extraLayers = lines ? { lines } : undefined;
    for (const tile of buildTiles(collection, { layer, maxZoom: TILE_MAX_ZOOM, bounds, extraLayers })) {
      const file = join(OUT_DIR, dir, version, String(tile.z), String(tile.x), `${tile.y}.pbf`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, tile.data);
      count++;
      bytes += tile.data.length;
    }
    return { dir, version, layer, bounds, count, bytes };
  };

  // Natural Earth's land, for the border lines (which leave out stretches at sea) and land areas.
  const land = loadLand(ds);
  const outlines: OutlineContext = { areas: importAreas(ds), land: land ? new LandDistance(land.all()) : undefined };
  const { collection, lines, bounds } = buildBorders(ds, outlines);
  const borders = writeTileSet('tiles', TILE_LAYER, collection, bounds, lines);
  const dejure = buildDejure(ds, outlines);
  const dejureTiles = writeTileSet('dejure-tiles', 'dejure', dejure.collection, dejure.bounds, dejure.lines);
  const second = buildSecondOpinion(ds, outlines);
  const secondTiles = writeTileSet('second-tiles', 'second', second.collection, second.bounds, second.lines);
  const edges = buildEdges(ds, outlines.land);
  writeFileSync(join(OUT_DIR, 'edges.json'), JSON.stringify(edges));
  const contested = buildContested(ds);
  const contestedLayer = contestedCollection(contested);
  const contestedTiles = writeTileSet('contested-tiles', 'contested', contestedLayer.collection, contestedLayer.bounds);
  const tileCount = borders.count + dejureTiles.count + secondTiles.count + contestedTiles.count;
  const tileBytes = borders.bytes + dejureTiles.bytes + secondTiles.bytes + contestedTiles.bytes;
  // The map only redraws on these days, so they cover every layer it can show.
  const changes = changeDays({
    type: 'FeatureCollection',
    features: [...collection.features, ...dejure.collection.features, ...second.collection.features, ...contestedLayer.collection.features, ...edges.features],
  });
  const extra = Object.fromEntries(
    [dejureTiles, secondTiles, contestedTiles].map(({ dir, version, layer, bounds: b }) => [layer, { dir, version, layer, bounds: b }]),
  );
  writeFileSync(
    join(OUT_DIR, 'tiles.json'),
    JSON.stringify({ version: borders.version, layer: TILE_LAYER, minzoom: 0, maxzoom: TILE_MAX_ZOOM, bounds, changes, extra }),
  );
  // Which polity pairs disagree, and where, so a crosswalk mistake shows up here first.
  const pairs = new Map<string, number>();
  for (const c of contested) pairs.set(`${c.facto} vs ${c.jure}`, Math.max(pairs.get(`${c.facto} vs ${c.jure}`) ?? 0, c.km2));
  console.log(`Contested (largest area per pair of polities): ${[...pairs].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toLocaleString('en')} km²`).join('; ') || 'none'}`);
  writeFileSync(join(OUT_DIR, 'sources.json'), JSON.stringify(buildSources(ds)));
  writeFileSync(join(OUT_DIR, 'changes.json'), JSON.stringify(buildChanges(ds)));
  writeFileSync(join(OUT_DIR, 'events.json'), JSON.stringify(buildEvents(ds)));
  mkdirSync(join(OUT_DIR, 'events'));
  for (const file of buildEventFiles(ds)) writeFileSync(join(OUT_DIR, 'events', `${file.id}.json`), JSON.stringify(file));
  mkdirSync(join(OUT_DIR, 'polities'));
  let polityBytes = 0;
  const areas = buildAreas(ds, land);
  for (const file of buildPolityFiles(ds, contested, areas)) {
    const json = JSON.stringify(file);
    writeFileSync(join(OUT_DIR, 'polities', `${file.id}.json`), json);
    polityBytes += json.length;
  }
  console.log(
    `Built public/data: ${collection.features.length} border features, ${dejure.collection.features.length} de jure, ` +
      `${second.collection.features.length} second-opinion, ` +
      `${contested.length} contested, in ${tileCount} tiles ` +
      `(${(tileBytes / 1e6).toFixed(1)} MB, zoom 0–${TILE_MAX_ZOOM}), ${changes.length} change days, ` +
      `${ds.polities.length} polity files (${(polityBytes / 1e3).toFixed(0)} KB), ${ds.events.length} events.`,
  );
}

// Run only when executed directly (not when imported by tests).
if (import.meta.filename === process.argv[1]) main();
