import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { civilToJdn } from '../src/dates/index.ts';
import {
  assignColors,
  buildBorders,
  buildChanges,
  buildContested,
  buildCoast,
  buildEdges,
  buildEventFiles,
  buildEvents,
  buildPolityFiles,
  changeDays,
  coastCut,
  computeAreas,
  dayRanges,
  FAR_FUTURE,
  onDefaultMap,
  eraItems,
  forEra,
  mapColors,
  nearbyFile,
  shapeCells,
  splitAtCoverage,
} from './build-data.ts';
import { loadDataset } from './lib/data.ts';
import { areaKm2 } from './lib/geometry.ts';
import { LandIndex } from './lib/land.ts';
import type { Dataset } from './lib/data.ts';
import type { MultiPolygon } from './lib/geometry.ts';

describe('buildPolityFiles', () => {
  // Made-up polities and sources (Testland), not real ones.
  const cite = [{ source: 'test-source', locator: 'p. 1' }];
  const ds: Dataset = {
    sources: [],
    polities: [
      { file: 'a', value: { id: 'testland', names: [{ text: 'Testland', lang: 'en', start: '1901', sources: cite }] } },
      { file: 'b', value: { id: 'otherland', names: [{ text: 'Otherland', lang: 'en', sources: cite }] } },
      { file: 'c', value: { id: 'quietland', names: [{ text: 'Quietland', lang: 'en', sources: cite }] } },
    ],
    assertions: [
      {
        file: 'd',
        value: [
          { id: 'late', relation: 'controls', subject: 'testland', shape: 's', start: '1910', end: 'ongoing', sources: cite },
          { id: 'early', relation: 'controls', subject: 'testland', shape: 's', start: '1901-05-12', end: '1910', sources: cite },
          { id: 'link', relation: 'protectorate-of', subject: 'otherland', object: 'testland', start: '1905', end: 'unknown', sources: cite },
        ],
      },
    ],
    events: [],
    figures: [],
    coverage: [],
    shapes: [],
    crosswalks: [],
    imports: [],
    problems: [],
  };
  const files = new Map(buildPolityFiles(ds).map((f) => [f.id, f]));

  it('writes one file per polity, with every record that mentions it, in date order', () => {
    expect([...files.keys()]).toEqual(['testland', 'otherland', 'quietland']);
    expect(files.get('testland')!.records.map((r) => r.id)).toEqual(['early', 'link', 'late']);
    expect(files.get('otherland')!.records.map((r) => r.id)).toEqual(['link']);
    expect(files.get('quietland')!.records).toEqual([]);
  });

  it('keeps the dates as written and adds day numbers', () => {
    const early = files.get('testland')!.records[0];
    expect(early).toMatchObject({ start: '1901-05-12', end: '1910', s0: civilToJdn(1901, 5, 12), e0: civilToJdn(1910, 1, 1) });
    // An end known only to the year also gets its last possible day; an open end doesn't.
    expect(early.e1).toBe(civilToJdn(1910, 12, 31));
    expect(files.get('testland')!.records[2].e1).toBeUndefined();
    expect(files.get('testland')!.names[0]).toMatchObject({ start: '1901', s0: civilToJdn(1901, 1, 1), e0: null, sources: cite });
  });

  it('writes event files with their effects in full and the names they need', () => {
    const [file] = buildEventFiles({
      ...ds,
      events: [
        {
          file: 'e',
          value: {
            id: 'testland-event',
            title: 'Made-up event',
            date: '1910',
            summary: 'A made-up event.',
            polities: ['quietland'],
            effects: ['early', 'late'],
            sources: cite,
          },
        },
      ],
    });
    expect(file.importance).toBe(3);
    expect(file.effects!.map((r) => [r.id, r.end])).toEqual([
      ['early', '1910'],
      ['late', 'ongoing'],
    ]);
    expect(Object.keys(file.related!).sort()).toEqual(['quietland', 'testland']);
  });

  it('lists every territorial start and end by day, skipping open ends and non-territorial links', () => {
    const { changes } = buildChanges(ds);
    // "early" ends the day "late" begins (same polity, relation, and source): one border change.
    expect(changes.map((c) => [c.record, c.kind, c.date])).toEqual([
      ['early', 'start', '1901-05-12'],
      ['late', 'change', '1910'],
    ]);
    expect(changes[0]).toMatchObject({ day: civilToJdn(1901, 5, 12), polity: 'testland', relation: 'controls', source: cite[0] });
  });

  it('keeps an end and a start apart unless the same polity, relation, and source change that day', () => {
    const other = { ...ds, assertions: ds.assertions.map(({ file, value }) => ({ file, value: value.map((a) => (a.id === 'late' ? { ...a, subject: 'quietland' } : a)) })) };
    expect(buildChanges(other).changes.map((c) => [c.record, c.kind])).toEqual([
      ['early', 'start'],
      ['late', 'start'], // the same day, sorted by polity: quietland before testland
      ['early', 'end'],
    ]);
  });

  it('writes an era\'s changes with the names of their polities, and nothing from other eras', () => {
    const { changes } = buildChanges(ds);
    const file = nearbyFile(ds, changes, { start: civilToJdn(1905, 1, 1), end: civilToJdn(1920, 1, 1) });
    expect(file.changes.map((c) => c.record)).toEqual(['late']);
    expect(Object.keys(file.names)).toEqual(['testland']);
    expect(file.names.testland[0]).toMatchObject({ text: expect.any(String), lang: expect.any(String) });
  });

  it('includes the names of the other polities its records mention, and only those', () => {
    expect(Object.keys(files.get('testland')!.related!)).toEqual(['otherland']);
    expect(files.get('quietland')!.related).toBeUndefined();
  });
});

