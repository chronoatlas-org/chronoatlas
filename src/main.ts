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
import type { BorderView } from './map/historical';
import { TerritoryPanel } from './panel/panel';
import type { Selection } from './panel/panel';
import type { TimelineEvent } from './timeline/events.ts';
import { Timeline } from './timeline/timeline';
import { formatHash, parseHash } from './url/state.ts';
import type { ViewState } from './url/state.ts';

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
// MapLibre opens the compact credits box at first. On phones that covers much of the map, so fold
// it: the (i) button opens the full credits and license notices.
map.once('load', () => {
  if (matchMedia('(max-width: 600px)').matches) {
    map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
  }
});
map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

// --- Borders and the territory panel ------------------------------------------------------------

const initialDay = clampDay(fromUrl.day ?? DEFAULT_VIEW.day);

// Declared before the timeline, because the timeline reports its first day (which updates the
// panel and schedules a URL update) while it's being created.
let urlTimer: number | undefined;
/** What the panel shows: a territory or an event, or nothing (null). */
let selected: Selection | null = null;
/** Which borders the map shows: as administered (default) or as legally recognized. */
let view: BorderView = fromUrl.view === 'jure' ? 'jure' : 'facto';
/** Whether Cliopatria's borders are shown as a second opinion. */
let secondOpinion = fromUrl.alt === 'cliopatria';

const territorySelection = (id: string): Selection => ({ kind: 'polity', id });
const eventSelection = (id: string): Selection => ({ kind: 'event', id });
/** The selection a link describes: an event (`ev`) or a territory (`sel`). */
const selectionFrom = (state: ViewState): Selection | null =>
  state.ev ? eventSelection(state.ev) : state.sel ? territorySelection(state.sel) : null;

const panel = new TerritoryPanel(document.getElementById('panel')!, initialDay, {
  onClose: () => select(null, 'close'),
  onGoToDay: (day) => timeline.setDay(clampDay(day)),
  onSelectPolity: (polity) => select(territorySelection(polity), 'click'),
  onEventShown: (file) => {
    // Outline the records the event started or ended, and pulse where it happened.
    historical.setEffects((file.effects ?? []).map((r) => r.id));
    if (file.location) historical.pulse([...file.location.coordinates, file.location.precision_km]);
  },
  viewLink: () => `${location.origin}${location.pathname}${currentHash()}`,
  onSelectEvent: (id) => select(eventSelection(id), 'click'),
  visibleRange: () => timeline.visibleRange(),
});
let spotClicks = 0;
const historical = new HistoricalLayers(map, initialDay, {
  onSelect: (polities, spot) => {
    panel.setSpot(polities);
    select(territorySelection(polities[0]), 'click');
    // What every source has at that spot, for the panel (only the latest click counts).
    const click = ++spotClicks;
    historical
      .recordsAt(spot)
      .then((sets) => {
        if (click === spotClicks) panel.setSpotSources(sets);
      })
      .catch((error) => console.error('Could not look up the sources at the clicked spot', error));
  },
});

/**
 * Selects a territory or an event, or nothing (null). `how` says where the change came from:
 * - 'click': picked on the map, the timeline, or in the panel. It becomes a Back-button step, and
 *   keyboard focus moves to the panel's heading.
 * - 'close': the close button or Escape (or an ID that isn't in our data). If focus was in the
 *   panel, it returns to the map.
 * - 'link': the address changed (a shared link, or Back/Forward).
 */
function select(next: Selection | null, how: 'click' | 'close' | 'link'): void {
  if (next?.kind === selected?.kind && next?.id === selected?.id) return;
  const focusWasInPanel = panel.hasFocus();
  selected = next;
  historical.setSelected(next?.kind === 'polity' ? next.id : null);
  if (next?.kind !== 'event') historical.setEffects([]); // an event's outlines appear once it loads
  panel.select(next, how === 'click');
  if (how === 'click') writeUrlNow({ push: true });
  else scheduleUrlUpdate();
  if (next === null && focusWasInPanel) map.getCanvas().focus();
  nearbyButton.setAttribute('aria-expanded', String(next?.kind === 'nearby'));
}

