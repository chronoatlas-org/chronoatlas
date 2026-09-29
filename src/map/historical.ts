// The historical layers: borders for the selected day, a "no data" hatch on land where we have
// nothing, and an outline around the selected territory. Clicking a territory selects it; the
// territory panel (src/panel/) shows the details.
//
// Two views of the borders (setView):
//   'facto' (the default): who ran each area, per OpenHistoricalMap;
//   'jure':  who was legally recognized as sovereign, per CShapes 2.0 (CC BY-NC-SA 4.0).
// In both, a cross-hatch marks contested areas, where the two sources disagree (computed by the
// build; see scripts/lib/contested.ts). A third source, Cliopatria, can be laid over either view
// as dotted outlines: a "second opinion" (setSecondOpinion).
//
// Borders come as vector tiles (built by scripts/build-data.ts), so only the tiles in view are
// downloaded. Each tile holds the fills and, as a layer of their own, the border lines. The selected day lives in MapLibre's global state (`['global-state', 'day']`),
// which the filters and colors below read. It is only updated when the day crosses a "change
// day" from the change index, because between change days the map looks identical.

import * as maplibregl from 'maplibre-gl';
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import { COLORS } from '../basemap.ts';
import type { SpotRecord, SpotSet } from '../panel/model.ts';
import { t } from '../i18n/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import { segmentOf } from './changes.ts';
import { eraOf } from './eras.ts';
import { pointInRings, readLayer, tileAt } from './mvt.ts';
import { pulseRadiusPx } from './pulse-size.ts';

/** Fill colors, indexed by the `color` the build assigns so that neighbours differ. */
const PALETTE = ['#e9c9a5', '#b9d3a8', '#d7bfe0', '#f2b8a8', '#e6db9a', '#a8d0c8', '#d9b3c2', '#c8c29a'];

