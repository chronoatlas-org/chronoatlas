// Writes the data-change summary: what a pull request changes in data/, in words, compared with
// main (see scripts/lib/summary.ts for what it says). Run with: npm run summarize-changes
//
// Options:
//   --base <folder>    main's data/ folder. Without it, main's data is taken from Git
//                      (`--base-ref`, default origin/main) into a temporary folder.
//   --base-ref <ref>   the commit to compare with (default origin/main).
//   --head <folder>    the data/ folder to summarize (default: this repository's).
//   --out <file>       write the summary for a pull request comment here (cut to GitHub's limit).
//   --full <file>      write the full summary here (for the check's summary page).
//   --full-url <url>   where the full summary can be read, for links in the comment.
//   --no-side          don't recompute contested areas, "sources differ", and land areas.
// Without --out or --full, the summary is printed.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import polygonClipping from 'polygon-clipping';
import {
  buildAreas,
  buildContested,
  buildDiffer,
  isDejure,
  isSecondOpinion,
  loadLand,
  onDefaultMap,
} from './build-data.ts';
import { DATA_DIR, loadDataset, ROOT } from './lib/data.ts';
import type { Dataset } from './lib/data.ts';
import { areaKm2 } from './lib/geometry.ts';
import type { MultiPolygon } from './lib/geometry.ts';
import { landPart } from './lib/land.ts';
import {
  compareDatasets,
  compareOverTime,
  fitComment,
  hasChanges,
  mapFilesTouched,
  renderSummary,
} from './lib/summary.ts';
import type { FileHashes, SideEffects, TimedValue } from './lib/summary.ts';
import { validateDataset } from './lib/validate-data.ts';

const SITE_URL = 'https://chronoatlas-org.github.io/chronoatlas/';
/**
 * The most lines per section in the comment, tried in turn until it fits in a GitHub comment
 * (65,536 characters); the full summary has them all.
 */
const COMMENT_MAX_LINES = [40, 20, 10, 5, 2];
const COMMENT_LIMIT = 65_536;
/** GitHub's limit for a check's summary page is 1 MiB; stay under it. */
const FULL_LIMIT = 1_000_000;

/** Every file under a data/ folder with a hash of its contents, by path from the folder holding it ("data/…"). */
function hashFiles(dataDir: string): FileHashes {
  const root = dirname(dataDir);
  const hashes = new Map<string, string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      // raw/ holds downloads that aren't committed (see .gitignore).
      if (statSync(full).isDirectory()) {
        if (entry !== 'raw') walk(full);
      } else {
        hashes.set(relative(root, full).split('\\').join('/'), createHash('sha256').update(readFileSync(full)).digest('hex'));
      }
    }
  };
  walk(dataDir);
  return hashes;
}

/** A commit's data/, taken from Git into a temporary folder (only read, never run). */
export function extractData(ref: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'chronoatlas-base-'));
  const archive = join(dir, 'base.tar');
  execFileSync('git', ['archive', '--format=tar', '-o', archive, ref, 'data'], { cwd: ROOT });
  execFileSync('tar', ['-xf', archive, '-C', dir]);
  removeLinks(join(dir, 'data'));
  return join(dir, 'data');
}

/**
 * Deletes symbolic links from a folder taken from Git. Data files are plain files, and a link in a
 * pull request could point at a file on the machine running the summary, which would then be read
 * (and could end up quoted in an error message in the comment).
 */
export function removeLinks(dir: string): string[] {
  const removed: string[] = [];
  if (!existsSync(dir)) return removed;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = lstatSync(full);
    if (info.isSymbolicLink()) {
      unlinkSync(full);
      removed.push(full);
      console.error(`Ignored a symbolic link in the data: ${full}`);
    } else if (info.isDirectory()) {
      removed.push(...removeLinks(full));
    }
  }
  return removed;
}

/** The area a changed shape gained and lost, and the box around both. */
function shapeDiff(before: MultiPolygon, after: MultiPolygon) {
  const gainedShape = polygonClipping.difference(after as never, before as never) as MultiPolygon;
  const lostShape = polygonClipping.difference(before as never, after as never) as MultiPolygon;
  const points = [...gainedShape, ...lostShape].flatMap((polygon) => polygon[0] ?? []);
  const box = points.length
    ? ([
        Math.min(...points.map((p) => p[0])),
        Math.min(...points.map((p) => p[1])),
        Math.max(...points.map((p) => p[0])),
        Math.max(...points.map((p) => p[1])),
      ] as [number, number, number, number])
    : undefined;
  return { gained: areaKm2(gainedShape), lost: areaKm2(lostShape), box };
}

