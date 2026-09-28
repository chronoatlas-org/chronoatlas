// Tile tests use a made-up square, not real borders.

import { describe, expect, it } from 'vitest';
import { PbfReader } from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import { buildTiles, tileRange } from './tiles.ts';

describe('tileRange', () => {
  it('covers the whole world with one tile at zoom 0', () => {
    expect(tileRange([-180, -85, 180, 85], 0)).toEqual({ x0: 0, x1: 0, y0: 0, y1: 0 });
  });

  it('finds the right tiles for an area (north-east quarter at zoom 1)', () => {
    expect(tileRange([10, 10, 20, 20], 1)).toEqual({ x0: 1, x1: 1, y0: 0, y1: 0 });
  });
});

describe('buildTiles', () => {
  const square: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { id: 'testland', s0: 2415021, color: 3 },
        geometry: {
          type: 'Polygon',
          coordinates: [[[10, 10], [20, 10], [20, 20], [10, 20], [10, 10]]],
        },
      },
    ],
  };

  it('writes one tile per grid square in the bounds, keeping feature properties', () => {
    const tiles = [...buildTiles(square, { layer: 'borders', maxZoom: 2, bounds: [10, 10, 20, 20] })];
    expect(tiles.map((t) => `${t.z}/${t.x}/${t.y}`)).toEqual(['0/0/0', '1/1/0', '2/2/1']);

    const decoded = new VectorTile(new PbfReader(tiles[0].data));
    const layer = decoded.layers.borders;
    expect(layer.length).toBe(1);
    expect(layer.feature(0).properties).toEqual({ id: 'testland', s0: 2415021, color: 3 });
  });

  it('leaves a layer out of the tiles below its minimum zoom, and skips zooms below the set\'s', () => {
    const tiles = [...buildTiles(square, { layer: 'borders', maxZoom: 2, bounds: [10, 10, 20, 20], extraLayers: { land: { collection: square, minZoom: 2 } } })];
    const layers = (z: number) => Object.keys(new VectorTile(new PbfReader(tiles.find((t) => t.z === z)!.data)).layers).sort();
    expect(layers(1)).toEqual(['borders']);
    expect(layers(2)).toEqual(['borders', 'land']);
    const upClose = [...buildTiles(square, { layer: 'borders', minZoom: 2, maxZoom: 2, bounds: [10, 10, 20, 20] })];
    expect(upClose.map((t) => t.z)).toEqual([2]);
  });

  it('writes empty tiles where there is nothing, instead of leaving gaps', () => {
    const tiles = [...buildTiles(square, { layer: 'borders', maxZoom: 3, bounds: [0, 0, 40, 40] })];
    const empty = tiles.filter((t) => new VectorTile(new PbfReader(t.data)).layers.borders?.length !== 1);
    expect(empty.length).toBeGreaterThan(0);
    expect(tiles.every((t) => t.data.length > 0)).toBe(true);
  });
});
