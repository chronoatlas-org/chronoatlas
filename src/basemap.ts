// The physical base map: land, water, and rivers from Natural Earth. It deliberately has no
// borders, roads, cities, or place names. Everything political is drawn from historical data on
// top of it.

import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
// `?url` asks Vite for the file's URL instead of its contents. Vite copies the file into the
// build and adds a content hash to its name, so browsers never use a stale cached copy.
import landUrl from '../data/imports/natural-earth/ne_50m_land.geojson?url';
import lakesUrl from '../data/imports/natural-earth/ne_50m_lakes.geojson?url';
import riversUrl from '../data/imports/natural-earth/ne_50m_rivers_lake_centerlines.geojson?url';

// Muted colors, so the historical layers drawn on top stand out. (The detailed coast drawn up
// close in src/map/historical.ts uses the same ones.)
export const COLORS = {
  water: '#cfdce6',
  land: '#f3f0e8',
  coastline: '#9fb3c2',
  river: '#a9c1d3',
};

// MapLibre loads GeoJSON in a background worker, which needs absolute URLs.
function absolute(url: string): string {
  return new URL(url, window.location.href).href;
}

export function baseMapStyle(): StyleSpecification {
  const attribution = '<a href="https://www.naturalearthdata.com/">Made with Natural Earth</a>';

  return {
    version: 8,
    name: 'chronoatlas base map',
    sources: {
      land: { type: 'geojson', data: absolute(landUrl), attribution },
      lakes: { type: 'geojson', data: absolute(lakesUrl) },
      rivers: { type: 'geojson', data: absolute(riversUrl) },
    },
    layers: [
      { id: 'water', type: 'background', paint: { 'background-color': COLORS.water } },
      { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': COLORS.land } },
      // The coastline under everything historical. Where the detailed 1:10m coast is drawn up
      // close, it covers this one; elsewhere this is the coastline at every zoom.
      {
        id: 'coastline-under',
        type: 'line',
        source: 'land',
        paint: {
          'line-color': COLORS.coastline,
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 6, 1.2],
        },
      },
      {
        id: 'coastline',
        type: 'line',
        source: 'land',
        paint: {
          'line-color': COLORS.coastline,
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 6, 1.2],
        },
      },
      {
        id: 'lakes',
        type: 'fill',
        source: 'lakes',
        paint: { 'fill-color': COLORS.water, 'fill-outline-color': COLORS.coastline },
      },
      {
        id: 'rivers',
        type: 'line',
        source: 'rivers',
        // Natural Earth ranks rivers 1 (largest) to 6. Show more of them as you zoom in:
        // ranks 1–2 when zoomed out, up to 4 from zoom 3, and all of them from zoom 5.
        filter: ['<=', ['get', 'scalerank'], ['step', ['zoom'], 2, 3, 4, 5, 6]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': COLORS.river,
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.3, 6, 1, 10, 2],
        },
      },
    ],
  };
}
