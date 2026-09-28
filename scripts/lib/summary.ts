// The data-change summary (Phase 4): what a pull request changes in data/, in words, so a reviewer
// reads "Testland: Administered (de facto), 1901 (year only) – 3 March 1902, per …" instead of
// YAML and coordinates, and sees what the change does elsewhere (contested areas, "sources differ",
// land areas), which a diff never shows.
//
// Two parts, both pure: `compareDatasets` works out what changed between two copies of the data
// (main's and the pull request's), and `renderSummary` writes it as Markdown. The script
// scripts/summarize-changes.ts loads the copies and computes the side effects.
//
// Everything a pull request wrote (names, notes, titles) is escaped before it goes into the
// Markdown: the summary is posted by a workflow with permission to comment, so a pull request must
// not be able to put links, images, mentions, or HTML into it.

import { parseEdtfDate } from '../../src/dates/index.ts';
import { formatDay } from '../../src/dates/format.ts';
import { t } from '../../src/i18n/index.ts';
import type { MessageKey } from '../../src/i18n/index.ts';
import { describeEventDate, describePeriod, sourceLink } from '../../src/panel/model.ts';
import { formatHash } from '../../src/url/state.ts';
import type { Dataset, Loaded, Problem } from './data.ts';
import type { MultiPolygon } from './geometry.ts';
import type {
  Assertion,
  Citation,
  Coverage,
  CrosswalkEntry,
  Figure,
  HistoricalEvent,
  Polity,
  ShapeFeature,
  Source,
} from './types.ts';

export type ChangeKind = 'added' | 'removed' | 'changed';

export interface Change<T> {
  kind: ChangeKind;
  id: string;
  /** The file it's in (the pull request's file; main's for a removal). */
  file: string;
  before?: T;
  after?: T;
}

/** One crosswalk match, flattened: the unit, and one polity it's linked to. */
export interface CrosswalkLinkEntry {
  unit: string;
  polity: string;
  kind: 'same-state' | 'dependency';
  from?: string;
  until?: string;
  why?: string;
}

export interface FileChange {
  kind: ChangeKind;
  path: string;
}

export interface DataChanges {
  sources: Change<Source>[];
  polities: Change<Polity>[];
  assertions: Change<Assertion>[];
  events: Change<HistoricalEvent>[];
  figures: Change<Figure>[];
  coverage: Change<Coverage>[];
  shapes: Change<ShapeFeature>[];
  crosswalks: Change<CrosswalkLinkEntry>[];
  /** Files under data/ that changed and aren't records of any kind above (manifests, licenses, READMEs, …). */
  otherFiles: FileChange[];
}

// ---------------------------------------------------------------------------------------------
// Comparing

/** Compares two lists of records by ID. A record is changed when anything in it differs. */
function compareById<T>(
  before: readonly Loaded<T>[],
  after: readonly Loaded<T>[],
  idOf: (value: T) => string,
): Change<T>[] {
  const old = new Map(before.map((item) => [idOf(item.value), item]));
  const now = new Map(after.map((item) => [idOf(item.value), item]));
  const changes: Change<T>[] = [];
  for (const [id, item] of now) {
    const was = old.get(id);
    if (!was) changes.push({ kind: 'added', id, file: item.file, after: item.value });
    else if (!sameValue(was.value, item.value)) changes.push({ kind: 'changed', id, file: item.file, before: was.value, after: item.value });
  }
  for (const [id, item] of old) if (!now.has(id)) changes.push({ kind: 'removed', id, file: item.file, before: item.value });
  return changes;
}

/** Deep equality for data read from YAML or JSON (key order doesn't matter). */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const list = b as unknown[];
    return a.length === list.length && a.every((value, i) => sameValue(value, list[i]));
  }
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const keys = Object.keys(x).filter((k) => x[k] !== undefined);
  return keys.length === Object.keys(y).filter((k) => y[k] !== undefined).length && keys.every((k) => sameValue(x[k], y[k]));
}

/** Files holding lists (assertions, figures, coverage) as one record per entry. */
function flatten<T>(files: readonly Loaded<T[]>[]): Loaded<T>[] {
  return files.flatMap(({ file, value }) => (Array.isArray(value) ? value.map((v) => ({ file, value: v })) : []));
}

function crosswalkEntries(files: readonly Loaded<CrosswalkEntry[]>[]): Loaded<CrosswalkLinkEntry>[] {
  return flatten(files).flatMap(({ file, value }) =>
    (value.matches ?? []).map((m) => ({ file, value: { unit: value.unit, ...m } })),
  );
}

/** A crosswalk link is the same link when it joins the same two units, in the same way, for the same years. */
const crosswalkKey = (l: CrosswalkLinkEntry) => `${l.unit} → ${l.polity} (${l.kind}) ${l.from ?? '..'}/${l.until ?? '..'}`;

/** Files listed by path, each with a hash of its contents, as the summary script reads them. */
export type FileHashes = ReadonlyMap<string, string>;

/**
 * What changed between two copies of the data. `files` (every file under data/, with a hash)
 * catches changes to files that hold no records, such as licenses and manifests.
 */
