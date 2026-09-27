// What the territory panel says, worked out from plain data so it can be tested without a
// browser. The Preact components in panel.tsx only lay this out.
//
// The data comes from two files the build writes (scripts/build-data.ts):
//   public/data/sources.json         every source's title and address
//   public/data/polities/<id>.json   one polity: all its names and all its records
// A visitor only downloads the polities they open, so this scales to a worldwide map.

import { formatDate, parseEdtfDate } from '../dates/index.ts';
import type { DatePrecision } from '../dates/index.ts';
import { t } from '../i18n/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import { pickNames } from '../map/names.ts';
import { eventDays } from '../timeline/events.ts';
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
  /** Day numbers: may have started from s0, had certainly started by s1, ended on e0. */
  s0: number;
  s1: number;
  e0: number;
  sources: Citation[];
  notes?: string;
}

/** public/data/polities/<id>.json */
export interface PolityFile {
  id: string;
  wikidata?: string;
  names: PolityName[];
  /** Sorted by start. */
  records: PolityRecord[];
  /** Names of the other polities the records mention (for "Protectorate of …" and so on). */
  related?: Record<string, AtlasName[]>;
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

// --- What the panel shows ------------------------------------------------------------------------

export interface SourceLine {
  text: string;
  url?: string;
}

/** A record in effect on the selected day, with everything needed to read it fairly. */
export interface CurrentEntry {
  id: string;
  label: string;
  began: string;
  ended: string;
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

/** A link to the exact record in the source, where we know how to build one. */
export function sourceLink(source: string, locator: string): string | undefined {
  const relationId = /\brelation (\d+)\b/.exec(locator)?.[1];
  if (source === 'openhistoricalmap' && relationId) return `https://www.openhistoricalmap.org/relation/${relationId}`;
  return undefined;
}

function sourceLines(citations: readonly Citation[], sources: SourcesFile['sources']): SourceLine[] {
  return citations.map((c) => {
    const url = sourceLink(c.source, c.locator);
    return { text: `${sources[c.source]?.title ?? c.source}, ${c.locator}`, ...(url ? { url } : {}) };
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

/** Describes a polity on a given day, from its polity file. */
export function describeTerritory(
  file: PolityFile,
  sources: SourcesFile['sources'],
  day: number,
  locale: string,
): TerritoryView {
  const nameOf = (id: string) => pickNames(file.related?.[id] ?? [], day, locale)?.primary ?? id;
  const isCurrent = (r: PolityRecord) => r.s0 <= day && day < r.e0;

  const label = (r: PolityRecord): string => {
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
    if (r.relation === 'administers') notes.push(t('panel.administersNote'));
    if (r.recognized_by?.length) notes.push(t('panel.recognizedBy', { list: listOf(r.recognized_by.map(nameOf), locale) }));
    if (r.notes) notes.push(r.notes);
    for (const c of r.sources) if (c.note) notes.push(c.note);
    return { id: r.id, label: label(r), began: describeDate(r.start), ended: describeDate(r.end), notes, sources: sourceLines(r.sources, sources) };
  });

  // Say which kinds of statement we have no source for on this day, so silence isn't read as
  // "there was none". Only when the polity has some territory on this day.
  const territorial = CATEGORIES.flatMap((c) => c.relations);
  const own = file.records.filter((r) => r.subject === file.id && isCurrent(r) && territorial.includes(r.relation));
  const absent = own.length === 0 ? [] : CATEGORIES.filter((c) => !own.some((r) => c.relations.includes(r.relation)));
  const missing = absent.length > 0 ? t('panel.missing', { list: listOf(absent.map((c) => t(c.key)), locale) }) : undefined;

  const history = file.records.map(
    (r): HistoryEntry => ({
      id: r.id,
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
  };
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
    sources: sourceLines(file.location.sources, sources),
  };

  return {
    id: file.id,
    title: file.title,
    date: describeEventDate(file.date),
    summary: file.summary,
    ...(location ? { location } : {}),
    polities: (file.polities ?? []).map((id) => ({ id, name: nameOf(id) })),
    effects,
    sources: sourceLines(file.sources, sources),
  };
}
