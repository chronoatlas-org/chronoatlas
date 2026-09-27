// Entry point: sets the language, then creates the map and the timeline.

import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
// Imported as a namespace (`maplibregl.Map`) so it doesn't hide JavaScript's built-in `Map`.
import * as maplibregl from 'maplibre-gl';
// MapLibre does its heavy data processing in a background "worker" script. By default it looks
// for that file next to its own code, but Vite moves MapLibre's code during bundling, so we have
// Vite bundle the worker into one self-contained file (`?worker&url`) and point MapLibre at it.
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { baseMapStyle } from './basemap';
import { civilToJdn } from './dates/index.ts';
import { getLocale, pickLocale, setLocale, t } from './i18n/index.ts';
import type { MessageKey } from './i18n/index.ts';
import { Timeline } from './timeline/timeline';

// --- Language ---------------------------------------------------------------------------------

setLocale(pickLocale(navigator.languages ?? [navigator.language]));
document.documentElement.lang = getLocale();
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
  el.textContent = t(el.dataset.i18n as MessageKey);
}

// --- Map --------------------------------------------------------------------------------------

maplibregl.setWorkerUrl(mapLibreWorkerUrl);

const mapContainer = document.getElementById('map')!;
mapContainer.setAttribute('aria-label', t('app.mapLabel'));

const map = new maplibregl.Map({
  container: mapContainer,
  style: baseMapStyle(),
  // Start over East Asia, the showcase region.
  center: [115, 35],
  zoom: 3,
  attributionControl: { compact: true },
});

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

// --- Timeline ---------------------------------------------------------------------------------

// The timeline ends today. This is the one place we use JavaScript's Date: for the present
// moment, never for a historical date.
const now = new Date();
const today = civilToJdn(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());

const timeline = new Timeline({
  container: document.getElementById('timeline')!,
  minJdn: civilToJdn(-9999, 1, 1), // 10,000 BCE
  maxJdn: today,
  // Open in mid-1937, inside the East Asia showcase period, with about 20 years in view. This is
  // only where the view starts; it makes no claim about any event or border.
  initialJdn: civilToJdn(1937, 7, 1),
  initialSpanDays: 20 * 365.2425,
  // Phase 1, step 5 adds an `onChange` handler here that filters the historical layers by day.
});

// During development only, expose the map and timeline as `window.map` and `window.timeline`
// so they can be inspected from the browser's developer console. Left out of the published site.
declare global {
  interface Window {
    map?: maplibregl.Map;
    timeline?: Timeline;
  }
}
if (import.meta.env.DEV) {
  window.map = map;
  window.timeline = timeline;
}
