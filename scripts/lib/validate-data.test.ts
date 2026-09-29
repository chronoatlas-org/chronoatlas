// Validator tests use a small synthetic dataset ("Testland"). None of it describes real places.

import { describe, expect, it } from 'vitest';
import type { Dataset } from './data.ts';
import { checkGeometry, validateDataset } from './validate-data.ts';
import type { Assertion, Polity, ShapeFeature, Source } from './types.ts';

const square: number[][] = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]; // counter-clockwise

function dataset(overrides: Partial<Dataset> = {}): Dataset {
  const source: Source = { id: 'test-atlas', kind: 'dataset', title: 'Test Atlas', license: 'CC0-1.0' };
  const polity: Polity = {
    id: 'testland',
    names: [{ text: 'Testland', lang: 'en', sources: [{ source: 'test-atlas', locator: 'p. 1' }] }],
  };
  const shape: ShapeFeature = {
    type: 'Feature',
    properties: { id: 'testland-1900', edge_precision: 'approximate-line' },
    geometry: { type: 'Polygon', coordinates: [square] },
  };
  const assertion: Assertion = {
    id: 'testland-administers-1900',
    relation: 'administers',
    subject: 'testland',
    shape: 'testland-1900',
    start: '1900',
    end: '1910-06-01',
    sources: [{ source: 'test-atlas', locator: 'map 3' }],
  };
  return {
    sources: [{ file: 'data/sources/test-atlas.yaml', value: source }],
    polities: [{ file: 'data/polities/testland.yaml', value: polity }],
    assertions: [{ file: 'data/assertions/test.yaml', value: [assertion] }],
    events: [],
    figures: [],
    coverage: [],
    shapes: [{ file: 'data/shapes/testland-1900.geojson', value: shape }],
    crosswalks: [],
    imports: [],
    problems: [],
    ...overrides,
  };
}

const withAssertion = (changes: Partial<Assertion>) => {
  const ds = dataset();
  ds.assertions[0].value[0] = { ...ds.assertions[0].value[0], ...changes };
  return ds;
};
const messages = (ds: Dataset, fileExists = () => true) =>
  validateDataset(ds, { fileExists }).map((p) => p.message).join('\n');

