// A small reader for our vector tiles (the Mapbox Vector Tile format, a Protocol Buffers file), and
// a point-in-polygon test. The panel uses it to ask every source's tiles what's at a clicked spot,
// including sources whose layers aren't on the map at the moment (MapLibre only loads tiles for
// layers it draws).
//
// It reads only what our tiles contain: layers with a name, an extent, keys and values, and
// features with tags, a type, and geometry. Format: https://github.com/mapbox/vector-tile-spec
// (version 2.1). Written here rather than adding a library to the site; it's checked against
// tiles written by the build's own tools in mvt.test.ts.

export interface TileFeature {
  properties: Record<string, string | number | boolean>;
  /** 1 point, 2 line, 3 polygon. */
  type: number;
  /** The geometry's rings or lines, in tile units (0 to extent). */
  rings: [number, number][][];
}

export interface TileLayer {
  extent: number;
  features: TileFeature[];
}

/** Reads Protocol Buffers fields one by one. */
class Reader {
  pos: number;
  readonly end: number;
  private readonly bytes: Uint8Array;

  constructor(bytes: Uint8Array, start = 0, end = bytes.length) {
    this.bytes = bytes;
    this.pos = start;
    this.end = end;
  }

  varint(): number {
    let result = 0;
    let factor = 1;
    for (;;) {
      const byte = this.bytes[this.pos++];
      result += (byte & 0x7f) * factor;
      if (byte < 0x80) return result;
      factor *= 128;
    }
  }

  /** A length-delimited field's bytes, as a reader over them. */
  sub(): Reader {
    const length = this.varint();
    const reader = new Reader(this.bytes, this.pos, this.pos + length);
    this.pos += length;
    return reader;
  }

  string(): string {
    const sub = this.sub();
    return new TextDecoder().decode(this.bytes.subarray(sub.pos, sub.end));
  }

  float(): number {
    const value = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.pos, 4).getFloat32(0, true);
    this.pos += 4;
    return value;
  }

  double(): number {
    const value = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.pos, 8).getFloat64(0, true);
    this.pos += 8;
    return value;
  }

  /** Skips a field of the given wire type. */
  skip(wireType: number): void {
    if (wireType === 0) this.varint();
    else if (wireType === 1) this.pos += 8;
    else if (wireType === 2) {
      // Read the length first: `this.pos += this.varint()` would add it to the position from
      // before the length was read.
      const length = this.varint();
      this.pos += length;
    }
    else if (wireType === 5) this.pos += 4;
    else throw new Error(`Unknown wire type ${wireType}`);
  }

  /** Reads fields until the end, calling `field(number, wireType)` for each. */
  each(field: (number: number, wireType: number) => boolean): void {
    while (this.pos < this.end) {
      const key = this.varint();
      const number = Math.floor(key / 8);
      const wireType = key & 7;
      if (!field(number, wireType)) this.skip(wireType);
    }
  }

  /** A packed repeated varint field. */
  packed(): number[] {
    const sub = this.sub();
    const values: number[] = [];
    while (sub.pos < sub.end) values.push(sub.varint());
    return values;
  }
}

const zigzag = (n: number) => (n % 2 === 0 ? n / 2 : -(n + 1) / 2);

function readValue(reader: Reader): string | number | boolean {
  let value: string | number | boolean = '';
  reader.each((number) => {
    if (number === 1) value = reader.string();
    else if (number === 2) value = reader.float();
    else if (number === 3) value = reader.double();
    else if (number === 4 || number === 5) value = reader.varint();
    else if (number === 6) value = zigzag(reader.varint());
    else if (number === 7) value = reader.varint() !== 0;
    else return false;
    return true;
  });
  return value;
}

/** Turns geometry commands (MoveTo, LineTo, ClosePath with zigzag deltas) into rings or lines. */
function readGeometry(commands: number[]): [number, number][][] {
  const rings: [number, number][][] = [];
  let x = 0;
  let y = 0;
  let current: [number, number][] = [];
  for (let i = 0; i < commands.length; ) {
    const command = commands[i] & 7;
    const count = commands[i] >> 3;
    i++;
    if (command === 7) {
      if (current.length > 0) current.push([current[0][0], current[0][1]]);
      continue;
    }
    for (let k = 0; k < count; k++) {
      x += zigzag(commands[i++]);
      y += zigzag(commands[i++]);
      if (command === 1) {
        if (current.length > 0) rings.push(current);
        current = [];
      }
      current.push([x, y]);
    }
  }
  if (current.length > 0) rings.push(current);
  return rings;
}

/** The named layer of a tile, or undefined when the tile doesn't have it. */
export function readLayer(bytes: Uint8Array, name: string): TileLayer | undefined {
  let found: TileLayer | undefined;
  // Walk the layers (field 3), reading only the one asked for.
  const tile = new Reader(bytes);
  tile.each((number, wireType) => {
    if (number !== 3 || wireType !== 2 || found) return false;
    const reader = tile.sub();
    let layerName = '';
    let extent = 4096;
    const keys: string[] = [];
    const values: (string | number | boolean)[] = [];
    const raw: { tags: number[]; type: number; geometry: number[] }[] = [];
    reader.each((field) => {
      if (field === 1) layerName = reader.string();
      else if (field === 2) {
        const feature = reader.sub();
        const entry = { tags: [] as number[], type: 0, geometry: [] as number[] };
        feature.each((f) => {
          if (f === 2) entry.tags = feature.packed();
          else if (f === 3) entry.type = feature.varint();
          else if (f === 4) entry.geometry = feature.packed();
          else return false;
          return true;
        });
        raw.push(entry);
      } else if (field === 3) keys.push(reader.string());
      else if (field === 4) values.push(readValue(reader.sub()));
      else if (field === 5) extent = reader.varint();
      else return false;
      return true;
    });
    if (layerName !== name) return true;
    found = {
      extent,
      features: raw.map(({ tags, type, geometry }) => {
        const properties: Record<string, string | number | boolean> = {};
        for (let i = 0; i + 1 < tags.length; i += 2) properties[keys[tags[i]]] = values[tags[i + 1]];
        return { properties, type, rings: readGeometry(geometry) };
      }),
    };
    return true;
  });
  return found;
}

/**
 * Whether a point is inside a polygon feature's rings (even-odd: a hole's ring cancels its outer
 * ring, so this works for polygons with holes and for several polygons in one feature).
 */
export function pointInRings(x: number, y: number, rings: readonly (readonly [number, number])[][]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** The tile (at zoom z) holding a point, and the point's position inside it, in tile units. */
export function tileAt(lng: number, lat: number, z: number, extent = 4096): { x: number; y: number; px: number; py: number } {
  const n = 2 ** z;
  const fx = ((lng + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const x = Math.min(n - 1, Math.max(0, Math.floor(fx)));
  const y = Math.min(n - 1, Math.max(0, Math.floor(fy)));
  return { x, y, px: (fx - x) * extent, py: (fy - y) * extent };
}
