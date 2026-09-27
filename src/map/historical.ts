// The historical layers: borders for the selected day, a "no data" hatch on land where we have
// nothing, and a popup describing whatever you click.
//
// The selected day lives in MapLibre's global state (`['global-state', 'day']`), so moving the
// timeline only updates one value; the filters and colors below read it.

import * as maplibregl from 'maplibre-gl';
import type { ExpressionSpecification, FilterSpecification } from '@maplibre/maplibre-gl-style-spec';
import { formatDate, parseEdtfDate } from '../dates/index.ts';
import { getLocale, t } from '../i18n/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import { pickNames } from './names.ts';
import type { AtlasName } from './names.ts';

/** Fill colors, indexed by the `color` the build assigns so that neighbours differ. */
const PALETTE = ['#e9c9a5', '#b9d3a8', '#d7bfe0', '#f2b8a8', '#e6db9a', '#a8d0c8', '#d9b3c2', '#c8c29a'];

interface Atlas {
  polities: Record<string, { wikidata?: string; names: AtlasName[] }>;
  sources: Record<string, { title: string; url?: string; attribution?: string }>;
}

const DAY: ExpressionSpecification = ['global-state', 'day'];
/** A border is shown from its earliest possible start until the day it ended. */
const ACTIVE: FilterSpecification = ['all', ['<=', ['get', 's0'], DAY], ['<', DAY, ['get', 'e0']]];

function dataUrl(file: string): string {
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
  private day: number;
  private ready = false;
  private atlas: Atlas | null = null;

  constructor(map: maplibregl.Map, initialDay: number) {
    this.map = map;
    this.day = initialDay;
    fetch(dataUrl('atlas.json'))
      .then((r) => r.json())
      .then((atlas: Atlas) => (this.atlas = atlas))
      .catch((error) => console.error('Could not load atlas.json', error));
    if (map.loaded()) this.addLayers();
    else map.once('load', () => this.addLayers());
  }

  /** Called by the timeline whenever the selected day changes. */
  setDay(day: number): void {
    this.day = day;
    if (this.ready) this.map.setGlobalStateProperty('day', day);
  }

  private addLayers(): void {
    const map = this.map;
    map.setGlobalStateProperty('day', this.day);
    map.addImage('no-data-hatch', hatchPattern(), { pixelRatio: 2 });

    // Hatch all land; borders drawn on top cover it wherever we have data.
    map.addLayer(
      { id: 'no-data', type: 'fill', source: 'land', paint: { 'fill-pattern': 'no-data-hatch' } },
      'coastline',
    );

    map.addSource('borders', {
      type: 'geojson',
      data: dataUrl('borders.geojson'),
      attribution:
        '<a href="https://www.openhistoricalmap.org/copyright">Borders: OpenHistoricalMap</a>',
    });
    map.addLayer(
      {
        id: 'borders-fill',
        type: 'fill',
        source: 'borders',
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
      filter: ACTIVE,
      paint: {
        'line-color': '#5b5146',
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.5, 6, 1.2, 10, 2],
      },
    });

    map.on('click', 'borders-fill', (event) => this.showPopup(event));
    map.on('mouseenter', 'borders-fill', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'borders-fill', () => (map.getCanvas().style.cursor = ''));
    this.ready = true;
  }

  private showPopup(event: maplibregl.MapLayerMouseEvent): void {
    const feature = event.features?.[0];
    if (!feature) return;
    const p = feature.properties as Record<string, string | number>;
    const content = document.createElement('div');
    content.className = 'border-popup';
    // Everything below is set with textContent, never innerHTML: names come from outside data.
    const add = (tag: string, text: string, className?: string) => {
      const el = document.createElement(tag);
      el.textContent = text;
      if (className) el.className = className;
      content.append(el);
      return el;
    };

    const names = pickNames(this.atlas?.polities[String(p.polity)]?.names ?? [], this.day, getLocale());
    add('h2', names?.primary ?? String(p.polity));
    if (names?.local) add('p', names.local, 'border-popup-local');

    add('p', t(`relation.${p.relation}` as MessageKey), 'border-popup-relation');
    const end = String(p.end);
    const endText = end === 'ongoing' ? t('date.ongoing') : end === 'unknown' ? t('date.unknown') : formatDate(parseEdtfDate(end));
    add('p', t('popup.period', { start: formatDate(parseEdtfDate(String(p.start))), end: endText }));
    if (p.relation === 'administers') add('p', t('popup.administersNote'), 'border-popup-note');

    const source = this.atlas?.sources[String(p.source)];
    const sourceLine = add('p', '', 'border-popup-source');
    const relationId = /relation (\d+)/.exec(String(p.locator))?.[1];
    if (p.source === 'openhistoricalmap' && relationId) {
      sourceLine.append(`${t('popup.sourceLabel')} `);
      const link = document.createElement('a');
      link.href = `https://www.openhistoricalmap.org/relation/${relationId}`;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = `${source?.title ?? String(p.source)}, ${String(p.locator)}`;
      sourceLine.append(link);
    } else {
      sourceLine.textContent = `${t('popup.sourceLabel')} ${source?.title ?? String(p.source)}, ${String(p.locator)}`;
    }

    new maplibregl.Popup({ maxWidth: '320px' }).setLngLat(event.lngLat).setDOMContent(content).addTo(this.map);
  }
}
