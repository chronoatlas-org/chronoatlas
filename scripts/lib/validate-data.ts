// Checks the whole dataset and returns a list of problems. Used by `npm run validate`, by the
// build, and in CI on every pull request. The checks:
//   1. every file matches its JSON Schema (schemas/*.schema.json);
//   2. IDs are unique, and single-record files are named after their ID;
//   3. every reference (polity, shape, source, assertion) points at something that exists;
//   4. every date parses, and nothing ends before it starts;
//   5. every shape is valid geometry (closed rings, sensible coordinates, correct orientation);
//   6. every import folder has its LICENSE.md, README.md, and manifest.json;
//   7. a polity record inside an import folder (data/imports/<name>/polities/) is only used by
//      that folder's own records, so nothing derived from that source leaks outside it;
//   8. a crosswalk (data/imports/<name>/polity-crosswalk.yaml) links that folder's units to our
//      own polities, with dates that parse.
//   9. a crosswalk's reviewed scopes (crosswalk-reviewed.yaml beside it) have dates that parse and
//      a box that isn't empty.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv/dist/2020.js';
import { EdtfError, parseEdtf, parseEdtfDate } from '../../src/dates/index.ts';
import type { HistoricalDate } from '../../src/dates/index.ts';
import { ROOT } from './data.ts';
import type { Dataset, Loaded, Problem } from './data.ts';
import { END_KEYWORDS } from './types.ts';
import type { Citation } from './types.ts';

type SchemaName = 'source' | 'polity' | 'assertion' | 'event' | 'figure' | 'coverage' | 'shape' | 'crosswalk' | 'crosswalk-reviewed';

function loadSchemas(): Record<SchemaName, ValidateFunction> {
  // Strict mode catches typos in the schemas. `strictRequired` is off because our conditional
  // rules ("datasets must have a license") list required fields defined elsewhere in the schema.
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
  const dir = join(ROOT, 'schemas');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.schema.json'))) {
    ajv.addSchema(JSON.parse(readFileSync(join(dir, file), 'utf8')));
  }
  const base = 'https://chronoatlas-org.github.io/chronoatlas/schemas/';
  const get = (name: SchemaName) => {
    const validate = ajv.getSchema(`${base}${name}.schema.json`);
    if (!validate) throw new Error(`schema ${name} not found`);
    return validate;
  };
  return {
    source: get('source'),
    polity: get('polity'),
    assertion: get('assertion'),
    event: get('event'),
    figure: get('figure'),
    coverage: get('coverage'),
    shape: get('shape'),
    crosswalk: get('crosswalk'),
    'crosswalk-reviewed': get('crosswalk-reviewed'),
  };
}

export interface ValidateOptions {
  fileExists?: (repoRelativePath: string) => boolean;
}

