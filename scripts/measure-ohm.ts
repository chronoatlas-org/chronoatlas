// Measures how much OpenHistoricalMap covers (Phase 5 step 9): its country-level boundaries
// (boundary=administrative, admin_level=2, as the import reads them) counted by region and period,
// so the maintainers can choose the next region to import (decision 8). It downloads tags and
// bounding boxes only, no geometry, and changes nothing in data/.
//
// Usage: npm run measure-ohm [-- --out=coverage.md]
// OpenHistoricalMap's servers can't be reached from every machine, so the "Measure
// OpenHistoricalMap's coverage" workflow runs this on GitHub and shows the table on its run page.

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { coverageMarkdown, coverageTable, REGIONS } from './lib/coverage.ts';
import type { BoundaryRelation } from './lib/coverage.ts';

const ENDPOINT = 'https://overpass-api.openhistoricalmap.org/api/interpreter';
const USER_AGENT = 'chronoatlas-measure/0.1 (https://github.com/chronoatlas-org/chronoatlas)';
const QUERY = `[out:json][timeout:900];
relation["boundary"="administrative"]["admin_level"="2"];
out tags bb;`;

const { values } = parseArgs({ options: { out: { type: 'string' } } });

console.log(`Querying ${ENDPOINT} ...`);
const response = await fetch(ENDPOINT, { method: 'POST', body: new URLSearchParams({ data: QUERY }), headers: { 'User-Agent': USER_AGENT } });
if (!response.ok) throw new Error(`Overpass request failed: HTTP ${response.status}`);
const { elements } = (await response.json()) as { elements: BoundaryRelation[] };
const table = coverageTable(elements);
const today = new Date().toISOString().slice(0, 10); // the measurement's own date, not a historical one

const report = [
  `## OpenHistoricalMap's country-level boundaries by region and period (${today})`,
  '',
  `${elements.length} relations tagged boundary=administrative and admin_level=2, as the import reads them, counted in`,
  'the region holding the middle of their bounding box, and in every period their start_date and',
  'end_date overlap. A count says how many boundaries were drawn, not how complete or how good they',
  'are: open a few in OpenHistoricalMap before choosing a region.',
  '',
  coverageMarkdown(table),
  '',
  `Regions (west, south, east, north): ${REGIONS.map((r) => `${r.name} ${r.box.join(', ')}`).join('; ')}.`,
  '',
].join('\n');
console.log(report);
if (values.out) writeFileSync(values.out, report);
