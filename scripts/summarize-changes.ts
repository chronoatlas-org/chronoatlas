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
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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
/** The most lines per section in the comment; the full summary has them all. */
const COMMENT_MAX_LINES = 40;
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

/** main's data/, taken from Git into a temporary folder. */
function extractBase(ref: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'chronoatlas-base-'));
  const archive = join(dir, 'base.tar');
  execFileSync('git', ['archive', '--format=tar', '-o', archive, ref, 'data'], { cwd: ROOT });
  execFileSync('tar', ['-xf', archive, '-C', dir]);
  return join(dir, 'data');
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
  const baseDir = values.base ?? extractBase(values['base-ref']!);
  const headDir = values.head!;
  let baseLabel: string | undefined;
  try {
    baseLabel = execFileSync('git', ['rev-parse', '--short', values['base-ref']!], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    baseLabel = undefined;
  }

  const base = loadDataset(baseDir);
  const head = loadDataset(headDir);
  const changes = compareDatasets(base, head, { base: hashFiles(baseDir), head: hashFiles(headDir) });

  // Only the pull request's data is checked; main's already passed.
  const problems = [...head.problems, ...validateDataset(head)];
  const touched = mapFilesTouched(changes);
  const side = values['no-side'] || touched.length === 0 ? undefined : sideEffects(base, head, touched);
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
    baseLabel,
    problems,
    side,
    skippedSide: !values['no-side'] && touched.length === 0,
    areaKm2,
    ...(land ? { landKm2: (shape: MultiPolygon) => areaKm2(landPart(shape, land)) } : {}),
    shapeDiff,
    manifests,
    siteUrl: SITE_URL,
  };

  const full = fitComment(renderSummary(base, head, changes, context), FULL_LIMIT);
  const comment = fitComment(
    renderSummary(base, head, changes, context, { maxLines: COMMENT_MAX_LINES, fullSummaryUrl: values['full-url'] }),
    65_536,
    values['full-url'],
  );
  const write = (file: string, text: string) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${text}\n`);
  };
  if (values.out) write(values.out, comment);
  if (values.full) write(values.full, full);
  if (!values.out && !values.full) console.log(full);
  const total = Object.values(changes).reduce((n, list) => n + list.length, 0);
  console.error(hasChanges(changes) ? `Data-change summary: ${total} change(s) in data/.` : 'Data-change summary: nothing in data/ changed.');
}

main();