export function validateDataset(ds: Dataset, options: ValidateOptions = {}): Problem[] {
  // Paths are relative to the folder holding this copy of data/ (the repository, unless it's
  // another copy, as in the data-change summary).
  const fileExists = options.fileExists ?? ((p: string) => existsSync(join(ds.root ?? ROOT, p)));
  const problems: Problem[] = [...ds.problems];
  const report = (file: string, message: string) => problems.push({ file, message });
  const schemas = loadSchemas();

  // 1. Schemas.
  const checkSchema = (name: SchemaName, items: Loaded<unknown>[]) => {
    for (const { file, value } of items) {
      if (!schemas[name](value)) {
        for (const error of schemas[name].errors ?? []) {
          report(file, `${error.instancePath || '(top level)'} ${error.message}`);
        }
      }
    }
  };
  checkSchema('source', ds.sources);
  checkSchema('polity', ds.polities);
  checkSchema('assertion', ds.assertions);
  checkSchema('event', ds.events);
  checkSchema('figure', ds.figures);
  checkSchema('coverage', ds.coverage);
  checkSchema('shape', ds.shapes);
  checkSchema('crosswalk', ds.crosswalks);
  checkSchema('crosswalk-reviewed', ds.crosswalkScopes ?? []);

  // 2. Unique IDs, and file names that match.
  const index = <T extends { id: string }>(kind: string, records: { file: string; value: T }[]) => {
    const byId = new Map<string, string>();
    for (const { file, value } of records) {
      if (typeof value?.id !== 'string') continue;
      const previous = byId.get(value.id);
      if (previous) report(file, `${kind} ID "${value.id}" is already used in ${previous}`);
      else byId.set(value.id, file);
    }
    return byId;
  };
  const expectFileName = (records: Loaded<{ id: string }>[], extension: string) => {
    for (const { file, value } of records) {
      if (typeof value?.id === 'string' && basename(file) !== `${value.id}${extension}`) {
        report(file, `file should be named ${value.id}${extension} to match its ID`);
      }
    }
  };
  const list = <T>(files: Loaded<T[]>[]) =>
    files.flatMap(({ file, value }) => (Array.isArray(value) ? value.map((v) => ({ file, value: v })) : []));

  const sources = index('source', ds.sources);
  const polities = index('polity', ds.polities);
  index('event', ds.events);
  const shapes = index(
    'shape',
    ds.shapes.map(({ file, value }) => ({ file, value: { id: value?.properties?.id } })),
  );
  const assertions = index('assertion', list(ds.assertions));
  index('figure', list(ds.figures));
  index('coverage', list(ds.coverage));
  expectFileName(ds.sources, '.yaml');
  expectFileName(ds.polities, '.yaml');
  expectFileName(ds.events, '.yaml');
  expectFileName(
    ds.shapes.map(({ file, value }) => ({ file, value: { id: value?.properties?.id } })),
    '.geojson',
  );

  // 3. References.
  const mustExist = (file: string, what: string, id: unknown, known: Map<string, string>) => {
    if (typeof id === 'string' && !known.has(id)) report(file, `${what} "${id}" does not exist`);
  };
  const checkCitations = (file: string, citations: Citation[] | undefined) => {
    for (const c of citations ?? []) mustExist(file, 'source', c?.source, sources);
  };
  for (const { file, value } of ds.polities) {
    for (const name of value?.names ?? []) checkCitations(file, name.sources);
  }
  for (const { file, value: a } of list(ds.assertions)) {
    mustExist(file, 'polity', a.subject, polities);
    mustExist(file, 'polity', a.object, polities);
    mustExist(file, 'shape', a.shape, shapes);
    for (const p of a.recognized_by ?? []) mustExist(file, 'polity', p, polities);
    checkCitations(file, a.sources);
  }
  for (const { file, value: e } of ds.events) {
    for (const p of e?.polities ?? []) mustExist(file, 'polity', p, polities);
    for (const a of e?.effects ?? []) mustExist(file, 'assertion', a, assertions);
    checkCitations(file, e?.sources);
    checkCitations(file, e?.location?.sources);
  }
  for (const { file, value: f } of list(ds.figures)) {
    mustExist(file, 'polity', f.polity, polities);
    checkCitations(file, f.sources);
  }
  for (const { file, value: c } of list(ds.coverage)) {
    mustExist(file, 'source', c.source, sources);
    mustExist(file, 'shape', c.region, shapes);
    checkCitations(file, c.sources);
  }

  // 4. Dates.
  const date = (file: string, label: string, text: unknown): HistoricalDate | null => {
    if (typeof text !== 'string') return null;
    try {
      return parseEdtfDate(text);
    } catch (error) {
      report(file, `${label}: ${error instanceof EdtfError ? error.message : String(error)}`);
      return null;
    }
  };
  /** Checks an optional start and end; `end` may also be "ongoing" or "unknown". */
  const range = (file: string, label: string, start: unknown, end: unknown) => {
    const s = start === undefined ? null : date(file, `${label} start`, start);
    if (typeof end !== 'string' || (END_KEYWORDS as readonly string[]).includes(end)) return;
    const e = date(file, `${label} end`, end);
    if (s && e && s.earliest > e.latest) {
      report(file, `${label} ends (${end}) before it starts (${start as string})`);
    }
  };
  for (const { file, value: s } of ds.sources) if (s?.year) date(file, 'year', s.year);
  for (const { file, value: p } of ds.polities) {
    for (const n of p?.names ?? []) range(file, `name "${n.text}"`, n.start, n.end);
  }
  for (const { file, value: a } of list(ds.assertions)) range(file, `assertion ${a.id}`, a.start, a.end);
  for (const { file, value: c } of list(ds.coverage)) range(file, `coverage ${c.id}`, c.start, c.end);
  for (const { file, value: f } of list(ds.figures)) date(file, `figure ${f.id} date`, f.date);
  for (const { file, value: e } of ds.events) {
    if (typeof e?.date !== 'string') continue;
    try {
      parseEdtf(e.date);
    } catch (error) {
      report(file, `date: ${(error as Error).message}`);
    }
  }

  // 5. Geometry.
  for (const { file, value } of ds.shapes) {
    for (const message of checkGeometry(value?.geometry)) report(file, message);
  }

  // 6. Import folders.
  for (const dir of ds.imports) {
    for (const required of ['LICENSE.md', 'README.md', 'manifest.json']) {
      if (!fileExists(`${dir}/${required}`)) report(dir, `import folder is missing ${required}`);
    }
  }

  // 7. Polities that belong to an import folder may only be used inside that folder.
  const homeFolder = new Map<string, string>();
  for (const { file, value } of ds.polities) {
    const folder = /^(data\/imports\/[^/]+)\/polities\//.exec(file)?.[1];
    if (folder && typeof value?.id === 'string') homeFolder.set(value.id, folder);
  }
  const mustStayHome = (file: string, id: unknown) => {
    const folder = typeof id === 'string' ? homeFolder.get(id) : undefined;
    if (folder && !file.startsWith(`${folder}/`)) {
      report(file, `polity "${id as string}" belongs to ${folder} and can only be used by records in that folder`);
    }
  };
  for (const { file, value: a } of list(ds.assertions)) {
    for (const id of [a.subject, a.object, ...(a.recognized_by ?? [])]) mustStayHome(file, id);
  }
  for (const { file, value: e } of ds.events) for (const id of e?.polities ?? []) mustStayHome(file, id);
  for (const { file, value: f } of list(ds.figures)) mustStayHome(file, f.polity);

  // 8. Crosswalks: each unit is a polity of the crosswalk's own folder, and each match is one of
  // our polities (data/polities/), with dates that parse and don't run backwards.
  for (const { file, value } of ds.crosswalks) {
    const folder = file.slice(0, file.lastIndexOf('/'));
    for (const entry of Array.isArray(value) ? value : []) {
      if (!polities.has(entry.unit)) report(file, `unit "${entry.unit}" does not exist`);
      else if (homeFolder.get(entry.unit) !== folder) report(file, `unit "${entry.unit}" is not a polity of ${folder}`);
      for (const match of entry.matches ?? []) {
        if (!polities.has(match.polity)) report(file, `polity "${match.polity}" does not exist`);
        else if (homeFolder.has(match.polity)) report(file, `polity "${match.polity}" should be one of ours (data/polities/), not an import's`);
        const start = match.from === undefined ? null : date(file, `match ${entry.unit} → ${match.polity} from`, match.from);
        const stop = match.until === undefined ? null : date(file, `match ${entry.unit} → ${match.polity} until`, match.until);
        if (start && stop && start.earliest >= stop.earliest) report(file, `match ${entry.unit} → ${match.polity} ends before it starts`);
      }
    }
  }

  // 9. Where crosswalks have been reviewed: dates that parse and don't run backwards, and a box
  // that isn't empty.
  for (const { file, value } of ds.crosswalkScopes ?? []) {
    for (const scope of Array.isArray(value) ? value : []) {
      const label = `reviewed scope ${scope.from}/${scope.until}`;
      const start = date(file, `${label} from`, scope.from);
      const stop = date(file, `${label} until`, scope.until);
      date(file, `${label} reviewed`, scope.reviewed);
      if (start && stop && start.earliest >= stop.earliest) report(file, `${label} ends before it starts`);
      const a = scope.area;
      if (a && (a.south >= a.north || a.west >= a.east)) report(file, `${label}: its area is empty (south must be below north, and west of east)`);
    }
  }

  return problems.filter((p, i) => problems.findIndex((q) => q.file === p.file && q.message === p.message) === i);
}

