// Imports CShapes 2.0 (legally recognized borders of states and their dependencies) for the East
// Asia showcase, as its own isolated layer.
//
// Run with:  npm run import:cshapes              (downloads the pinned files, checks their checksums)
//            npm run import:cshapes -- --offline  (re-processes the last download in raw/)
//
// LICENSE: CShapes is CC BY-NC-SA 4.0 (non-commercial, share-alike). Everything this script
// writes stays in data/imports/cshapes-2-0/, which carries the same license. Nothing derived from
// CShapes may be written anywhere else (see CLAUDE.md, ground rule 5).
//
// What it does, in order:
//   1. Downloads the CShapes GeoJSON and the authors' R package from the dataset's page, and
//      checks both against pinned checksums (a changed upstream file stops the import).
//   2. Reads each row's borders and dates from the GeoJSON, and its status (independent, colony,
//      protectorate, mandate, occupied), ruling state, and "borders defined" flag from the R
//      package's data file. Only the package has those columns; every row matches one-to-one.
//   3. Keeps rows that overlap the configured years and have land in the import area (the whole
//      world, 1886–2019), simplifies and trims their borders the same way as the
//      OpenHistoricalMap import, and writes:
//        data/imports/cshapes-2-0/shapes/*.geojson   one shape per CShapes row
//        data/imports/cshapes-2-0/assertions.yaml    who was sovereign (or occupying), when
//        data/imports/cshapes-2-0/polities/*.yaml    CShapes' own units (cshapes-<gwcode>)
//        data/imports/cshapes-2-0/manifest.json      what was fetched and every decision made
// The hand-written polity-crosswalk.yaml (which of our polities is the same state) is not touched.

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import polygonClipping from 'polygon-clipping';
import { stringify as stringifyYaml } from 'yaml';
import { civilToJdn, jdnToCivil } from '../src/dates/index.ts';
import { DATA_DIR } from './lib/data.ts';
import { cleanMultiPolygon, formatFeature, simplifyLine } from './lib/geometry.ts';
import type { MultiPolygon, Position } from './lib/geometry.ts';
import { readTarGzEntry } from './lib/tar.ts';
import type { Assertion, Polity } from './lib/types.ts';

// xz-decompress is a CommonJS package, so Node can only load it with require().
const { XzReadableStream } = createRequire(import.meta.url)('xz-decompress') as typeof import('xz-decompress');

const CONFIG = {
  /** Import area: south, west, north, east (degrees). The whole world since Phase 5 (decision 4). */
  bbox: { south: -90, west: -180, north: 90, east: 180 },
  /** Keep rows that overlap these years: all of CShapes 2.0, which runs from 1886 to 2019. */
  fromYear: 1886,
  toYear: 2019,
  /** Douglas–Peucker tolerance in degrees (0.005° is about 500 m), as for OpenHistoricalMap. */
  simplifyTolerance: 0.005,
  /** Decimal places kept in coordinates (4 is about 11 m). */
  coordinateDecimals: 4,
};

const SOURCE_ID = 'cshapes-2-0';
const PAGE = 'https://icr.ethz.ch/data/cshapes/';
/** The pinned upstream files. A different checksum means the data changed: review, then re-pin. */
const FILES = {
  geojson: {
    url: `${PAGE}CShapes-2.0.geojson`,
    file: 'CShapes-2.0.geojson',
    sha256: '384b1ea90b9419f30a858d7ec237c85a22c60d1b35b5f85f215a1204f9989d42',
  },
  rPackage: {
    url: `${PAGE}cshapes_2.0.tar.gz`,
    file: 'cshapes_2.0.tar.gz',
    sha256: '6708b263224888c368aab136cdcae8a24c220bd07929af10f8bd69cf53634caa',
    /** The data file inside the package that has the status, owner, and b_def columns. */
    entry: 'cshapes/inst/extdata/cshapes_2_gw.topojson.xz',
  },
};
/** CShapes 2.0 starts and ends on these days, so they mark the edges of the data, not events. */
const DATASET_START = '1886-01-01';
const DATASET_END = '2019-12-31';

const OUT = join(DATA_DIR, 'imports', 'cshapes-2-0');
const RAW = join(OUT, 'raw');

type Status = 'independent' | 'colony' | 'protectorate' | 'mandate' | 'occupied' | 'N/A';

interface Row {
  gwcode: number;
  name: string;
  /** The first and last day of the row, as CShapes gives them (the last day is inclusive). */
  first: string;
  last: string;
  status: Status;
  owner: number;
  bordersDefined: boolean;
  geometry: MultiPolygon;
}

const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

/** The day after an ISO date, computed with our date library (never JavaScript's Date). */
function dayAfter(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const next = jdnToCivil(civilToJdn(year, month, day) + 1);
  return ymd(next.year, next.month, next.day);
}

