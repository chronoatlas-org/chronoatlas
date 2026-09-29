// Loads every data file in data/ into memory, remembering which file each record came from, so
// the validator and the build can report problems by file.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import type {
  Assertion,
  Coverage,
  CrosswalkEntry,
  CrosswalkScope,
  Figure,
  HistoricalEvent,
  Polity,
  ShapeFeature,
  Source,
} from './types.ts';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = join(ROOT, 'data');

/**
 * Import folders whose polities the map draws as administered where our own data ends (the
 * baseline, Phase 5): another source's crosswalk may match its units to them, so contested areas
 * can be worked out there (Phase 5 step 8).
 */
export const BASELINE_FOLDERS = ['data/imports/cliopatria'];

export interface Loaded<T> {
  /** Path relative to the folder holding data/ (the repository root), with forward slashes. */
  file: string;
  value: T;
}

export interface Problem {
  file: string;
  message: string;
}

export interface Dataset {
  sources: Loaded<Source>[];
  polities: Loaded<Polity>[];
  assertions: Loaded<Assertion[]>[];
  events: Loaded<HistoricalEvent>[];
  figures: Loaded<Figure[]>[];
  coverage: Loaded<Coverage[]>[];
  shapes: Loaded<ShapeFeature>[];
  /** Hand-written crosswalks in import folders (polity-crosswalk.yaml): a list per file. */
  crosswalks: Loaded<CrosswalkEntry[]>[];
  /**
   * Where each crosswalk has been reviewed (crosswalk-reviewed.yaml beside it): contested areas
   * are computed only there. Absent in hand-made test datasets.
   */
  crosswalkScopes?: Loaded<CrosswalkScope[]>[];
  /** Import folders (data/imports/<name>), relative to the repository root. */
  imports: string[];
  /** Files that couldn't be read or parsed at all. */
  problems: Problem[];
  /**
   * The folder that holds this copy of data/ (absolute). Paths above are relative to it. Absent
   * means the repository itself (ROOT); the data-change summary also loads another copy.
   */
  root?: string;
}

/** All files under `dir` (recursively) whose names end with `extension`. */
function filesIn(dir: string, extension: string, recursive = true): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (recursive && entry !== 'raw') found.push(...filesIn(full, extension));
    } else if (entry.endsWith(extension)) {
      found.push(full);
    }
  }
  return found;
}

/** A path relative to `root`, with forward slashes. */
function pathFrom(root: string, absolute: string): string {
  return relative(root, absolute).split('\\').join('/');
}

function load<T>(files: string[], parse: (text: string) => unknown, problems: Problem[], root: string): Loaded<T>[] {
  const loaded: Loaded<T>[] = [];
  for (const file of files) {
    try {
      loaded.push({ file: pathFrom(root, file), value: parse(readFileSync(file, 'utf8')) as T });
    } catch (error) {
      problems.push({ file: pathFrom(root, file), message: `could not be read: ${(error as Error).message}` });
    }
  }
  return loaded;
}

const yaml = (text: string) => parseYaml(text);
const json = (text: string) => JSON.parse(text);

/**
 * Loads every data file under `dataDir`. File paths are given relative to the folder that holds
 * it ("data/…"), so another copy of the data (say, main's, for the data-change summary) reads the
 * same way as the repository's own.
 */
export function loadDataset(dataDir = DATA_DIR): Dataset {
  const problems: Problem[] = [];
  const root = dirname(dataDir);
  const importsDir = join(dataDir, 'imports');
  const imports = existsSync(importsDir)
    ? readdirSync(importsDir)
        .map((name) => join(importsDir, name))
        .filter((path) => statSync(path).isDirectory())
    : [];
  const inImports = (fileName: string) =>
    imports.map((dir) => join(dir, fileName)).filter((path) => existsSync(path));

  return {
    sources: load<Source>(filesIn(join(dataDir, 'sources'), '.yaml'), yaml, problems, root),
    // Polity records built from an import that isn't CC0 or public domain stay inside that import's
    // folder (data/imports/<name>/polities/); the validator keeps them there.
    polities: load<Polity>(
      [
        ...filesIn(join(dataDir, 'polities'), '.yaml'),
        ...imports.flatMap((dir) => filesIn(join(dir, 'polities'), '.yaml')),
      ],
      yaml,
      problems,
      root,
    ),
    assertions: load<Assertion[]>(
      [...filesIn(join(dataDir, 'assertions'), '.yaml'), ...inImports('assertions.yaml')],
      yaml,
      problems,
      root,
    ),
    events: load<HistoricalEvent>(filesIn(join(dataDir, 'events'), '.yaml'), yaml, problems, root),
    figures: load<Figure[]>(
      [...filesIn(join(dataDir, 'figures'), '.yaml'), ...inImports('figures.yaml')],
      yaml,
      problems,
      root,
    ),
    coverage: load<Coverage[]>(
      [...filesIn(join(dataDir, 'coverage'), '.yaml'), ...inImports('coverage.yaml')],
      yaml,
      problems,
      root,
    ),
    shapes: load<ShapeFeature>(
      [
        ...filesIn(join(dataDir, 'shapes'), '.geojson'),
        ...imports.flatMap((dir) => filesIn(join(dir, 'shapes'), '.geojson')),
      ],
      json,
      problems,
      root,
    ),
    crosswalks: load<CrosswalkEntry[]>(inImports('polity-crosswalk.yaml'), yaml, problems, root),
    crosswalkScopes: load<CrosswalkScope[]>(inImports('crosswalk-reviewed.yaml'), yaml, problems, root),
    imports: imports.map((dir) => pathFrom(root, dir)),
    problems,
    ...(root === ROOT ? {} : { root }),
  };
}
