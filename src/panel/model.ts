// What the territory panel says, worked out from plain data so it can be tested without a
// browser. The Preact components in panel.tsx only lay this out.
//
// The data comes from two files the build writes (scripts/build-data.ts):
//   public/data/sources.json         every source's title and address
//   public/data/polities/<id>.json   one polity: all its names and all its records
// A visitor only downloads the polities they open, so this scales to a worldwide map.

import { formatDate, formatDay, parseEdtfDate } from '../dates/index.ts';
import type { DatePrecision } from '../dates/index.ts';
import { t } from '../i18n/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import { pickNames } from '../map/names.ts';
import { eventDays } from '../timeline/events.ts';
import type { TimelineEvent } from '../timeline/events.ts';
import type { AtlasName } from '../map/names.ts';

// --- The files -----------------------------------------------------------------------------------

/** public/data/sources.json */
export interface SourcesFile {
  sources: Record<string, { title: string; url?: string; attribution?: string }>;
}

export interface Citation {
  source: string;
  locator: string;
  note?: string;
}

/** A name as stored in a polity file: EDTF dates for display, day numbers for choosing. */
export interface PolityName extends AtlasName {
  start?: string;
  end?: string;
  sources: Citation[];
}

/** One assertion about the polity (as subject, or as the other polity in a relation). */
export interface PolityRecord {
  id: string;
  relation: string;
  subject: string;
  object?: string;
  recognized_by?: string[];
  /** EDTF. `end` is the first day it no longer applied, or "ongoing" or "unknown". */
  start: string;
  end: string;
  /**
   * Day numbers: may have started from s0, had certainly started by s1, may have ended from e0.
   * e1 is set only when the end is known just to the month or year: it had certainly ended by then.
   */
  s0: number;
  s1: number;
  e0: number;
  e1?: number;
  sources: Citation[];
  notes?: string;
  /** The area of the record's shape, in km² (measured on the globe). */
  km2?: number;
  /** How precise the shape's border is: treaty-line, approximate-line, frontier-zone, or unknown. */
  edge?: string;
  /**
   * For a record the map draws as administered, in years a legal source covers: whether it lies
   * outside every place and period whose crosswalk has been reviewed (`unchecked`), or partly
   * outside (`partly`), so contested areas can't be (all) worked out for it (Phase 5 step 8).
   */
  legal?: 'unchecked' | 'partly';
  /**
   * Set on a de jure unit's record that the crosswalk links to this polity: the unit's ID, the
   * kind of link, and when the link applies (day numbers, m1 exclusive; open when missing).
   */
  via?: string;
  link?: 'same-state' | 'dependency';
  m0?: number;
  m1?: number;
}

/** Where the sources disagree over this polity's territory (computed by the build). */
export interface ContestedEntry {
  /** 'facto': this polity ran the area; 'jure': this polity (or its de jure unit) held it legally. */
  side: 'facto' | 'jure';
  /** The polity on the other side, and its relation to the area, per its source. */
  other: string;
  relation: string;
  source: string;
  s0: number;
  e0: number;
  /** Set when one of the two records may not apply then (its date is known only to the month or year). */
  maybe?: boolean;
  km2: number;
}

/**
 * A figure (statistic) about a polity: computed by the build from a shape (its land area), or
 * sourced from data/figures/. Each says what territory it counts (`basis`).
 */
export interface FigureEntry {
  metric: string;
  value?: number;
  low?: number;
  high?: number;
  basis: 'polity-territory' | 'present-day-borders' | 'computed-from-shape';
  basisDetail?: string;
  /** For a sourced figure: the date it describes (EDTF). */
  date?: string;
  /** When it applies: from s0 until e0 (exclusive), as day numbers. */
  s0: number;
  e0: number;
  /** For a computed figure: the relation it counts (administers, occupies, …). */
  relation?: string;
  /** For a computed figure: the records whose shapes it was measured over, together. */
  records?: string[];
  /** Set when only the part inside an import's area was measured: that area, in words. */
  partOf?: string;
  /** Coastal waters inside the border that the land area leaves out, in km². */
  waterKm2?: number;
  /** The source that computed it from its own shape (Cliopatria's `Area`), when not chronoatlas. */
  computedBy?: string;
  sources: Citation[];
  notes?: string;
}

/** public/data/polities/<id>.json */
export interface PolityFile {
  id: string;
  wikidata?: string;
  names: PolityName[];
  /** The polity record's notes, e.g. that it is a state as one source identifies it. */
  notes?: string;
  /** Sorted by start. */
  records: PolityRecord[];
  /** Names of the other polities the records mention (for "Protectorate of …" and so on). */
  related?: Record<string, AtlasName[]>;
  contested?: ContestedEntry[];
  /** Where the second opinion (Cliopatria) names a different holder over this territory: "sources differ". */
  differ?: ContestedEntry[];
  figures?: FigureEntry[];
  /**
   * Without a Wikidata ID: the English Wikipedia articles a source links for this polity's rows
   * (Cliopatria's `Wikipedia` column, Phase 5 decision 14), each for the days it applies, by start.
   */
  articles?: { title: string; source: string; s0: number; e0: number }[];
}