describe('buildEvents', () => {
  it('lists events by start, with day ranges, a default importance, and inexact dates marked', () => {
    // Made-up events (Testland), not real ones.
    const cite = [{ source: 'test-source', locator: 'p. 1' }];
    const event = (id: string, date: string, importance?: number) => ({
      file: id,
      value: { id, title: `Test event ${id}`, date, summary: 'A made-up event.', sources: cite, ...(importance ? { importance } : {}) },
    });
    const { events } = buildEvents({
      sources: [], polities: [], assertions: [], figures: [], coverage: [], shapes: [], crosswalks: [], imports: [], problems: [],
      events: [event('later', '1902-03~', 5), event('earlier', '1901-05-12/1901-05-20')],
    });
    expect(events).toEqual([
      { id: 'earlier', title: 'Test event earlier', date: '1901-05-12/1901-05-20', s0: civilToJdn(1901, 5, 12), s1: civilToJdn(1901, 5, 20), importance: 3 },
      { id: 'later', title: 'Test event later', date: '1902-03~', s0: civilToJdn(1902, 3, 1), s1: civilToJdn(1902, 3, 31), importance: 5, inexact: true },
    ]);
  });
});

describe('changeDays', () => {
  it('includes the last possible end of an uncertain end', () => {
    const days = changeDays({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { s0: 10, s1: 10, e0: 50, e1: 80 }, geometry: { type: 'Point', coordinates: [0, 0] } }],
    });
    expect(days).toEqual([10, 50, 80]);
  });

  it('lists every start, certain-start, and end day once, in order, without "no end yet"', () => {
    const feature = (s0: number, s1: number, e0: number): GeoJSON.Feature => ({
      type: 'Feature',
      properties: { s0, s1, e0 },
      geometry: { type: 'Point', coordinates: [0, 0] },
    });
    const days = changeDays({
      type: 'FeatureCollection',
      features: [feature(10, 20, 50), feature(20, 20, FAR_FUTURE), feature(5, 5, 50)],
    });
    expect(days).toEqual([5, 10, 20, 50]);
  });
});

describe('dayRanges', () => {
  it('turns start and end into day-number ranges', () => {
    const r = dayRanges('1932', '1945-08-17');
    expect(r.s0).toBe(civilToJdn(1932, 1, 1));
    expect(r.s1).toBe(civilToJdn(1932, 12, 31));
    expect(r.e0).toBe(civilToJdn(1945, 8, 17));
    expect(r.e1).toBe(civilToJdn(1945, 8, 17));
  });

  it('gives an end known only to the year its first and last possible days', () => {
    const r = dayRanges('1901', '1905');
    expect(r.e0).toBe(civilToJdn(1905, 1, 1));
    expect(r.e1).toBe(civilToJdn(1905, 12, 31));
  });

  it('treats "ongoing" as no end yet', () => {
    expect(dayRanges('1924-11-26', 'ongoing')).toMatchObject({ e0: FAR_FUTURE, endUnknown: false });
    expect(dayRanges('1924', 'unknown')).toMatchObject({ e0: FAR_FUTURE, endUnknown: true });
  });
});

