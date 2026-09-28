// Cuts a GeoJSON FeatureCollection into vector tiles: small squares of map, one set per zoom
// level, each simplified to the detail that zoom can show. The browser then downloads only the
// tiles in view instead of the whole dataset.
//
// Tiles use the standard "slippy map" grid (the same as OpenStreetMap and MapLibre): at zoom z
// the world is 2^z × 2^z tiles, and tile (x, y) is stored at {z}/{x}/{y}.pbf in the Mapbox
// Vector Tile format.

import GeoJSONVT from 'geojson-vt';
import vtpbf from 'vt-pbf';

/** West, south, east, north in degrees. */
export type Bounds = [number, number, number, number];

export interface TileOptions {
  /** Name of the layer inside each tile (the map's `source-layer`). */
  layer: string;
  /** Highest zoom with its own tiles; MapLibre enlarges these for closer zooms. */
  maxZoom: number;
  /** Only tiles touching these bounds are written. */
  bounds: Bounds;
  /** More layers in the same tiles, by name (for example the border lines, apart from the fills). */
  extraLayers?: Record<string, GeoJSON.FeatureCollection>;
}

export interface BuiltTile {
  z: number;
  x: number;
  y: number;
  data: Uint8Array;
}

function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}

function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

/** The range of tile columns and rows that touch `bounds` at zoom z. */
export function tileRange(bounds: Bounds, z: number) {
  const max = 2 ** z - 1;
  const clampIndex = (n: number) => Math.min(max, Math.max(0, n));
  const [west, south, east, north] = bounds;
  return {
    x0: clampIndex(lonToTileX(west, z)),
    x1: clampIndex(lonToTileX(east, z)),
    y0: clampIndex(latToTileY(north, z)), // tile rows count downwards from the north
    y1: clampIndex(latToTileY(south, z)),
  };
}

/**
 * Builds every tile from zoom 0 to maxZoom that touches the bounds. Tiles with nothing in them
 * are still written (a few bytes each), so the browser never asks for a file that doesn't exist.
 */
export function* buildTiles(collection: GeoJSON.FeatureCollection, options: TileOptions): Generator<BuiltTile> {
  const indexOf = (c: GeoJSON.FeatureCollection) =>
    new GeoJSONVT(c, {
      maxZoom: options.maxZoom,
      tolerance: 3, // simplification in tile units (a tile is 4096 units across)
      extent: 4096,
      buffer: 64, // overlap between neighbouring tiles, so tile edges never show as lines
    });
  const indexes = [
    [options.layer, indexOf(collection)] as const,
    ...Object.entries(options.extraLayers ?? {}).map(([name, c]) => [name, indexOf(c)] as const),
  ];
  for (let z = 0; z <= options.maxZoom; z++) {
    const { x0, x1, y0, y1 } = tileRange(options.bounds, z);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const layers = Object.fromEntries(indexes.map(([name, index]) => [name, index.getTile(z, x, y) ?? { features: [] }]));
        const data = vtpbf.fromGeojsonVt(layers, { version: 2 });
        yield { z, x, y, data };
      }
    }
  }
}