/** public/data/events/<id>.json */
export interface EventFile {
  id: string;
  wikidata?: string;
  title: string;
  /** EDTF: a date or an interval. */
  date: string;
  importance: number;
  location?: { coordinates: [number, number]; precision_km: number; sources: Citation[] };
  /** Written in the project's own words from the cited sources. */
  summary: string;
  polities?: string[];
  /** The records this event started or ended, written out in full. */
  effects?: PolityRecord[];
  sources: Citation[];
  /** Names of the polities it mentions. */
  related?: Record<string, AtlasName[]>;
}

/**
 * One entry of an era's public/data/changes/<version>.json: a territorial record starting or
 * ending, or (`change`) ending on the day the next record of the same polity begins.
 */
export interface BorderChange {
  /** The first day it applied (start, change), or the first day it no longer applied (end). */
  day: number;
  kind: 'start' | 'end' | 'change';
  /** The date as written in the data (EDTF), for its precision. */
  date: string;
  polity: string;
  record: string;
  relation: string;
  source: Citation;
}

/** public/data/changes/<version>.json: one era's changes, and the names of their polities. */
export interface NearbyFile {
  changes: BorderChange[];
  names: Record<string, AtlasName[]>;
}

/**
 * Which eras "around this date" needs, nearest the day first: the eras the window [left, right]
 * touches, but only as far out as could still hold one of the `limit` changes nearest the day.
 * `changesOf` gives an era's changes once its file has loaded. `missing` is the next era to load
 * (one at a time, nearest first, since the nearer ones may make it unneeded); when it's empty,
 * `changes` is everything the list can show.
 */
export function nearbyEras(
  eras: readonly { start: number; end: number }[],
  day: number,
  [left, right]: [number, number],
  changesOf: (era: number) => readonly BorderChange[] | undefined,
  limit = 25,
): { missing: number[]; changes: BorderChange[] } {
  const distance = (i: number) => {
    const from = Math.max(eras[i].start, left);
    const to = Math.min(eras[i].end - 1, right);
    return day < from ? from - day : day > to ? day - to : 0;
  };
  const touched = eras.map((_, i) => i).filter((i) => eras[i].start <= right && eras[i].end > left);
  touched.sort((a, b) => distance(a) - distance(b) || a - b);
  const missing: number[] = [];
  const found: BorderChange[] = [];
  for (const i of touched) {
    // Enough already: the `limit` nearest found are all closer than anything in this era.
    const near = found.map((c) => Math.abs(c.day - day)).sort((a, b) => a - b);
    if (near.length >= limit && near[limit - 1] <= distance(i)) break;
    const changes = changesOf(i);
    if (!changes) {
      missing.push(i);
      break;
    }
    found.push(...changes.filter((c) => c.day >= left && c.day <= right));
  }
  return { missing, changes: found };
}

/**
 * A territorial record found at a clicked spot, from one source's tiles (read by
 * HistoricalLayers.recordsAt): its record and polity IDs, relation, and day numbers.
 */
export interface SpotRecord {
  id: string;
  polity: string;
  relation: string;
  s0: number;
  s1: number;
  e0: number;
  e1?: number;
}

/** What one source's layer has at a clicked spot: the map's default view, the de jure view, or the second opinion. */
export interface SpotSet {
  set: 'facto' | 'jure' | 'second';
  /** The sources this layer's records come from (for naming them where there's no record). */
  sources: string[];
  records: SpotRecord[];
}

// --- What the panel shows ------------------------------------------------------------------------

/**
 * A source shown in the panel, with the credit it asks for. Licenses such as CC BY-NC-SA require
 * the credit and license notice wherever their data appears, so each view lists its sources.
 */
export interface Credit {
  title: string;
  attribution?: string;
  url?: string;
}

export interface SourceLine {
  text: string;
  url?: string;
  /** What this source is, for reading it fairly (for example "Statement by the Japanese government"). */
  note?: string;
}

/** A record in effect on the selected day, with everything needed to read it fairly. */
export interface CurrentEntry {
  id: string;
  label: string;
  began: string;
  ended: string;
  /** How precise the border is, in words (territorial records only). */
  border?: string;
  notes: string[];
  sources: SourceLine[];
}

/** A line in the polity's full history. */
export interface HistoryEntry {
  id: string;
  label: string;
  period: string;
  /** The first day the map shows this record, for "go to this date". */
  day: number;
  /** In effect on the selected day. */
  current: boolean;
  sources: SourceLine[];
}

export interface NameLine {
  text: string;
  /** BCP 47 tag for the `lang` attribute (so Chinese and Japanese text get the right glyphs). */
  lang?: string;
  language: string;
  period?: string;
}

/** Names that share the same sources, so each source is shown once. */
export interface NameGroup {
  names: NameLine[];
  sources: SourceLine[];
}