describe('assignColors', () => {
  it('gives overlapping polities different colors, and reuses colors for distant ones', () => {
    const box = (x: number): [number, number, number, number] => [x, 0, x + 1, 1];
    const colors = assignColors([
      { polity: 'a', box: box(0), s0: 0, e0: 100 },
      { polity: 'b', box: box(0.5), s0: 0, e0: 100 }, // overlaps a
      { polity: 'c', box: box(10), s0: 0, e0: 100 }, // far away
    ]);
    expect(colors.get('a')).not.toBe(colors.get('b'));
    expect(colors.get('c')).toBe(0);
  });

  it('ignores polities that overlap in space but not in time', () => {
    const colors = assignColors([
      { polity: 'a', box: [0, 0, 1, 1], s0: 0, e0: 10 },
      { polity: 'b', box: [0, 0, 1, 1], s0: 10, e0: 20 }, // starts when a ends
    ]);
    expect(colors.get('a')).toBe(colors.get('b'));
  });

  it('with grid squares, counts only shapes that come close as neighbours, not whole bounding boxes', () => {
    // Made-up Testland shapes: a wide "empire" whose box covers b and c, but which touches only b.
    const square = (x: number, y: number): MultiPolygon => [[[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]]];
    const empire: MultiPolygon = [...square(0, 0), ...square(20, 0)];
    const b = square(1, 0); // shares a corner square with the empire
    const c = square(10, 0.2); // inside the empire's box, far from its shapes
    const item = (polity: string, shape: MultiPolygon) => ({ polity, box: [0, 0, 21, 1] as [number, number, number, number], s0: 0, e0: 10, cells: shapeCells(shape) });
    const colors = assignColors([item('empire', empire), item('b', b), item('c', c)]);
    expect(colors.get('empire')).not.toBe(colors.get('b'));
    // c has no neighbours, so it takes the first color, whatever the empire has.
    expect(colors.get('c')).toBe(0);
  });
});

describe('mapColors', () => {
  // Made-up Testland polities and squares in a row, each touching the next: ours (the default map),
  // then two of Cliopatria's (the baseline), and a neighbour of ours.
  const cite = [{ source: 'test-source', locator: 'p. 1' }];
  const shape = (id: string, x: number) => ({
    file: id,
    value: { type: 'Feature' as const, properties: { id, edge_precision: 'unknown' }, geometry: { type: 'Polygon' as const, coordinates: [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]] } },
  });
  const record = (subject: string) => ({ id: subject, relation: 'controls' as const, subject, shape: subject, start: '1901', end: 'ongoing', sources: cite });
  const ds: Dataset = {
    sources: [], polities: [], events: [], figures: [], coverage: [], imports: [], problems: [],
    shapes: [shape('neighbour', -1), shape('testland', 0), shape('cliopatria-testland', 1), shape('cliopatria-rival', 2)],
    assertions: [
      { file: 'data/assertions/test.yaml', value: [record('neighbour'), record('testland')] },
      { file: 'data/imports/cliopatria/assertions.yaml', value: [record('cliopatria-testland'), record('cliopatria-rival')] },
    ],
    crosswalks: [
      { file: 'data/imports/cliopatria/polity-crosswalk.yaml', value: [{ unit: 'cliopatria-testland', matches: [{ polity: 'testland', kind: 'same-state' }] }] },
      // A legal source's unit matched to two of our states, which still need colors of their own.
      { file: 'data/imports/test-legal/polity-crosswalk.yaml', value: [{ unit: 'unit-a', matches: [{ polity: 'testland', kind: 'same-state' }, { polity: 'neighbour', kind: 'same-state' }] }] },
    ],
  };

  it('gives a Cliopatria polity matched to ours the same color, so it keeps it across the edge', () => {
    const colors = mapColors(ds);
    expect(colors.get('cliopatria-testland')).toBe(colors.get('testland'));
    expect(colors.get('cliopatria-rival')).not.toBe(colors.get('cliopatria-testland'));
  });

  it('keeps neighbours apart even when another source links them to one unit', () => {
    const colors = mapColors(ds);
    expect(colors.get('neighbour')).not.toBe(colors.get('testland'));
  });
});

