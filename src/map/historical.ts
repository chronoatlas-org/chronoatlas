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
import { segmentOf } from './changes.ts';
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
  version: string;
  layer: string;
  minzoom: number;
  maxzoom: number;
  bounds: [number, number, number, number];
  /** The sources of the default map's records. */
  sources?: string[];
  changes: number[];
  /** Other layers' tiles: the de jure view, the contested areas, and the detailed coast. */
  extra?: Record<
    string,
    { dir: string; version: string; layer: string; bounds: [number, number, number, number]; minzoom?: number; sources?: string[] }
  >;
}

/** Which borders the map shows: as administered (de facto) or as legally recognized (de jure). */
export type BorderView = 'facto' | 'jure';

export interface HistoricalOptions {
  /**
   * Called when someone clicks a territory, with every polity recorded at that spot (the one
   * drawn on top first) and the spot itself ([longitude, latitude]). Records can overlap, and
   * none should be unreachable.
   */
  onSelect: (polities: string[], spot: [number, number]) => void;
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
export function dataUrl(file: string): string {
  return new URL(`data/${file}`, document.baseURI).href;
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

  /** Shows the borders as administered ('facto') or as legally recognized ('jure'). */
  setView(view: BorderView): void {
    this.view = view;
    if (!this.ready) return;
    const show = (ids: string[], visible: boolean) => {
      for (const id of ids) if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    };
    show(['borders-fill', 'borders-line', 'borders-selected'], view === 'facto');
    show(['dejure-fill', 'dejure-line', 'dejure-line-dependent', 'dejure-selected'], view === 'jure');
  }

  /** Shows or hides the second opinion: Cliopatria's borders as dotted outlines. */
  setSecondOpinion(on: boolean): void {
    this.secondOpinion = on;
    if (this.ready && this.map.getLayer('second-line')) {
      this.map.setLayoutProperty('second-line', 'visibility', on ? 'visible' : 'none');
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
    const layers: { set: SpotSet['set']; dir: string; version: string; layer: string; bounds: number[]; sources?: string[] }[] = [
      { set: 'facto', dir: 'tiles', version: index.version, layer: index.layer, bounds: index.bounds, sources: index.sources },
      ...(index.extra?.dejure ? [{ set: 'jure' as const, ...index.extra.dejure }] : []),
      ...(index.extra?.second ? [{ set: 'second' as const, ...index.extra.second }] : []),
    ];
    const z = index.maxzoom;
    const { x, y, px, py } = tileAt(lng, lat, z);
    return Promise.all(
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

  /** Updates the map, but only when the day has crossed into a different change segment. */
  private showDay(): void {
    if (!this.ready) return;
    const segment = segmentOf(this.changes, this.day);
    if (segment === this.shownSegment) return;
    this.shownSegment = segment;
    this.map.setGlobalStateProperty('day', this.day);
  }

  private addLayers(index: TileIndex): void {
    const map = this.map;
    this.index = index;
    this.changes = index.changes;
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
      tiles: [`${dataUrl(`tiles/${index.version}/`)}{z}/{x}/{y}.pbf`],
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
    map.addLayer({
      id: 'borders-line',
      type: 'line',
      source: 'borders',
      'source-layer': LINES,
      filter: ACTIVE,
      paint: {
        'line-color': '#5b5146',
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.5, 6, 1.2, 10, 2],
      },
    });
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

    // The de jure view (CShapes), hidden until chosen. Colonies, protectorates, and occupied units
    // (`dep`) get a lighter tint of the color of the state CShapes records as holding them, and
    // dashed edges, so the difference isn't color alone.
    const dejure = index.extra?.dejure;
    if (dejure) {
      map.addSource('dejure', {
        type: 'vector',
        tiles: [`${dataUrl(`${dejure.dir}/${dejure.version}/`)}{z}/{x}/{y}.pbf`],
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
        tiles: [`${dataUrl(`${contested.dir}/${contested.version}/`)}{z}/{x}/{y}.pbf`],
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
    // The second opinion (Cliopatria): dotted outlines only, in a color of their own, so they
    // read as another source's lines over whichever view is shown. Hidden until chosen.
    const second = index.extra?.second;
    if (second) {
      map.addSource('second', {
        type: 'vector',
        tiles: [`${dataUrl(`${second.dir}/${second.version}/`)}{z}/{x}/{y}.pbf`],
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

    map.on('click', 'borders-fill', (event) => {
      const polities = [...new Set((event.features ?? []).map((feature) => String(feature.properties.polity)))];
      if (polities.length > 0) this.options.onSelect(polities, [event.lngLat.lng, event.lngLat.lat]);
    });
    map.on('mouseenter', 'borders-fill', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'borders-fill', () => (map.getCanvas().style.cursor = ''));
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