/** A color halfway to white: dependencies in the de jure view, opaque so no hatch shows through. */
function lighten(hex: string): string {
  const channel = (i: number) => Math.round((parseInt(hex.slice(i, i + 2), 16) + 255) / 2).toString(16).padStart(2, '0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/** ['match', ['get', 'color'], 0, colors[0], 1, colors[1], …, fallback]; built in code, so cast. */
function colorMatch(colors: readonly string[]): ExpressionSpecification {
  return ['match', ['get', 'color'], ...colors.flatMap((c, i) => [i, c]), colors[0]] as unknown as ExpressionSpecification;
}

/** public/data/tiles.json, written by the build. */
interface TileIndex {
  layer: string;
  minzoom: number;
  maxzoom: number;
  bounds: [number, number, number, number];
  /** The sources of the default map's records. */
  sources?: string[];
  /** The kinds of imprecise border line the default map has ('approximate-line', 'frontier-zone'). */
  precision?: string[];
  /**
   * The eras the tiles are split into (Phase 5, decision 10), in order and covering every day, each
   * with its change index: the days on which something starts or ends inside it.
   */
  eras: TileEra[];
  /** The default map's tiles for each era (a fingerprint of their contents), in the eras' order. */
  versions: string[];
  /**
   * Other layers' tiles: the de jure view, the second opinion, the contested areas, and "sources
   * differ", split by era like the default map (`versions`), and the detailed coast, which doesn't
   * change with time (`version`).
   */
  extra?: Record<
    string,
    { dir: string; layer: string; bounds: [number, number, number, number]; versions?: string[]; version?: string; minzoom?: number; sources?: string[] }
  >;
}

/** The tile sets split by era, as MapLibre source IDs, with their folders under public/data/. */
const TIMED_SOURCES = [
  ['borders', 'tiles'],
  ['dejure', 'dejure-tiles'],
  ['second', 'second-tiles'],
  ['baseline', 'baseline-tiles'],
  ['contested', 'contested-tiles'],
  ['differ', 'differ-tiles'],
] as const;

/** Which borders the map shows: as administered (de facto) or as legally recognized (de jure). */
export type BorderView = 'facto' | 'jure';

/** An era in tiles.json: its days, its change index, and its "around this date" file (changes/<nearby>.json). */
export interface TileEra {
  start: number;
  end: number;
  changes: number[];
  nearby?: string;
}

export interface HistoricalOptions {
  /**
   * Called when someone clicks a territory, with every polity recorded at that spot (the one
   * drawn on top first) and the spot itself ([longitude, latitude]). Records can overlap, and
   * none should be unreachable.
   */
  onSelect: (polities: string[], spot: [number, number]) => void;
  /**
   * Called once the borders are on the map, with the kinds of imprecise border line they include,
   * so the legend explains only what the map can show.
   */
  onPrecision?: (kinds: string[]) => void;
  /** Called once the borders are on the map, saying whether the baseline (Cliopatria) is among them. */
  onBaseline?: (present: boolean) => void;
  /** Called once tiles.json has loaded, so what reads the eras (the panel's "around this date") can. */
  onEras?: () => void;
}

const DAY: ExpressionSpecification = ['global-state', 'day'];
/**
 * The layer, in each tile set, with the border lines. The build writes them apart from the fills,
 * without the straight cuts where an import's area ends and without the stretches at sea
 * (scripts/lib/outlines.ts), so the lines are drawn from it rather than by outlining the fills.
 */
const LINES = 'lines';
/**
 * A border is shown from its earliest possible start (s0) until its last possible end: e1 when
 * the end is known only to the month or year, otherwise e0, the day it ended.
 */
const ACTIVE: ExpressionSpecification = [
  'all',
  ['<=', ['get', 's0'], DAY],
  ['<', DAY, ['coalesce', ['get', 'e1'], ['get', 'e0']]],
];
/** While a border may not have started yet (before s1), or may already have ended (from e0). */
const UNCERTAIN: ExpressionSpecification = ['any', ['<', DAY, ['get', 's1']], ['>=', DAY, ['get', 'e0']]];

/** A fill's opacity: lighter while its dates are uncertain. */
const FILL_OPACITY: ExpressionSpecification = ['case', UNCERTAIN, 0.55, 1];
/**
 * From this zoom, fills stop at the coast (the build's COAST_MIN_ZOOM): a border's coastal waters,
 * as the source draws them, are only a faint tint, and its land part is filled over them.
 */
const COAST_ZOOM = 4;
const WATER_TINT = 0.25;
/** Over the tint, an uncertain land part at this opacity looks like FILL_OPACITY's 0.55. */
const LAND_OVER_TINT: ExpressionSpecification = ['case', UNCERTAIN, 0.4, 1];

/** The address of a file the build wrote to public/data/. */
/**
 * A tile set's address template for MapLibre. The {z}/{x}/{y} placeholders are appended after the
 * base is resolved, because URL() would escape them.
 */
function tileUrls(dir: string, version: string): string[] {
  return [`${dataUrl(`${dir}/${version}/`)}{z}/{x}/{y}.pbf`];
}

export function dataUrl(file: string): string {
  return new URL(`data/${file}`, document.baseURI).href;
}

/**
 * Territory names on the map (Phase 3 step 5): the English name, with the local name beneath when
 * it differs. Larger territories are placed first; the rest appear as there's room. Text is drawn
 * with the visitor's own fonts (the style has no glyphs address), so no font is downloaded.
 */
function nameLayer(id: string, source: string, layer: string): maplibregl.SymbolLayerSpecification {
  // A dependency in the de jure view names the unit, and beneath it its status and holder, e.g.
  // "Korea / Colony of Japan". The wording comes from the catalog ("Colony of {holder}"), split
  // around the placeholder so the map can put the holder's name in.
  const status = (key: MessageKey): ExpressionSpecification => {
    const [before, after = ''] = t(key, { holder: '\u0000' }).split('\u0000');
    return ['concat', before, ['get', 'name'], after];
  };
  const dependency: ExpressionSpecification = [
    'match',
    ['get', 'status'],
    'colony',
    status('map.status.colony'),
    'protectorate',
    status('map.status.protectorate'),
    'mandate',
    status('map.status.mandate'),
    'occupied',
    status('map.status.occupied'),
    status('map.status.other'),
  ];
  return {
    id,
    type: 'symbol',
    source,
    'source-layer': layer,
    // Smaller territories' names only as the map zooms in, so they don't crowd out the rest (`a`
    // is the territory's area in thousands of km²).
    filter: ['all', ACTIVE, ['>=', ['get', 'a'], ['step', ['zoom'], 100, 4, 10, 5, 1, 6, 0]]],
    layout: {
      'text-field': [
        'case',
        ['has', 'unit'],
        ['format', ['get', 'unit'], {}, '\n', {}, dependency, { 'font-scale': 0.85 }],
        ['has', 'local'],
        ['format', ['get', 'name'], {}, '\n', {}, ['get', 'local'], { 'font-scale': 0.85 }],
        ['get', 'name'],
      ] as unknown as ExpressionSpecification,
      'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 5, 12, 8, 15],
      'text-max-width': 8,
      'text-padding': 3,
      'symbol-sort-key': ['-', ['get', 'a']],
    },
    paint: {
      'text-color': '#3d352c',
      'text-halo-color': 'rgba(255, 255, 255, 0.85)',
      'text-halo-width': 1.2,
      // Lighter while the record's dates are uncertain, like its fill.
      'text-opacity': ['case', UNCERTAIN, 0.65, 1],
    },
  };
}

/** A cross-hatch for contested areas: a different pattern from "no data", not only a color. */
function crossHatchPattern(): ImageData {
  const size = 12;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = 'rgba(154, 27, 91, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const offset of [-size, 0, size]) {
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + size, size);
    ctx.moveTo(offset, size);
    ctx.lineTo(offset + size, 0);
  }
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

/**
 * Dots in the second opinion's teal, for "sources differ": a pattern of its own (not the
 * contested cross-hatch or the "no data" hatch), so the difference doesn't rest on color alone.
 */
function dotsPattern(): ImageData {
  const size = 10;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(11, 110, 119, 0.8)';
  for (const [x, y] of [[2.5, 2.5], [7.5, 7.5]]) {
    ctx.beginPath();
    ctx.arc(x, y, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  return ctx.getImageData(0, 0, size, size);
}

/** A diagonal-line pattern for land with no data. */
function hatchPattern(): ImageData {
  const size = 16;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = 'rgba(110, 100, 85, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const offset of [-size, 0, size]) {
    ctx.moveTo(offset, size);
    ctx.lineTo(offset + size, 0);
  }
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

export class HistoricalLayers {
  private readonly map: maplibregl.Map;
  private readonly options: HistoricalOptions;
  private day: number;
  private selected = '';
  /** Assertion IDs outlined as a selected event's effects. */
  private effects: string[] = [];
  private ready = false;
  private changes: number[] = [];
  /** The stretch between change days currently shown on the map (see src/map/changes.ts). */
  private shownSegment = -1;
  private view: BorderView = 'facto';
  /** public/data/tiles.json, once loaded. */
  private index: TileIndex | null = null;
  /** The era whose tiles are on the map (an index into `index.eras`). */
  private era = 0;
  /** Tiles fetched for recordsAt, by address (each source's tile at a clicked spot). */
  private readonly spotTiles = new Map<string, Promise<Uint8Array | null>>();
  private hasDejure = false;
  private secondOpinion = false;

  constructor(map: maplibregl.Map, initialDay: number, options: HistoricalOptions) {
    this.map = map;
    this.day = initialDay;
    this.options = options;
    const mapLoaded = map.loaded() ? Promise.resolve() : new Promise((resolve) => map.once('load', resolve));
    Promise.all([fetch(dataUrl('tiles.json')).then((r) => r.json() as Promise<TileIndex>), mapLoaded])
      .then(([index]) => this.addLayers(index))
      .catch((error) => console.error('Could not load the border tiles', error));
  }

  /** Called by the timeline whenever the selected day changes. */
  setDay(day: number): void {
    this.day = day;
    this.showDay();
  }

  /** The eras from tiles.json, or null until it has loaded. */
  eras(): readonly TileEra[] | null {
    return this.index?.eras ?? null;
  }

  /** Shows the borders as administered ('facto') or as legally recognized ('jure'). */
  setView(view: BorderView): void {
    this.view = view;
    if (!this.ready) return;
    const show = (ids: string[], visible: boolean) => {
      for (const id of ids) if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    };
    show(
      [
        'borders-under',
        'borders-under-inland',
        'borders-land-under',
        'borders-fill',
        'borders-land',
        'borders-line',
        'borders-line-approximate',
        'borders-zone',
        'borders-selected',
        'borders-labels',
        'baseline-under',
        'baseline-fill',
        'baseline-sea',
        'baseline-line',
        'baseline-selected',
        'baseline-labels',
      ],
      view === 'facto',
    );
    show(['dejure-fill', 'dejure-line', 'dejure-line-dependent', 'dejure-selected', 'dejure-labels'], view === 'jure');
    this.showDiffer();
  }

  /**
   * Shows or hides the second opinion: Cliopatria's borders as dotted outlines. Over the default
   * view it's also the comparison of sources: where the two name different holders is marked
   * "Sources differ" (both record control, so that's like with like; against the legal borders
   * the difference is what "contested" already shows).
   */
  setSecondOpinion(on: boolean): void {
    this.secondOpinion = on;
    if (!this.ready) return;
    if (this.map.getLayer('second-line')) this.map.setLayoutProperty('second-line', 'visibility', on ? 'visible' : 'none');
    this.showDiffer();
  }

  /** Whether "sources differ" is on the map: the second opinion over the default view. */
  get comparing(): boolean {
    return this.secondOpinion && this.view === 'facto';
  }

  private showDiffer(): void {
    for (const id of ['differ-dots', 'differ-line', 'differ-labels']) {
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', this.comparing ? 'visible' : 'none');
    }
  }

  /** Outlines the selected polity's borders, or removes the outline (null). */
  setSelected(polity: string | null): void {
    this.selected = polity ?? '';
    if (this.ready) this.map.setGlobalStateProperty('selected', this.selected);
  }

  /**
   * Outlines the borders of these assertions (a selected event's effects) with a dashed line,
   * whatever the date: an event ends some records and starts others, so both are shown. [] clears.
   */
  setEffects(ids: string[]): void {
    this.effects = ids;
    if (this.ready) this.map.setFilter('borders-effects', this.effectsFilter());
  }

  private effectsFilter(): ExpressionSpecification {
    return ['in', ['get', 'id'], ['literal', this.effects]];
  }

  /**
   * A brief ring where an event happened, sized by how precisely the place is known
   * ([longitude, latitude, precision in km]). With reduced motion on, the ring appears still.
   */
  pulse([lng, lat, km]: [number, number, number]): void {
    const radius = pulseRadiusPx(km, lat, this.map.getZoom());
    const element = document.createElement('div');
    element.className = 'event-pulse';
    element.style.width = element.style.height = `${Math.round(radius * 2)}px`;
    element.setAttribute('aria-hidden', 'true');
    // MapLibre positions the element with a transform, so the animation runs on an inner ring.
    element.append(document.createElement('span'));
    const marker = new maplibregl.Marker({ element }).setLngLat([lng, lat]).addTo(this.map);
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => marker.remove(), still ? 3000 : 1600);
  }

  /**
   * Every territorial record at a spot ([longitude, latitude]) in each source's layer: the default
   * map, the de jure view, and the second opinion, whether or not they're shown. Read from each
   * layer's most detailed tile there (one small download per layer, kept for later clicks).
   */
  async recordsAt([lng, lat]: [number, number]): Promise<SpotSet[]> {
    const index = this.index;
    if (!index) return [];
    const era = this.era;
    const layers: { set: SpotSet['set']; dir: string; version: string; layer: string; bounds: number[]; sources?: string[] }[] = [
      { set: 'facto', dir: 'tiles', version: index.versions[era], layer: index.layer, bounds: index.bounds, sources: index.sources },
      ...(index.extra?.dejure?.versions ? [{ set: 'jure' as const, ...index.extra.dejure, version: index.extra.dejure.versions[era] }] : []),
      ...(index.extra?.second?.versions ? [{ set: 'second' as const, ...index.extra.second, version: index.extra.second.versions[era] }] : []),
      // Cliopatria outside the default map's area: the same source as the second opinion.
      ...(index.extra?.baseline?.versions ? [{ set: 'second' as const, ...index.extra.baseline, version: index.extra.baseline.versions[era] }] : []),
    ];
    const z = index.maxzoom;
    const { x, y, px, py } = tileAt(lng, lat, z);
    const found = await Promise.all(
      layers.map(async ({ set, dir, version, layer, bounds, sources }) => {
        const [w, s, e, n] = bounds;
        const inside = lng >= w && lng <= e && lat >= s && lat <= n;
        const bytes = inside ? await this.spotTile(dataUrl(`${dir}/${version}/${z}/${x}/${y}.pbf`)) : null;
        const features = (bytes && readLayer(bytes, layer)?.features) ?? [];
        const records = features
          .filter((f) => f.type === 3 && pointInRings(px, py, f.rings))
          .map(({ properties: p }): SpotRecord => ({
            id: String(p.id),
            polity: String(p.polity),
            relation: String(p.relation),
            s0: Number(p.s0),
            s1: Number(p.s1),
            e0: Number(p.e0),
            ...(p.e1 !== undefined ? { e1: Number(p.e1) } : {}),
          }));
        return { set, sources: sources ?? [], records };
      }),
    );
    // One entry per source: the second opinion and the baseline are both Cliopatria.
    const bySet = new Map<SpotSet['set'], SpotSet>();
    for (const entry of found) {
      const known = bySet.get(entry.set);
      if (!known) bySet.set(entry.set, entry);
      else bySet.set(entry.set, { set: entry.set, sources: [...new Set([...known.sources, ...entry.sources])], records: [...known.records, ...entry.records] });
    }
    return [...bySet.values()];
  }

  private spotTile(url: string): Promise<Uint8Array | null> {
    let tile = this.spotTiles.get(url);
    if (!tile) {
      tile = fetch(url)
        .then(async (response) => (response.ok ? new Uint8Array(await response.arrayBuffer()) : null))
        .catch(() => null);
      this.spotTiles.set(url, tile);
    }
    return tile;
  }

  /**
   * Updates the map, but only when the day has crossed into a different change segment. Crossing
   * into another era first swaps every time-bearing layer's tiles for that era's.
   */
  private showDay(): void {
    if (!this.ready || !this.index) return;
    const era = eraOf(this.index.eras, this.day);
    if (era !== this.era) this.showEra(era);
    const segment = segmentOf(this.changes, this.day);
    if (segment === this.shownSegment) return;
    this.shownSegment = segment;
    this.map.setGlobalStateProperty('day', this.day);
  }

  /** Points each time-bearing layer at an era's tiles. The layers and their styles stay as they are. */
  private showEra(era: number): void {
    const index = this.index!;
    this.era = era;
    this.changes = index.eras[era].changes;
    this.shownSegment = -1;
    for (const [id, dir] of TIMED_SOURCES) {
      const versions = id === 'borders' ? index.versions : index.extra?.[id]?.versions;
      const source = this.map.getSource<maplibregl.VectorTileSource>(id);
      if (source && versions) source.setTiles(tileUrls(dir, versions[era]));
    }
  }

  private addLayers(index: TileIndex): void {
    const map = this.map;
    this.index = index;
    this.options.onEras?.();
    this.era = eraOf(index.eras, this.day);
    this.changes = index.eras[this.era].changes;
    map.addImage('no-data-hatch', hatchPattern(), { pixelRatio: 2 });

    // Hatch all land; borders drawn on top cover it wherever we have data.
    map.addLayer(
      { id: 'no-data', type: 'fill', source: 'land', paint: { 'fill-pattern': 'no-data-hatch' } },
      'coastline',
    );

    // Up close, inside the imported area: Natural Earth's detailed (1:10m) land, sea, and "no data"
    // hatch over the coarser base map, so the coast matches where the fills are cut; and the
    // detailed coastline instead of the coarse one.
    const coast = index.extra?.coast;
    if (coast) {
      map.addSource('coast', {
        type: 'vector',
        tiles: [`${dataUrl(`${coast.dir}/${coast.version}/`)}{z}/{x}/{y}.pbf`],
        minzoom: coast.minzoom ?? COAST_ZOOM,
        maxzoom: index.maxzoom,
        bounds: coast.bounds,
      });
      const kind = (k: string): ExpressionSpecification => ['==', ['get', 'kind'], k];
      const detail = { source: 'coast', 'source-layer': coast.layer, minzoom: COAST_ZOOM } as const;
      map.addLayer({ id: 'coast-sea', type: 'fill', ...detail, filter: kind('sea'), paint: { 'fill-color': COLORS.water } }, 'coastline');
      map.addLayer({ id: 'coast-land', type: 'fill', ...detail, filter: kind('land'), paint: { 'fill-color': COLORS.land } }, 'coastline');
      map.addLayer({ id: 'no-data-detail', type: 'fill', ...detail, filter: kind('land'), paint: { 'fill-pattern': 'no-data-hatch' } }, 'coastline');
      map.addLayer(
        {
          id: 'coastline-detail',
          type: 'line',
          ...detail,
          filter: kind('coast'),
          paint: { 'line-color': COLORS.coastline, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1, 8, 1.4] },
        },
        'lakes',
      );
      map.setLayerZoomRange('coastline', 0, COAST_ZOOM);
    }

    // The tile URL template is appended after resolving the base, because URL() would escape
    // the {z}/{x}/{y} placeholders MapLibre needs.
    map.addSource('borders', {
      type: 'vector',
      tiles: tileUrls('tiles', index.versions[this.era]),
      minzoom: index.minzoom,
      maxzoom: index.maxzoom,
      bounds: index.bounds,
      attribution:
        '<a href="https://www.openhistoricalmap.org/copyright">Borders: OpenHistoricalMap</a>',
    });
    this.ready = true;
    // Set the global state before adding the layers that read it.
    this.showDay();
    this.setSelected(this.selected || null);
    map.addLayer(
      {
        id: 'borders-fill',
        type: 'fill',
        source: 'borders',
        'source-layer': index.layer,
        filter: ACTIVE,
        paint: {
          'fill-color': colorMatch(PALETTE),
          // Lighter while the border's start or end is uncertain (e.g. "1932" = some time in 1932).
          // Up close, a border with a land part (`coast`) is only a faint tint: its coastal waters.
          'fill-opacity': [
            'step',
            ['zoom'],
            FILL_OPACITY,
            COAST_ZOOM,
            ['case', ['==', ['get', 'coast'], 1], WATER_TINT, FILL_OPACITY],
          ] as unknown as ExpressionSpecification,
        },
      },
      'coastline',
    );
    // Under a lighter (uncertain) fill, plain land, so it reads as a paler color rather than letting
    // the "no data" hatch show through: there is data there, only its dates are uncertain. Up close,
    // a border that takes in coastal waters gets it under its land part only.
    const uncertain: ExpressionSpecification = ['all', ACTIVE, UNCERTAIN];
    const under = { type: 'fill', source: 'borders', paint: { 'fill-color': COLORS.land } } as const;
    map.addLayer({ ...under, id: 'borders-under', 'source-layer': index.layer, maxzoom: COAST_ZOOM, filter: uncertain }, 'borders-fill');
    map.addLayer({ ...under, id: 'borders-under-inland', 'source-layer': index.layer, minzoom: COAST_ZOOM, filter: ['all', uncertain, ['!=', ['get', 'coast'], 1]] }, 'borders-fill');
    map.addLayer({ ...under, id: 'borders-land-under', 'source-layer': 'land', minzoom: COAST_ZOOM, filter: uncertain }, 'borders-fill');
    // Up close, the land part of each border that takes in coastal waters, filled over the tint.
    map.addLayer(
      {
        id: 'borders-land',
        type: 'fill',
        source: 'borders',
        'source-layer': 'land',
        minzoom: COAST_ZOOM,
        filter: ACTIVE,
        paint: { 'fill-color': colorMatch(PALETTE), 'fill-opacity': LAND_OVER_TINT },
      },
      'coastline',
    );
    // Border lines, by how precise their source says they are (`ep`, Phase 3 decision 3): a plain
    // line for a treaty line or unknown precision, a softened line for an approximate one, and a
    // wide soft band for a frontier zone. Sharpness, not dots or dashes, which mean other things.
    const lineWidth: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 2, 0.5, 6, 1.2, 10, 2];
    map.addLayer({
      id: 'borders-line',
      type: 'line',
      source: 'borders',
      'source-layer': LINES,
      filter: ['all', ACTIVE, ['!', ['has', 'ep']]],
      paint: { 'line-color': '#5b5146', 'line-width': lineWidth },
    });
    map.addLayer({
      id: 'borders-line-approximate',
      type: 'line',
      source: 'borders',
      'source-layer': LINES,
      filter: ['all', ACTIVE, ['==', ['get', 'ep'], 1]],
      paint: {
        'line-color': '#5b5146',
        // Wider than a plain line and blurred nearly across its width: no crisp edge anywhere, but
        // still a line, well short of a frontier zone's band.
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 3, 6, 6, 10, 8],
        'line-blur': ['interpolate', ['linear'], ['zoom'], 2, 2.5, 6, 5, 10, 7],
      },
    });
    map.addLayer({
      id: 'borders-zone',
      type: 'line',
      source: 'borders',
      'source-layer': LINES,
      filter: ['all', ACTIVE, ['==', ['get', 'ep'], 2]],
      paint: {
        'line-color': '#5b5146',
        'line-opacity': 0.35,
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 10, 6, 22, 10, 36],
        'line-blur': ['interpolate', ['linear'], ['zoom'], 2, 8, 6, 18, 10, 30],
      },
    });
    this.options.onPrecision?.(index.precision ?? []);
    // The selected territory: a thick dark outline (a change of width, not only of color).
    map.addLayer({
      id: 'borders-selected',
      type: 'line',
      source: 'borders',
      'source-layer': LINES,
      filter: ['all', ACTIVE, ['==', ['get', 'polity'], ['global-state', 'selected']]],
      paint: {
        'line-color': '#1f2328',
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 2, 6, 3, 10, 4.5],
      },
    });

    // The baseline (Phase 5, decision 2): Cliopatria's borders wherever the default map has no
    // import, filled like it, under it, with softer lines (its borders are yearly and approximate).
    // Up close, the detailed sea is drawn over it, so its fills stop at the coast (decision 11).
    const baseline = index.extra?.baseline;
    if (baseline?.versions) {
      map.addSource('baseline', {
        type: 'vector',
        tiles: tileUrls(baseline.dir, baseline.versions[this.era]),
        minzoom: index.minzoom,
        maxzoom: index.maxzoom,
        bounds: baseline.bounds,
        attribution:
          '<a href="https://github.com/Seshat-Global-History-Databank/cliopatria">Borders elsewhere: Cliopatria (CC BY 4.0)</a>',
      });
      map.addLayer(
        { id: 'baseline-fill', type: 'fill', source: 'baseline', 'source-layer': baseline.layer, filter: ACTIVE, paint: { 'fill-color': colorMatch(PALETTE), 'fill-opacity': FILL_OPACITY } },
        'borders-fill',
      );
      // Plain land under its lighter fills too, as for the default map (the sea covers it up close).
      map.addLayer(
        { id: 'baseline-under', type: 'fill', source: 'baseline', 'source-layer': baseline.layer, filter: ['all', ACTIVE, UNCERTAIN], paint: { 'fill-color': COLORS.land } },
        'baseline-fill',
      );
      const coastLayer = index.extra?.coast?.layer;
      if (coastLayer && map.getSource('coast')) {
        map.addLayer(
          { id: 'baseline-sea', type: 'fill', source: 'coast', 'source-layer': coastLayer, minzoom: COAST_ZOOM, filter: ['==', ['get', 'kind'], 'sea'], paint: { 'fill-color': COLORS.water } },
          'borders-fill',
        );
      }
      map.addLayer(
        { id: 'baseline-line', type: 'line', source: 'baseline', 'source-layer': LINES, filter: ACTIVE, paint: { 'line-color': '#5b5146', 'line-opacity': 0.6, 'line-width': lineWidth } },
        'borders-line',
      );
      map.addLayer({
        id: 'baseline-selected',
        type: 'line',
        source: 'baseline',
        'source-layer': LINES,
        filter: ['all', ACTIVE, ['==', ['get', 'polity'], ['global-state', 'selected']]],
        paint: { 'line-color': '#1f2328', 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 2, 6, 3, 10, 4.5] },
      });
      map.addLayer(nameLayer('baseline-labels', 'baseline', 'labels'));
    }
    this.options.onBaseline?.(!!baseline?.versions);

    // The de jure view (CShapes), hidden until chosen. Colonies, protectorates, and occupied units
    // (`dep`) get a lighter tint of the color of the state CShapes records as holding them, and
    // dashed edges, so the difference isn't color alone.
    const dejure = index.extra?.dejure;
    if (dejure) {
      map.addSource('dejure', {
        type: 'vector',
        tiles: tileUrls(dejure.dir, dejure.versions?.[this.era] ?? ''),
        minzoom: index.minzoom,
        maxzoom: index.maxzoom,
        bounds: dejure.bounds,
        attribution: '<a href="https://icr.ethz.ch/data/cshapes/">Legal borders: CShapes 2.0 (CC BY-NC-SA 4.0)</a>',
      });
      map.addLayer(
        {
          id: 'dejure-fill',
          type: 'fill',
          source: 'dejure',
          'source-layer': dejure.layer,
          filter: ACTIVE,
          layout: { visibility: 'none' },
          paint: {
            'fill-color': ['case', ['==', ['get', 'dep'], 1], colorMatch(PALETTE.map(lighten)), colorMatch(PALETTE)],
          },
        },
        'coastline',
      );
      const dejureLine = (id: string, dependent: boolean) =>
        map.addLayer({
          id,
          type: 'line',
          source: 'dejure',
          'source-layer': LINES,
          filter: ['all', ACTIVE, dependent ? ['==', ['get', 'dep'], 1] : ['!=', ['get', 'dep'], 1]],
          layout: { visibility: 'none' },
          paint: {
            'line-color': '#3b3f5c',
            'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.6, 6, 1.3, 10, 2],
            ...(dependent ? { 'line-dasharray': [3, 2] } : {}),
          },
        });
      dejureLine('dejure-line', false);
      dejureLine('dejure-line-dependent', true);
      map.addLayer({
        id: 'dejure-selected',
        type: 'line',
        source: 'dejure',
        'source-layer': LINES,
        filter: ['all', ACTIVE, ['==', ['get', 'polity'], ['global-state', 'selected']]],
        layout: { visibility: 'none' },
        paint: { 'line-color': '#1f2328', 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 2, 6, 3, 10, 4.5] },
      });
      this.hasDejure = true;
    }

    // Contested areas, in both views: a cross-hatch and a dashed edge (patterns, not only color).
    const contested = index.extra?.contested;
    if (contested) {
      map.addImage('contested-hatch', crossHatchPattern(), { pixelRatio: 2 });
      map.addSource('contested', {
        type: 'vector',
        tiles: tileUrls(contested.dir, contested.versions?.[this.era] ?? ''),
        minzoom: index.minzoom,
        maxzoom: index.maxzoom,
        bounds: contested.bounds,
        attribution:
          'Contested areas: computed from OpenHistoricalMap and <a href="https://icr.ethz.ch/data/cshapes/">CShapes 2.0 (CC BY-NC-SA 4.0)</a>',
      });
      map.addLayer(
        {
          id: 'contested-hatch',
          type: 'fill',
          source: 'contested',
          'source-layer': contested.layer,
          filter: ACTIVE,
          // Fainter where it's only possibly contested: a date involved is known only to the
          // month or year (`maybe`), as uncertain borders are drawn lighter.
          paint: { 'fill-pattern': 'contested-hatch', 'fill-opacity': ['case', ['==', ['get', 'maybe'], 1], 0.45, 1] },
        },
        'coastline',
      );
      map.addLayer({
        id: 'contested-line',
        type: 'line',
        source: 'contested',
        'source-layer': contested.layer,
        filter: ACTIVE,
        paint: {
          'line-color': '#9a1b5b',
          'line-width': 1.5,
          'line-dasharray': [3, 2],
          'line-opacity': ['case', ['==', ['get', 'maybe'], 1], 0.45, 1],
        },
      });
    }
    // Where the default map and the second opinion name different holders ("sources differ"):
    // teal dots with a thin teal edge, shown with the second opinion over the default view.
    const differ = index.extra?.differ;
    if (differ) {
      map.addImage('differ-dots', dotsPattern(), { pixelRatio: 2 });
      map.addSource('differ', {
        type: 'vector',
        tiles: tileUrls(differ.dir, differ.versions?.[this.era] ?? ''),
        minzoom: index.minzoom,
        maxzoom: index.maxzoom,
        bounds: differ.bounds,
        attribution:
          'Sources differ: computed from OpenHistoricalMap and <a href="https://github.com/Seshat-Global-History-Databank/cliopatria">Cliopatria (CC BY 4.0)</a>',
      });
      const maybeFaint: ExpressionSpecification = ['case', ['==', ['get', 'maybe'], 1], 0.45, 1];
      map.addLayer(
        {
          id: 'differ-dots',
          type: 'fill',
          source: 'differ',
          'source-layer': differ.layer,
          filter: ACTIVE,
          layout: { visibility: 'none' },
          paint: { 'fill-pattern': 'differ-dots', 'fill-opacity': maybeFaint },
        },
        'coastline',
      );
      map.addLayer({
        id: 'differ-line',
        type: 'line',
        source: 'differ',
        'source-layer': differ.layer,
        filter: ACTIVE,
        layout: { visibility: 'none' },
        paint: { 'line-color': '#0b6e77', 'line-width': 1, 'line-opacity': maybeFaint },
      });
    }
    // The second opinion (Cliopatria): dotted outlines only, in a color of their own, so they
    // read as another source's lines over whichever view is shown. Hidden until chosen.
    const second = index.extra?.second;
    if (second) {
      map.addSource('second', {
        type: 'vector',
        tiles: tileUrls(second.dir, second.versions?.[this.era] ?? ''),
        minzoom: index.minzoom,
        maxzoom: index.maxzoom,
        bounds: second.bounds,
        attribution:
          '<a href="https://github.com/Seshat-Global-History-Databank/cliopatria">Second opinion: Cliopatria (CC BY 4.0)</a>',
      });
      map.addLayer({
        id: 'second-line',
        type: 'line',
        source: 'second',
        'source-layer': LINES,
        filter: ACTIVE,
        layout: { visibility: 'none', 'line-cap': 'round' },
        paint: {
          'line-color': '#0b6e77',
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1.2, 6, 2, 10, 3],
          'line-dasharray': [0.1, 2.2],
        },
      });
    }
    this.setView(this.view);
    this.setSecondOpinion(this.secondOpinion);

    // Where the imported data ends: a dashed gray line over land, while the imports' years
    // apply, so borders cut at the edge don't read as real borders (public/data/edges.json).
    map.addSource('edges', { type: 'geojson', data: dataUrl('edges.json') });
    map.addLayer({
      id: 'data-edge',
      type: 'line',
      source: 'edges',
      filter: ['all', ['<=', ['get', 's0'], DAY], ['<', DAY, ['get', 'e0']]],
      layout: { 'line-cap': 'butt' },
      paint: {
        'line-color': '#6e6455',
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1, 6, 1.6],
        'line-dasharray': [5, 3],
      },
    });

    // A selected event's effects: dashed (not only a different color), whatever the date.
    map.addLayer({
      id: 'borders-effects',
      type: 'line',
      source: 'borders',
      'source-layer': LINES,
      filter: this.effectsFilter(),
      paint: {
        'line-color': '#0550ae',
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 2, 6, 3, 10, 4],
        'line-dasharray': [2, 1.5],
      },
    });

    // Words on the map, over everything else: "Contested" on contested areas, the edge of the
    // imported data along its line, "Frontier zone" along zone bands, then territory names.
    map.addLayer({
      id: 'data-edge-label',
      type: 'symbol',
      source: 'edges',
      filter: ['all', ['<=', ['get', 's0'], DAY], ['<', DAY, ['get', 'e0']]],
      layout: { 'symbol-placement': 'line', 'symbol-spacing': 500, 'text-field': t('map.edge'), 'text-size': 10, 'text-offset': [0, -0.8] },
      paint: { 'text-color': '#6e6455', 'text-halo-color': 'rgba(255, 255, 255, 0.85)', 'text-halo-width': 1 },
    });
    map.addLayer({
      id: 'zone-label',
      type: 'symbol',
      source: 'borders',
      'source-layer': LINES,
      filter: ['all', ACTIVE, ['==', ['get', 'ep'], 2]],
      layout: { 'symbol-placement': 'line', 'symbol-spacing': 400, 'text-field': t('map.zone'), 'text-size': 10 },
      paint: { 'text-color': '#5b5146', 'text-halo-color': 'rgba(255, 255, 255, 0.85)', 'text-halo-width': 1 },
    });
    map.addLayer(nameLayer('borders-labels', 'borders', 'labels'));
    if (differ) {
      map.addLayer({
        id: 'differ-labels',
        type: 'symbol',
        source: 'differ',
        'source-layer': 'labels',
        filter: ACTIVE,
        layout: {
          visibility: 'none',
          'text-field': ['case', ['==', ['get', 'maybe'], 1], t('map.maybeDiffer'), t('map.differ')],
          'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 6, 12],
          'text-anchor': 'bottom',
          'text-offset': [0, -2.1],
          'text-padding': 1,
          'symbol-sort-key': ['-', ['get', 'a']],
        },
        paint: { 'text-color': '#0b6e77', 'text-halo-color': 'rgba(255, 255, 255, 0.9)', 'text-halo-width': 1.4 },
      });
    }
    if (this.hasDejure && dejure) {
      const dejureNames = nameLayer('dejure-labels', 'dejure', 'labels');
      map.addLayer({ ...dejureNames, layout: { ...dejureNames.layout, visibility: 'none' } }); // shown by setView
    }
    // Contested areas' labels go on top, so they're placed before names and never crowded out.
    if (contested) {
      map.addLayer({
        id: 'contested-labels',
        type: 'symbol',
        source: 'contested',
        'source-layer': 'labels',
        filter: ACTIVE,
        layout: {
          'text-field': ['case', ['==', ['get', 'maybe'], 1], t('map.maybeContested'), t('map.contested')],
          'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 6, 12],
          // Hanging just below a two-line name at the same spot, so both fit.
          'text-anchor': 'top',
          'text-offset': [0, 2.1],
          'text-padding': 1,
          'symbol-sort-key': ['-', ['get', 'a']],
        },
        paint: { 'text-color': '#9a1b5b', 'text-halo-color': 'rgba(255, 255, 255, 0.9)', 'text-halo-width': 1.4 },
      });
    }
    this.setView(this.view);

    map.on('click', 'borders-fill', (event) => {
      const polities = [...new Set((event.features ?? []).map((feature) => String(feature.properties.polity)))];
      if (polities.length > 0) this.options.onSelect(polities, [event.lngLat.lng, event.lngLat.lat]);
    });
    map.on('mouseenter', 'borders-fill', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'borders-fill', () => (map.getCanvas().style.cursor = ''));
    if (map.getLayer('baseline-fill')) {
      map.on('click', 'baseline-fill', (event) => {
        const polities = [...new Set((event.features ?? []).map((feature) => String(feature.properties.polity)))];
        if (polities.length > 0) this.options.onSelect(polities, [event.lngLat.lng, event.lngLat.lat]);
      });
      map.on('mouseenter', 'baseline-fill', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'baseline-fill', () => (map.getCanvas().style.cursor = ''));
    }
    if (this.hasDejure) {
      map.on('click', 'dejure-fill', (event) => {
        const holders = [...new Set((event.features ?? []).map((feature) => String(feature.properties.polity)))];
        if (holders.length > 0) this.options.onSelect(holders, [event.lngLat.lng, event.lngLat.lat]);
      });
      map.on('mouseenter', 'dejure-fill', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'dejure-fill', () => (map.getCanvas().style.cursor = ''));
    }
  }
}