/** Signed area of a ring (shoelace); positive means counter-clockwise. */
function signedArea(ring: number[][]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return sum / 2;
}

export function checkGeometry(geometry: { type?: string; coordinates?: unknown } | undefined): string[] {
  const messages: string[] = [];
  if (!geometry || !Array.isArray(geometry.coordinates)) return ['geometry has no coordinates'];
  const polygons = (
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  ) as unknown[][][];
  if (polygons.length === 0) messages.push('geometry is empty');
  polygons.forEach((polygon, p) => {
    if (!Array.isArray(polygon) || polygon.length === 0) {
      messages.push(`polygon ${p} has no rings`);
      return;
    }
    polygon.forEach((ringValue, r) => {
      const ring = ringValue as unknown[];
      const where = `polygon ${p} ring ${r}`;
      if (!Array.isArray(ring) || ring.length < 4) {
        messages.push(`${where} needs at least 4 positions`);
        return;
      }
      const valid = ring.every(
        (pos) =>
          Array.isArray(pos) &&
          pos.length >= 2 &&
          Number.isFinite(pos[0]) &&
          Number.isFinite(pos[1]) &&
          Math.abs(pos[0] as number) <= 180 &&
          Math.abs(pos[1] as number) <= 90,
      );
      if (!valid) {
        messages.push(`${where} has a coordinate that is not a valid [longitude, latitude]`);
        return;
      }
      const positions = ring as number[][];
      const first = positions[0];
      const last = positions[positions.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) messages.push(`${where} is not closed`);
      const area = signedArea(positions);
      if (area === 0) messages.push(`${where} has no area`);
      else if (r === 0 && area < 0) messages.push(`${where} (outer edge) should run counter-clockwise`);
      else if (r > 0 && area > 0) messages.push(`${where} (hole) should run clockwise`);
    });
  });
  return messages;
}
