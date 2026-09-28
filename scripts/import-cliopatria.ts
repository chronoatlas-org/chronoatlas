// Imports Cliopatria (Seshat Global History Databank): the territory each polity held, year by
// year, as Cliopatria maps it, worldwide and for every year it covers (3400 BCE–2024). The site
// shows it as the baseline outside OpenHistoricalMap's area, and as a "second opinion" inside it
// (Phase 5 decisions 2–3).
//
// Run with:  npm run import:cliopatria              (downloads the pinned file, checks its checksum)
//            npm run import:cliopatria -- --offline  (re-processes the last download in raw/)
//
// LICENSE: Cliopatria is CC BY 4.0: credit it, link the license, and say what was changed. It isn't
// public domain, so everything derived from it stays in data/imports/cliopatria/ (see LICENSE.md).
//
// What it does, in order:
//   1. Downloads cliopatria.geojson.zip from the GitHub repository at a pinned commit, checks its
//      checksum, and unpacks the GeoJSON inside.
//   2. Keeps POLITY rows that overlap the configured years and area (all of them). It skips grouping
//      rows (names in parentheses that list their Components, such as "(British Empire)"), whose
//      land is already covered by the rows they group.
//   3. Simplifies and trims their borders the same way as the other imports, and writes:
//        data/imports/cliopatria/shapes/*.geojson    one shape per Cliopatria row
//        data/imports/cliopatria/assertions.yaml     "per Cliopatria, <polity> controlled <shape>"
//        data/imports/cliopatria/polities/*.yaml     Cliopatria's own polities (cliopatria-<name>)
//        data/imports/cliopatria/manifest.json       the pinned download, every decision, the skips
// The hand-written polity-crosswalk.yaml (which of our polities is the same one) is not touched.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import polygonClipping from 'polygon-clipping';
import { stringify as stringifyYaml } from 'yaml';
import { DATA_DIR } from './lib/data.ts';
import { cleanMultiPolygon, formatFeature, simplifyLine } from './lib/geometry.ts';
import type { MultiPolygon, Position } from './lib/geometry.ts';
import { numberDuplicates, rowId } from './lib/cliopatria.ts';
import { readZipEntry } from './lib/zip.ts';
import type { Assertion, Polity } from './lib/types.ts';

const CONFIG = {
  /**
   * Import area: south, west, north, east (degrees). The whole world since Phase 5 (decision 3),
   * where Cliopatria is the baseline outside OpenHistoricalMap's area.
   */
  bbox: { south: -90, west: -180, north: 90, east: 180 },
  /** Keep rows that overlap these (astronomical) years: every row, since the data runs from 3400 BCE to 2024. */
  fromYear: -4000,
  toYear: 2100,
  /** Douglas–Peucker tolerance in degrees (0.005° is about 500 m), as for the other imports. */
  simplifyTolerance: 0.005,
  /** Decimal places kept in coordinates (4 is about 11 m). */
  coordinateDecimals: 4,
};

const SOURCE_ID = 'cliopatria';
const REPOSITORY = 'https://github.com/Seshat-Global-History-Databank/cliopatria';
/** v0.2.0 (both the v0.2.0 and v0.2.0-duplicate tags point at this commit). */
const COMMIT = 'ad28a691b7c07c1fca89d0e0636d324667d2a258';
const DOWNLOAD = {
  url: `https://raw.githubusercontent.com/Seshat-Global-History-Databank/cliopatria/${COMMIT}/cliopatria.geojson.zip`,
  file: 'cliopatria.geojson.zip',
  sha256: 'd01ae3a20d358cc5d54f69d9d725d390767d9c8759ac89ad6f90c58d106f3370',
  entry: 'cliopatria_polities_only.geojson',
};

const OUT = join(DATA_DIR, 'imports', 'cliopatria');
const RAW = join(OUT, 'raw');

interface Row {
  name: string;
  from: number;
  to: number;
  area: number;
  wikidata: string;
  wikipedia: string;
  seshat: string;
  memberOf: string;
  geometry: MultiPolygon;
}

const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');

function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** A year as EDTF: four digits, with a minus sign before 1 CE (astronomical: -0040 is 41 BCE). */
const edtfYear = (year: number) => (year < 0 ? `-${String(-year).padStart(4, '0')}` : String(year).padStart(4, '0'));