async function download(spec: { url: string; file: string }): Promise<void> {
  console.log(`Downloading ${spec.url}`);
  const response = await fetch(spec.url);
  if (!response.ok) throw new Error(`Download failed (HTTP ${response.status}): ${spec.url}`);
  writeFileSync(join(RAW, spec.file), Buffer.from(await response.arrayBuffer()));
}

function readPinned(spec: { file: string; sha256: string; url: string }): Buffer {
  const path = join(RAW, spec.file);
  if (!existsSync(path)) throw new Error(`No download found at ${path}; run without --offline first.`);
  const data = readFileSync(path);
  const actual = sha256(data);
  if (actual !== spec.sha256) {
    throw new Error(
      `${spec.file} has changed upstream (checksum ${actual}, pinned ${spec.sha256}). ` +
        `Review what changed at ${spec.url}, then update the pinned checksum in this script.`,
    );
  }
  return data;
}

async function unxz(data: Buffer): Promise<Buffer> {
  return Buffer.from(await new Response(new XzReadableStream(new Blob([Uint8Array.from(data)]).stream())).arrayBuffer());
}

/** Simplifies each ring on its own (CShapes has no shared border lines), trims, and rounds. */
function prepareGeometry(geometry: { type: string; coordinates: unknown }, box: MultiPolygon): MultiPolygon {
  const polygons = (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates) as Position[][][];
  const simplified: MultiPolygon = polygons
    .map((polygon) => polygon.map((ring) => simplifyLine(ring, CONFIG.simplifyTolerance)).filter((ring) => ring.length >= 4))
    .filter((polygon) => polygon.length > 0);
  if (simplified.length === 0) return [];
  const clipped = polygonClipping.intersection(simplified as never, box as never) as MultiPolygon;
  return cleanMultiPolygon(clipped, CONFIG.coordinateDecimals);
}

