// vt-pbf ships without TypeScript types; this describes the one function we use.
declare module 'vt-pbf' {
  const vtpbf: {
    /** Encodes geojson-vt tiles (one per named layer) as a Mapbox Vector Tile. */
    fromGeojsonVt(
      layers: Record<string, { features: unknown[] }>,
      options?: { version?: number; extent?: number },
    ): Uint8Array;
  };
  export default vtpbf;
}
