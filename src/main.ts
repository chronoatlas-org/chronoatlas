// Entry point: reads the view from the URL, sets the language, then creates the map and the
// timeline and keeps the URL in step with them.

import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
// Imported as a namespace (`maplibregl.Map`) so it doesn't hide JavaScript's built-in `Map`.
import * as maplibregl from 'maplibre-gl';
// MapLibre does its heavy data processing in a background "worker" script. By default it looks
// for that file next to its own code, but Vite moves MapLibre's code during bundling, so we have
// Vite bundle the worker into one self-contained file (`?worker&url`) and point MapLibre at it.
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { baseMapStyle } from './basemap';
import { civilToJdn, formatDay } from './dates/index.ts';
import { getLocale, pickLocale, setLocale, t } from './i18n/index.ts';
import type { MessageKey } from './i18n/index.ts';
import { HistoricalLayers } from './map/historical';
import { TerritoryPanel } from './panel/panel';
import { Timeline } from './timeline/timeline';
import { formatHash, parseHash } from './url/state.ts';

// --- The view to open ---------------------------------------------------------------------------

// The timeline ends today. This is the one place we use JavaScript's Date: for the present
// moment, never for a historical date.
const now = new Date();
const TODAY = civilToJdn(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
const FIRST_DAY = civilToJdn(-9999, 1, 1); // 10,000 BCE
const clampDay = (day: number) => Math.min(TODAY, Math.max(FIRST_DAY, day));

// Without a link, open in mid-1937 over East Asia, the showcase period and region. This is only
// where the view starts; it makes no claim about any event or border.
const DEFAULT_VIEW = { day: civilToJdn(1937, 7, 1), zoom: 3, lat: 35, lng: 115 };
const fromUrl = parseHash(location.hash);

// --- Language -----------------------------------------------------------------------------------

// A language chosen in the link wins; otherwise use the browser's preferred languages.
setLocale(pickLocale([...(fromUrl.lang ? [fromUrl.lang] : []), ...(navigator.languages ?? [navigator.language])]));
document.documentElement.lang = getLocale();
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
  el.textContent = t(el.dataset.i18n as MessageKey);
}
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-label]')) {
  const label = t(el.dataset.i18nLabel as MessageKey);
  el.setAttribute('aria-label', label);
  el.title = label;
}

// --- Map ----------------------------------------------------------------------------------------

maplibregl.setWorkerUrl(mapLibreWorkerUrl);

const mapContainer = document.getElementById('map')!;
mapContainer.setAttribute('aria-label', t('app.mapLabel'));

const map = new maplibregl.Map({
  container: mapContainer,
  style: baseMapStyle(),
  center: [fromUrl.lng ?? DEFAULT_VIEW.lng, fromUrl.lat ?? DEFAULT_VIEW.lat],
  zoom: fromUrl.zoom ?? DEFAULT_VIEW.zoom,
  attributionControl: { compact: true },
});

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

// --- Borders and the territory panel ------------------------------------------------------------

const initialDay = clampDay(fromUrl.day ?? DEFAULT_VIEW.day);

// Declared before the timeline, because the timeline reports its first day (which updates the
// panel and schedules a URL update) while it's being created.
let urlTimer: number | undefined;
/** The selected polity's ID, or null. */
let selected: string | null = null;

const panel = new TerritoryPanel(document.getElementById('panel')!, initialDay, {
  bordersOf: (polity) => historical.bordersOf(polity),
  onClose: () => select(null),
});
const historical = new HistoricalLayers(map, initialDay, {
  onSelect: (polity) => select(polity),
  onDataChange: () => panel.refresh(),
});

function select(polity: string | null): void {
  selected = polity;
  historical.setSelected(polity);
  panel.select(polity);
  scheduleUrlUpdate();
}

// --- Timeline -----------------------------------------------------------------------------------

const timeline = new Timeline({
  container: document.getElementById('timeline')!,
  minJdn: FIRST_DAY,
  maxJdn: TODAY,
  initialJdn: initialDay,
  initialSpanDays: 20 * 365.2425,
  onChange: (day) => {
    historical.setDay(day);
    panel.setDay(day);
    scheduleUrlUpdate();
  },
});

// Open the territory from the link, if any. (An ID that isn't in our data closes the panel again.)
if (fromUrl.sel) select(fromUrl.sel);

// --- Shareable URL ------------------------------------------------------------------------------

// The URL is updated a moment after the view stops changing. `replaceState` changes the address
// without adding a Back-button step for every move (and browsers limit how often it may be called).
function writeUrlNow(): void {
  window.clearTimeout(urlTimer);
  const center = map.getCenter();
  const hash = formatHash({
    day: timeline.day,
    zoom: map.getZoom(),
    lat: center.lat,
    lng: center.lng,
    sel: selected ?? undefined,
    lang: fromUrl.lang,
  });
  if (hash !== location.hash) history.replaceState(null, '', hash);
  document.title = t('app.title', { date: formatDay(timeline.day) });
}

function scheduleUrlUpdate(): void {
  window.clearTimeout(urlTimer);
  urlTimer = window.setTimeout(writeUrlNow, 300);
}

map.on('moveend', scheduleUrlUpdate);

// If someone edits the address or goes Back/Forward, follow the link.
window.addEventListener('hashchange', () => {
  const next = parseHash(location.hash);
  if (next.day !== undefined) timeline.setDay(clampDay(next.day));
  if (next.zoom !== undefined && next.lat !== undefined && next.lng !== undefined) {
    map.jumpTo({ center: [next.lng, next.lat], zoom: next.zoom });
  }
  if ((next.sel ?? null) !== selected) select(next.sel ?? null);
});

// "Copy link": on phones, open the system share sheet; elsewhere, copy to the clipboard.
const shareButton = document.getElementById('share-button')!;
const shareStatus = document.getElementById('share-status')!;
shareButton.addEventListener('click', async () => {
  writeUrlNow();
  const url = location.href;
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ title: document.title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    shareStatus.textContent = t('share.copied');
  } catch (error) {
    if ((error as DOMException).name === 'AbortError') return; // the share sheet was closed
    shareStatus.textContent = t('share.failed');
  }
  window.setTimeout(() => (shareStatus.textContent = ''), 4000);
});

// --- Development helpers ------------------------------------------------------------------------

// During development only, expose the map, timeline, and historical layers on `window`
// so they can be inspected from the browser's developer console. Left out of the published site.
declare global {
  interface Window {
    map?: maplibregl.Map;
    timeline?: Timeline;
    historical?: HistoricalLayers;
    panel?: TerritoryPanel;
  }
}
if (import.meta.env.DEV) {
  window.map = map;
  window.timeline = timeline;
  window.historical = historical;
  window.panel = panel;
}
