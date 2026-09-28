// Reading and writing the part of the URL after "#", which records the view so it can be shared:
//
//   #d=1937-07-01&m=4.5/38.2/118.9&sel=testland&lang=en
//     d     the selected day, as an EDTF date (BCE years are negative: d=-0220-03-15)
//     m     the map view: zoom/latitude/longitude (the same order OpenStreetMap uses)
//     sel   the selected territory, as a polity ID (IDs are permanent, so old links keep working)
//     ev    the selected event, as an event ID (instead of sel: the panel shows one or the other)
//     v     "jure" for the legally recognized borders (CShapes); absent for the default view
//     lang  the interface language, only present if someone chose it explicitly
//
// Everything is optional and checked: a damaged or hand-edited link falls back to defaults for
// whatever it can't read, rather than breaking the page.

import { jdnToCivil, parseEdtfDate } from '../dates/index.ts';

export interface ViewState {
  day?: number;
  zoom?: number;
  lat?: number;
  lng?: number;
  /** The selected polity's ID. */
  sel?: string;
  /** The selected event's ID. */
  ev?: string;
  /** The legally recognized borders instead of the default (administered) ones. */
  view?: 'jure';
  lang?: string;
}

const LANG_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
/** The same rule as IDs in our data files (schemas/common.schema.json). */
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Reads a hash such as "#d=1937-07-01&m=4.5/38.2/118.9". Unreadable parts are left out. */
export function parseHash(hash: string): ViewState {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const state: ViewState = {};

  const d = params.get('d');
  if (d) {
    try {
      state.day = parseEdtfDate(d).earliest; // a month or year link opens on its first day
    } catch {
      // not a valid date: ignore it
    }
  }

  const m = params.get('m')?.split('/').map(Number);
  if (m && m.length === 3 && m.every(Number.isFinite)) {
    const [zoom, lat, lng] = m;
    if (zoom >= 0 && zoom <= 24 && Math.abs(lat) <= 90) {
      state.zoom = zoom;
      state.lat = lat;
      // Wrap out-of-range longitudes into -180…180 (only when needed, to avoid rounding noise).
      state.lng = Math.abs(lng) <= 180 ? lng : Number((((((lng + 180) % 360) + 360) % 360) - 180).toFixed(6));
    }
  }

  // Only the form is checked here. An ID that isn't in our data is dropped once the data loads.
  const isId = (value: string | null): value is string => !!value && value.length <= 100 && ID_PATTERN.test(value);
  const sel = params.get('sel');
  if (isId(sel)) state.sel = sel;
  const ev = params.get('ev');
  if (isId(ev)) state.ev = ev;
  if (params.get('v') === 'jure') state.view = 'jure';

  const lang = params.get('lang');
  if (lang && LANG_PATTERN.test(lang)) state.lang = lang;

  return state;
}

/** Formats a day number as an EDTF date for the URL, e.g. 1937-07-01 or -0220-03-15. */
export function formatDayForUrl(jdn: number): string {
  const { year, month, day } = jdnToCivil(jdn);
  const pad = (n: number, width: number) => String(n).padStart(width, '0');
  const yearText = year < 0 ? `-${pad(-year, 4)}` : pad(year, 4);
  return `${yearText}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** Rounds to a fixed number of decimals and drops trailing zeros ("35.0000" → "35"). */
function short(value: number, decimals: number): string {
  return String(Number(value.toFixed(decimals)));
}

/** Builds the hash for a view. Zoom keeps 2 decimals, coordinates 4 (about 11 m). */
export function formatHash(state: Required<Pick<ViewState, 'day' | 'zoom' | 'lat' | 'lng'>> & Pick<ViewState, 'sel' | 'ev' | 'view' | 'lang'>): string {
  let hash = `#d=${formatDayForUrl(state.day)}&m=${short(state.zoom, 2)}/${short(state.lat, 4)}/${short(state.lng, 4)}`;
  if (state.sel) hash += `&sel=${state.sel}`;
  if (state.ev) hash += `&ev=${state.ev}`;
  if (state.view === 'jure') hash += '&v=jure';
  if (state.lang) hash += `&lang=${state.lang}`;
  return hash;
}