export function compareDatasets(base: Dataset, head: Dataset, files?: { base: FileHashes; head: FileHashes }): DataChanges {
  const idOf = (value: { id: string }) => value.id;
  const changes: DataChanges = {
    sources: compareById(base.sources, head.sources, idOf),
    polities: compareById(base.polities, head.polities, idOf),
    assertions: compareById(flatten(base.assertions), flatten(head.assertions), idOf),
    events: compareById(base.events, head.events, idOf),
    figures: compareById(flatten(base.figures), flatten(head.figures), idOf),
    coverage: compareById(flatten(base.coverage), flatten(head.coverage), idOf),
    shapes: compareById(base.shapes, head.shapes, (s) => s.properties?.id),
    crosswalks: compareById(crosswalkEntries(base.crosswalks), crosswalkEntries(head.crosswalks), crosswalkKey),
    otherFiles: [],
  };
  if (files) {
    // Every file the records above came from; the rest are listed on their own.
    const recordFiles = new Set(
      [base, head].flatMap((ds) =>
        [ds.sources, ds.polities, ds.assertions, ds.events, ds.figures, ds.coverage, ds.shapes, ds.crosswalks].flatMap((list) =>
          (list as Loaded<unknown>[]).map((item) => item.file),
        ),
      ),
    );
    for (const [path, hash] of files.head) {
      if (recordFiles.has(path)) continue;
      const old = files.base.get(path);
      if (old === undefined) changes.otherFiles.push({ kind: 'added', path });
      else if (old !== hash) changes.otherFiles.push({ kind: 'changed', path });
    }
    for (const path of files.base.keys()) {
      if (!files.head.has(path) && !recordFiles.has(path)) changes.otherFiles.push({ kind: 'removed', path });
    }
    changes.otherFiles.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }
  return changes;
}

/** Whether anything under data/ changed at all. */
export function hasChanges(changes: DataChanges): boolean {
  return Object.values(changes).some((list) => list.length > 0);
}

/**
 * The files whose changes can move contested areas, "sources differ" areas, or land areas: those
 * holding territorial records, shapes, or crosswalk links that changed. The summary script uses
 * this to compute those side effects only when they can have changed (it takes a few minutes).
 */
export function mapFilesTouched(changes: DataChanges): string[] {
  return [
    ...new Set([...changes.assertions, ...changes.shapes, ...changes.crosswalks].map((c) => c.file)),
  ].sort();
}

