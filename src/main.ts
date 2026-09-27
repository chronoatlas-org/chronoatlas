// Entry point: creates the map. Later steps add the timeline, historical layers, and panels.

import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
// Imported as a namespace (`maplibregl.Map`) so it doesn't hide JavaScript's built-in `Map`.
import * as maplibregl from 'maplibre-gl';
// MapLibre does its heavy data processing in a background "worker" script. By default it looks
// for that file next to its own code, but Vite moves MapLibre's code during bundling, so we have
// Vite bundle the worker into one self-contained file (`?worker&url`) and point MapLibre at it.
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { baseMapStyle } from './basemap';

maplibregl.setWorkerUrl(mapLibreWorkerUrl);

const map = new maplibregl.Map({
  container: 'map',
  style: baseMapStyle(),
  // Start over East Asia, the showcase region.
  center: [115, 35],
  zoom: 3,
  attributionControl: { compact: true },
});

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

// During development only, expose the map as `window.map` so it can be inspected from the
// browser's developer console. This is left out of the published site.
declare global {
  interface Window {
    map?: maplibregl.Map;
  }
}
if (import.meta.env.DEV) window.map = map;