describe('the default map', () => {
  it('draws our own data and OpenHistoricalMap, and keeps every other import out', () => {
    expect(onDefaultMap('data/assertions/testland.yaml')).toBe(true);
    expect(onDefaultMap('data/imports/openhistoricalmap/assertions.yaml')).toBe(true);
    expect(onDefaultMap('data/imports/cshapes-2-0/assertions.yaml')).toBe(false);
  });

  it('builds the border tiles from default-map assertions only', () => {
    // Made-up shapes and records (Testland), not real ones.
    const cite = [{ source: 'test-source', locator: 'p. 1' }];
    const square = [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]];
    const shape = (id: string) => ({
      file: id,
      value: { type: 'Feature' as const, properties: { id, edge_precision: 'unknown' }, geometry: { type: 'Polygon' as const, coordinates: square } },
    });
    const record = (id: string) => ({ id, relation: 'administers' as const, subject: 'testland', shape: id, start: '1901', end: 'ongoing', sources: cite });
    const { collection } = buildBorders({
      sources: [], polities: [], events: [], figures: [], coverage: [], crosswalks: [], imports: [], problems: [],
      shapes: [shape('mine'), shape('other-import')],
      assertions: [
        { file: 'data/imports/openhistoricalmap/assertions.yaml', value: [record('mine')] },
        { file: 'data/imports/test-other/assertions.yaml', value: [record('other-import')] },
      ],
    });
    expect(collection.features.map((f) => f.properties?.id)).toEqual(['mine']);
  });

  it('writes each border\'s lines apart from its fill, without the cut along the import\'s edge', () => {
    // Made-up shape and record (Testland), not real ones.
    const cite = [{ source: 'test-source', locator: 'p. 1' }];
    const { lines } = buildBorders(
      {
        sources: [], polities: [], events: [], figures: [], coverage: [], crosswalks: [], imports: [], problems: [],
        shapes: [{ file: 'cut', value: { type: 'Feature', properties: { id: 'cut', edge_precision: 'unknown' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] } } }],
        assertions: [
          { file: 'data/imports/openhistoricalmap/assertions.yaml', value: [{ id: 'cut-1', relation: 'administers', subject: 'testland', shape: 'cut', start: '1901', end: '1905', sources: cite }] },
        ],
      },
      { areas: new Map([['data/imports/openhistoricalmap', [-10, -10, 1, 10]]]) },
    );
    expect(lines.features).toHaveLength(1);
    expect(lines.features[0].properties).toEqual({ id: 'cut-1', polity: 'testland', s0: civilToJdn(1901, 1, 1), e0: civilToJdn(1905, 1, 1), e1: civilToJdn(1905, 12, 31) });
    // The east side, along the area's edge at 1°E, is left out.
    expect(lines.features[0].geometry).toEqual({ type: 'MultiLineString', coordinates: [[[1, 1], [0, 1], [0, 0], [1, 0]]] });
  });

  it('marks approximate lines and frontier zones on the lines, and lists which kinds there are', () => {
    // Made-up shapes and records (Testland), not real ones.
    const cite = [{ source: 'test-source', locator: 'p. 1' }];
    const shape = (id: string, edge: string) => ({
      file: id,
      value: { type: 'Feature' as const, properties: { id, edge_precision: edge }, geometry: { type: 'Polygon' as const, coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] } },
    });
    const record = (id: string) => ({ id, relation: 'administers' as const, subject: 'testland', shape: id, start: '1901', end: 'ongoing', sources: cite });
    const edges = ['treaty-line', 'approximate-line', 'frontier-zone', 'unknown'];
    const { lines, precision } = buildBorders({
      sources: [], polities: [], events: [], figures: [], coverage: [], crosswalks: [], imports: [], problems: [],
      shapes: edges.map((e) => shape(e, e)),
      assertions: [{ file: 'data/imports/openhistoricalmap/assertions.yaml', value: edges.map(record) }],
    });
    expect(Object.fromEntries(lines.features.map((f) => [f.properties?.id, f.properties?.ep]))).toEqual({
      'treaty-line': undefined,
      'approximate-line': 1,
      'frontier-zone': 2,
      unknown: undefined,
    });
    expect(precision).toEqual(['approximate-line', 'frontier-zone']);
  });

  it('labels each record at one point, with the names that apply, split where a name changes', () => {
    // Made-up polity, names, shape, and record (Testland), not real ones.
    const cite = [{ source: 'test-source', locator: 'p. 1' }];
    const { labels } = buildBorders({
      sources: [], events: [], figures: [], coverage: [], crosswalks: [], imports: [], problems: [],
      polities: [
        {
          file: 'data/polities/testland.yaml',
          value: {
            id: 'testland',
            names: [
              { text: 'Old Testland', lang: 'en', end: '1905', sources: cite },
              { text: 'Testland', lang: 'en', start: '1905', sources: cite },
              { text: '試驗國', lang: 'und', sources: cite },
            ],
          },
        },
      ],
      shapes: [{ file: 's', value: { type: 'Feature', properties: { id: 's', edge_precision: 'unknown' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] } } }],
      assertions: [
        { file: 'data/imports/openhistoricalmap/assertions.yaml', value: [{ id: 'r', relation: 'administers', subject: 'testland', shape: 's', start: '1901', end: '1910', sources: cite }] },
      ],
    });
    expect(labels.features.map((f) => [f.properties?.name, f.properties?.local, f.properties?.s0, f.properties?.e0, f.properties?.e1])).toEqual([
      ['Old Testland', '試驗國', civilToJdn(1901, 1, 1), civilToJdn(1905, 1, 1), undefined],
      ['Testland', '試驗國', civilToJdn(1905, 1, 1), civilToJdn(1910, 1, 1), civilToJdn(1910, 12, 31)],
    ]);
    const [x, y] = (labels.features[0].geometry as GeoJSON.Point).coordinates;
    expect(x).toBeCloseTo(1, 1);
    expect(y).toBeCloseTo(1, 1);
  });

  it('adds the last possible end day only to borders whose end is uncertain', () => {
    // Made-up shapes and records (Testland), not real ones.
    const cite = [{ source: 'test-source', locator: 'p. 1' }];
    const square = [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]];
    const shape = (id: string) => ({
      file: id,
      value: { type: 'Feature' as const, properties: { id, edge_precision: 'unknown' }, geometry: { type: 'Polygon' as const, coordinates: square } },
    });
    const record = (id: string, end: string) => ({ id, relation: 'administers' as const, subject: 'testland', shape: id, start: '1901', end, sources: cite });
    const { collection } = buildBorders({
      sources: [], polities: [], events: [], figures: [], coverage: [], crosswalks: [], imports: [], problems: [],
      shapes: [shape('year'), shape('month'), shape('day'), shape('open')],
      assertions: [
        { file: 'data/imports/openhistoricalmap/assertions.yaml', value: [record('year', '1905'), record('month', '1905-03'), record('day', '1905-03-07'), record('open', 'ongoing')] },
      ],
    });
    const e1 = Object.fromEntries(collection.features.map((f) => [f.properties?.id, f.properties?.e1]));
    expect(e1).toEqual({ year: civilToJdn(1905, 12, 31), month: civilToJdn(1905, 3, 31), day: undefined, open: undefined });
  });
});

