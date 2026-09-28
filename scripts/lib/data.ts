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
  Figure,
  HistoricalEvent,
  Polity,
  ShapeFeature,
  Source,
} from './types.ts';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = join(ROOT, 'data');

export interface Loaded<T> {
  /** Path relative to the repository root, with forward slashes. */
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
  /** Import folders (data/imports/<name>), relative to the repository root. */
  imports: string[];
  /** Files that couldn't be read or parsed at all. */
  problems: Problem[];
}

export function repoPath(absolute: string): string {
  return relative(ROOT, absolute).split('\\').join('/');
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

function load<T>(files: string[], parse: (text: string) => unknown, problems: Problem[]): Loaded<T>[] {
  const loaded: Loaded<T>[] = [];
  for (const file of files) {
    try {
      loaded.push({ file: repoPath(file), value: parse(readFileSync(file, 'utf8')) as T });
    } catch (error) {
      problems.push({ file: repoPath(file), message: `could not be read: ${(error as Error).message}` });
    }
  }
  return loaded;
}

const yaml = (text: string) => parseYaml(text);
const json = (text: string) => JSON.parse(text);

export function loadDataset(dataDir = DATA_DIR): Dataset {
  const problems: Problem[] = [];
  const importsDir = join(dataDir, 'imports');
  const imports = existsSync(importsDir)
    ? readdirSync(importsDir)
        .map((name) => join(importsDir, name))
        .filter((path) => statSync(path).isDirectory())
    : [];
  const inImports = (fileName: string) =>
    imports.map((dir) => join(dir, fileName)).filter((path) => existsSync(path));

  return {
    sources: load<Source>(filesIn(join(dataDir, 'sources'), '.yaml'), yaml, problems),
    // Polity records built from an import that isn't CC0 or public domain stay inside that import's
    // folder (data/imports/<name>/polities/); the validator keeps them there.
    polities: load<Polity>(
      [
        ...filesIn(join(dataDir, 'polities'), '.yaml'),
        ...imports.flatMap((dir) => filesIn(join(dir, 'polities'), '.yaml')),
      ],
      yaml,
      problems,
    ),
    assertions: load<Assertion[]>(
      [...filesIn(join(dataDir, 'assertions'), '.yaml'), ...inImports('assertions.yaml')],
      yaml,
      problems,
    ),
    events: load<HistoricalEvent>(filesIn(join(dataDir, 'events'), '.yaml'), yaml, problems),
    figures: load<Figure[]>(
      [...filesIn(join(dataDir, 'figures'), '.yaml'), ...inImports('figures.yaml')],
      yaml,
      problems,
    ),
    coverage: load<Coverage[]>(
      [...filesIn(join(dataDir, 'coverage'), '.yaml'), ...inImports('coverage.yaml')],
      yaml,
      problems,
    ),
    shapes: load<ShapeFeature>(
      [
        ...filesIn(join(dataDir, 'shapes'), '.geojson'),
        ...imports.flatMap((dir) => filesIn(join(dir, 'shapes'), '.geojson')),
      ],
      json,
      problems,
    ),
    crosswalks: load<CrosswalkEntry[]>(inImports('polity-crosswalk.yaml'), yaml, problems),
    imports: imports.map(repoPath),
    problems,
  };
}
