// How big an event's pulse on the map is: the ring covers the area the location's precision
// allows, so a vague location looks vague. Kept apart from the drawing so it can be tested.

const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
/** Even a precisely known point gets a ring big enough to notice. */
const MIN_RADIUS_PX = 14;
/** A very vague location caps out, so the ring doesn't cover the whole screen. */
const MAX_RADIUS_PX = 400;

/** The ring's radius in pixels for a place known to within `km`, at a latitude and map zoom. */
export function pulseRadiusPx(km: number, latitude: number, zoom: number): number {
  // MapLibre's world is 512 pixels wide at zoom 0.
  const metresPerPixel = (EARTH_CIRCUMFERENCE_M * Math.cos((latitude * Math.PI) / 180)) / (512 * 2 ** zoom);
  return Math.min(MAX_RADIUS_PX, Math.max(MIN_RADIUS_PX, (km * 1000) / metresPerPixel));
}
