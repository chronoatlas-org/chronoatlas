// Checks the tile reader against tiles written by the build's own tools, and against the reference
// reader (@mapbox/vector-tile, used here in tests only). Made-up shapes (Testland).

import { describe, expect, it } from 'vitest';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { buildTiles } from '../../scripts/lib/tiles.ts';
import { pointInRings, readLayer, tileAt } from './mvt.ts';

// A square with a square hole, and a line, at 10–20°E, 10–20°N.
const collection: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 'testland-1', polity: 'testland', s0: 2415021, e1: 2420000, dep: 1 },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [[10, 10], [20, 10], [20, 20], [10, 20], [10, 10]],
          [[14, 14], [14, 16], [16, 16], [16, 14], [14, 14]],
        ],
      },
    },
  ],
};
const lines: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: { id: 'line-1' }, geometry: { type: 'LineString', coordinates: [[10, 10], [20, 20]] } }],
};
const tile = [...buildTiles(collection, { layer: 'borders', maxZoom: 0, bounds: [10, 10, 20, 20], extraLayers: { lines } })][0];

describe('readLayer', () => {
  it('reads a layer\'s features and properties like the reference reader', () => {
    const layer = readLayer(tile.data, 'borders')!;
    const reference = new VectorTile(new PbfReader(tile.data)).layers.borders;
    expect(layer.extent).toBe(reference.extent);
    expect(layer.features).toHaveLength(reference.length);
    expect(layer.features[0].properties).toEqual(reference.feature(0).properties);
    expect(layer.features[0].type).toBe(3);
    const referenceRings = reference.feature(0).loadGeometry().map((ring) => ring.map((p) => [p.x, p.y]));
    expect(layer.features[0].rings).toEqual(referenceRings);
  });

  it('finds a layer before others, skipping the rest of the tile correctly', () => {
    // Three layers, the one asked for first, so the reader has to skip the other two.
    const three = [...buildTiles(collection, { layer: 'borders', maxZoom: 0, bounds: [10, 10, 20, 20], extraLayers: { lines, land: collection } })][0];
    expect(readLayer(three.data, 'borders')!.features).toHaveLength(1);
    expect(readLayer(three.data, 'lines')!.features).toHaveLength(1);
    expect(readLayer(three.data, 'land')!.features).toHaveLength(1);
  });

  it('reads the other layers in the same tile, and says when one is missing', () => {
    expect(readLayer(tile.data, 'lines')!.features[0].properties).toEqual({ id: 'line-1' });
    expect(readLayer(tile.data, 'nothing')).toBeUndefined();
  });
});

describe('pointInRings and tileAt', () => {
  it('finds a point inside the polygon, and not in its hole or outside it', () => {
    const { rings } = readLayer(tile.data, 'borders')!.features[0];
    const at = (lng: number, lat: number) => {
      const { px, py } = tileAt(lng, lat, 0);
      return pointInRings(px, py, rings);
    };
    expect(at(12, 12)).toBe(true);
    expect(at(15, 15)).toBe(false); // in the hole
    expect(at(25, 12)).toBe(false);
  });

  it('gives the tile and position of a point', () => {
    expect(tileAt(0, 0, 1)).toEqual({ x: 1, y: 1, px: 0, py: 0 });
    const { x, y } = tileAt(15, 15, 7);
    expect([x, y]).toEqual([69, 58]);
  });
});
