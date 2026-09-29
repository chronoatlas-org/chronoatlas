// Suggests crosswalk links for one region and period (Phase 5 step 8), for a maintainer to review:
// which of CShapes' holders held each of the map's polities there, as the same state or as a
// dependency. It writes a report (Markdown, with YAML ready to paste into the crosswalk after
// review) and changes nothing in data/.
//
// Usage:
//   npm run suggest-crosswalk -- --region=W,S,E,N --years=FROM,TO [--map=cliopatria] [--with=cshapes]
//                                [--out=suggestions.md] [--trial]
// For example, Europe 1914–1950:
//   npm run suggest-crosswalk -- --region=-25,34,45,72 --years=1914,1950 --out=europe.md --trial
// (Write --region=… with "=", since a west edge like -25 would otherwise read as an option.)
//
//   --map    whose polities to link: cliopatria (the default; where it's the baseline) or
//            openhistoricalmap (our own polities, the default map).
//   --with   what to link them to: cshapes (the default; the legal borders, for contested areas,
//            in data/imports/cshapes-2-0/polity-crosswalk.yaml) or cliopatria (its polities, for
//            "sources differ", in data/imports/cliopatria/polity-crosswalk.yaml; only with
//            --map=openhistoricalmap).
//
// With --trial, the report also lists the contested areas (or, --with=cliopatria, the "sources
// differ" areas) the map would show there if every suggestion were accepted and the region marked
// as reviewed: what the review is deciding.
//
// How: on 1 July of every year in the period, each of the map's rows inside the region is compared
// with each row on the other side, and the area they share is added up per polity and unit (CShapes
// names the state holding each unit: a colony's record is its owner's; a Cliopatria polity is its
// own unit). Where a polity held most of a unit (inside the region, over the days sampled), its
// holder is suggested: as the same state for the holder's own unit, as a dependency otherwise
// (scripts/lib/suggest.ts). A polity that only lay inside a unit without holding most of it (a
// breakaway state, rival government, or occupation zone) is never suggested, but listed for a
// closer look. Polities the crosswalk already links are left out.

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import polygonClipping from 'polygon-clipping';
import { civilToJdn, jdnToCivil } from '../src/dates/index.ts';
import { buildContested, buildDiffer, crosswalkLinks, dayRanges, isDejure, isSecondOpinion, onDefaultMap } from './build-data.ts';
import { loadDataset } from './lib/data.ts';
import { areaKm2, cleanMultiPolygon } from './lib/geometry.ts';
import type { MultiPolygon } from './lib/geometry.ts';
import { boundingBox } from './lib/contested.ts';
import { suggest } from './lib/suggest.ts';
import type { Overlap } from './lib/suggest.ts';
import type { ShapeFeature } from './lib/types.ts';

type Box = [number, number, number, number];

const { values } = parseArgs({
  options: {
    region: { type: 'string' },
    years: { type: 'string' },
    out: { type: 'string' },
    trial: { type: 'boolean' },
    map: { type: 'string', default: 'cliopatria' },
    with: { type: 'string', default: 'cshapes' },
  },
});
const map = values.map === 'openhistoricalmap' ? 'openhistoricalmap' : values.map === 'cliopatria' ? 'cliopatria' : undefined;
const other = values.with === 'cliopatria' ? 'cliopatria' : values.with === 'cshapes' ? 'cshapes' : undefined;
if (!map || !other || (other === 'cliopatria' && map !== 'openhistoricalmap')) {
  console.error('Give --map=cliopatria or openhistoricalmap, and --with=cshapes or (with --map=openhistoricalmap) cliopatria.');
  process.exit(1);
}
/** Where the links go, and the reviewed scopes beside them. */
const folder = other === 'cshapes' ? 'data/imports/cshapes-2-0' : 'data/imports/cliopatria';
const MAP_NAME = { cliopatria: 'Cliopatria', openhistoricalmap: 'OpenHistoricalMap' }[map];
const OTHER_NAME = { cshapes: 'CShapes', cliopatria: 'Cliopatria' }[other];
const numbers = (text: string | undefined, count: number, what: string) => {
  const parts = (text ?? '').split(',').map(Number);
  if (parts.length !== count || parts.some((n) => !Number.isFinite(n))) {
    console.error(`Give --${what} as ${count} numbers separated by commas (see the top of this script).`);
    process.exit(1);
  }
  return parts;
};
const region = numbers(values.region, 4, 'region') as Box;
const [fromYear, toYear] = numbers(values.years, 2, 'years');