export interface TerritoryView {
  polity: string;
  name: string;
  /** The name in its original script, when it differs from `name`. */
  localName?: string;
  /** Whether any source gives this polity territory on the selected day. */
  hasTerritory: boolean;
  /** One line for the phone panel at its smallest height: what's in effect on this date. */
  summary: string;
  current: CurrentEntry[];
  /** Names the kinds of statement with no record for this date, e.g. sovereignty (de jure). */
  missing?: string;
  history: HistoryEntry[];
  names: NameGroup[];
  nameCount: number;
  /** The polity record's notes. */
  note?: string;
  /** Where the sources disagree over this polity's territory on this date, in words. */
  contested: string[];
  /** Where the second opinion names a different holder on this date, in words ("sources differ"). */
  differ: string[];
  /** Figures for this date, each with what it counts, how it was made, and its sources. */
  figures: FigureLine[];
  /** Said when our only legal-borders source can't cover a territory this small. */
  smallTerritory?: string;
  /** Said when this territory hasn't (all) been checked against legal borders for contested areas. */
  notChecked?: string;
  /** Every source this view cites, with its credit. */
  credits: Credit[];
  /** The address of the polity's Wikipedia article, from its Wikidata ID or a source's `articles`. */
  wikipedia?: string;
  /** The source that links that article, when it isn't our Wikidata ID (e.g. "Cliopatria"). */
  wikipediaVia?: string;
}

/**
 * The polity's link to Wikipedia: from its Wikidata ID; otherwise the article a source links for
 * the row in effect on the day (or the nearest row), credited to that source.
 */
function wikipediaFor(file: PolityFile, sources: SourcesFile['sources'], day: number, locale: string): Pick<TerritoryView, 'wikipedia' | 'wikipediaVia'> {
  const byId = file.wikidata ? wikipediaLink(file.wikidata, locale) : undefined;
  if (byId) return { wikipedia: byId };
  const articles = file.articles ?? [];
  if (articles.length === 0) return {};
  const distance = (a: { s0: number; e0: number }) => (day < a.s0 ? a.s0 - day : day >= a.e0 ? day - a.e0 + 1 : 0);
  const article = articles.reduce((best, a) => (distance(a) < distance(best) ? a : best));
  const url = articleLink(article.title);
  return url ? { wikipedia: url, wikipediaVia: sources[article.source]?.title ?? article.source } : {};
}

/**
 * The address of the Wikipedia article for a Wikidata item, in the reader's language: Wikidata's
 * own "go to the linked article" page, which opens Wikidata's page for the item when there's no
 * article in that language. Nothing is fetched to build it. Undefined for anything that isn't a
 * Wikidata item ID, since the ID comes from outside data.
 */
export function wikipediaLink(wikidata: string, locale: string): string | undefined {
  if (!/^Q[1-9][0-9]*$/.test(wikidata)) return undefined;
  const lang = locale.split('-')[0].toLowerCase();
  return `https://www.wikidata.org/wiki/Special:GoToLinkedPage/${/^[a-z]{2,3}$/.test(lang) ? lang : 'en'}wiki/${wikidata}`;
}

/**
 * The address of an English Wikipedia article by its title, as a source gives it. Undefined for a
 * title with characters no Wikipedia title has, since it comes from outside data.
 */