describe('validateDataset', () => {
  it('keeps polity records that live in an import folder inside that folder', () => {
    const imported: Polity = {
      id: 'import-only-land',
      names: [{ text: 'Import-only land', lang: 'en', sources: [{ source: 'test-atlas', locator: 'p. 2' }] }],
    };
    const use = (file: string) => ({
      file,
      value: [{ ...dataset().assertions[0].value[0], id: `uses-${file.length}`, subject: 'import-only-land' }],
    });
    const base = dataset();
    const ds = dataset({
      polities: [...base.polities, { file: 'data/imports/test-import/polities/import-only-land.yaml', value: imported }],
      assertions: [...base.assertions, use('data/imports/test-import/assertions.yaml')],
    });
    expect(validateDataset(ds, { fileExists: () => true })).toEqual([]);
    ds.assertions.push(use('data/assertions/outside.yaml'));
    expect(messages(ds)).toMatch(/polity "import-only-land" belongs to data\/imports\/test-import and can only be used/);
  });

  it('checks crosswalks: units from their own folder, matches to our polities, sensible dates', () => {
    const unit: Polity = { id: 'test-unit-1', names: [{ text: 'Unit 1', lang: 'en', sources: [{ source: 'test-atlas', locator: 'p. 3' }] }] };
    const base = dataset();
    const ds = dataset({
      polities: [...base.polities, { file: 'data/imports/test-import/polities/test-unit-1.yaml', value: unit }],
      crosswalks: [
        {
          file: 'data/imports/test-import/polity-crosswalk.yaml',
          value: [{ unit: 'test-unit-1', matches: [{ polity: 'testland', kind: 'same-state', from: '1901', until: '1905' }] }],
        },
      ],
    });
    expect(validateDataset(ds, { fileExists: () => true })).toEqual([]);
    ds.crosswalks[0].value[0].matches.push(
      { polity: 'nowhere', kind: 'same-state' },
      { polity: 'test-unit-1', kind: 'dependency' },
      { polity: 'testland', kind: 'same-state', from: '1910', until: '1905' },
    );
    const text = messages(ds);
    expect(text).toMatch(/polity "nowhere" does not exist/);
    expect(text).toMatch(/polity "test-unit-1" should be one of ours/);
    expect(text).toMatch(/ends before it starts/);
  });

  it('lets a crosswalk match a baseline\'s polity (Cliopatria\'s), but not another import\'s', () => {
    const polity = (id: string): Polity => ({ id, names: [{ text: id, lang: 'en', sources: [{ source: 'test-atlas', locator: 'p. 3' }] }] });
    const base = dataset();
    const ds = dataset({
      polities: [
        ...base.polities,
        { file: 'data/imports/test-import/polities/test-unit-1.yaml', value: polity('test-unit-1') },
        { file: 'data/imports/cliopatria/polities/cliopatria-testland.yaml', value: polity('cliopatria-testland') },
        { file: 'data/imports/other-import/polities/other-unit.yaml', value: polity('other-unit') },
      ],
      crosswalks: [
        { file: 'data/imports/test-import/polity-crosswalk.yaml', value: [{ unit: 'test-unit-1', matches: [{ polity: 'cliopatria-testland', kind: 'same-state' }] }] },
      ],
    });
    expect(validateDataset(ds, { fileExists: () => true })).toEqual([]);
    ds.crosswalks[0].value[0].matches.push({ polity: 'other-unit', kind: 'same-state' });
    expect(messages(ds)).toMatch(/polity "other-unit" should be one of ours \(data\/polities\/\) or a baseline's/);
  });

  it('accepts a valid dataset', () => {
    expect(validateDataset(dataset(), { fileExists: () => true })).toEqual([]);
  });

  it('reports references to things that do not exist', () => {
    expect(messages(withAssertion({ subject: 'nowhere' }))).toMatch(/polity "nowhere" does not exist/);
    expect(messages(withAssertion({ shape: 'no-shape' }))).toMatch(/shape "no-shape" does not exist/);
    expect(messages(withAssertion({ sources: [{ source: 'rumour', locator: 'x' }] }))).toMatch(
      /source "rumour" does not exist/,
    );
  });

  it('requires at least one source with a locator', () => {
    expect(messages(withAssertion({ sources: [] }))).toMatch(/must NOT have fewer than 1 items/);
  });

  it('requires a shape for territorial relations', () => {
    expect(messages(withAssertion({ shape: undefined }))).toMatch(/must have required property 'shape'/);
  });

  it('reports invalid dates and ranges that end before they start', () => {
    expect(messages(withAssertion({ start: '1900-13' }))).toMatch(/month 13 does not exist/);
    expect(messages(withAssertion({ start: '1920', end: '1910' }))).toMatch(/ends \(1910\) before it starts/);
  });

  it('accepts "ongoing" and "unknown" as ends', () => {
    expect(messages(withAssertion({ end: 'ongoing' }))).toBe('');
    expect(messages(withAssertion({ end: 'unknown' }))).toBe('');
  });

  it('reports duplicate IDs', () => {
    const ds = dataset();
    ds.assertions[0].value.push({ ...ds.assertions[0].value[0] });
    expect(messages(ds)).toMatch(/assertion ID "testland-administers-1900" is already used/);
  });

  it('requires file names to match IDs', () => {
    const ds = dataset();
    ds.polities[0].file = 'data/polities/wrong-name.yaml';
    expect(messages(ds)).toMatch(/should be named testland.yaml/);
  });

  it('requires a license for datasets', () => {
    const ds = dataset();
    delete ds.sources[0].value.license;
    expect(messages(ds)).toMatch(/must have required property 'license'/);
  });

  it('requires import folders to have a license, readme, and manifest', () => {
    const ds = dataset({ imports: ['data/imports/test'] });
    const result = messages(ds, () => false);
    expect(result).toMatch(/missing LICENSE.md/);
    expect(result).toMatch(/missing manifest.json/);
  });
});

describe('checkGeometry', () => {
  it('accepts a valid polygon', () => {
    expect(checkGeometry({ type: 'Polygon', coordinates: [square] })).toEqual([]);
  });

  it('reports unclosed rings, bad coordinates, and wrong orientation', () => {
    expect(checkGeometry({ type: 'Polygon', coordinates: [square.slice(0, 4).concat([[0, 0.5]])] })).toContain(
      'polygon 0 ring 0 is not closed',
    );
    expect(checkGeometry({ type: 'Polygon', coordinates: [[[0, 0], [200, 0], [1, 1], [0, 0]]] })[0]).toMatch(
      /not a valid \[longitude, latitude\]/,
    );
    expect(checkGeometry({ type: 'Polygon', coordinates: [[...square].reverse()] })[0]).toMatch(
      /should run counter-clockwise/,
    );
  });
});
