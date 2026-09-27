// The historical layers: borders for the selected day, a "no data" hatch on land where we have
// nothing, and an outline around the selected territory. Clicking a territory selects it; the
// territory panel (src/panel/) shows the details.
//
// Borders come as vector tiles (built by scripts/build-data.ts), so only the tiles in view are
// downloaded. The selected day lives in MapLibre's global state (`['global-state', 'day']`),
// which the filters and colors below read. It is only updated when the day crosses a "change
// day" from the change index, because between change days the map looks identical.

import * as maplibregl from 'maplibre-gl';
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import { segmentOf } from './changes.ts';
import { pulseRadiusPx } from './pulse-size.ts';

/** Fill colors, indexed by the `color` the build assigns so that neighbours differ. */
const PALETTE = ['#e9c9a5', '#b9d3a8', '#d7bfe0', '#f2b8a8', '#e6db9a', '#a8d0c8', '#d9b3c2', '#c8c29a'];

/** public/data/tiles.json, written by the build. */
interface TileIndex {
  version: string;
  layer: string;
  minzoom: number;
  maxzoom: number;
  bounds: [number, number, number, number];
  changes: number[];
}

export interface HistoricalOptions {
  /**
   * Called when someone clicks a territory, with every polity recorded at that spot (the one
   * drawn on top first). Records can overlap, and none should be unreachable.
   */
  onSelect: (polities: string[]) => void;
}

const DAY: ExpressionSpecification = ['global-state', 'day'];
/** A border is shown from its earliest possible start until the day it ended. */
const ACTIVE: ExpressionSpecification = ['all', ['<=', ['get', 's0'], DAY], ['<', DAY, ['get', 'e0']]];

/** The address of a file the build wrote to public/data/. */
export function dataUrl(file: string): string {
  return new URL(`data/${file}`, document.baseURI).href;
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
    this.changes = index.changes;
    map.addImage('no-data-hatch', hatchPattern(), { pixelRatio: 2 });

    // Hatch all land; borders drawn on top cover it wherever we have data.
    map.addLayer(
      { id: 'no-data', type: 'fill', source: 'land', paint: { 'fill-pattern': 'no-data-hatch' } },
      'coastline',
    );

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
          // ['match', color, 0, PALETTE[0], 1, PALETTE[1], ..., fallback]; built in code, so cast.
          'fill-color': ['match', ['get', 'color'], ...PALETTE.flatMap((c, i) => [i, c]), PALETTE[0]] as unknown as ExpressionSpecification,
          // Lighter while the border's start date is still uncertain (e.g. "1932" = sometime in 1932).
          'fill-opacity': ['case', ['<', DAY, ['get', 's1']], 0.55, 1],
        },
      },
      'coastline',
    );
    map.addLayer({
      id: 'borders-line',
      type: 'line',
      source: 'borders',
      'source-layer': index.layer,
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
      'source-layer': index.layer,
      filter: ['all', ACTIVE, ['==', ['get', 'polity'], ['global-state', 'selected']]],
      paint: {
        'line-color': '#1f2328',
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 2, 6, 3, 10, 4.5],
      },
    });

    // A selected event's effects: dashed (not only a different color), whatever the date.
    map.addLayer({
      id: 'borders-effects',
      type: 'line',
      source: 'borders',
      'source-layer': index.layer,
      filter: this.effectsFilter(),
      paint: {
        'line-color': '#0550ae',
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 2, 6, 3, 10, 4],
        'line-dasharray': [2, 1.5],
      },
    });

    map.on('click', 'borders-fill', (event) => {
      const polities = [...new Set((event.features ?? []).map((feature) => String(feature.properties.polity)))];
      if (polities.length > 0) this.options.onSelect(polities);
    });
    map.on('mouseenter', 'borders-fill', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'borders-fill', () => (map.getCanvas().style.cursor = ''));
  }
}