async function main(): Promise<void> {
  mkdirSync(RAW, { recursive: true });
  if (!process.argv.includes('--offline')) {
    await download(FILES.geojson);
    await download(FILES.rPackage);
  }
  const geojsonData = readPinned(FILES.geojson);
  const packageData = readPinned(FILES.rPackage);

  // Status, owner, and "borders defined" come from the R package's data file.
  const entry = readTarGzEntry(packageData, FILES.rPackage.entry);
  if (!entry) throw new Error(`${FILES.rPackage.entry} is missing from the R package`);
  const topology = JSON.parse((await unxz(entry)).toString('utf8'));
  const attributes = new Map<string, { status: Status; owner: number; b_def: number; name: string }>();
  for (const g of Object.values(topology.objects as Record<string, { geometries: { properties: any }[] }>).flatMap((o) => o.geometries)) {
    const p = g.properties;
    attributes.set(`${p.gwcode}|${p.start}|${p.end}`, { status: p.status, owner: Number(p.owner), b_def: Number(p.b_def), name: p.country_name });
  }

  // Borders, names, and dates come from the GeoJSON published on the dataset's page. Its date
  // strings are shifted by a time zone ("31.12.1885 23:00:00" for 1 January 1886), so the
  // separate year, month, and day columns are used instead.
  const geojson = JSON.parse(geojsonData.toString('utf8')) as { features: { properties: any; geometry: any }[] };
  const { south, west, north, east } = CONFIG.bbox;
  const box: MultiPolygon = [[[[west, south], [east, south], [east, north], [west, north], [west, south]]]];
  const from = ymd(CONFIG.fromYear, 1, 1);
  const to = ymd(CONFIG.toYear, 12, 31);

  const rows: Row[] = [];
  const skipped: { gwcode: number; name: string; period: string; reason: string }[] = [];
  const namesByCode = new Map<number, Set<string>>();
  let unmatched = 0;
  for (const { properties: p, geometry } of geojson.features) {
    const first = ymd(p.gwsyear, p.gwsmonth, p.gwsday);
    const last = ymd(p.gweyear, p.gwemonth, p.gweday);
    namesByCode.set(p.gwcode, (namesByCode.get(p.gwcode) ?? new Set()).add(p.cntry_name));
    const extra = attributes.get(`${p.gwcode}|${first}|${last}`);
    if (!extra) {
      unmatched++;
      continue;
    }
    if (last < from || first > to || !geometry) continue;
    const prepared = prepareGeometry(geometry, box);
    if (prepared.length === 0) continue; // nothing inside the import area
    if (extra.status === 'N/A') {
      skipped.push({ gwcode: p.gwcode, name: p.cntry_name, period: `${first} to ${last}`, reason: 'CShapes gives no status (N/A)' });
      continue;
    }
    rows.push({
      gwcode: p.gwcode,
      name: p.cntry_name,
      first,
      last,
      status: extra.status,
      owner: extra.owner,
      bordersDefined: extra.b_def === 1,
      geometry: prepared,
    });
  }
  if (unmatched > 0) throw new Error(`${unmatched} GeoJSON rows have no match in the R package's data; review before importing.`);
  rows.sort((a, b) => a.gwcode - b.gwcode || a.first.localeCompare(b.first));

  const unitId = (code: number) => `cshapes-${code}`;
  const nameOf = (code: number) => [...(namesByCode.get(code) ?? [])].join(' / ') || `gwcode ${code}`;
  const isFirstOfMonth = (iso: string) => iso.endsWith('-01');

  // Shapes and assertions.
  rmSync(join(OUT, 'shapes'), { recursive: true, force: true });
  mkdirSync(join(OUT, 'shapes'), { recursive: true });
  const assertions: Assertion[] = [];
  const subjects = new Set<number>();
  for (const row of rows) {
    const id = `cshapes-${row.gwcode}-${row.first}`;
    writeFileSync(
      join(OUT, 'shapes', `${id}.geojson`),
      formatFeature(
        {
          id,
          edge_precision: 'unknown',
          cshapes_gwcode: row.gwcode,
          cshapes_name: row.name,
          cshapes_first_day: row.first,
          cshapes_last_day: row.last,
          cshapes_status: row.status,
          cshapes_owner: row.owner,
          cshapes_borders_defined: row.bordersDefined,
        },
        row.geometry,
      ),
    );

    const dependent = row.status !== 'independent';
    const subject = dependent ? row.owner : row.gwcode;
    subjects.add(subject);
    const end = row.last === DATASET_END ? 'ongoing' : dayAfter(row.last);
    const notes: string[] = [];
    if (dependent) {
      const status = row.status === 'occupied' ? 'occupied' : `a ${row.status}`;
      notes.push(`Per CShapes, ${row.name} (gwcode ${row.gwcode}) was ${status} in this period. CShapes lists its owner as ${nameOf(row.owner)} (gwcode ${row.owner}).`);
    }
    if (row.first === DATASET_START) {
      notes.push('CShapes begins on 1886-01-01, so this start is the start of the data, not necessarily of this state or border.');
    }
    const onFirst = [
      ...(row.first !== DATASET_START && isFirstOfMonth(row.first) ? ['start'] : []),
      ...(end !== 'ongoing' && isFirstOfMonth(end) ? ['end'] : []),
    ];
    if (onFirst.length > 0) {
      const which = onFirst.length === 2 ? 'The start and the end fall' : `The ${onFirst[0]} falls`;
      notes.push(`${which} on the first of a month: CShapes uses the first of the month or 1 January when it does not know the exact day, so this may be less precise than it looks.`);
    }
    if (!row.bordersDefined) notes.push("CShapes marks this unit's borders as partly undefined in this period.");
    assertions.push({
      id,
      relation: row.status === 'occupied' ? 'occupies' : 'sovereign',
      subject: unitId(subject),
      shape: id,
      start: row.first,
      end,
      sources: [{ source: SOURCE_ID, locator: `gwcode ${row.gwcode}, period ${row.first} to ${row.last}` }],
      ...(notes.length ? { notes: notes.join(' ') } : {}),
    });
  }
  writeFileSync(
    join(OUT, 'assertions.yaml'),
    '# Generated by scripts/import-cshapes.ts from CShapes 2.0 (CC BY-NC-SA 4.0). Do not edit by hand;\n' +
      '# re-import instead (see README.md). Licensed CC BY-NC-SA 4.0, like everything in this folder.\n' +
      stringifyYaml(assertions, { lineWidth: 0 }),
  );

  // CShapes' own units, as polity records that stay in this folder (they carry CShapes' names).
  rmSync(join(OUT, 'polities'), { recursive: true, force: true });
  mkdirSync(join(OUT, 'polities'), { recursive: true });
  for (const code of [...subjects].sort((a, b) => a - b)) {
    const polity: Polity = {
      id: unitId(code),
      type: 'state',
      names: [...(namesByCode.get(code) ?? [])].map((text) => ({
        text,
        lang: 'en',
        sources: [{ source: SOURCE_ID, locator: `gwcode ${code}` }],
      })),
      notes: `A state as CShapes 2.0 identifies it (Gleditsch and Ward code ${code}).`,
    };
    writeFileSync(join(OUT, 'polities', `${polity.id}.yaml`), stringifyYaml(polity, { lineWidth: 0 }));
  }

  // Warn if the hand-written crosswalk mentions units this import no longer has.
  const crosswalkFile = join(OUT, 'polity-crosswalk.yaml');
  if (existsSync(crosswalkFile)) {
    const known = new Set(readdirSync(join(OUT, 'polities')).map((f) => f.replace(/\.yaml$/, '')));
    for (const unit of readFileSync(crosswalkFile, 'utf8').matchAll(/^- unit: (\S+)/gm)) {
      if (!known.has(unit[1])) console.warn(`  WARNING: polity-crosswalk.yaml mentions ${unit[1]}, which this import no longer has.`);
    }
  }

  const statusCounts = rows.reduce<Record<string, number>>((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {});
  const manifest = {
    dataset: 'CShapes 2.0',
    source_id: SOURCE_ID,
    license:
      'CC BY-NC-SA 4.0 (non-commercial, share-alike), as stated on the dataset page. Everything in this folder is derived from CShapes and carries the same license. See LICENSE.md.',
    page: PAGE,
    // When the pinned files were downloaded (not when this script last ran, which may be --offline).
    retrieved: statSync(join(RAW, FILES.geojson.file)).mtime.toISOString(),
    downloads: [
      { url: FILES.geojson.url, file: `raw/${FILES.geojson.file} (not committed)`, bytes: statSync(join(RAW, FILES.geojson.file)).size, sha256: FILES.geojson.sha256 },
      {
        url: FILES.rPackage.url,
        file: `raw/${FILES.rPackage.file} (not committed)`,
        bytes: statSync(join(RAW, FILES.rPackage.file)).size,
        sha256: FILES.rPackage.sha256,
        used: `${FILES.rPackage.entry}: only its status, owner, and b_def columns`,
      },
    ],
    settings: CONFIG,
    counts: { rows_in_dataset: geojson.features.length, imported: rows.length, skipped: skipped.length, units: subjects.size, by_status: statusCounts },
    decisions: {
      columns:
        "The GeoJSON, CSV, and SQL files on the dataset page lack the status, owner, and b_def columns that the codebook lists. They are taken from the data file in the authors' R package (cshapes 2.0, from the same page), matched row by row on gwcode, start, and end (all 710 rows match). The package's DESCRIPTION file says \"License: GPL (>= 2)\"; the maintainers decided on 2026-09-27 to treat these columns as part of CShapes 2.0 under its dataset license (CC BY-NC-SA 4.0) and asked the authors to confirm (2026-09-27; awaiting their reply).",
      relation:
        'Independent units become "sovereign" assertions by the unit itself. Colonies, protectorates, and mandates become "sovereign" assertions by their owner (the codebook defines the owner as "the state that holds sovereignty over this territory"). Occupied units become "occupies" assertions by their owner (maintainer decision, 2026-09-27). Each dependency\'s status is stated in its notes.',
      subjects:
        'Assertions name CShapes\' own units (cshapes-<gwcode>), with polity records in polities/ that stay in this folder. CShapes follows a state through changes of regime under one code (710 is China under the Qing, the Republic, and the People\'s Republic), while our polities are split by regime, so CShapes rows are not cut up to fit ours. The hand-written polity-crosswalk.yaml records which of our polities is the same state, and when.',
      dates:
        'Dates come from the year, month, and day columns (the GeoJSON\'s date strings are shifted by a time zone). CShapes gives each period\'s last day; our end is the day after. A row that runs to CShapes\' last day (2019-12-31) is imported as "ongoing". A start of 1886-01-01 (CShapes\' first day) is noted as the start of the data.',
      first_of_month:
        'When the exact day was unknown, CShapes used the first of the month or 1 January (codebook). Dates are kept as given, with a note on every start or end that falls on the first of a month (maintainer decision, 2026-09-27).',
      borders_defined: 'Units that CShapes marks as having partly undefined borders (b_def 0) get a note. Edge precision is otherwise "unknown": CShapes does not record it line by line.',
      geometry: `Each ring is simplified (Douglas–Peucker, ${CONFIG.simplifyTolerance}°), trimmed to the import area, and rounded to ${CONFIG.coordinateDecimals} decimal places. CShapes has no shared border lines, so neighbouring units are simplified separately and can show gaps or overlaps of up to about 500 m.`,
      coding_rules:
        'CShapes codes de jure changes only, dated to the day a treaty was signed, for example. It leaves out territorial changes under 10,000 km² (so small concessions, leased territories, and colonies such as Hong Kong, Macau, and Goa sit inside the surrounding state), unrecognized changes that were later reversed (such as Japan\'s occupation of Manchuria), and wartime changes reversed after the war. Where maps conflicted, it chose the one closest to present-day borders.',
      selection: `Rows that overlap ${from} to ${to} and have land in the import area after trimming.`,
    },
    skipped,
  };
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log(`Imported ${rows.length} CShapes rows as ${subjects.size} units (${JSON.stringify(statusCounts)}); skipped ${skipped.length}.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