describe('the edge of imported data', () => {
  it('draws one edge for imports that share an area and years, only in those years', () => {
    // The real manifests (all the edge needs, so the worldwide shapes aren't loaded): only the
    // default map's import, OpenHistoricalMap, gets an edge, at 10–55°N, 73–150°E, 1900–1950.
    // Without land to check, the whole edge is drawn.
    const imports = readdirSync(new URL('../data/imports/', import.meta.url)).map((name) => `data/imports/${name}`);
    const manifestsOnly: Dataset = { sources: [], polities: [], assertions: [], events: [], figures: [], coverage: [], shapes: [], crosswalks: [], imports, problems: [] };
    const edges = buildEdges(manifestsOnly);
    expect(edges.features).toHaveLength(1);
    expect(edges.features[0].properties).toMatchObject({ s0: civilToJdn(1900, 1, 1), e0: civilToJdn(1951, 1, 1) });
  });
});

describe('the crosswalk in polity files', () => {
  // Made-up polities, squares, and records (Testland), not real ones.
  const cite = [{ source: 'test-source', locator: 'p. 1' }];
  const square = (x: number) => [[[x, 0], [x + 2, 0], [x + 2, 2], [x, 2], [x, 0]]];
  const shape = (id: string, x: number) => ({
    file: id,
    value: { type: 'Feature' as const, properties: { id, edge_precision: 'unknown' }, geometry: { type: 'Polygon' as const, coordinates: square(x) } },
  });
  const polity = (id: string, file: string) => ({ file, value: { id, names: [{ text: id, lang: 'en', sources: cite }] } });
  const record = (id: string, subject: string, shapeId: string, relation: 'administers' | 'sovereign' = 'administers') => ({
    id, relation, subject, shape: shapeId, start: '1901', end: 'ongoing', sources: cite,
  });
  const ds: Dataset = {
    sources: [], events: [], figures: [], coverage: [], imports: [], problems: [],
    polities: [
      polity('testland', 'data/polities/testland.yaml'),
      polity('colony-office', 'data/polities/colony-office.yaml'),
      polity('rival', 'data/polities/rival.yaml'),
      polity('unit-a', 'data/imports/test-legal/polities/unit-a.yaml'),
      polity('unit-b', 'data/imports/test-legal/polities/unit-b.yaml'),
    ],
    shapes: [shape('home', 0), shape('colony', 10), shape('far-colony', 20), shape('unit-a-home', 0), shape('unit-a-colony', 10), shape('unit-a-far', 20)],
    assertions: [
      { file: 'data/assertions/test.yaml', value: [record('t-home', 'testland', 'home'), record('c-colony', 'colony-office', 'colony')] },
      { file: 'data/imports/test-legal/assertions.yaml', value: [
        record('a-home', 'unit-a', 'unit-a-home', 'sovereign'),
        record('a-colony', 'unit-a', 'unit-a-colony', 'sovereign'),
        record('a-far', 'unit-a', 'unit-a-far', 'sovereign'),
      ] },
    ],
    crosswalks: [{ file: 'data/imports/test-legal/polity-crosswalk.yaml', value: [{ unit: 'unit-a', matches: [
      { polity: 'testland', kind: 'same-state' as const },
      { polity: 'colony-office', kind: 'dependency' as const, until: '1950' },
    ] }] }],
  };
  const files = new Map(buildPolityFiles(ds).map((f) => [f.id, f]));

  it('brings all of a same-state unit\'s records to our polity, marked with the unit', () => {
    const linked = files.get('testland')!.records.filter((r) => r.via);
    expect(linked.map((r) => [r.id, r.via, r.link])).toEqual([
      ['a-colony', 'unit-a', 'same-state'],
      ['a-far', 'unit-a', 'same-state'],
      ['a-home', 'unit-a', 'same-state'],
    ]);
  });

  it('brings only the records that share land with a dependency, within the link\'s period', () => {
    const linked = files.get('colony-office')!.records.filter((r) => r.via);
    expect(linked.map((r) => r.id)).toEqual(['a-colony']);
    expect(linked[0]).toMatchObject({ link: 'dependency', m1: civilToJdn(1950, 1, 1) });
    expect(linked[0].m0).toBeUndefined();
  });

  it('records the areas of territorial records', () => {
    expect(files.get('testland')!.records.find((r) => r.id === 't-home')!.km2).toBeGreaterThan(49_000);
  });

  it('gives a unit the Wikidata ID of the one polity it is the same state as, for the Wikipedia link', () => {
    // A made-up ID for Testland; unit-b is matched to two polities with different (made-up) IDs.
    const withIds: Dataset = {
      ...ds,
      polities: ds.polities.map((p) => ({ ...p, value: { ...p.value, ...({ testland: { wikidata: 'Q1234567' }, rival: { wikidata: 'Q7654321' } } as Record<string, object>)[p.value.id] } })),
      crosswalks: [{ file: 'data/imports/test-legal/polity-crosswalk.yaml', value: [
        { unit: 'unit-a', matches: [{ polity: 'testland', kind: 'same-state' as const }] },
        { unit: 'unit-b', matches: [{ polity: 'testland', kind: 'same-state' as const }, { polity: 'rival', kind: 'same-state' as const }] },
      ] }],
    };
    const byId = new Map(buildPolityFiles(withIds).map((f) => [f.id, f]));
    expect(byId.get('unit-a')!.wikidata).toBe('Q1234567');
    expect(byId.get('unit-b')!.wikidata).toBeUndefined();
    expect(byId.get('colony-office')!.wikidata).toBeUndefined();
  });
});