/** The top-level fields of a manifest that differ, as short "field: before → after" texts. */
export function manifestChanges(before: unknown, after: unknown): string[] {
  const x = (before ?? {}) as Record<string, unknown>;
  const y = (after ?? {}) as Record<string, unknown>;
  const lines: string[] = [];
  for (const key of [...new Set([...Object.keys(x), ...Object.keys(y)])].sort()) {
    if (sameValue(x[key], y[key])) continue;
    const scalar = (v: unknown) => v === undefined || v === null || typeof v !== 'object';
    if (scalar(x[key]) && scalar(y[key])) {
      lines.push(`${code(key)}: ${x[key] === undefined ? 'not set' : code(String(x[key]))} → ${y[key] === undefined ? 'removed' : code(String(y[key]))}`);
    } else {
      lines.push(`${code(key)}: changed`);
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------------------------
// Side effects over time

/** Something measured over a stretch of days (from s0 until e0, exclusive), under a key. */
export interface TimedValue {
  key: string;
  s0: number;
  e0: number;
  km2: number;
}

export interface TimedChange {
  key: string;
  s0: number;
  e0: number;
  /** In km², rounded to 3 significant figures; 0 when there was none. */
  before: number;
  after: number;
}

/** Rounds to 3 significant figures, as the site shows areas (neither borders nor coastline are more precise). */
export const roughly = (km2: number) => (km2 === 0 ? 0 : Number(km2.toPrecision(3)));

/**
 * Where a measured value (the area contested between two polities, say) differs between main's
 * data and the pull request's, day by day, as the stretches where it differs. Values that apply at
 * the same time under one key are added together. Differences that vanish when rounded to what the
 * site shows are left out.
 */
export function compareOverTime(before: readonly TimedValue[], after: readonly TimedValue[]): TimedChange[] {
  const byKey = new Map<string, { before: TimedValue[]; after: TimedValue[] }>();
  const entry = (key: string) => byKey.get(key) ?? byKey.set(key, { before: [], after: [] }).get(key)!;
  for (const v of before) entry(v.key).before.push(v);
  for (const v of after) entry(v.key).after.push(v);
  const total = (values: TimedValue[], day: number) =>
    roughly(values.reduce((sum, v) => (v.s0 <= day && day < v.e0 ? sum + v.km2 : sum), 0));

  const changes: TimedChange[] = [];
  for (const key of [...byKey.keys()].sort()) {
    const { before: b, after: a } = byKey.get(key)!;
    const days = [...new Set([...b, ...a].flatMap((v) => [v.s0, v.e0]))].sort((x, y) => x - y);
    let last: TimedChange | undefined;
    for (let k = 0; k + 1 < days.length; k++) {
      const was = total(b, days[k]);
      const now = total(a, days[k]);
      if (was === now) {
        last = undefined;
        continue;
      }
      if (last && last.e0 === days[k] && last.before === was && last.after === now) last.e0 = days[k + 1];
      else changes.push((last = { key, s0: days[k], e0: days[k + 1], before: was, after: now }));
    }
  }
  return changes;
}

export interface SideEffects {
  /** Areas administered by one polity and legally recognized as another's (key: "facto\tjure"). */
  contested?: TimedChange[];
  /** Where the default map and the second opinion name different holders (key: "default\tsecond"). */
  differ?: TimedChange[];
  /** Land areas on the default map (key: "polity\trelation"). */
  areas?: TimedChange[];
}

// ---------------------------------------------------------------------------------------------
// Writing

/**
 * Text written by a pull request, made safe to show: one line, at most `max` characters, and with
 * Markdown and HTML characters escaped, so it shows as written and can't add links, images, or
 * formatting. "@" gets an invisible space after it, so it never mentions anyone.
 */
export function plain(value: unknown, max = 300): string {
  let text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length > max) text = `${text.slice(0, max - 1)}…`;
  return text.replace(/[\\`*_{}[\]()<>#+!|~&]/g, (c) => `\\${c}`).replace(/@/g, '@​');
}

/** An ID or path, shown as code (nothing inside code is formatted). */
export function code(value: unknown, max = 120): string {
  let text = String(value ?? '').replace(/[`\s]+/g, ' ').trim();
  if (text.length > max) text = `${text.slice(0, max - 1)}…`;
  return `\`${text || ' '}\``;
}

/** "1,230,000". Numbers aren't dates, so Intl is fine here. */
const number = (n: number) => n.toLocaleString('en');
const km2 = (n: number) => `${number(roughly(n))} km²`;

/** Guards against data that fails validation: wording helpers fall back to the raw text. */
function safely(describe: () => string, fallback: unknown): string {
  try {
    return describe();
  } catch {
    return plain(fallback);
  }
}

export interface SummaryContext {
  /** The branch compared with (default main), and its commit, for the heading. */
  baseName?: string;
  baseLabel?: string;
  /** The validator's result on the pull request's data. */
  problems?: readonly Problem[];
  side?: SideEffects;
  /** Side effects not computed because nothing that affects them changed. */
  skippedSide?: boolean;
  /** Measures the land inside a shape, in km² (Natural Earth's land), when available. */
  landKm2?: (shape: MultiPolygon) => number;
  /** The area gained and lost by a changed shape, when available. */
  shapeDiff?: (before: MultiPolygon, after: MultiPolygon) => { gained: number; lost: number; box?: [number, number, number, number] };
  /** Total area of a shape, in km². */
  areaKm2?: (shape: MultiPolygon) => number;
  /** Manifests of changed import folders, main's and the pull request's (by path). */
  manifests?: ReadonlyMap<string, { before?: unknown; after?: unknown }>;
  /** The live site's address, for "see it on the map" links. */
  siteUrl?: string;
}

export interface RenderOptions {
  /** At most this many lines per section; the rest are counted. */
  maxLines?: number;
  /** Where the full summary is, for sections cut short. */
  fullSummaryUrl?: string;
}

const REPO_URL = 'https://github.com/chronoatlas-org/chronoatlas';

/** A marker the commenting workflow uses to find its own comment and update it. */
export const SUMMARY_MARKER = '<!-- chronoatlas:data-summary -->';

const KIND_WORDS: Record<ChangeKind, string> = { added: 'Added', removed: 'Removed', changed: 'Changed' };

const asMultiPolygon = (geometry: ShapeFeature['geometry'] | undefined): MultiPolygon | undefined => {
  if (!geometry || !Array.isArray(geometry.coordinates)) return undefined;
  return (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates) as MultiPolygon;
};

/** Writes the summary as Markdown for a pull request comment (or the check's summary page). */
export function renderSummary(base: Dataset, head: Dataset, changes: DataChanges, context: SummaryContext = {}, options: RenderOptions = {}): string {
  const maxLines = options.maxLines ?? Infinity;
  const out: string[] = [SUMMARY_MARKER, '## Data-change summary', ''];

  // Lookups over both copies, the pull request's first, so removed records still have names.
  const polities = new Map<string, Polity>();
  const sources = new Map<string, Source>();
  const shapes = new Map<string, ShapeFeature>();
  const assertionsByShape = new Map<string, Assertion[]>();
  for (const ds of [base, head]) {
    for (const { value } of ds.polities) if (value?.id) polities.set(value.id, value);
    for (const { value } of ds.sources) if (value?.id) sources.set(value.id, value);
  }
  for (const { value } of base.shapes) if (value?.properties?.id) shapes.set(value.properties.id, value);
  for (const { value } of head.shapes) if (value?.properties?.id) shapes.set(value.properties.id, value);
  for (const { value } of flatten(head.assertions)) {
    if (value?.shape) assertionsByShape.set(value.shape, [...(assertionsByShape.get(value.shape) ?? []), value]);
  }

  const nameOf = (id: string | undefined): string => {
    if (!id) return 'unknown';
    const polity = polities.get(id);
    const names = polity?.names ?? [];
    const english = names.filter((n) => n.lang === 'en' || n.lang?.startsWith('en-'));
    const name = english.find((n) => !n.end || n.end === 'ongoing') ?? english.at(-1) ?? names[0];
    return name ? `${plain(name.text, 80)} (${code(id)})` : code(id);
  };
  const citation = (c: Citation): string => {
    const title = sources.get(c.source)?.title;
    const link = sourceLink(c.source, c.locator ?? '', sources.get(c.source)?.url);
    const text = `${title ? plain(title, 100) : code(c.source)}, ${plain(c.locator, 100)}`;
    // Links to OpenHistoricalMap relations and FRUS documents are built by us from a number, so
    // they're safe to make clickable.
    const linked = link ? `${text} ([open](${link}))` : text;
    return c.note ? `${linked}; note: “${plain(c.note, 200)}”` : linked;
  };
  const citations = (list: readonly Citation[] | undefined) => (list?.length ? list.map(citation).join('; ') : 'none');
  const relationWords = (a: Assertion) =>
    safely(() => {
      const key = `relation.${a.relation}` as MessageKey;
      return t(key, { name: nameOf(a.object) });
    }, a.relation);
  const period = (start?: string, end?: string) => safely(() => describePeriod(start, end) ?? 'no dates', `${start} – ${end}`);
  const day = (jdn: number) => safely(() => formatDay(jdn), jdn);
  const span = (s0: number, e0: number) => {
    const open0 = !Number.isFinite(s0) || s0 <= -99_999_999;
    const open1 = !Number.isFinite(e0) || e0 >= 99_999_999;
    if (open0 && open1) return 'at all times';
    if (open0) return `until ${day(e0)}`;
    if (open1) return `${day(s0)} onwards`;
    return `${day(s0)} – ${day(e0)}`;
  };
  const edgeWords = (edge: unknown) =>
    ['treaty-line', 'approximate-line', 'frontier-zone', 'unknown'].includes(String(edge)) ? t(`edge.${edge}` as MessageKey) : plain(edge);

  /** A section: a heading with counts, and at most maxLines lines. */
  const section = (title: string, lines: string[], counts?: string) => {
    if (lines.length === 0) return;
    out.push(`### ${title}${counts ? ` (${counts})` : ''}`, '');
    out.push(...lines.slice(0, maxLines));
    if (lines.length > maxLines) {
      const more = `…and ${number(lines.length - maxLines)} more`;
      out.push(`- ${options.fullSummaryUrl ? `[${more} in the full summary](${options.fullSummaryUrl})` : more}.`);
    }
    out.push('');
  };
  const countsOf = (list: { kind: ChangeKind }[]) =>
    (['added', 'changed', 'removed'] as const)
      .map((kind) => [kind, list.filter((c) => c.kind === kind).length] as const)
      .filter(([, n]) => n > 0)
      .map(([kind, n]) => `${n} ${kind}`)
      .join(', ');
  const fileNote = (file: string) => `· ${code(file)}`;

  // Intro and the validator's result.
  out.push(
    `What this pull request changes in ${code('data/')}, compared with ${plain(context.baseName ?? 'main', 60)}${context.baseLabel ? ` at ${code(context.baseLabel)}` : ''}. ` +
      'Written automatically from the files, which are what counts; end dates are the first day a record no longer applied, as in the data.',
    '',
  );
  if (!hasChanges(changes)) {
    out.push('This pull request changes nothing in `data/`.', '');
    return out.join('\n');
  }
  if (context.problems) {
    if (context.problems.length === 0) out.push('**Checks:** ✅ the data passes `npm run validate`.', '');
    else {
      out.push(`**Checks:** ❌ \`npm run validate\` found ${number(context.problems.length)} problem(s):`, '');
      for (const p of context.problems.slice(0, 10)) out.push(`- ${code(p.file)}: ${plain(p.message, 200)}`);
      if (context.problems.length > 10) out.push(`- …and ${number(context.problems.length - 10)} more (see the check's log).`);
      out.push('');
    }
  }

  // What always needs the maintainers.
  const flags: string[] = [];
  for (const f of changes.otherFiles) {
    if (/(^|\/)LICENSE[^/]*$/.test(f.path)) flags.push(`- **A license file is ${f.kind}:** ${code(f.path)}. A license change is always the maintainers' decision.`);
  }
  for (const c of changes.sources) {
    if (c.kind === 'changed' && c.before?.license !== c.after?.license) {
      flags.push(`- **A source's license changed:** ${code(c.id)}, ${plain(c.before?.license ?? 'none')} → ${plain(c.after?.license ?? 'none')}.`);
    }
  }
  for (const f of changes.otherFiles) {
    if (/^data\/imports\/[^/]+\/manifest\.json$/.test(f.path)) {
      flags.push(`- **An import's manifest is ${f.kind}:** ${code(f.path)}. Its settings and interpretation decisions are the maintainers' call.`);
    }
  }
  if (changes.crosswalks.length > 0) {
    flags.push('- **Crosswalk links changed.** They decide what counts as the same state, so they can move contested and "sources differ" areas across a whole country; see the side effects below.');
  }
  const removedIds = [
    ...changes.polities.filter((c) => c.kind === 'removed').map((c) => c.id),
    ...changes.events.filter((c) => c.kind === 'removed').map((c) => c.id),
  ];
  if (removedIds.length > 0) {
    flags.push(`- **IDs removed:** ${removedIds.map((id) => code(id)).join(', ')}. IDs are permanent once published, and links to them would stop working.`);
  }
  const imported = [...new Set(
    [...changes.assertions, ...changes.shapes, ...changes.polities]
      .map((c) => /^(data\/imports\/[^/]+)\//.exec(c.file)?.[1])
      .filter((folder): folder is string => folder !== undefined),
  )];
  if (imported.length > 0) {
    flags.push(`- **Changes inside import folders** (${imported.map((f) => code(f)).join(', ')}): these files are written by the import scripts and never edited by hand. Check that the change comes from a re-import.`);
  }
  section('⚠️ For the maintainers', flags);

  // Side effects come next: they're what a diff never shows, so they're never the part cut short.
  const side = context.side;
  if (side || context.skippedSide) {
    out.push('### What it changes elsewhere on the map', '');
    if (context.skippedSide || !side) {
      out.push('Nothing that moves contested areas, "sources differ" areas, or land areas changed, so they weren\'t recomputed.', '');
    } else {
      const pair = (key: string) => key.split('\t');
      const amount = (c: TimedChange) =>
        c.before === 0 ? `new, ${km2(c.after)}` : c.after === 0 ? `gone (was ${km2(c.before)})` : `${km2(c.before)} → ${km2(c.after)}`;
      const lines = (list: TimedChange[] | undefined, label: (key: string) => string) =>
        (list ?? []).map((c) => `- ${label(c.key)}, ${span(c.s0, c.e0)}: ${amount(c)}`);
      const groups: [string, TimedChange[] | undefined, (key: string) => string, string][] = [
        [
          'Contested areas',
          side.contested,
          (key) => {
            const [facto, jure] = pair(key);
            return `administered by ${nameOf(facto)}, legally ${nameOf(jure)}'s`;
          },
          'Administered by one state and legally recognized as another\'s (including "possibly contested"), in km².',
        ],
        [
          'Sources differ',
          side.differ,
          (key) => {
            const [main, second] = pair(key);
            return `OpenHistoricalMap: ${nameOf(main)}; Cliopatria: ${nameOf(second)}`;
          },
          'Where the default map and the second opinion name different holders, in km².',
        ],
        [
          'Land areas',
          side.areas,
          (key) => {
            const [polity, relation] = pair(key);
            return `${nameOf(polity)}, ${relationWords({ relation } as Assertion).toLowerCase()}`;
          },
          'Land held on the default map, as the territory panel shows it.',
        ],
      ];
      for (const [title, list, label, about] of groups) {
        if (list === undefined) continue;
        if (list.length === 0) {
          out.push(`**${title}:** no change.`, '');
          continue;
        }
        out.push(`**${title}** (${number(list.length)} change${list.length === 1 ? '' : 's'}). ${about}`, '');
        const all = lines(list, label);
        out.push(...all.slice(0, maxLines));
        if (all.length > maxLines) {
          const more = `…and ${number(all.length - maxLines)} more`;
          out.push(`- ${options.fullSummaryUrl ? `[${more} in the full summary](${options.fullSummaryUrl})` : more}.`);
        }
        out.push('');
      }
    }
  }


  // Records (assertions).
  const assertionLines = changes.assertions.map((c) => {
    const a = (c.after ?? c.before)!;
    const head = `- **${KIND_WORDS[c.kind]}** ${code(c.id)}: ${nameOf(a.subject)}, ${relationWords(a)}`;
    if (c.kind !== 'changed') {
      const shape = a.shape ? ` · shape ${code(a.shape)}` : '';
      const recognized = a.recognized_by?.length ? ` · recognized by ${a.recognized_by.map((id) => nameOf(id)).join(', ')}` : '';
      return `${head}, ${period(a.start, a.end)}${shape}${recognized} · sources: ${citations(a.sources)} ${fileNote(c.file)}`;
    }
    const b = c.before!;
    const details: string[] = [];
    if (b.relation !== a.relation || b.object !== a.object) details.push(`relation: ${relationWords(b)} → ${relationWords(a)}`);
    if (b.subject !== a.subject) details.push(`holder: ${nameOf(b.subject)} → ${nameOf(a.subject)}`);
    if (b.start !== a.start || b.end !== a.end) details.push(`dates: ${period(b.start, b.end)} → ${period(a.start, a.end)}`);
    if (b.shape !== a.shape) details.push(`shape: ${b.shape ? code(b.shape) : 'none'} → ${a.shape ? code(a.shape) : 'none'}`);
    if (!sameValue(b.recognized_by, a.recognized_by)) {
      details.push(`recognized by: ${(b.recognized_by ?? []).map((id) => nameOf(id)).join(', ') || 'none'} → ${(a.recognized_by ?? []).map((id) => nameOf(id)).join(', ') || 'none'}`);
    }
    if (!sameValue(b.sources, a.sources)) details.push(`sources: ${citations(b.sources)} → ${citations(a.sources)}`);
    if (b.notes !== a.notes) details.push(`notes: ${a.notes ? `“${plain(a.notes, 400)}”` : 'removed'}`);
    return `${head} ${fileNote(c.file)}\n${details.map((d) => `  - ${d}`).join('\n')}`;
  });
  section('Records', assertionLines, countsOf(changes.assertions));

  // Borders (shapes).
  const shapeLines = changes.shapes.map((c) => {
    const s = (c.after ?? c.before)!;
    const users = assertionsByShape.get(c.id) ?? [];
    const usedBy = users.length
      ? ` · used by ${users.slice(0, 3).map((a) => `${nameOf(a.subject)} (${period(a.start, a.end)})`).join('; ')}${users.length > 3 ? `, and ${users.length - 3} more` : ''}`
      : '';
    const before = asMultiPolygon(c.before?.geometry);
    const after = asMultiPolygon(c.after?.geometry);
    const measure = (shape: MultiPolygon | undefined) => {
      if (!shape || !context.areaKm2) return undefined;
      const total = context.areaKm2(shape);
      const land = context.landKm2?.(shape);
      return { total, land };
    };
    const areaText = (m: { total: number; land?: number } | undefined) =>
      m ? `${km2(m.total)}${m.land !== undefined ? ` (land ${km2(m.land)})` : ''}` : '';
    const head = `- **${KIND_WORDS[c.kind]}** ${code(c.id)}`;
    const edge = s.properties?.edge_precision;
    if (c.kind !== 'changed') {
      const area = areaText(measure(after ?? before));
      return `${head}${area ? `: ${area}` : ''} · border line: ${edgeWords(edge)}${usedBy} ${fileNote(c.file)}`;
    }
    const details: string[] = [];
    if (!sameValue(c.before?.geometry, c.after?.geometry)) {
      const m0 = measure(before);
      const m1 = measure(after);
      if (m0 && m1) {
        const same = roughly(m0.total) === roughly(m1.total) && roughly(m0.land ?? 0) === roughly(m1.land ?? 0);
        details.push(same ? `area: ${areaText(m1)}, unchanged when rounded` : `area: ${areaText(m0)} → ${areaText(m1)}`);
      }
      if (before && after && context.shapeDiff) {
        const { gained, lost, box } = context.shapeDiff(before, after);
        let where = '';
        if (box) {
          const [w, so, e, n] = box;
          // Two decimals (about 1 km) for a small change, so its two edges don't read the same.
          const digits = Math.max(e - w, n - so) < 1 ? 2 : 1;
          const lat = (v: number) => `${Math.abs(v).toFixed(digits)}°${v < 0 ? 'S' : 'N'}`;
          const lon = (v: number) => `${Math.abs(v).toFixed(digits)}°${v < 0 ? 'W' : 'E'}`;
          where = `, around ${lat(so)}–${lat(n)}, ${lon(w)}–${lon(e)}`;
          const user = users[0];
          if (context.siteUrl && user) {
            const zoom = Math.max(2, Math.min(7, Math.log2(360 / Math.max(e - w, n - so, 0.01)) - 1));
            try {
              const hash = formatHash({ day: parseEdtfDate(user.start).earliest, zoom, lat: (so + n) / 2, lng: (w + e) / 2 });
              where += ` ([main's map there](${context.siteUrl}${hash}))`;
            } catch {
              // no link without a readable date
            }
          }
        }
        details.push(`borders moved: ${km2(gained)} gained, ${km2(lost)} lost${where}`);
      } else if (!m0 || !m1) {
        details.push('the border changed');
      }
    }
    if (c.before?.properties?.edge_precision !== c.after?.properties?.edge_precision) {
      details.push(`border line: ${edgeWords(c.before?.properties?.edge_precision)} → ${edgeWords(edge)}`);
    }
    const otherProperties = (p: ShapeFeature['properties'] | undefined) => {
      const { id: _id, edge_precision: _edge, ...rest } = p ?? ({} as ShapeFeature['properties']);
      return rest;
    };
    const properties = manifestChanges(otherProperties(c.before?.properties), otherProperties(c.after?.properties));
    if (properties.length > 0) details.push(`properties: ${properties.join('; ')}`);
    return `${head}${usedBy} ${fileNote(c.file)}\n${details.map((d) => `  - ${d}`).join('\n')}`;
  });
  section('Borders', shapeLines, countsOf(changes.shapes));

  // Events.
  const eventLines = changes.events.map((c) => {
    const e = (c.after ?? c.before)!;
    const date = safely(() => describeEventDate(e.date), e.date);
    const head = `- **${KIND_WORDS[c.kind]}** ${code(c.id)}: “${plain(e.title, 150)}”, ${date}`;
    if (c.kind === 'removed') return `${head} ${fileNote(c.file)}`;
    const details: string[] = [];
    const b = c.before;
    const describeLocation = (l: HistoricalEvent['location']) =>
      l ? `${l.coordinates?.map((v) => number(v)).join(', ')} (within ${number(l.precision_km)} km), per ${citations(l.sources)}` : 'none';
    if (!b) {
      details.push(`importance: ${e.importance ?? 'not set'}`);
      details.push(`sources: ${citations(e.sources)}`);
      if (e.polities?.length) details.push(`polities: ${e.polities.map((id) => nameOf(id)).join(', ')}`);
      if (e.effects?.length) details.push(`effects (records): ${e.effects.map((id) => code(id)).join(', ')}`);
      if (e.location) details.push(`place: ${describeLocation(e.location)}`);
      details.push(`summary: “${plain(e.summary, 1200)}”`);
    } else {
      if (b.title !== e.title) details.push(`title: “${plain(b.title, 150)}” → “${plain(e.title, 150)}”`);
      if (b.date !== e.date) details.push(`date: ${safely(() => describeEventDate(b.date), b.date)} → ${date}`);
      if (b.importance !== e.importance) details.push(`importance: ${b.importance ?? 'not set'} → ${e.importance ?? 'not set'}`);
      if (!sameValue(b.sources, e.sources)) details.push(`sources: ${citations(b.sources)} → ${citations(e.sources)}`);
      if (!sameValue(b.polities, e.polities)) details.push(`polities: ${(e.polities ?? []).map((id) => nameOf(id)).join(', ') || 'none'}`);
      if (!sameValue(b.effects, e.effects)) details.push(`effects (records): ${(e.effects ?? []).map((id) => code(id)).join(', ') || 'none'}`);
      if (!sameValue(b.location, e.location)) details.push(`place: ${describeLocation(b.location)} → ${describeLocation(e.location)}`);
      if (b.summary !== e.summary) details.push(`summary, now: “${plain(e.summary, 1200)}”`);
      if (b.wikidata !== e.wikidata) details.push(`Wikidata ID: ${b.wikidata ? code(b.wikidata) : 'none'} → ${e.wikidata ? code(e.wikidata) : 'none'}`);
    }
    return `${head} ${fileNote(c.file)}\n${details.map((d) => `  - ${d}`).join('\n')}`;
  });
  section('Events', eventLines, countsOf(changes.events));

  // Polities and names.
  const nameText = (n: Polity['names'][number]) =>
    `“${plain(n.text, 80)}” (${code(n.lang)}${n.start || n.end ? `, ${period(n.start, n.end)}` : ''}), per ${citations(n.sources)}`;
  const polityLines = changes.polities.map((c) => {
    const p = (c.after ?? c.before)!;
    const head = `- **${KIND_WORDS[c.kind]}** ${nameOf(p.id)}`;
    if (c.kind === 'removed') return `${head} ${fileNote(c.file)}`;
    const details: string[] = [];
    const b = c.before;
    // Names are matched by text and language. Names that changed the same way (a re-import often
    // adds a relation to every name's sources) are reported together, in one line.
    type Name = Polity['names'][number];
    const nameKey = (n: Name) => JSON.stringify([n.text, n.lang]);
    const oldNames = new Map((b?.names ?? []).map((n) => [nameKey(n), n]));
    const newNames = new Map((p.names ?? []).map((n) => [nameKey(n), n]));
    for (const [k, n] of newNames) if (!oldNames.has(k)) details.push(`name added: ${nameText(n)}`);
    for (const [k, n] of oldNames) if (!newNames.has(k)) details.push(`name removed: ${nameText(n)}`);
    const sameChange = new Map<string, Name[]>();
    for (const [k, n] of newNames) {
      const was = oldNames.get(k);
      if (!was || sameValue(was, n)) continue;
      const parts: string[] = [];
      if (was.start !== n.start || was.end !== n.end) parts.push(`dates ${period(was.start, was.end)} → ${period(n.start, n.end)}`);
      if (!sameValue(was.sources, n.sources)) parts.push(`sources ${citations(was.sources)} → ${citations(n.sources)}`);
      const change = parts.join('; ') || 'changed';
      sameChange.set(change, [...(sameChange.get(change) ?? []), n]);
    }
    for (const [change, names] of sameChange) {
      const which = names.length === 1 ? `“${plain(names[0].text, 80)}” (${code(names[0].lang)})` : `${names.length} names (${names.slice(0, 10).map((n) => code(n.lang)).join(', ')}${names.length > 10 ? `, and ${names.length - 10} more` : ''})`;
      details.push(`${which}: ${change}`);
    }
    if (b && b.type !== p.type) details.push(`type: ${b.type ? code(b.type) : 'none'} → ${p.type ? code(p.type) : 'none'}`);
    else if (!b && p.type) details.push(`type: ${code(p.type)}`);
    if (b && b.wikidata !== p.wikidata) details.push(`Wikidata ID: ${b.wikidata ? code(b.wikidata) : 'none'} → ${p.wikidata ? code(p.wikidata) : 'none'}`);
    if ((b?.notes ?? undefined) !== p.notes && p.notes) details.push(`notes: “${plain(p.notes, 400)}”`);
    return `${head} ${fileNote(c.file)}${details.length ? `\n${details.map((d) => `  - ${d}`).join('\n')}` : ''}`;
  });
  section('Polities and names', polityLines, countsOf(changes.polities));

  // Figures.
  const figureLines = changes.figures.map((c) => {
    const f = (c.after ?? c.before)!;
    const value = f.value !== undefined ? number(f.value) : `${f.low !== undefined ? number(f.low) : '?'} to ${f.high !== undefined ? number(f.high) : '?'}`;
    const date = safely(() => describeEventDate(f.date), f.date);
    return `- **${KIND_WORDS[c.kind]}** ${code(c.id)}: ${nameOf(f.polity)}, ${code(f.metric)} ${value}, ${date}, basis ${code(f.basis)} · sources: ${citations(f.sources)} ${fileNote(c.file)}`;
  });
  section('Figures', figureLines, countsOf(changes.figures));

  // Coverage.
  const coverageLines = changes.coverage.map((c) => {
    const v = (c.after ?? c.before)!;
    return `- **${KIND_WORDS[c.kind]}** ${code(c.id)}: ${code(v.source)} covers ${plain(v.region, 120)}, ${period(v.start, v.end)} ${fileNote(c.file)}`;
  });
  section('Coverage', coverageLines, countsOf(changes.coverage));

  // Crosswalks.
  const crosswalkLines = changes.crosswalks.map((c) => {
    const l = (c.after ?? c.before)!;
    const years = l.from || l.until ? `, ${period(l.from, l.until)}` : '';
    // The unit is the import's; the polity is ours (see schemas/crosswalk.schema.json).
    const link =
      l.kind === 'dependency'
        ? `${nameOf(l.polity)} administered a territory the import codes as a dependency of its unit ${nameOf(l.unit)}`
        : `${nameOf(l.polity)} is the same state as the import's unit ${nameOf(l.unit)}`;
    const why = c.kind === 'changed' ? ` · reason, now: “${plain(l.why, 300)}”` : l.why ? ` · reason: “${plain(l.why, 300)}”` : '';
    return `- **${KIND_WORDS[c.kind]}** ${link}${years}${why} ${fileNote(c.file)}`;
  });
  section('Crosswalk links', crosswalkLines, countsOf(changes.crosswalks));

  // Sources.
  const sourceLines = changes.sources.map((c) => {
    const s = (c.after ?? c.before)!;
    const head = `- **${KIND_WORDS[c.kind]}** ${code(c.id)}: ${plain(s.title, 200)}`;
    const facts = [
      s.kind ? `kind ${code(s.kind)}` : '',
      `license: ${s.license ? plain(s.license, 100) : 'not stated'}`,
      s.url ? `address ${code(s.url, 200)}` : '',
    ].filter(Boolean);
    if (c.kind === 'changed') {
      const fields = Object.keys({ ...c.before, ...c.after }).filter((k) => !sameValue((c.before as unknown as Record<string, unknown>)[k], (c.after as unknown as Record<string, unknown>)[k]));
      facts.push(`fields changed: ${fields.map((f) => code(f)).join(', ')}`);
    }
    return `${head} · ${facts.join(' · ')} ${fileNote(c.file)}`;
  });
  section('Sources', sourceLines, countsOf(changes.sources));

  // Other files: manifests with what changed in them, and the rest by name.
  const otherLines = changes.otherFiles.map((f) => {
    const manifest = context.manifests?.get(f.path);
    const fields = manifest ? manifestChanges(manifest.before, manifest.after) : [];
    return `- **${KIND_WORDS[f.kind]}** ${code(f.path)}${fields.length ? `\n${fields.slice(0, 12).map((l) => `  - ${l}`).join('\n')}${fields.length > 12 ? `\n  - …and ${fields.length - 12} more fields` : ''}` : ''}`;
  });
  section('Other files', otherLines, `${changes.otherFiles.length}`);

  out.push(
    '### Still for a person to check',
    '',
    '- Each cited source says what the data says, with the precision the data claims (open the page, sheet, or document).',
    '- Control, legal recognition, and claims are kept apart.',
    '- The wording is attributed rather than asserted, so both sides of a dispute would call it fair.',
    '- Summaries are in our own words, not pasted from the source or from Wikipedia.',
    '',
    `How review works: [CONTRIBUTING.md](${REPO_URL}/blob/main/CONTRIBUTING.md#how-review-works).`,
  );
  return out.join('\n');
}

/**
 * Fits a summary into GitHub's comment limit (65,536 characters): if it's too long, it's cut at a
 * line and ends with a pointer to the full summary.
 */
export function fitComment(markdown: string, limit = 65_536, fullSummaryUrl?: string): string {
  if (markdown.length <= limit) return markdown;
  const note = `\n\n**This summary is too long for a comment and was cut short.** ${fullSummaryUrl ? `[Read the full summary](${fullSummaryUrl}).` : "The full summary is on the check's summary page."}`;
  const cut = markdown.slice(0, limit - note.length);
  return cut.slice(0, cut.lastIndexOf('\n')) + note;
}
