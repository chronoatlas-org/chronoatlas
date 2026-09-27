// Imports country-level boundaries from OpenHistoricalMap (OHM) for the East Asia showcase.
//
// Run with:  npm run import:ohm              (downloads fresh data from OHM)
//            npm run import:ohm -- --offline  (re-processes the last download in raw/)
//
// What it does, in order:
//   1. Asks OHM's Overpass API for admin_level=2 boundary relations in the import area that
//      overlap 1900–1950, with every border line and point listed once.
//   2. Simplifies each border line once (so neighbours stay exactly aligned), then assembles each
//      relation's lines into polygons.
//   3. Trims the polygons to the import area and rounds coordinates.
//   4. Groups relations into polities (by Wikidata ID, otherwise English name) and writes:
//        data/imports/openhistoricalmap/shapes/*.geojson   one shape per OHM relation
//        data/imports/openhistoricalmap/assertions.yaml    who administered which shape, when
//        data/imports/openhistoricalmap/polity-ids.json    permanent polity IDs we assigned
//        data/imports/openhistoricalmap/manifest.json      what was fetched and every decision made
//        data/polities/<id>.yaml                           names from OHM (other names are kept)
// Every choice that interprets OHM's data is recorded in the manifest so reviewers can see it.

import { createHash } from 'node:crypto';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import polygonClipping from 'polygon-clipping';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { EdtfError, parseEdtfDate } from '../src/dates/index.ts';
import { DATA_DIR } from './lib/data.ts';
import {
  assembleRings,
  buildMultiPolygon,
  cleanMultiPolygon,
  formatFeature,
  simplifyLine,
} from './lib/geometry.ts';
import type { MultiPolygon, Position } from './lib/geometry.ts';
import type { Assertion, Polity, PolityName } from './lib/types.ts';

const CONFIG = {
  /** Import area: south, west, north, east (degrees). */
  bbox: { south: 10, west: 73, north: 55, east: 150 },
  /** Keep relations that overlap these years. */
  fromYear: 1900,
  toYear: 1950,
  adminLevel: '2',
  /** Douglas–Peucker tolerance in degrees (0.005° is about 500 m). */
  simplifyTolerance: 0.005,
  /** Decimal places kept in coordinates (4 is about 11 m). */
  coordinateDecimals: 4,
};
const ENDPOINT = 'https://overpass-api.openhistoricalmap.org/api/interpreter';
const USER_AGENT = 'chronoatlas-import/0.1 (https://github.com/chronoatlas-org/chronoatlas)';
const SOURCE_ID = 'openhistoricalmap';
const OUT = join(DATA_DIR, 'imports', 'openhistoricalmap');
const RAW_FILE = join(OUT, 'raw', 'overpass.json');

const { south, west, north, east } = CONFIG.bbox;
const QUERY = `[out:json][timeout:900];
relation["boundary"="administrative"]["admin_level"="${CONFIG.adminLevel}"](${south},${west},${north},${east})(if: t["start_date"] < "${CONFIG.toYear + 1}" && (!is_tag("end_date") || t["end_date"] > "${CONFIG.fromYear}"));
out meta;
way(r);
out skel qt;
node(w);
out skel qt;`;

interface OsmRelation {
  type: 'relation';
  id: number;
  version: number;
  timestamp: string;
  tags: Record<string, string>;
  members: { type: string; ref: number; role: string }[];
}