/** Contested areas, "sources differ", and land areas, for main's data and the pull request's, where they can have changed. */
function sideEffects(base: Dataset, head: Dataset, touched: string[]): SideEffects {
  const side: SideEffects = {};
  const timed = (list: { facto: string; jure: string; s0: number; e0: number; km2: number }[]): TimedValue[] =>
    list.map((c) => ({ key: `${c.facto}\t${c.jure}`, s0: c.s0, e0: c.e0, km2: c.km2 }));
  const started = Date.now();
  if (touched.some((f) => onDefaultMap(f) || isDejure(f))) {
    side.contested = compareOverTime(timed(buildContested(base)), timed(buildContested(head)));
  }
  if (touched.some((f) => onDefaultMap(f) || isSecondOpinion(f))) {
    side.differ = compareOverTime(timed(buildDiffer(base)), timed(buildDiffer(head)));
  }
  if (touched.some((f) => onDefaultMap(f))) {
    const areas = (ds: Dataset): TimedValue[] =>
      [...buildAreas(ds)].flatMap(([polity, figures]) =>
        figures.map((f) => ({ key: `${polity}\t${f.relation}`, s0: f.s0, e0: f.e0, km2: f.landKm2 })),
      );
    side.areas = compareOverTime(areas(base), areas(head));
  }
  console.error(`Side effects computed in ${((Date.now() - started) / 1000).toFixed(0)} s.`);
  return side;
}

export interface SummarizeOptions {
  /** main's copy of data/ (or the base branch's). */
  baseDir: string;
  /** The copy to summarize. */
  headDir: string;
  /** The branch compared with (default main), and its commit. */
  baseName?: string;
  baseLabel?: string;
  /** Where the full summary can be read, for links in the comment. */
  fullSummaryUrl?: string;
  /** Don't recompute contested areas, "sources differ", and land areas. */
  noSide?: boolean;
}

/**
 * The summary of what `headDir` changes compared with `baseDir`: `comment` for a pull request
 * (sections cut short, within GitHub's limit) and `full`. Only reads the two folders' files: it
 * never runs anything from them, which is what lets the commenting workflow use it on a pull
 * request's data.
 */
export function summarize(options: SummarizeOptions): { comment: string; full: string; changed: boolean; count: number } {
  const { baseDir, headDir } = options;
  const base = loadDataset(baseDir);
  const head = loadDataset(headDir);
  const changes = compareDatasets(base, head, { base: hashFiles(baseDir), head: hashFiles(headDir) });

  // Only the new copy is checked; the base already passed.
  const problems = validateDataset(head);
  const touched = mapFilesTouched(changes);
  const side = options.noSide || touched.length === 0 ? undefined : sideEffects(base, head, touched);
  const land = changes.shapes.length > 0 ? loadLand(head) : undefined;
  const manifests = new Map(
    changes.otherFiles
      .filter((f) => f.path.endsWith('/manifest.json'))
      .map((f) => {
        const read = (dir: string) => {
          const file = join(dirname(dir), f.path);
          if (!existsSync(file)) return undefined;
          try {
            return JSON.parse(readFileSync(file, 'utf8'));
          } catch {
            return undefined;
          }
        };
        return [f.path, { before: read(baseDir), after: read(headDir) }];
      }),
  );
  const context = {
    baseName: options.baseName,
    baseLabel: options.baseLabel,
    problems,
    side,
    skippedSide: !options.noSide && touched.length === 0,
    areaKm2,
    ...(land ? { landKm2: (shape: MultiPolygon) => areaKm2(landPart(shape, land)) } : {}),
    shapeDiff,
    manifests,
    siteUrl: SITE_URL,
  };

  const full = fitComment(renderSummary(base, head, changes, context), FULL_LIMIT);
  // Fewer lines per section until it fits; as a last resort, cut at a line (fitComment).
  let comment = '';
  for (const maxLines of COMMENT_MAX_LINES) {
    comment = renderSummary(base, head, changes, context, { maxLines, fullSummaryUrl: options.fullSummaryUrl });
    if (comment.length <= COMMENT_LIMIT) break;
  }
  comment = fitComment(comment, COMMENT_LIMIT, options.fullSummaryUrl);
  return { comment, full, changed: hasChanges(changes), count: Object.values(changes).reduce((n, list) => n + list.length, 0) };
}

function main(): void {
  const { values } = parseArgs({
    options: {
      base: { type: 'string' },
      'base-ref': { type: 'string', default: 'origin/main' },
      head: { type: 'string', default: DATA_DIR },
      out: { type: 'string' },
      full: { type: 'string' },
      'full-url': { type: 'string' },
      'no-side': { type: 'boolean', default: false },
    },
  });
  let baseLabel: string | undefined;
  try {
    baseLabel = execFileSync('git', ['rev-parse', '--short', values['base-ref']!], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    baseLabel = undefined;
  }
  const { comment, full, changed, count } = summarize({
    baseDir: values.base ?? extractData(values['base-ref']!),
    headDir: values.head!,
    baseLabel,
    fullSummaryUrl: values['full-url'],
    noSide: values['no-side'],
  });
  const write = (file: string, text: string) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${text}\n`);
  };
  if (values.out) write(values.out, comment);
  if (values.full) write(values.full, full);
  if (!values.out && !values.full) console.log(full);
  console.error(changed ? `Data-change summary: ${count} change(s) in data/.` : 'Data-change summary: nothing in data/ changed.');
}

// Run only when executed directly (not when imported by the commenting script or tests).
if (import.meta.filename === process.argv[1]) main();