const ds = loadDataset();
const shapes = new Map(ds.shapes.map(({ value }) => [value.properties.id, value]));
const asMulti = (g: ShapeFeature['geometry']): MultiPolygon => (g.type === 'Polygon' ? [g.coordinates as MultiPolygon[number]] : (g.coordinates as MultiPolygon));
const overlapsBox = ([w, s, e, n]: Box, [bw, bs, be, bn]: Box) => w < be && e > bw && s < bn && n > bs;
const names = new Map(ds.polities.map(({ value }) => [value.id, value.names.find((n) => n.lang === 'en')?.text ?? value.names[0]?.text ?? value.id]));

// The records on each side, with their shapes (whole, and Cliopatria's cut to the region).
interface Row {
  id: string;
  holder: string;
  shape: string;
  s0: number;
  e0: number;
  box: Box;
  unit: string;
  home: boolean;
}
const rows = (include: (file: string) => boolean, relations: string[]): Row[] =>
  ds.assertions
    .filter(({ file }) => include(file))
    .flatMap(({ value }) => value)
    .filter((a) => relations.includes(a.relation) && a.shape && shapes.has(a.shape))
    .map((a) => {
      const shape = shapes.get(a.shape!)!;
      const { s0, e1 } = dayRanges(a.start, a.end);
      const { cshapes_gwcode: code, cshapes_owner: owner } = shape.properties;
      const unit = code === undefined ? a.subject : `cshapes-${code}`;
      return { id: a.id, holder: a.subject, shape: a.shape!, s0, e0: e1, box: boundingBox(asMulti(shape.geometry)), unit, home: code === undefined || code === owner };
    })
    .filter((r) => overlapsBox(r.box, region));
// Polities this crosswalk already links are left out.
const linked = new Set(crosswalkLinks({ ...ds, crosswalks: ds.crosswalks.filter(({ file }) => file.startsWith(`${folder}/`)) }).map((l) => l.polity));
const polityRows = (map === 'cliopatria' ? rows(isSecondOpinion, ['controls']) : rows(onDefaultMap, ['administers', 'controls'])).filter((r) => !linked.has(r.holder));
const legalRows = other === 'cshapes' ? rows(isDejure, ['sovereign', 'occupies']) : rows(isSecondOpinion, ['controls']);

const frame: MultiPolygon = [[[[region[0], region[1]], [region[2], region[1]], [region[2], region[3]], [region[0], region[3]], [region[0], region[1]]]]];
const inRegion = new Map<string, MultiPolygon>();
const regionKm2 = new Map<string, number>();
const areaInRegion = (shape: string) => {
  if (!regionKm2.has(shape)) regionKm2.set(shape, areaKm2(clipped(shape)));
  return regionKm2.get(shape)!;
};
const clipped = (shape: string) => {
  if (!inRegion.has(shape)) inRegion.set(shape, cleanMultiPolygon(polygonClipping.intersection(asMulti(shapes.get(shape)!.geometry) as never, frame as never) as MultiPolygon, 4));
  return inRegion.get(shape)!;
};
const shared = new Map<string, number>();
const sharedKm2 = (a: string, b: string) => {
  const key = `${a}|${b}`;
  if (!shared.has(key)) {
    const piece = polygonClipping.intersection(clipped(a) as never, asMulti(shapes.get(b)!.geometry) as never) as MultiPolygon;
    shared.set(key, areaKm2(piece));
  }
  return shared.get(key)!;
};

