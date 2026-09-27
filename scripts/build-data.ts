// Compiles the data files into the compact files the website loads:
//   public/data/tiles/<version>/{z}/{x}/{y}.pbf
//                          every territorial assertion joined to its shape, with dates as day
//                          numbers, cut into vector tiles so the browser downloads only what's in
//                          view. <version> is a fingerprint of the data, so browsers never mix
//                          tiles from two different builds.
//   public/data/tiles.json where the tiles are, and the change index: every day on which the map
//                          changes, so dragging the timeline only redraws when one is crossed
//   public/data/sources.json         each source's title and address
//   public/data/events.json          every event's dates, importance, title, and place, for the
//                          timeline's markers and the map's pulse
//   public/data/events/<id>.json     one event in full (summary, sources, effects), for the panel
//   public/data/changes.json         every day a border starts or ends, with its polity and source
//   public/data/polities/<id>.json   one polity's names and every record that mentions it, for
//                          the territory panel (a visitor downloads only the ones they open)
//
// Run with: npm run build-data (it also runs automatically before `npm run dev` and the build).
// It validates the data first and refuses to build from invalid data.

import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseEdtfDate } from '../src/dates/index.ts';
import { loadDataset, ROOT } from './lib/data.ts';
import type { Dataset } from './lib/data.ts';
import { buildTiles } from './lib/tiles.ts';
import type { Bounds } from './lib/tiles.ts';
import { validateDataset } from './lib/validate-data.ts';
import { TERRITORIAL_RELATIONS } from './lib/types.ts';
import type { Assertion, Polity, PolityName, ShapeFeature } from './lib/types.ts';
import type { AtlasName } from '../src/map/names.ts';
import type { BorderChange, EventFile, PolityFile, PolityRecord, SourcesFile } from '../src/panel/model.ts';
import { DEFAULT_IMPORTANCE, eventDays } from '../src/timeline/events.ts';
import type { TimelineEvent } from '../src/timeline/events.ts';

const OUT_DIR = join(ROOT, 'public', 'data');
const TILE_LAYER = 'borders';
/** Highest zoom with its own tiles. At zoom 7 a tile unit is about 40 m, finer than the data. */
const TILE_MAX_ZOOM = 7;
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

  // Only what the map itself uses goes into the tiles, because it's repeated in every tile. The
  // territory panel gets the rest (dates as written, sources) from the polity files.
  const collection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: items.map(({ assertion: a, shape, s0, s1, e0, endUnknown }) => ({
      type: 'Feature',
      properties: {
        id: a.id,
        polity: a.subject,
        relation: a.relation,
        s0,
        s1,
        e0,
        ...(endUnknown ? { endUnknown: true } : {}),
        color: colors.get(a.subject) ?? 0,
      },
      geometry: shape.geometry as GeoJSON.Geometry,
    })),
  };
  const dataBounds = items.reduce<Bounds>(
    (all, { box }) => [Math.min(all[0], box[0]), Math.min(all[1], box[1]), Math.max(all[2], box[2]), Math.max(all[3], box[3])],
    [180, 90, -180, -90],
  );
  return { collection, bounds: dataBounds };
}

/**
 * The change index: every day on which some border starts (s0), stops being uncertain (s1), or
 * ends (e0). The map's filter and styling only compare the day against these values, so the map
 * looks identical between two consecutive change days.
 */
export function changeDays(collection: GeoJSON.FeatureCollection): number[] {
  const days = new Set<number>();
  for (const { properties } of collection.features) {
    for (const key of ['s0', 's1', 'e0']) {
      const day = properties?.[key];
      if (typeof day === 'number' && day < FAR_FUTURE) days.add(day);
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
function assertionRecord(a: Assertion): PolityRecord {
  const { s0, s1, e0 } = dayRanges(a.start, a.end);
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
    sources: a.sources,
    ...(a.notes ? { notes: a.notes } : {}),
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
export function buildPolityFiles(ds: Dataset): PolityFile[] {
  const polities = new Map(ds.polities.map(({ value }) => [value.id, value]));
  const mentions = new Map<string, Assertion[]>();
  for (const a of ds.assertions.flatMap(({ value }) => value)) {
    for (const id of new Set([a.subject, ...(a.object ? [a.object] : [])])) {
      mentions.set(id, [...(mentions.get(id) ?? []), a]);
    }
  }

  return ds.polities.map(({ value: p }) => {
    const records = (mentions.get(p.id) ?? []).map(assertionRecord).sort((a, b) => a.s0 - b.s0 || a.id.localeCompare(b.id));

    // Other polities the records mention, with just enough to name them.
    const others = new Set(records.flatMap((r) => [r.subject, r.object ?? '', ...(r.recognized_by ?? [])]));
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

  const { collection, bounds } = buildBorders(ds);
  const version = createHash('sha256').update(JSON.stringify(collection)).digest('hex').slice(0, 12);
  let tileCount = 0;
  let tileBytes = 0;
  for (const tile of buildTiles(collection, { layer: TILE_LAYER, maxZoom: TILE_MAX_ZOOM, bounds })) {
    const file = join(OUT_DIR, 'tiles', version, String(tile.z), String(tile.x), `${tile.y}.pbf`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, tile.data);
    tileCount++;
    tileBytes += tile.data.length;
  }
  const changes = changeDays(collection);
  writeFileSync(
    join(OUT_DIR, 'tiles.json'),
    JSON.stringify({ version, layer: TILE_LAYER, minzoom: 0, maxzoom: TILE_MAX_ZOOM, bounds, changes }),
  );
  writeFileSync(join(OUT_DIR, 'sources.json'), JSON.stringify(buildSources(ds)));
  writeFileSync(join(OUT_DIR, 'changes.json'), JSON.stringify(buildChanges(ds)));
  writeFileSync(join(OUT_DIR, 'events.json'), JSON.stringify(buildEvents(ds)));
  mkdirSync(join(OUT_DIR, 'events'));
  for (const file of buildEventFiles(ds)) writeFileSync(join(OUT_DIR, 'events', `${file.id}.json`), JSON.stringify(file));
  mkdirSync(join(OUT_DIR, 'polities'));
  let polityBytes = 0;
  for (const file of buildPolityFiles(ds)) {
    const json = JSON.stringify(file);
    writeFileSync(join(OUT_DIR, 'polities', `${file.id}.json`), json);
    polityBytes += json.length;
  }
  console.log(
    `Built public/data: ${collection.features.length} border features in ${tileCount} tiles ` +
      `(${(tileBytes / 1e6).toFixed(1)} MB, zoom 0–${TILE_MAX_ZOOM}), ${changes.length} change days, ` +
      `${ds.polities.length} polity files (${(polityBytes / 1e3).toFixed(0)} KB), ${ds.events.length} events.`,
  );
}

// Run only when executed directly (not when imported by tests).
if (import.meta.filename === process.argv[1]) main();