export function articleLink(title: string): string | undefined {
  if (!/^[^\u0000-\u001f<>[\]{}|#]{1,255}$/.test(title)) return undefined;
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`;
}

/** "What each source says at the spot you clicked": one group per source layer. */
export interface SpotView {
  groups: {
    set: SpotSet['set'];
    /** The layer and its sources, e.g. "As administered · OpenHistoricalMap". */
    heading: string;
    entries: {
      /** The record's ID (for keys). */
      id: string;
      polity: string;
      /** The relation in words, e.g. "Administered (de facto)". */
      relation: string;
      name: string;
      period?: string;
      /** Said when the record's start or end is uncertain and it may not apply on this date. */
      maybe?: string;
      sources: SourceLine[];
    }[];
    /** Said when the layer has no record at the spot on this date. */
    none?: string;
  }[];
}

export interface FigureLine {
  id: string;
  label: string;
  value: string;
  notes: string[];
  sources: SourceLine[];
}

// --- Wording -------------------------------------------------------------------------------------

const RELATION_KEYS: Record<string, MessageKey> = {
  controls: 'relation.controls',
  administers: 'relation.administers',
  occupies: 'relation.occupies',
  sovereign: 'relation.sovereign',
  claims: 'relation.claims',
  'leased-to': 'relation.leased-to',
  'protectorate-of': 'relation.protectorate-of',
  'puppet-of': 'relation.puppet-of',
};

/** For records where this polity is the `object`: "Protectorate: Testland" and so on. */
const INVERSE_KEYS: Record<string, MessageKey> = {
  'leased-to': 'relation.inverse.leased-to',
  'protectorate-of': 'relation.inverse.protectorate-of',
  'puppet-of': 'relation.inverse.puppet-of',
};

/** Labels for the metrics a figure can have (schemas/figure.schema.json). */
const FIGURE_KEYS: Record<string, MessageKey> = {
  'area-km2': 'figure.area-km2',
  population: 'figure.population',
};

/** How a contested entry describes the other side's relation to the area. */
const HOLDS_KEYS: Record<string, MessageKey> = {
  sovereign: 'panel.holds.sovereign',
  occupies: 'panel.holds.occupies',
  administers: 'panel.holds.administers',
  controls: 'panel.holds.controls',
};

/** CShapes (our source for legal borders) doesn't code territorial changes under this size. */
const LEGAL_SOURCE = 'cshapes-2-0';
const LEGAL_SOURCE_MIN_KM2 = 10_000;

/** The three kinds of territorial statement the ground rules keep apart. */
const CATEGORIES: { key: MessageKey; relations: string[] }[] = [
  { key: 'panel.category.control', relations: ['controls', 'administers', 'occupies'] },
  { key: 'panel.category.sovereignty', relations: ['sovereign'] },
  { key: 'panel.category.claims', relations: ['claims'] },
];

// Day-precise dates need no comment; coarser ones say so, so "1932" never looks exact.
const PRECISION_KEYS: Partial<Record<DatePrecision, MessageKey>> = {
  month: 'panel.precision.month',
  year: 'panel.precision.year',
};

/** A start or end date from our data, in words, saying how precise it is. */
export function describeDate(edtf: string): string {
  if (edtf === 'ongoing') return t('panel.endOngoing');
  if (edtf === 'unknown') return t('panel.endUnknown');
  const date = parseEdtfDate(edtf);
  const key = PRECISION_KEYS[date.precision];
  return key ? t(key, { date: formatDate(date) }) : formatDate(date);
}

/** A period such as "1932 (year only) – 17 August 1945", or "1945 onwards". Either end may be missing. */
export function describePeriod(start: string | undefined, end: string | undefined): string | undefined {
  if (!start && !end) return undefined;
  if (!start) return t('date.intervalUntil', { end: describeDate(end!) });
  if (!end || end === 'ongoing') return t('date.intervalOnwards', { start: describeDate(start) });
  return t('panel.period', { start: describeDate(start), end: end === 'unknown' ? t('date.unknown') : describeDate(end) });
}

/** Volumes of Foreign Relations of the United States on the State Department historian's site. */
const FRUS_VOLUME = /^https:\/\/history\.state\.gov\/historicaldocuments\/[a-z0-9-]+$/;

/**
 * A link to the exact record in the source, where we know how to build one: an OpenHistoricalMap
 * relation, or a document in a volume of Foreign Relations of the United States ("document 57"
 * is at <volume>/d57). `sourceUrl` is the source's own address.
 */
export function sourceLink(source: string, locator: string, sourceUrl?: string): string | undefined {
  const relationId = /\brelation (\d+)\b/.exec(locator)?.[1];
  if (source === 'openhistoricalmap' && relationId) return `https://www.openhistoricalmap.org/relation/${relationId}`;
  const documentNumber = /^document (\d+)\b/.exec(locator)?.[1];
  if (documentNumber && sourceUrl && FRUS_VOLUME.test(sourceUrl)) return `${sourceUrl}/d${documentNumber}`;
  return undefined;
}

/** The distinct sources cited, in the order first cited, with their credits. */
function creditsFor(citations: Iterable<Citation>, sources: SourcesFile['sources']): Credit[] {
  const seen = new Map<string, Credit>();
  for (const { source } of citations) {
    if (seen.has(source)) continue;
    const s = sources[source];
    seen.set(source, {
      title: s?.title ?? source,
      ...(s?.attribution ? { attribution: s.attribution } : {}),
      ...(s?.url ? { url: s.url } : {}),
    });
  }
  return [...seen.values()];
}

/**
 * Each citation as "Title, locator", linked where possible. With `withNotes`, each keeps its note
 * (who is speaking in it). Records show their citation notes among their own notes instead.
 */
function sourceLines(citations: readonly Citation[], sources: SourcesFile['sources'], withNotes = false): SourceLine[] {
  return citations.map((c) => {
    const url = sourceLink(c.source, c.locator, sources[c.source]?.url);
    return {
      text: `${sources[c.source]?.title ?? c.source}, ${c.locator}`,
      ...(url ? { url } : {}),
      ...(withNotes && c.note ? { note: c.note } : {}),
    };
  });
}

const languageNames = new Map<string, Intl.DisplayNames | null>();

/** "Japanese" for "ja", in the reader's language. Language names aren't dates, so Intl is fine. */
export function languageName(tag: string, locale: string): string {
  if (tag === 'und') return t('panel.nameLocal');
  if (!languageNames.has(locale)) {
    try {
      languageNames.set(locale, new Intl.DisplayNames([locale], { type: 'language', fallback: 'code' }));
    } catch {
      languageNames.set(locale, null);
    }
  }
  try {
    return languageNames.get(locale)?.of(tag) ?? tag;
  } catch {
    return tag; // not a well-formed language tag
  }
}

function listOf(items: string[], locale: string): string {
  try {
    return new Intl.ListFormat(locale, { type: 'conjunction' }).format(items);
  } catch {
    return items.join(', ');
  }
}

// --- Putting it together -------------------------------------------------------------------------

/**
 * The other polities recorded at the spot the reader clicked, so none is hidden under another
 * (overlapping records are exactly what the ground rules say not to flatten). `spot` lists them
 * top one first; names not loaded yet show as their ID until they arrive.
 */
export function otherPolitiesAtSpot(
  spot: readonly string[],
  selected: string,
  namesOf: (id: string) => readonly AtlasName[] | undefined,
  day: number,
  locale: string,
): { id: string; name: string }[] {
  if (!spot.includes(selected)) return [];
  return spot
    .filter((id) => id !== selected)
    .map((id) => ({ id, name: pickNames(namesOf(id) ?? [], day, locale)?.primary ?? id }));
}

/** How precise a border is, in words. Treaty lines and unknown precision look alike on the map. */
const EDGE_KEYS: Record<string, MessageKey> = {
  'treaty-line': 'edge.treaty-line',
  'approximate-line': 'edge.approximate-line',
  'frontier-zone': 'edge.frontier-zone',
  unknown: 'edge.unknown',
};

const SPOT_SET_KEYS: Record<SpotSet['set'], MessageKey> = {
  facto: 'spot.facto',
  jure: 'spot.jure',
  second: 'spot.second',
};

/**
 * What each source's layer has at the spot the reader clicked, on this day, side by side: every
 * record in effect (with the relation, name, dates, and sources), or that there's none. Shown only
 * while the selected polity is one of those recorded at the spot. `fileOf` gives a polity's file,
 * once loaded, for its names and the record's dates and sources.
 */
export function describeSpot(
  sets: readonly SpotSet[] | null,
  selected: string,
  fileOf: (id: string) => PolityFile | undefined,
  sources: SourcesFile['sources'],
  day: number,
  locale: string,
): SpotView | undefined {
  if (!sets || !sets.some((s) => s.records.some((r) => r.polity === selected))) return undefined;
  return {
    groups: sets.map((set) => {
      const titles = set.sources.map((id) => sources[id]?.title ?? id).join(', ');
      const heading = titles ? `${t(SPOT_SET_KEYS[set.set])} · ${titles}` : t(SPOT_SET_KEYS[set.set]);
      const current = set.records.filter((r) => r.s0 <= day && day < (r.e1 ?? r.e0));
      const entries = current.map((r) => {
        const file = fileOf(r.polity);
        const record = file?.records.find((x) => x.id === r.id && !x.via);
        const uncertain = (r.s0 <= day && day < r.s1) || (r.e1 !== undefined && r.e0 <= day);
        return {
          id: r.id,
          polity: r.polity,
          relation: RELATION_KEYS[r.relation] ? t(RELATION_KEYS[r.relation]) : r.relation,
          name: pickNames(file?.names ?? [], day, locale)?.primary ?? r.polity,
          ...(record ? { period: describePeriod(record.start, record.end) } : {}),
          ...(uncertain ? { maybe: t('spot.maybe') } : {}),
          sources: record ? sourceLines(record.sources, sources) : [],
        };
      });
      return { set: set.set, heading, entries, ...(entries.length === 0 ? { none: t('spot.none') } : {}) };
    }),
  };
}

/** Describes a polity on a given day, from its polity file. */
export function describeTerritory(
  file: PolityFile,
  sources: SourcesFile['sources'],
  day: number,
  locale: string,
): TerritoryView {
  const nameOf = (id: string) => pickNames(file.related?.[id] ?? [], day, locale)?.primary ?? id;
  // Numbers are rounded to 2 significant figures: none of the areas is more precise than that.
  const number = (n: number) => {
    try {
      return new Intl.NumberFormat(locale, { maximumSignificantDigits: 2 }).format(n);
    } catch {
      return String(n);
    }
  };
  // A record counts until the last day it could have ended, as the map shows it. A linked record
  // counts only while its crosswalk link applies.
  const isCurrent = (r: PolityRecord) =>
    r.s0 <= day && day < (r.e1 ?? r.e0) && (r.m0 === undefined || r.m0 <= day) && (r.m1 === undefined || day < r.m1);

  const label = (r: PolityRecord): string => {
    if (r.via) {
      // A de jure unit's record, linked by the crosswalk: "Sovereign (de jure), as “China”", or
      // for a dependency, the state that held it: "Sovereign (de jure): United Kingdom".
      const relation = RELATION_KEYS[r.relation] ? t(RELATION_KEYS[r.relation]) : r.relation;
      return t(r.link === 'dependency' ? 'panel.heldBy' : 'panel.heldAs', { relation, name: nameOf(r.subject) });
    }
    if (r.subject !== file.id) {
      const key = INVERSE_KEYS[r.relation];
      return key ? t(key, { name: nameOf(r.subject) }) : r.relation;
    }
    const key = RELATION_KEYS[r.relation];
    if (!key) return r.relation;
    return r.object ? t(key, { name: nameOf(r.object) }) : t(key);
  };

  const current = file.records.filter(isCurrent).map((r): CurrentEntry => {
    const notes: string[] = [];
    if (r.s0 <= day && day < r.s1) notes.push(t('panel.uncertainStart', { date: formatDate(parseEdtfDate(r.start)) }));
    if (r.e1 !== undefined && r.e0 <= day) notes.push(t('panel.uncertainEnd', { date: formatDate(parseEdtfDate(r.end)) }));
    if (r.relation === 'administers') notes.push(t('panel.administersNote'));
    if (r.recognized_by?.length) notes.push(t('panel.recognizedBy', { list: listOf(r.recognized_by.map(nameOf), locale) }));
    if (r.notes) notes.push(r.notes);
    for (const c of r.sources) if (c.note) notes.push(c.note);
    return {
      id: recordKey(r),
      label: label(r),
      began: describeDate(r.start),
      ended: describeDate(r.end),
      ...(r.edge && EDGE_KEYS[r.edge] ? { border: t(EDGE_KEYS[r.edge]) } : {}),
      notes,
      sources: sourceLines(r.sources, sources),
    };
  });

  // Say which kinds of statement we have no source for on this day, so silence isn't read as
  // "there was none". Only when the polity has some territory on this day.
  const territorial = CATEGORIES.flatMap((c) => c.relations);
  const own = file.records.filter((r) => (r.subject === file.id || r.via) && isCurrent(r) && territorial.includes(r.relation));
  const absent = own.length === 0 ? [] : CATEGORIES.filter((c) => !own.some((r) => c.relations.includes(r.relation)));
  const missing = absent.length > 0 ? t('panel.missing', { list: listOf(absent.map((c) => t(c.key)), locale) }) : undefined;

  const history = file.records.map(
    (r): HistoryEntry => ({
      id: recordKey(r),
      label: label(r),
      period: describePeriod(r.start, r.end)!,
      day: r.s0,
      current: isCurrent(r),
      sources: sourceLines(r.sources, sources),
    }),
  );

  // Names: the reader's language first, then English, then the local name, then the rest by
  // language name. Grouped by their sources, so a shared source is listed once.
  const base = locale.split('-')[0];
  const rank = (n: PolityName) => (n.lang.split('-')[0] === base ? 0 : n.lang === 'en' ? 1 : n.lang === 'und' ? 2 : 3);
  const lines = file.names
    .map((n) => ({ n, language: languageName(n.lang, locale) }))
    .sort((a, b) => rank(a.n) - rank(b.n) || a.language.localeCompare(b.language, locale) || a.n.text.localeCompare(b.n.text));
  const groups = new Map<string, NameGroup>();
  for (const { n, language } of lines) {
    const key = JSON.stringify(n.sources);
    if (!groups.has(key)) groups.set(key, { names: [], sources: sourceLines(n.sources, sources) });
    const period = describePeriod(n.start, n.end);
    groups.get(key)!.names.push({
      text: n.text,
      ...(n.lang !== 'und' ? { lang: n.lang } : {}),
      language,
      ...(period ? { period } : {}),
    });
  }

  // One line per other holder: records known only to the year overlap for a whole year (the old
  // one may still apply, the new one may already), so the same disagreement can come from two
  // pairs of records at once. Different areas become a range.
  const perHolder = (entries: readonly ContestedEntry[]) => {
    const groups = new Map<string, { entry: ContestedEntry; km2: number[] }>();
    for (const c of entries.filter((c) => c.s0 <= day && day < c.e0)) {
      const key = [c.side, c.other, c.relation, c.source, !!c.maybe].join('|');
      const group = groups.get(key) ?? { entry: c, km2: [] };
      group.km2.push(c.km2);
      groups.set(key, group);
    }
    return [...groups.values()].map(({ entry, km2 }) => {
      const [low, high] = [number(Math.min(...km2)), number(Math.max(...km2))];
      return {
        entry,
        params: {
          source: sources[entry.source]?.title ?? entry.source,
          name: nameOf(entry.other),
          holds: HOLDS_KEYS[entry.relation] ? t(HOLDS_KEYS[entry.relation]) : entry.relation,
          km2: low === high ? low : t('figure.range', { low, high }),
        },
      };
    });
  };
  // Where the sources disagree over this territory today, attributed to the other side's source.
  const disputes = (file.contested ?? []).filter((c) => c.s0 <= day && day < c.e0);
  const contested = perHolder(disputes).map(({ entry: c, params }) =>
    t(c.maybe ? 'panel.contestedMaybe' : c.side === 'facto' ? 'panel.contestedFacto' : 'panel.contestedJure', params),
  );
  // Where the second opinion names someone else: a difference between sources, not a dispute.
  const differ = perHolder(file.differ ?? []).map(({ entry: c, params }) => t(c.maybe ? 'panel.differMaybe' : 'panel.differ', params));

  // Figures. A computed figure applies while its record does. For sourced figures, show the
  // estimate nearest to this date, with its own date, rather than invent an in-between value.
  const figureLines: FigureLine[] = [];
  const computed = (file.figures ?? []).filter((f) => !f.date && f.s0 <= day && day < f.e0);
  const distance = (f: FigureEntry) => (day < f.s0 ? f.s0 - day : day >= f.e0 ? day - f.e0 + 1 : 0);
  const nearest = new Map<string, FigureEntry>();
  for (const f of (file.figures ?? []).filter((f) => f.date)) {
    const best = nearest.get(f.metric);
    if (!best || distance(f) < distance(best)) nearest.set(f.metric, f);
  }
  for (const f of [...computed, ...nearest.values()]) {
    const notes: string[] = [];
    if (f.relation && f.relation !== 'administers') {
      notes.push(t('figure.relation', { relation: RELATION_KEYS[f.relation] ? t(RELATION_KEYS[f.relation]) : f.relation }));
    }
    if (f.records && f.records.length > 1) notes.push(t('figure.combined', { count: String(f.records.length) }));
    // Measured over several records, one of which may not apply on this date (its start or end is
    // known only to the month or year): the area held may have been smaller.
    const unsure = (id: string) => {
      const r = file.records.find((x) => x.id === id && !x.via);
      return !!r && ((r.s0 <= day && day < r.s1) || (r.e1 !== undefined && r.e0 <= day && day < r.e1));
    };
    if (f.records && f.records.length > 1 && f.records.some(unsure)) notes.push(t('figure.uncertain'));
    if (f.partOf) notes.push(t('figure.partOf', { area: f.partOf }));
    if (f.waterKm2) notes.push(t('figure.water', { value: number(f.waterKm2) }));
    if (f.computedBy) notes.push(t('figure.computedBy', { source: sources[f.computedBy]?.title ?? f.computedBy }));
    else if (f.basis === 'computed-from-shape') notes.push(t('figure.computed'));
    if (f.basis === 'present-day-borders') notes.push(t('figure.presentDay', { detail: f.basisDetail ?? '' }));
    if (f.date) notes.push(t('figure.asOf', { date: describeEventDate(f.date) }));
    if (f.notes) notes.push(f.notes);
    const amount =
      f.value !== undefined ? number(f.value) : f.low !== undefined && f.high !== undefined ? t('figure.range', { low: number(f.low), high: number(f.high) }) : '';
    figureLines.push({
      id: `${f.metric}-${f.relation ?? ''}-${f.date ?? f.s0}`,
      // A source's own area isn't our land-only measurement, so it's just "Area".
      label: f.computedBy && f.metric === 'area-km2' ? t('figure.area') : FIGURE_KEYS[f.metric] ? t(FIGURE_KEYS[f.metric]) : f.metric,
      value: f.metric === 'area-km2' ? t('figure.areaValue', { value: amount }) : t('figure.approximately', { value: amount }),
      notes,
      sources: sourceLines(f.sources, sources),
    });
  }

  // CShapes can't speak to territories under its 10,000 km² threshold; say so rather than leave
  // the reader wondering why the legal side is missing.
  const legal = own.some((r) => r.sources.some((s) => s.source === LEGAL_SOURCE));
  const small = own.length > 0 && !legal && own.every((r) => r.km2 !== undefined && r.km2 < LEGAL_SOURCE_MIN_KM2);
  // Contested areas are worked out only where the crosswalk has been reviewed: say so where it
  // hasn't, so no contested area isn't read as "not contested".
  const unchecked = own.filter((r) => !r.via && r.legal);
  const notChecked =
    unchecked.length === 0 ? undefined : t(unchecked.every((r) => r.legal === 'unchecked') && unchecked.length === own.filter((r) => !r.via).length ? 'panel.notChecked' : 'panel.partlyChecked');

  const names = pickNames(file.names, day, locale);
  const name = names?.primary ?? file.id;
  return {
    polity: file.id,
    name,
    ...(names?.local ? { localName: names.local } : {}),
    hasTerritory: own.length > 0,
    summary: current.length > 0 ? [...new Set(current.map((e) => e.label))].join(' · ') : t('panel.noTerritory', { name }),
    current,
    ...(missing ? { missing } : {}),
    history,
    names: [...groups.values()],
    nameCount: file.names.length,
    ...(file.notes ? { note: file.notes } : {}),
    contested,
    differ,
    figures: figureLines,
    ...(small ? { smallTerritory: t('panel.smallTerritory') } : {}),
    ...(notChecked ? { notChecked } : {}),
    ...wikipediaFor(file, sources, day, locale),
    credits: creditsFor(
      [
        ...file.records.flatMap((r) => r.sources),
        ...file.names.flatMap((n) => n.sources),
        ...disputes.map((c) => ({ source: c.source, locator: '' })),
        ...(file.figures ?? []).flatMap((f) => f.sources),
      ],
      sources,
    ),
  };
}

/** A key that stays unique when the crosswalk links the same record through two periods. */
function recordKey(r: PolityRecord): string {
  return r.via ? `${r.id}@${r.m0 ?? ''}` : r.id;
}

// --- Events --------------------------------------------------------------------------------------

export interface EventView {
  id: string;
  title: string;
  /** The date in words, with its precision ("May 1901 (month only)", or a range). */
  date: string;
  summary: string;
  /** Where it happened, in words, with the location's own sources. */
  location?: { text: string; sources: SourceLine[] };
  polities: { id: string; name: string }[];
  /** The records the event started or ended (outlined on the map while it's selected). */
  effects: { id: string; label: string; period: string; sources: SourceLine[] }[];
  sources: SourceLine[];
  credits: Credit[];
}

/** An event date in words: a single date, or a range with either end open or unknown. */
export function describeEventDate(edtf: string): string {
  if (!edtf.includes('/')) return describeDate(edtf);
  const [start, end] = edtf.split('/');
  return describePeriod(start && start !== '..' ? start : undefined, end === '..' ? 'ongoing' : end || 'unknown')!;
}

/** Describes an event from its event file. */
export function describeEvent(file: EventFile, sources: SourcesFile['sources'], day: number, locale: string): EventView {
  const nameOf = (id: string) => pickNames(file.related?.[id] ?? [], day, locale)?.primary ?? id;
  const { s0, s1 } = eventDays(file.date);
  const within = (d: number) => d >= s0 && d <= s1 + 1;

  const effects = (file.effects ?? []).map((r) => {
    const key = RELATION_KEYS[r.relation];
    const relation = key ? (r.object ? t(key, { name: nameOf(r.object) }) : t(key)) : r.relation;
    const record = t('panel.effectRecord', { relation, name: nameOf(r.subject) });
    // Whether the event's dates match the record's start or end, as the effects list implies.
    const label = within(r.s0) ? t('panel.effectStarted', { record }) : within(r.e0) ? t('panel.effectEnded', { record }) : record;
    return { id: r.id, label, period: describePeriod(r.start, r.end)!, sources: sourceLines(r.sources, sources) };
  });

  const location = file.location && {
    text:
      file.location.precision_km > 0
        ? t('panel.locationWithin', { km: file.location.precision_km })
        : t('panel.locationExact'),
    sources: sourceLines(file.location.sources, sources, true),
  };

  return {
    id: file.id,
    title: file.title,
    date: describeEventDate(file.date),
    summary: file.summary,
    ...(location ? { location } : {}),
    polities: (file.polities ?? []).map((id) => ({ id, name: nameOf(id) })),
    effects,
    sources: sourceLines(file.sources, sources, true),
    credits: creditsFor(
      [...file.sources, ...(file.location?.sources ?? []), ...(file.effects ?? []).flatMap((r) => r.sources)],
      sources,
    ),
  };
}

// --- Around this date ----------------------------------------------------------------------------

export interface NearbyView {
  /** "Around 1 July 1937" */
  title: string;
  /** The period covered: the part of the timeline in view. */
  window: string;
  events: { id: string; title: string; date: string }[];
  changes: { key: string; polity: string; name: string; label: string; date: string; day: number; sources: SourceLine[] }[];
  credits: Credit[];
}

/**
 * What happened near a day: events and border changes between `left` and `right` (the part of
 * the timeline in view, so the window grows as you zoom out), nearest first, at most `limit` of
 * each. Names not loaded yet show as their ID until they arrive.
 */
export function describeNearby(
  day: number,
  [left, right]: [number, number],
  events: readonly TimelineEvent[],
  changes: readonly BorderChange[],
  sources: SourcesFile['sources'],
  namesOf: (id: string) => readonly AtlasName[] | undefined,
  locale: string,
  limit = 25,
): NearbyView {
  const distance = (d: number) => Math.abs(d - day);

  const nearEvents = events
    .filter((e) => e.s1 + 1 >= left && e.s0 <= right)
    .sort((a, b) => distance(a.s0) - distance(b.s0) || a.s0 - b.s0)
    .slice(0, limit)
    .map((e) => ({ id: e.id, title: e.title, date: e.date ? describeEventDate(e.date) : formatDay(e.s0) }));

  const nearChanges = changes
    .filter((c) => c.day >= left && c.day <= right)
    .sort((a, b) => distance(a.day) - distance(b.day) || a.day - b.day)
    .slice(0, limit)
    .map((c) => {
      const relation = RELATION_KEYS[c.relation] ? t(RELATION_KEYS[c.relation]) : c.relation;
      return {
        key: `${c.record}-${c.kind}`,
        polity: c.polity,
        name: pickNames(namesOf(c.polity) ?? [], c.day, locale)?.primary ?? c.polity,
        label: t(c.kind === 'start' ? 'nearby.recordStarts' : c.kind === 'change' ? 'nearby.recordChanges' : 'nearby.recordEnds', { relation }),
        date: describeDate(c.date),
        day: c.day,
        sources: sourceLines([c.source], sources),
      };
    });

  const nearChangeSources = changes.filter((c) => nearChanges.some((n) => n.key === `${c.record}-${c.kind}`)).map((c) => c.source);
  return {
    credits: creditsFor(nearChangeSources, sources),
    title: t('nearby.title', { date: formatDay(day) }),
    window: t('nearby.window', { start: formatDay(Math.ceil(left)), end: formatDay(Math.floor(right)) }),
    events: nearEvents,
    changes: nearChanges,
  };
}