// "Around this date" opens (or closes) the list of what changed near the selected day. It isn't
// recorded in the address: it's a view of the date, which the address already has.
const nearbyButton = document.getElementById('nearby-button')!;

// The map key starts folded on phones (and short landscape screens), so the map has room; a tap on
// "Map key" opens it.
const mapKey = document.querySelector<HTMLDetailsElement>('.map-key')!;
if (matchMedia('(max-width: 600px), (max-height: 500px)').matches) mapKey.open = false;

// The view switch: borders as administered (OpenHistoricalMap) or as legally recognized (CShapes).
const viewButtons = [...document.querySelectorAll<HTMLButtonElement>('.view-switch button')];
const jureLegend = document.querySelector<HTMLElement>('.legend-jure')!;
function setView(next: BorderView): void {
  view = next;
  historical.setView(next);
  for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset.view === next));
  jureLegend.hidden = next !== 'jure';
  scheduleUrlUpdate();
}
for (const button of viewButtons) button.addEventListener('click', () => setView(button.dataset.view as BorderView));

// The second opinion: Cliopatria's borders as dotted outlines over either view.
const secondButton = document.getElementById('second-opinion')!;
const secondLegend = document.querySelector<HTMLElement>('.legend-second')!;
function setSecondOpinion(on: boolean): void {
  secondOpinion = on;
  historical.setSecondOpinion(on);
  secondButton.setAttribute('aria-pressed', String(on));
  secondLegend.hidden = !on;
  scheduleUrlUpdate();
}
secondButton.addEventListener('click', () => setSecondOpinion(!secondOpinion));
nearbyButton.addEventListener('click', () =>
  select(selected?.kind === 'nearby' ? null : { kind: 'nearby', id: '' }, 'click'),
);

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
  onEventSelect: (id) => select(eventSelection(id), 'click'),
  onZoom: () => panel.refresh(),
  // A ring on the map where each event the playhead passes happened.
  onEventsPassed: (events) => events.forEach((e) => e.at && historical.pulse(e.at)),
});

// Event markers on the timeline. (Events need citable sources, so there may be none yet.)
fetch(new URL('data/events.json', document.baseURI))
  .then((r) => r.json() as Promise<{ events: TimelineEvent[] }>)
  .then(({ events }) => {
    timeline.setEvents(events);
    panel.setEvents(events);
  })
  .catch((error) => console.error('Could not load events.json', error));

setView(view);
setSecondOpinion(secondOpinion);

// Open the territory or event from the link, if any. (An ID that isn't in our data closes the
// panel again.)
select(selectionFrom(fromUrl), 'link');

// Escape closes the panel, unless it's closing something else first (such as an open drop-down).
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || selected === null || event.defaultPrevented) return;
  if (event.target instanceof HTMLSelectElement) return;
  select(null, 'close');
});

// --- Shareable URL ------------------------------------------------------------------------------

// The URL is updated a moment after the view stops changing. `replaceState` changes the address
// without adding a Back-button step for every move (and browsers limit how often it may be called).
// Selecting a territory is the exception (`push`): it adds a step, so Back closes the panel.
function writeUrlNow({ push = false } = {}): void {
  window.clearTimeout(urlTimer);
  const hash = currentHash();
  if (hash !== location.hash) {
    if (push) history.pushState(null, '', hash);
    else history.replaceState(null, '', hash);
  }
  document.title = t('app.title', { date: formatDay(timeline.day) });
}

/** The hash for the current view: date, map position, selection, and language. */
function currentHash(): string {
  const center = map.getCenter();
  return formatHash({
    day: timeline.day,
    zoom: map.getZoom(),
    lat: center.lat,
    lng: center.lng,
    sel: selected?.kind === 'polity' ? selected.id : undefined,
    ev: selected?.kind === 'event' ? selected.id : undefined,
    view: view === 'jure' ? 'jure' : undefined,
    alt: secondOpinion ? 'cliopatria' : undefined,
    lang: fromUrl.lang,
  });
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
  select(selectionFrom(next), 'link');
  if ((next.view ?? 'facto') !== view) setView(next.view ?? 'facto');
  if ((next.alt === 'cliopatria') !== secondOpinion) setSecondOpinion(next.alt === 'cliopatria');
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