describe('reference test: Manchuria in 1937 (the real imported data)', () => {
  it('is contested: Manchukuo administered it per OpenHistoricalMap, China was sovereign per CShapes', () => {
    // Checked against the pinned imports on 2026-09-27, as the Phase 2 plan requires.
    const ds = loadDataset();
    const keep = new Set(['manchukuo', 'cshapes-710']);
    const subset = { ...ds, assertions: ds.assertions.map(({ file, value }) => ({ file, value: value.filter((a) => keep.has(a.subject)) })) };
    const day = civilToJdn(1937, 7, 1);
    const areas = buildContested(subset).filter((a) => a.s0 <= day && day < a.e0);
    expect(areas).toHaveLength(1);
    expect(areas[0]).toMatchObject({ facto: 'manchukuo', factoRelation: 'administers', jure: 'cshapes-710', jureRelation: 'sovereign' });
    expect(areas[0].km2).toBeGreaterThan(1_000_000);
    // Reading the whole worldwide dataset takes a few seconds, more than a test's usual 5.
  }, 60_000);
});

describe('land areas', () => {
  // Made-up shapes, land, and records (Testland), not real ones.
  const day = civilToJdn;
  const cite = [{ source: 'test-source', locator: 'p. 1' }];
  const rect = (x0: number, y0: number, x1: number, y1: number): [number, number][][] => [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]];
  const shape = (id: string, coordinates: number[][][]) => ({
    file: id,
    value: { type: 'Feature' as const, properties: { id, edge_precision: 'unknown' }, geometry: { type: 'Polygon' as const, coordinates } },
  });
  const record = (id: string, relation: 'administers' | 'occupies', shapeId: string, start: string, end: string) => ({
    id, relation, subject: 'testland', shape: shapeId, start, end, sources: cite,
  });
  const ds: Dataset = {
    sources: [], events: [], figures: [], coverage: [], crosswalks: [], problems: [],
    imports: ['data/imports/openhistoricalmap'],
    polities: [{ file: 'data/polities/testland.yaml', value: { id: 'testland', names: [{ text: 'Testland', lang: 'en', sources: cite }] } }],
    // "coastal" is half land, half sea; "cut" is all land and runs along the import area's east
    // edge; "copy" is drawn exactly over "coastal".
    shapes: [shape('coastal', rect(0, 0, 2, 2)), shape('cut', rect(8, 0, 10, 2)), shape('copy', rect(0, 0, 2, 2))],
    assertions: [
      {
        file: 'data/imports/openhistoricalmap/assertions.yaml',
        value: [
          record('coastal-1', 'administers', 'coastal', '1901', 'ongoing'),
          record('cut-1', 'administers', 'cut', '1901', '1911'),
          record('copy-1', 'administers', 'copy', '1905', '1906'),
          record('occupied-1', 'occupies', 'cut', '1920', '1921'),
        ],
      },
    ],
  };
  const land = new LandIndex([{ type: 'Polygon', coordinates: rect(0, 0, 1, 2) }, { type: 'Polygon', coordinates: rect(8, 0, 10, 2) }], [-10, -10, 20, 20]);
  const landSource = { source: 'land-test-source', locator: 'sheet 1' };
  const areas = computeAreas(ds, land, new Map([['data/imports/openhistoricalmap', [-10, -10, 10, 10]]]), landSource);
  const administered = areas.get('testland')!.filter((f) => f.relation === 'administers');
  const near = (a: number, b: number) => expect(Math.abs(a / b - 1)).toBeLessThan(0.005); // 3 significant figures

  it('measures everything a polity holds at once together, and splits time where that changes', () => {
    expect(administered.map((f) => f.records)).toEqual([
      ['coastal-1', 'cut-1'],
      ['coastal-1', 'copy-1', 'cut-1'],
      ['coastal-1', 'cut-1'],
      ['coastal-1'],
    ]);
    // Ends known only to the year ("1906", "1911") count until the last day of that year, as the
    // map shows them.
    expect(administered.map((f) => f.s0)).toEqual([day(1901, 1, 1), day(1905, 1, 1), day(1906, 12, 31), day(1911, 12, 31)]);
    near(administered[0].landKm2, areaKm2([rect(0, 0, 1, 2)]) + areaKm2([rect(8, 0, 10, 2)]));
    near(administered[3].landKm2, areaKm2([rect(0, 0, 1, 2)]));
    near(administered[3].totalKm2, areaKm2([rect(0, 0, 2, 2)]));
  });

  it('cuts a border at the coast only when it takes in coastal waters', () => {
    // "coastal" is half sea: its land part is the western half. "cut" is all land.
    const [polygon] = coastCut([rect(0, 0, 2, 2)], land)!;
    expect(areaKm2([polygon])).toBeCloseTo(areaKm2([rect(0, 0, 1, 2)]), -1);
    expect(coastCut([rect(8, 0, 10, 2)], land)).toBeUndefined();
  });

  it('builds the detailed coast: land, the sea around it, and the coastline without the area\'s edges', () => {
    const coast = buildCoast(land, [0, 0, 4, 4]);
    expect(coast.features.map((f) => f.properties?.kind)).toEqual(['land', 'sea', 'coast']);
    // The land inside the area is the strip 0–1°E, 0–2°N; only its east side is coastline (the
    // west and south sides lie on the area's edge).
    expect(coast.features[2].geometry).toEqual({ type: 'MultiLineString', coordinates: [[[1, 0], [1, 2], [0, 2]]] });
  });

  it('counts a shape drawn twice only once', () => {
    expect(administered[1].landKm2).toBe(administered[0].landKm2);
  });

  it('keeps each relation apart: an occupied area is not added to an administered one', () => {
    const occupied = areas.get('testland')!.filter((f) => f.relation === 'occupies');
    expect(occupied.map((f) => f.records)).toEqual([['occupied-1']]);
  });

  it('marks shapes cut at the edge of their import\'s area', () => {
    expect(administered[0].partOf).toBe('10°S–10°N, 10°W–10°E');
    expect(administered[3].partOf).toBeUndefined();
  });

  it('turns them into figures in the polity file, citing each source once and the land last', () => {
    const [file] = buildPolityFiles(ds, [], areas);
    const [first] = file.figures!;
    expect(first).toMatchObject({ metric: 'area-km2', basis: 'computed-from-shape', relation: 'administers', value: administered[0].landKm2 });
    expect(first.sources).toEqual([...cite, landSource]);
    expect(first.waterKm2).toBeGreaterThan(20_000); // the sea half of "coastal", left out of the land area
  });

  it('adds the area a source gives for its own shape (Cliopatria’s Area), per record and credited to it', () => {
    // A made-up Testland row with the area its (made-up) source gives, and no measurement of ours.
    const row = { id: 'row', relation: 'controls' as const, subject: 'testland', shape: 'given', start: '1901', end: '1903', sources: [{ source: 'cliopatria', locator: '"Testland", 1901 to 1902' }] };
    const withGiven: Dataset = {
      ...ds,
      assertions: [{ file: 'data/imports/cliopatria/assertions.yaml', value: [row] }],
      shapes: [{ file: 'given', value: { type: 'Feature', properties: { id: 'given', edge_precision: 'unknown', cliopatria_area_km2: 123_456 }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] } } }],
    };
    const [file] = buildPolityFiles(withGiven);
    expect(file.figures).toEqual([
      {
        metric: 'area-km2', value: 123_000, basis: 'computed-from-shape', computedBy: 'cliopatria',
        s0: civilToJdn(1901, 1, 1), e0: civilToJdn(1903, 1, 1), relation: 'controls', records: ['row'], sources: row.sources,
      },
    ]);
  });
});

