// Downloads the Natural Earth base map layers from a pinned release, trims them to what the map
// needs, and records exactly where they came from in data/imports/natural-earth/manifest.json.
//
// Run with: npm run import:natural-earth
//
// Natural Earth is public domain (https://www.naturalearthdata.com/about/terms-of-use/).
// We pin a release tag so every run produces the same files, and record a SHA-256 checksum of
// each downloaded file so anyone can confirm our copy matches the upstream release.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RELEASE = 'v5.1.2';
const REPO = 'nvkelso/natural-earth-vector';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'imports', 'natural-earth');

// Coordinates are rounded to this many decimal places (4 ≈ 11 m at the equator). That is far
// finer than the 1:50m source scale, so it loses nothing visible and roughly halves file size.
const COORD_DECIMALS = 4;

interface LayerSpec {
  file: string;
  description: string;
  // Properties to keep. Everything else, including modern place names, is dropped: the base map
  // shows physical geography only.
  keep: string[];
}

const LAYERS: LayerSpec[] = [
  { file: 'ne_50m_land.geojson', description: 'Land polygons (1:50m)', keep: [] },
  { file: 'ne_50m_lakes.geojson', description: 'Lakes and reservoirs (1:50m)', keep: ['scalerank'] },
  {
    file: 'ne_50m_rivers_lake_centerlines.geojson',
    description: 'Rivers and lake centerlines (1:50m)',
    keep: ['scalerank'],
  },
];

type Position = number[];
type Coordinates = Position | Coordinates[];

interface Feature {
  type: 'Feature';
  properties: Record<string, unknown> | null;
  geometry: { type: string; coordinates: Coordinates } | null;
}

function roundCoordinates(coords: Coordinates): Coordinates {
  if (typeof coords[0] === 'number') {
    const factor = 10 ** COORD_DECIMALS;
    return (coords as Position).map((n) => Math.round(n * factor) / factor);
  }
  return (coords as Coordinates[]).map(roundCoordinates);
}

function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

async function readPreviousManifest(): Promise<Record<string, string>> {
  try {
    const manifest = JSON.parse(await readFile(join(OUT_DIR, 'manifest.json'), 'utf8'));
    return Object.fromEntries(
      manifest.files.map((f: { file: string; upstreamSha256: string }) => [f.file, f.upstreamSha256]),
    );
  } catch {
    return {};
  }
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const previous = await readPreviousManifest();
  const files = [];

  for (const layer of LAYERS) {
    const url = `https://raw.githubusercontent.com/${REPO}/${RELEASE}/geojson/${layer.file}`;
    console.log(`Downloading ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
    const raw = Buffer.from(await response.arrayBuffer());
    const upstreamSha256 = sha256(raw);

    if (previous[layer.file] && previous[layer.file] !== upstreamSha256) {
      console.warn(`  WARNING: upstream file changed since the last import (checksum differs).`);
    }

    const source = JSON.parse(raw.toString('utf8')) as { features: Feature[] };
    const features = source.features.map((f) => ({
      type: 'Feature',
      properties: Object.fromEntries(layer.keep.map((k) => [k, f.properties?.[k] ?? null])),
      geometry: f.geometry && {
        type: f.geometry.type,
        coordinates: roundCoordinates(f.geometry.coordinates),
      },
    }));

    // One feature per line: compact, but a change to one feature shows up as a one-line diff.
    const output =
      '{"type":"FeatureCollection","features":[\n' +
      features.map((f) => JSON.stringify(f)).join(',\n') +
      '\n]}\n';
    await writeFile(join(OUT_DIR, layer.file), output);

    console.log(`  ${features.length} features, ${raw.length} → ${output.length} bytes`);
    files.push({
      file: layer.file,
      description: layer.description,
      upstreamUrl: url,
      upstreamBytes: raw.length,
      upstreamSha256,
      outputSha256: sha256(output),
      featureCount: features.length,
      keptProperties: layer.keep,
    });
  }

  const manifest = {
    dataset: 'Natural Earth',
    homepage: 'https://www.naturalearthdata.com/',
    repository: `https://github.com/${REPO}`,
    release: RELEASE,
    license: 'Public domain (https://www.naturalearthdata.com/about/terms-of-use/)',
    retrieved: new Date().toISOString().slice(0, 10),
    processing: [
      `Downloaded GeoJSON from the ${RELEASE} release tag.`,
      `Kept only the properties listed per file; dropped all others (including modern names).`,
      `Rounded coordinates to ${COORD_DECIMALS} decimal places.`,
      'Wrote one feature per line.',
    ],
    files,
  };
  await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Wrote ${join(OUT_DIR, 'manifest.json')}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