/** Simplifies each ring on its own, trims to the import area, and rounds. */
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
  const rawPath = join(RAW, DOWNLOAD.file);
  if (!process.argv.includes('--offline')) {
    console.log(`Downloading ${DOWNLOAD.url}`);
    const response = await fetch(DOWNLOAD.url);
    if (!response.ok) throw new Error(`Download failed (HTTP ${response.status}): ${DOWNLOAD.url}`);
    writeFileSync(rawPath, Buffer.from(await response.arrayBuffer()));
  }
  if (!existsSync(rawPath)) throw new Error(`No download found at ${rawPath}; run without --offline first.`);
  const archive = readFileSync(rawPath);
  const actual = sha256(archive);
  if (actual !== DOWNLOAD.sha256) {
    throw new Error(`${DOWNLOAD.file} has changed (checksum ${actual}, pinned ${DOWNLOAD.sha256}). Review it, then update the pin.`);
  }
  const unpacked = readZipEntry(archive, DOWNLOAD.entry);
  if (!unpacked) throw new Error(`${DOWNLOAD.entry} is missing from ${DOWNLOAD.file}`);
  const data = JSON.parse(unpacked.toString('utf8')) as { features: { properties: any; geometry: any }[] };
  // The last year the dataset covers: a row that runs to it continues past the data, not ends.
  const lastYear = Math.max(...data.features.map((f) => Number(f.properties.ToYear)));

  const { south, west, north, east } = CONFIG.bbox;
  const box: MultiPolygon = [[[[west, south], [east, south], [east, north], [west, north], [west, south]]]];
  const rows: Row[] = [];
  const skipped: { name: string; years: string; reason: string }[] = [];
  const counts = { relation: 0, grouping: 0 };
  for (const { properties: p, geometry } of data.features) {
    if (!geometry || p.FromYear > CONFIG.toYear || p.ToYear < CONFIG.fromYear) continue;
    const prepared = prepareGeometry(geometry, box);
    if (prepared.length === 0) continue; // nothing inside the import area
    const years = `${p.FromYear}–${p.ToYear}`;
    if (p.Type !== 'POLITY') {
      counts.relation++;
      skipped.push({ name: p.Name, years, reason: `Type ${p.Type} (only POLITY rows are imported for now)` });
      continue;
    }
    if (p.Components) {
      counts.grouping++;
      skipped.push({ name: p.Name, years, reason: `a grouping of other rows (${p.Components}), whose land they already cover` });
      continue;
    }
    rows.push({
      name: p.Name,
      from: Number(p.FromYear),
      to: Number(p.ToYear),
      area: Number(p.Area),
      wikidata: p.Wikidata ?? '',
      wikipedia: p.Wikipedia ?? '',
      seshat: p.SeshatID ?? '',
      memberOf: p.MemberOf ?? '',
      geometry: prepared,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name) || a.from - b.from);

  const unitId = (name: string) => `cliopatria-${slugify(name)}`;
  rmSync(join(OUT, 'shapes'), { recursive: true, force: true });
  mkdirSync(join(OUT, 'shapes'), { recursive: true });
  const assertions: Assertion[] = [];
  const units = new Map<string, string>();
  // IDs are permanent: <unit>-<year> (…-41bce before 1 CE), numbered when a name and first year repeat.
  const ids = numberDuplicates(rows.map((row) => rowId(unitId(row.name), row.from)));
  for (const [i, row] of rows.entries()) {
    const id = ids[i];
    units.set(unitId(row.name), row.name);
    writeFileSync(
      join(OUT, 'shapes', `${id}.geojson`),
      formatFeature(
        {
          id,
          edge_precision: 'unknown',
          cliopatria_name: row.name,
          cliopatria_from_year: row.from,
          cliopatria_to_year: row.to,
          cliopatria_area_km2: Math.round(row.area),
          cliopatria_wikidata: row.wikidata,
          cliopatria_wikipedia: row.wikipedia,
          ...(row.seshat ? { cliopatria_seshat_id: row.seshat } : {}),
          ...(row.memberOf ? { cliopatria_member_of: row.memberOf } : {}),
        },
        row.geometry,
      ),
    );
    const ongoing = row.to === lastYear;
    assertions.push({
      id,
      relation: 'controls',
      subject: unitId(row.name),
      shape: id,
      start: edtfYear(row.from),
      // Cliopatria's years are inclusive; our end is the first year it no longer applied.
      end: ongoing ? 'ongoing' : edtfYear(row.to + 1),
      sources: [{ source: SOURCE_ID, locator: `"${row.name}", ${row.from} to ${row.to}` }],
      notes: `Cliopatria maps territory year by year: this row covers the whole years ${row.from} to ${row.to}${ongoing ? ', the last year in the data' : ''}. It doesn't distinguish control from legal sovereignty.`,
    });
  }
  writeFileSync(
    join(OUT, 'assertions.yaml'),
    '# Generated by scripts/import-cliopatria.ts from Cliopatria (CC BY 4.0). Do not edit by hand;\n' +
      '# re-import instead (see README.md). Licensed CC BY 4.0, like everything in this folder.\n' +
      stringifyYaml(assertions, { lineWidth: 0 }),
  );

  // Cliopatria's own polities: records that stay in this folder, named as Cliopatria names them.
  rmSync(join(OUT, 'polities'), { recursive: true, force: true });
  mkdirSync(join(OUT, 'polities'), { recursive: true });
  for (const [id, name] of [...units].sort((a, b) => a[0].localeCompare(b[0]))) {
    const polity: Polity = {
      id,
      names: [{ text: name, lang: 'en', sources: [{ source: SOURCE_ID, locator: `Name "${name}"` }] }],
      notes: 'A polity as Cliopatria (Seshat Global History Databank) maps it.',
    };
    writeFileSync(join(OUT, 'polities', `${id}.yaml`), stringifyYaml(polity, { lineWidth: 0 }));
  }

  // Warn if the hand-written crosswalk mentions units this import no longer has.
  const crosswalkFile = join(OUT, 'polity-crosswalk.yaml');
  if (existsSync(crosswalkFile)) {
    const known = new Set(readdirSync(join(OUT, 'polities')).map((f) => f.replace(/\.yaml$/, '')));
    for (const unit of readFileSync(crosswalkFile, 'utf8').matchAll(/^- unit: (\S+)/gm)) {
      if (!known.has(unit[1])) console.warn(`  WARNING: polity-crosswalk.yaml mentions ${unit[1]}, which this import no longer has.`);
    }
  }

  const manifest = {
    dataset: 'Cliopatria (Seshat Global History Databank)',
    source_id: SOURCE_ID,
    license: 'CC BY 4.0. Everything in this folder is derived from Cliopatria and carries the same license. See LICENSE.md.',
    repository: REPOSITORY,
    version: 'v0.2.0',
    commit: COMMIT,
    // When the pinned file was downloaded (not when this script last ran, which may be --offline).
    retrieved: statSync(rawPath).mtime.toISOString(),
    download: { url: DOWNLOAD.url, file: `raw/${DOWNLOAD.file} (not committed)`, bytes: statSync(rawPath).size, sha256: DOWNLOAD.sha256, entry: DOWNLOAD.entry },
    settings: CONFIG,
    counts: {
      rows_in_dataset: data.features.length,
      imported: rows.length,
      polities: units.size,
      skipped_relation_rows: counts.relation,
      skipped_grouping_rows: counts.grouping,
      last_year_in_data: lastYear,
    },
    decisions: {
      relation:
        'Rows become "controls" assertions: Cliopatria maps the territory each polity held and does not separate control from legal sovereignty (maintainer decision, 2026-09-27). Each assertion says so in its notes.',
      rows: 'Only POLITY rows are imported. Grouping rows (a name in parentheses with a Components list, such as "(British Empire)") are skipped, because the rows they group already cover their land. RELATION rows are skipped too, and counted.',
      subjects:
        'Assertions name Cliopatria\'s own polities (cliopatria-<name>), with records in polities/ that stay in this folder. They are not matched to our polities by Wikidata ID, because some of Cliopatria\'s IDs are wrong for this period: its "Republic of China" rows carry Q148 (the People\'s Republic of China) and its "Republic of Korea" row carries Q423 (North Korea). The hand-written polity-crosswalk.yaml links them to our polities, and says on what evidence.',
      dates:
        'FromYear and ToYear are whole years, inclusive (per Cliopatria\'s README). The start is FromYear, with year precision; the end is ToYear + 1, the first year the row no longer applied. A row that runs to the last year in the data is imported as "ongoing".',
      bce: 'Cliopatria\'s README says negative years are BCE, but not whether year 0 exists. Its data has one: six rows end in year 0, and each is followed by a row of the same polity starting in year 1 (checked 2026-09-28). So its years are read as astronomical, as EDTF\'s are: -40 is 41 BCE. IDs use the BCE year a reader sees (…-41bce).',
      geometry: `Each ring is simplified (Douglas–Peucker, ${CONFIG.simplifyTolerance}°), trimmed to the import area, and rounded to ${CONFIG.coordinateDecimals} decimal places. Edge precision is "unknown". Cliopatria's own area (km², equal-area projection) is kept in each shape's properties.`,
      puppet_states:
        'Cliopatria folds some governments into their patrons (for example, there is no separate Manchukuo; its land is inside the Empire of Japan). That is Cliopatria\'s view, shown attributed, not an error to correct.',
      selection: `POLITY rows that overlap the years ${CONFIG.fromYear} to ${CONFIG.toYear} (astronomical; that is every row) and have land in the import area after trimming.`,
      ids: 'Each row\'s ID is <unit>-<first year>, with four digits from 1 CE and <n>bce before that; when two rows share a name and a first year, the later one (in the file\'s order) gets -2 (Phase 5 decision 12).',
    },
    skipped,
  };
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log(`Imported ${rows.length} Cliopatria rows as ${units.size} polities; skipped ${counts.grouping} grouping and ${counts.relation} RELATION rows. Last year in the data: ${lastYear}.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
