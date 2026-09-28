// TypeScript shapes of the data files in data/. The JSON Schemas in schemas/ are the
// authoritative rules; these types mirror them for the scripts.

export interface Citation {
  source: string;
  locator: string;
  note?: string;
}

export interface Source {
  id: string;
  kind: 'dataset' | 'book' | 'article' | 'map' | 'document' | 'archive' | 'website';
  title: string;
  authors?: string[];
  publisher?: string;
  year?: string;
  url?: string;
  doi?: string;
  isbn?: string;
  license?: string;
  attribution?: string;
  notes?: string;
}

export interface PolityName {
  text: string;
  lang: string;
  start?: string;
  end?: string;
  sources: Citation[];
}

export interface Polity {
  id: string;
  wikidata?: string;
  type?: string;
  names: PolityName[];
  notes?: string;
}

export type Relation =
  | 'controls'
  | 'administers'
  | 'occupies'
  | 'sovereign'
  | 'claims'
  | 'leased-to'
  | 'protectorate-of'
  | 'puppet-of';

export const TERRITORIAL_RELATIONS: readonly Relation[] = [
  'controls',
  'administers',
  'occupies',
  'sovereign',
  'claims',
];

export interface Assertion {
  id: string;
  relation: Relation;
  subject: string;
  shape?: string;
  object?: string;
  recognized_by?: string[];
  start: string;
  /** The first day it no longer applied, as EDTF; or 'ongoing'; or 'unknown'. */
  end: string;
  sources: Citation[];
  notes?: string;
}

export interface HistoricalEvent {
  id: string;
  wikidata?: string;
  title: string;
  date: string;
  location?: { coordinates: [number, number]; precision_km: number; sources: Citation[] };
  summary: string;
  polities?: string[];
  effects?: string[];
  importance?: number;
  sources: Citation[];
}

export interface Figure {
  id: string;
  polity: string;
  metric: string;
  value?: number;
  low?: number;
  high?: number;
  date: string;
  basis: 'polity-territory' | 'present-day-borders' | 'computed-from-shape';
  basis_detail?: string;
  method?: string;
  sources: Citation[];
  notes?: string;
}

export interface Coverage {
  id: string;
  source: string;
  region: string;
  start: string;
  end: string;
  sources: Citation[];
  notes?: string;
}

export interface ShapeFeature {
  type: 'Feature';
  properties: { id: string; edge_precision: string; [key: string]: unknown };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
}

/** One entry of an import folder's polity-crosswalk.yaml (see schemas/crosswalk.schema.json). */
export interface CrosswalkEntry {
  /** A polity record in the same import folder. */
  unit: string;
  matches: {
    polity: string;
    kind: 'same-state' | 'dependency';
    from?: string;
    until?: string;
    why?: string;
  }[];
}

/** One entry of an import folder's crosswalk-reviewed.yaml (see schemas/crosswalk-reviewed.schema.json). */
export interface CrosswalkScope {
  area: { south: number; west: number; north: number; east: number };
  /** First day reviewed, and the first day no longer reviewed (EDTF). */
  from: string;
  until: string;
  reviewed: string;
  notes?: string;
}

/** Special values allowed in `end` fields instead of a date. */
export const END_KEYWORDS = ['ongoing', 'unknown'] as const;