async function download(): Promise<void> {
  mkdirSync(join(OUT, 'raw'), { recursive: true });
  console.log(`Querying ${ENDPOINT} ...`);
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    body: new URLSearchParams({ data: QUERY }),
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!response.ok || !response.body) throw new Error(`Overpass request failed: HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream), createWriteStream(RAW_FILE));
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Name tags we copy: `name` (local name) and `name:<language>`, e.g. name:en, name:zh-Hant. */
function nameTags(tags: Record<string, string>): { lang: string; text: string }[] {
  const names: { lang: string; text: string }[] = [];
  for (const [key, text] of Object.entries(tags)) {
    if (key === 'name') names.push({ lang: 'und', text });
    const match = /^name:([a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)$/.exec(key);
    if (match) names.push({ lang: match[1], text });
  }
  return names;
}

async function main(): Promise<void> {
  const offline = process.argv.includes('--offline');
  if (!offline) await download();
  if (!existsSync(RAW_FILE)) throw new Error(`No download found at ${RAW_FILE}; run without --offline first.`);

  const rawSha256 = await sha256File(RAW_FILE);
  const raw = JSON.parse(readFileSync(RAW_FILE, 'utf8'));
  const elements: { type: string; id: number }[] = raw.elements;
  const nodes = new Map<number, Position>();
  const ways = new Map<number, number[]>();
  const relations: OsmRelation[] = [];
  for (const e of elements as any[]) {
    if (e.type === 'node') nodes.set(e.id, [e.lon, e.lat]);
    else if (e.type === 'way') ways.set(e.id, e.nodes);
    else if (e.type === 'relation') relations.push(e);
  }
  relations.sort((a, b) => a.id - b.id);
  console.log(`${relations.length} relations, ${ways.size} ways, ${nodes.size} points (data as of ${raw.osm3s?.timestamp_osm_base}).`);

  // Simplify every way once, so every relation that shares it gets the same simplified line.
  const simplified = new Map<number, Position[]>();
  const wayGeometry = (id: number): Position[] | null => {
    const cached = simplified.get(id);
    if (cached) return cached;
    const ids = ways.get(id);
    if (!ids) return null;
    const points = ids.map((n) => nodes.get(n));
    if (points.some((p) => !p)) return null;
    const line = simplifyLine(points as Position[], CONFIG.simplifyTolerance);
    simplified.set(id, line);
    return line;
  };

  const box: MultiPolygon = [[[[west, south], [east, south], [east, north], [west, north], [west, south]]]];
  const skipped: { relation: number; name: string; reason: string }[] = [];
  const kept: { relation: OsmRelation; geometry: MultiPolygon; start: string; end: string; key: string }[] = [];

  for (const relation of relations) {
    const tags = relation.tags ?? {};
    const label = tags['name:en'] ?? tags.name ?? '(no name)';
    const skip = (reason: string) => skipped.push({ relation: relation.id, name: label, reason });

    // Dates: prefer the EDTF-specific tags when present.
    const start = tags['start_date:edtf'] ?? tags.start_date;
    const end = tags['end_date:edtf'] ?? tags.end_date ?? 'ongoing';
    if (!start) {
      skip('no start date');
      continue;
    }
    try {
      parseEdtfDate(start);
      if (end !== 'ongoing') parseEdtfDate(end);
    } catch (error) {
      skip(error instanceof EdtfError ? error.message : String(error));
      continue;
    }
    if (tags.license && !/^(cc0|public domain)/i.test(tags.license)) {
      skip(`license tag "${tags.license}" is not public domain; needs review before import`);
      continue;
    }

    const outerLines: Position[][] = [];
    const innerLines: Position[][] = [];
    let missing = false;
    for (const member of relation.members) {
      if (member.type !== 'way' || !['outer', 'inner', ''].includes(member.role)) continue;
      const line = wayGeometry(member.ref);
      if (!line) {
        missing = true;
        break;
      }
      (member.role === 'inner' ? innerLines : outerLines).push(line);
    }
    if (missing) {
      skip('a border line is missing from the download');
      continue;
    }
    const outers = assembleRings(outerLines);
    const inners = assembleRings(innerLines);
    if (!outers || !inners || outers.length === 0) {
      skip('border lines do not join into closed rings');
      continue;
    }
    let geometry: MultiPolygon;
    try {
      const clipped = polygonClipping.intersection(buildMultiPolygon(outers, inners) as any, box as any);
      geometry = cleanMultiPolygon(clipped as MultiPolygon, CONFIG.coordinateDecimals);
    } catch (error) {
      skip(`geometry could not be clipped: ${(error as Error).message}`);
      continue;
    }
    if (geometry.length === 0) {
      skip('nothing left inside the import area after trimming and simplifying');
      continue;
    }
    const key = tags.wikidata ? `wikidata:${tags.wikidata}` : `name:${tags['name:en'] ?? tags.name ?? relation.id}`;
    kept.push({ relation, geometry, start, end, key });
  }

  // Permanent polity IDs: reuse any assigned before; never rename.
  mkdirSync(join(DATA_DIR, 'polities'), { recursive: true });
  const idsFile = join(OUT, 'polity-ids.json');
  const polityIds: Record<string, string> = existsSync(idsFile) ? JSON.parse(readFileSync(idsFile, 'utf8')) : {};
  const taken = new Set([
    ...Object.values(polityIds),
    ...readdirSync(join(DATA_DIR, 'polities')).map((f) => f.replace(/\.yaml$/, '')),
  ]);
  const byEarliest = [...kept].sort((a, b) => parseEdtfDate(a.start).earliest - parseEdtfDate(b.start).earliest);
  for (const { key, relation } of byEarliest) {
    if (polityIds[key]) continue;
    // From the English name, else the main name if it's in Latin script, else the relation ID.
    let slug =
      slugify(relation.tags['name:en'] ?? '') || slugify(relation.tags.name ?? '') || `ohm-polity-${relation.id}`;
    if (taken.has(slug)) slug = `${slug}-${relation.id}`;
    polityIds[key] = slug;
    taken.add(slug);
  }

  // Shapes: rewrite the folder, so relations removed upstream disappear in the diff.
  const shapesDir = join(OUT, 'shapes');
  rmSync(shapesDir, { recursive: true, force: true });
  mkdirSync(shapesDir, { recursive: true });
  const assertions: Assertion[] = [];
  const namesByPolity = new Map<string, Map<string, { name: { lang: string; text: string }; starts: string[]; ends: string[]; relations: number[] }>>();

  for (const { relation, geometry, start, end, key } of kept) {
    const shapeId = `ohm-r${relation.id}`;
    const polity = polityIds[key];
    writeFileSync(
      join(shapesDir, `${shapeId}.geojson`),
      formatFeature(
        {
          id: shapeId,
          edge_precision: 'unknown',
          ohm_relation: relation.id,
          ohm_version: relation.version,
          ohm_timestamp: relation.timestamp,
        },
        geometry,
      ),
    );
    assertions.push({
      id: shapeId,
      relation: 'administers',
      subject: polity,
      shape: shapeId,
      start,
      end,
      sources: [{ source: SOURCE_ID, locator: `relation ${relation.id}, version ${relation.version}` }],
    });
    const names = namesByPolity.get(polity) ?? new Map();
    for (const name of nameTags(relation.tags)) {
      const k = `${name.lang}\u0000${name.text}`;
      const entry = names.get(k) ?? { name, starts: [], ends: [], relations: [] };
      entry.starts.push(start);
      entry.ends.push(end);
      entry.relations.push(relation.id);
      names.set(k, entry);
    }
    namesByPolity.set(polity, names);
  }

  const startJdn = (s: string) => parseEdtfDate(s).earliest;
  const endJdn = (s: string) => (s === 'ongoing' ? Infinity : parseEdtfDate(s).latest);
  assertions.sort((a, b) => a.subject.localeCompare(b.subject) || startJdn(a.start) - startJdn(b.start));
  writeFileSync(
    join(OUT, 'assertions.yaml'),
    '# Generated by scripts/import-ohm.ts from OpenHistoricalMap. Do not edit by hand:\n' +
      '# fix problems in OpenHistoricalMap and re-import (see README.md).\n' +
      stringifyYaml(assertions, { lineWidth: 0 }),
  );
  writeFileSync(idsFile, JSON.stringify(Object.fromEntries(Object.entries(polityIds).sort()), null, 2) + '\n');

  // Polity files: replace the names that came from OHM; keep everything else as curated.
  for (const [polity, names] of namesByPolity) {
    const file = join(DATA_DIR, 'polities', `${polity}.yaml`);
    const existing: Partial<Polity> = existsSync(file) ? parseYaml(readFileSync(file, 'utf8')) : {};
    const keptNames = (existing.names ?? []).filter((n) => !n.sources.every((s) => s.source === SOURCE_ID));
    const ohmNames: PolityName[] = [...names.values()]
      .sort((a, b) => a.name.lang.localeCompare(b.name.lang) || startJdn(a.starts[0]) - startJdn(b.starts[0]))
      .map(({ name, starts, ends, relations: rels }) => ({
        text: name.text,
        lang: name.lang,
        start: starts.reduce((x, y) => (startJdn(y) < startJdn(x) ? y : x)),
        end: ends.reduce((x, y) => (endJdn(y) > endJdn(x) ? y : x)),
        sources: [{ source: SOURCE_ID, locator: `name tags on relation${rels.length > 1 ? 's' : ''} ${rels.join(', ')}` }],
      }));
    const wikidata = kept.find((k) => polityIds[k.key] === polity)?.relation.tags.wikidata;
    const record: Polity = {
      id: polity,
      ...(existing.wikidata || wikidata ? { wikidata: existing.wikidata ?? wikidata } : {}),
      ...(existing.type ? { type: existing.type } : {}),
      names: [...keptNames, ...ohmNames],
      ...(existing.notes ? { notes: existing.notes } : {}),
    };
    writeFileSync(file, stringifyYaml(record, { lineWidth: 0 }));
  }

  const manifest = {
    dataset: 'OpenHistoricalMap',
    source_id: SOURCE_ID,
    license: 'CC0 1.0 (public domain dedication); see LICENSE.md',
    endpoint: ENDPOINT,
    query: QUERY,
    retrieved: new Date().toISOString(),
    data_as_of: raw.osm3s?.timestamp_osm_base ?? null,
    raw_download: { file: 'raw/overpass.json (not committed)', bytes: statSync(RAW_FILE).size, sha256: rawSha256 },
    settings: CONFIG,
    counts: { relations_downloaded: relations.length, imported: kept.length, skipped: skipped.length, polities: namesByPolity.size },
    decisions: {
      relation:
        'OHM boundary=administrative + admin_level=2 relations are imported as "administers" (de facto administration). OHM does not distinguish de facto control from de jure sovereignty, so no sovereignty claim is imported. Labelled "per OpenHistoricalMap".',
      end_date:
        'OHM end_date is read as the first day the boundary no longer applied: OHM chains successive boundaries with the same date as one end_date and the next start_date. On a changeover day we show the successor. (OHM\'s own viewer shows both on that day.)',
      no_end_date: 'A relation without end_date is imported with end "ongoing".',
      edtf_tags: 'Where start_date:edtf or end_date:edtf exist, they are used instead of start_date/end_date.',
      polities:
        'Relations are grouped into one polity by their Wikidata ID, or by English name when there is none. Polity IDs are permanent and recorded in polity-ids.json.',
      names: 'The name and name:<language> tags of each relation are copied, with the dates of the relations that carry them. Tagged "name" without a language is recorded as lang "und" (the local name).',
      geometry: `Each OHM way is simplified once (Douglas–Peucker, ${CONFIG.simplifyTolerance}°), so shared borders stay aligned; rings are then assembled, trimmed to the import area, and rounded to ${CONFIG.coordinateDecimals} decimal places. Edge precision is "unknown" because OHM doesn't record it.`,
      coverage:
        'No coverage is asserted: OHM does not claim to be complete, so land with no imported boundary is shown as "no data", never as "no state".',
      bce: 'This import contains no BCE dates. OHM\'s convention for negative years has not been verified yet.',
    },
    skipped,
  };
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log(`Imported ${kept.length} relations as ${namesByPolity.size} polities; skipped ${skipped.length}.`);
  for (const s of skipped) console.log(`  skipped relation ${s.relation} (${s.name}): ${s.reason}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