describe('eras in the build', () => {
  // Made-up Testland features, not real borders.
  const feature = (props: Record<string, number>): GeoJSON.Feature => ({
    type: 'Feature',
    properties: props,
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
  });
  const collection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [feature({ s0: 0, e0: 10 }), feature({ s0: 10, e0: 20, e1: 30 }), feature({})],
  };

  it('keeps the features drawn at some point in an era, counting an uncertain end', () => {
    expect(forEra(collection, { start: 20, end: 25 }).features.map((f) => f.properties)).toEqual([{ s0: 10, e0: 20, e1: 30 }, {}]);
    expect(forEra(collection, { start: 0, end: 5 }).features).toHaveLength(2);
  });

  it('lists every layer\'s features, with their days and sizes, for choosing eras', () => {
    const items = eraItems({ key: 'test', dir: 'test-tiles', layer: 'test', collection, bounds: [0, 0, 1, 1], extraLayers: { lines: { collection, minZoom: 4 } } });
    expect(items).toHaveLength(6);
    expect(items[1]).toMatchObject({ set: 'test-tiles', s0: 10, e0: 30 });
    expect(items[2].s0).toBeLessThan(-1e7);
    expect(items[0].bytes).toBeGreaterThan(0);
  });
});

describe('splitAtCoverage', () => {
  // A made-up Testland record from 1890 to 1960, whose square is half inside the coverage box.
  const cite = [{ source: 'test-source', locator: 'p. 1' }];
  const file = 'data/imports/test-import/assertions.yaml';
  const ds: Dataset = {
    sources: [],
    polities: [{ file: 'a', value: { id: 'testland', names: [{ text: 'Testland', lang: 'en', sources: cite }] } }],
    assertions: [{ file, value: [{ id: 'r', relation: 'controls', subject: 'testland', shape: 'sq', start: '1890', end: '1960', sources: cite }] }],
    events: [],
    figures: [],
    coverage: [],
    shapes: [{ file: 'data/imports/test-import/shapes/sq.geojson', value: { type: 'Feature', properties: { id: 'sq', edge_precision: 'unknown' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [4, 0], [4, 2], [0, 2], [0, 0]]] } } }],
    crosswalks: [],
    imports: [],
    problems: [],
  };
  const scope = { box: [2, -1, 5, 5] as [number, number, number, number], d0: civilToJdn(1900, 1, 1), d1: civilToJdn(1951, 1, 1) };
  const include = (f: string) => f === file;
  const records = (d: Dataset) => d.assertions.flatMap(({ value }) => value).map((a) => [a.start, a.end, a.shape]);
  const shapeOf = (d: Dataset, id: string) => d.shapes.find((x) => x.value.properties.id === id)!.value.geometry.coordinates as number[][][][];

  it('keeps the years outside the coverage whole, and during it the part outside the box', () => {
    const out = splitAtCoverage(ds, include, [scope], 'outside');
    expect(records(out)).toEqual([
      ['1890', '1900-01-01', 'sq'],
      ['1951-01-01', '1960', 'sq'],
      ['1900-01-01', '1951-01-01', 'sq~out'],
    ]);
    const xs = shapeOf(out, 'sq~out').flat(2).map(([x]) => x);
    expect(Math.max(...xs)).toBe(2);
  });

  it('keeps only the part inside the box during the coverage, for the second opinion', () => {
    const inside = splitAtCoverage(ds, include, [scope], 'inside');
    expect(records(inside)).toEqual([['1900-01-01', '1951-01-01', 'sq~in']]);
    expect(Math.min(...shapeOf(inside, 'sq~in').flat(2).map(([x]) => x))).toBe(2);
  });

  it('keeps whole shapes only during the coverage, for the default map', () => {
    expect(records(splitAtCoverage(ds, include, [scope], 'during'))).toEqual([['1900-01-01', '1951-01-01', 'sq']]);
  });

  it('leaves dates as written when they fall inside the coverage', () => {
    const inYears: Dataset = { ...ds, assertions: [{ file, value: [{ ...ds.assertions[0].value[0], start: '1920', end: '1930' }] }] };
    expect(records(splitAtCoverage(inYears, include, [scope], 'during'))).toEqual([['1920', '1930', 'sq']]);
  });

  it('without coverage, keeps everything outside and nothing inside', () => {
    expect(splitAtCoverage(ds, include, [], 'outside')).toBe(ds);
    expect(records(splitAtCoverage(ds, include, [], 'inside'))).toEqual([]);
  });
});