const totals = new Map<string, number>();
const found = new Map<string, Overlap>();
for (let year = fromYear; year <= toYear; year++) {
  const day = civilToJdn(year, 7, 1);
  const legalNow = legalRows.filter((r) => r.s0 <= day && day < r.e0);
  for (const p of polityRows.filter((r) => r.s0 <= day && day < r.e0)) {
    const own = areaInRegion(p.shape);
    if (own === 0) continue;
    totals.set(p.holder, (totals.get(p.holder) ?? 0) + own);
    for (const l of legalNow.filter((r) => overlapsBox(r.box, p.box))) {
      const km2 = sharedKm2(p.shape, l.shape);
      if (km2 === 0) continue;
      const key = `${p.holder}|${l.holder}|${l.unit}`;
      const o = found.get(key) ?? { polity: p.holder, holder: l.holder, unit: l.unit, home: l.home, km2: 0, unitKm2: 0, days: [] };
      o.km2 += km2;
      o.unitKm2 += areaInRegion(l.shape);
      o.days.push(day);
      found.set(key, o);
    }
  }
  process.stdout.write(`\r${year}`);
}
process.stdout.write('\n');

const { suggestions, inside, unmatched } = suggest([...found.values()], totals);
const yearOf = (day: number) => jdnToCivil(day).year;
const percent = (share: number) => `${Math.round(share * 100)}%`;
const lines: string[] = [
  `# Crosswalk suggestions: ${region.join(', ')} (west, south, east, north), ${fromYear}–${toYear}`,
  '',
  `${MAP_NAME}'s polities, linked to ${OTHER_NAME}'s ${other === 'cshapes' ? 'units' : 'polities'}.`,
  '',
  'Written by `npm run suggest-crosswalk`. **Suggestions only:** each link needs a maintainer\'s review',
  `before it goes into \`${folder}/polity-crosswalk.yaml\` (Phase 5 decision 6). The share is`,
  `on 1 July of each year sampled, inside the region: "Held" is how much of the ${OTHER_NAME} unit(s) the ${MAP_NAME}`,
  'polity held, and "Share" how much of the polity lay inside them.',
  '',
  `## Suggested links (${suggestions.length})`,
  '',
  `| ${OTHER_NAME} holder | ${MAP_NAME} polity | Kind | Units | Held | Share | Years |`,
  '|---|---|---|---|---|---|---|',
  ...suggestions.map(
    (s) =>
      `| ${names.get(s.holder) ?? s.holder} (\`${s.holder}\`) | ${names.get(s.polity) ?? s.polity} (\`${s.polity}\`) | ${s.kind} | ${s.units.map((u) => names.get(u) ?? u).join(', ')} | ${percent(s.held)} | ${percent(s.share)} | ${yearOf(s.first)}–${yearOf(s.last)} |`,
  ),
  '',
  `## Look closer (${inside.length})`,
  '',
  'Never suggested, because a link would hide what "contested" exists to show. Link one only if the',
  'review finds it really was the same state (or its dependency).',
  '',
  '**Inside a unit without holding most of it:** possibly a breakaway state, a rival government, or an',
  'occupation zone.',
  '',
  ...inside
    .filter((i) => i.why === 'inside')
    .map((i) => `- ${names.get(i.polity) ?? i.polity} (\`${i.polity}\`): ${percent(i.share)} inside ${names.get(i.unit) ?? i.unit} (\`${i.unit}\`, held by \`${i.holder}\`), holding ${percent(i.held)} of it`),
  '',
  '**Holding most of another state\'s unit:** possibly an occupation or annexation, or a year of transition',
  '(Cliopatria\'s rows are yearly).',
  '',
  ...(other === 'cliopatria' ? ['(With Cliopatria\'s polities, each is its own unit, so this list stays empty.)', ''] : []),
  '',
  ...inside
    .filter((i) => i.why === 'beyond')
    .map((i) => `- ${names.get(i.polity) ?? i.polity} (\`${i.polity}\`): held ${percent(i.held)} of ${names.get(i.unit) ?? i.unit} (\`${i.unit}\`, held by \`${i.holder}\`), ${percent(i.share)} of its own territory`),
  '',
  `## No unit held mostly (${unmatched.length})`,
  '',
  other === 'cshapes'
    ? 'These would show as contested wherever they overlap a CShapes unit, once the region is reviewed.'
    : 'These would show as "sources differ" wherever they overlap a Cliopatria polity, once the region is reviewed.',
  '',
  ...unmatched.map((u) => `- ${names.get(u.polity) ?? u.polity} (\`${u.polity}\`): held at most ${percent(u.best)} of any unit`),
  '',
  '## YAML, after review',
  '',
  '```yaml',
  ...[...new Set(suggestions.map((s) => s.holder))].flatMap((holder) => [
    `- unit: ${holder}`,
    '  matches:',
    ...suggestions
      .filter((s) => s.holder === holder)
      .flatMap((s) => [
        `    - polity: ${s.polity}`,
        `      kind: ${s.kind}`,
        `      why: ${JSON.stringify(`${MAP_NAME}'s "${names.get(s.polity) ?? s.polity}" held ${percent(s.held)} of ${OTHER_NAME}'s ${s.units.map((u) => `"${names.get(u) ?? u}"`).join(', ')} (${s.kind === 'same-state' ? 'its own unit' : `a dependency of "${names.get(holder) ?? holder}"`}), and ${percent(s.share)} of it lay there (1 July, ${yearOf(s.first)}–${yearOf(s.last)}). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>.`)}`,
      ]),
  ]),
  '```',
  '',
];
// What the review decides: the contested areas there, if every suggestion were accepted.
if (values.trial) {
  const entries = [...new Set(suggestions.map((s) => s.holder))].map((unit) => ({
    unit,
    matches: suggestions.filter((s) => s.holder === unit).map((s) => ({ polity: s.polity, kind: s.kind })),
  }));
  const trial = {
    ...ds,
    crosswalks: [...ds.crosswalks, { file: `${folder}/polity-crosswalk.yaml`, value: entries }],
    crosswalkScopes: [
      ...(ds.crosswalkScopes ?? []),
      {
        file: `${folder}/crosswalk-reviewed.yaml`,
        value: [{ area: { west: region[0], south: region[1], east: region[2], north: region[3] }, from: String(fromYear), until: String(toYear + 1), reviewed: '2000-01-01', map }],
      },
    ],
  };
  const inside = (other === 'cshapes' ? buildContested(trial) : buildDiffer(trial)).filter(
    (a) => a.factoSource === map && overlapsBox(boundingBox(a.geometry), region) && a.e0 > civilToJdn(fromYear, 1, 1) && a.s0 < civilToJdn(toYear + 1, 1, 1),
  );
  const pairs = new Map<string, { km2: number; first: number; last: number; maybe: boolean }>();
  for (const a of inside) {
    const key = `${a.facto}|${a.jure}`;
    const p = pairs.get(key) ?? { km2: 0, first: a.s0, last: a.e0, maybe: true };
    pairs.set(key, { km2: Math.max(p.km2, a.km2), first: Math.min(p.first, a.s0), last: Math.max(p.last, a.e0), maybe: p.maybe && !!a.maybe });
  }
  lines.push(
    ...(other === 'cshapes'
      ? [
          `## Trial: contested areas if every suggestion were accepted (${pairs.size} pairs)`,
          '',
          `Administered per ${MAP_NAME}, legally recognized as another state's per CShapes, at least 10,000 km²${map === 'cliopatria' ? ' and\n10 km wide' : ''}.`,
          'The largest area of each pair; "possibly" where only uncertain (month- or year-only) dates make it so.',
          '',
          `| Administered by (${MAP_NAME}) | Legally (CShapes) | Largest area | Years |`,
        ]
      : [
          `## Trial: "sources differ" if every suggestion were accepted (${pairs.size} pairs)`,
          '',
          'Held per OpenHistoricalMap, by another polity per Cliopatria, at least 1,000 km² and 10 km wide.',
          'The largest area of each pair; "possibly" where only uncertain (month- or year-only) dates make it so.',
          '',
          '| OpenHistoricalMap | Cliopatria | Largest area | Years |',
        ]),
    '|---|---|---|---|',
    ...[...pairs]
      .sort((a, b) => b[1].km2 - a[1].km2)
      .map(([key, p]) => {
        const [facto, jure] = key.split('|');
        return `| ${names.get(facto) ?? facto} | ${names.get(jure) ?? jure} | ${Math.round(p.km2).toLocaleString('en')} km²${p.maybe ? ' (possibly)' : ''} | ${yearOf(p.first)}–${yearOf(p.last - 1)} |`;
      }),
    '',
  );
}
const report = lines.join('\n');
if (values.out) writeFileSync(values.out, report);
else console.log(report);
console.log(`${suggestions.length} suggested links, ${inside.length} to look at closer, ${unmatched.length} polities without one.`);
