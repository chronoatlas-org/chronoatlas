// What the territory panel says, worked out from plain data so it can be tested without a
// browser. The Preact component in panel.tsx only lays this out.
//
// For now (Phase 2, step 1) the panel's facts come from the border tiles the map has loaded, so it
// can only list borders in the part of the map that has been downloaded. Step 2 replaces that
// with one file per polity listing all of its records.

import { formatDate, parseEdtfDate } from '../dates/index.ts';
import type { DatePrecision } from '../dates/index.ts';
import { t } from '../i18n/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import type { BorderRecord } from '../map/historical.ts';
import { pickNames } from '../map/names.ts';
import type { AtlasName } from '../map/names.ts';

/** public/data/atlas.json, written by the build: polity names and source titles. */
export interface Atlas {
  polities: Record<string, { wikidata?: string; names: AtlasName[] }>;
  sources: Record<string, { title: string; url?: string; attribution?: string }>;
}

/** One border record, ready to show. */
export interface BorderEntry {
  /** The assertion's ID. */
  id: string;
  relation: string;
  began: string;
  ended: string;
  /** Explains the lighter shading while the selected day is inside an uncertain start. */
  uncertainStart?: string;
  note?: string;
  source: { text: string; url?: string };
}

export interface TerritoryView {
  polity: string;
  name: string;
  /** The name in its original script, when it differs from `name`. */
  localName?: string;
  /** Borders in effect on the selected day; empty if none is loaded. */
  borders: BorderEntry[];
}

const RELATION_KEYS: Record<string, MessageKey> = {
  controls: 'relation.controls',
  administers: 'relation.administers',
  occupies: 'relation.occupies',
  sovereign: 'relation.sovereign',
  claims: 'relation.claims',
};

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

/** A link to the exact record in the source, where we know how to build one. */
export function sourceLink(source: string, locator: string): string | undefined {
  const relationId = /\brelation (\d+)\b/.exec(locator)?.[1];
  if (source === 'openhistoricalmap' && relationId) return `https://www.openhistoricalmap.org/relation/${relationId}`;
  return undefined;
}

function describeBorder(atlas: Atlas, record: BorderRecord, day: number): BorderEntry {
  const title = atlas.sources[record.source]?.title ?? record.source;
  const url = sourceLink(record.source, record.locator);
  return {
    id: record.id,
    relation: RELATION_KEYS[record.relation] ? t(RELATION_KEYS[record.relation]) : record.relation,
    began: describeDate(record.start),
    ended: describeDate(record.end),
    ...(day < record.s1 ? { uncertainStart: t('panel.uncertainStart', { date: formatDate(parseEdtfDate(record.start)) }) } : {}),
    ...(record.relation === 'administers' ? { note: t('panel.administersNote') } : {}),
    source: { text: `${title}, ${record.locator}`, ...(url ? { url } : {}) },
  };
}

/**
 * Describes a polity on a given day. `records` may contain other polities' borders, borders from
 * other days, and duplicates (a border crossing several tiles arrives once per tile).
 * Returns null if the polity isn't in our data.
 */
export function describeTerritory(
  atlas: Atlas,
  polity: string,
  records: readonly BorderRecord[],
  day: number,
  locale: string,
): TerritoryView | null {
  const entry = atlas.polities[polity];
  if (!entry) return null;

  const active = new Map<string, BorderRecord>();
  for (const r of records) {
    // The same test the map's filter uses (src/map/historical.ts): from s0, until e0.
    if (r.polity === polity && r.s0 <= day && day < r.e0) active.set(r.id, r);
  }
  const borders = [...active.values()]
    .sort((a, b) => a.s0 - b.s0 || a.id.localeCompare(b.id))
    .map((r) => describeBorder(atlas, r, day));

  const names = pickNames(entry.names, day, locale);
  return {
    polity,
    name: names?.primary ?? polity,
    ...(names?.local ? { localName: names.local } : {}),
    borders,
  };
}
