import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDataset } from './data.ts';
import type { Dataset } from './data.ts';
import {
  code,
  compareDatasets,
  compareOverTime,
  fitComment,
  hasChanges,
  manifestChanges,
  mapFilesTouched,
  plain,
  renderSummary,
  sameValue,
  SUMMARY_MARKER,
} from './summary.ts';
import type { Assertion } from './types.ts';

// Made-up polities, sources, and shapes (Testland), not real ones.
const cite = [{ source: 'test-source', locator: 'p. 1' }];

function dataset(parts: Partial<Dataset> = {}): Dataset {
  return {
    sources: [{ file: 'data/sources/test-source.yaml', value: { id: 'test-source', kind: 'book', title: 'A Test Atlas', license: 'CC0-1.0' } }],
    polities: [
      { file: 'data/polities/testland.yaml', value: { id: 'testland', names: [{ text: 'Testland', lang: 'en', sources: cite }] } },
      { file: 'data/polities/otherland.yaml', value: { id: 'otherland', names: [{ text: 'Otherland', lang: 'en', sources: cite }] } },
    ],
    assertions: [],
    events: [],
    figures: [],
    coverage: [],
    shapes: [],
    crosswalks: [],
    imports: [],
    problems: [],
    ...parts,
  };
}

const record = (over: Partial<Assertion> = {}): Assertion => ({
  id: 'testland-1901',
  relation: 'administers',
  subject: 'testland',
  shape: 'square',
  start: '1901',
  end: '1902-03-03',
  sources: cite,
  ...over,
});

const square = (size: number) => ({
  file: 'data/shapes/square.geojson',
  value: {
    type: 'Feature' as const,
    properties: { id: 'square', edge_precision: 'unknown' },
    geometry: { type: 'Polygon' as const, coordinates: [[[0, 0], [size, 0], [size, size], [0, size], [0, 0]]] },
  },
});

describe('loadDataset from another folder', () => {
  it('names files from the folder holding that copy of data/, as for the repository', () => {
    const dir = mkdtempSync(join(tmpdir(), 'summary-test-'));
    try {
      mkdirSync(join(dir, 'data', 'sources'), { recursive: true });
      writeFileSync(join(dir, 'data', 'sources', 'test-source.yaml'), 'id: test-source\nkind: book\ntitle: A Test Atlas\n');
      const ds = loadDataset(join(dir, 'data'));
      expect(ds.sources.map((s) => s.file)).toEqual(['data/sources/test-source.yaml']);
      expect(ds.root).toBe(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('sameValue', () => {
  it('ignores key order and keys set to undefined', () => {
    expect(sameValue({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(sameValue({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(sameValue({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(sameValue({ a: 1 }, { a: '1' })).toBe(false);
  });
});

describe('compareDatasets', () => {
  const base = dataset({
    assertions: [{ file: 'data/assertions/testland.yaml', value: [record(), record({ id: 'gone', start: '1890', end: '1895' })] }],
    shapes: [square(1)],
    crosswalks: [
      {
        file: 'data/imports/test-import/polity-crosswalk.yaml',
        value: [{ unit: 'test-unit', matches: [{ polity: 'testland', kind: 'same-state', why: 'Made up.' }] }],
      },
    ],
  });
  const head = dataset({
    assertions: [{ file: 'data/assertions/testland.yaml', value: [record({ end: '1902-04' }), record({ id: 'new', start: '1903', end: 'ongoing' })] }],
    shapes: [square(2)],
    crosswalks: [
      {
        file: 'data/imports/test-import/polity-crosswalk.yaml',
        value: [{ unit: 'test-unit', matches: [{ polity: 'testland', kind: 'same-state', why: 'Made up, with a better reason.' }] }],
      },
    ],
  });
  const files = {
    base: new Map([
      ['data/assertions/testland.yaml', 'a'],
      ['data/imports/test-import/LICENSE.md', 'x'],
      ['data/README.md', 'r'],
    ]),
    head: new Map([
      ['data/assertions/testland.yaml', 'b'],
      ['data/imports/test-import/LICENSE.md', 'y'],
      ['data/imports/test-import/manifest.json', 'm'],
    ]),
  };
  const changes = compareDatasets(base, head, files);

  it('finds records added, removed, and changed, by ID', () => {
    expect(changes.assertions.map((c) => [c.kind, c.id])).toEqual([
      ['changed', 'testland-1901'],
      ['added', 'new'],
      ['removed', 'gone'],
    ]);
    expect(changes.shapes.map((c) => c.kind)).toEqual(['changed']);
    expect(changes.polities).toEqual([]);
  });

  it('matches a crosswalk link by what it joins, so a new reason is a change, not a new link', () => {
    expect(changes.crosswalks.map((c) => [c.kind, c.after?.why])).toEqual([['changed', 'Made up, with a better reason.']]);
  });

  it('lists changed files that hold no records, and leaves out the ones that do', () => {
    expect(changes.otherFiles).toEqual([
      { kind: 'removed', path: 'data/README.md' },
      { kind: 'changed', path: 'data/imports/test-import/LICENSE.md' },
      { kind: 'added', path: 'data/imports/test-import/manifest.json' },
    ]);
  });

  it('knows which files can move contested areas and land areas', () => {
    expect(mapFilesTouched(changes)).toEqual([
      'data/assertions/testland.yaml',
      'data/imports/test-import/polity-crosswalk.yaml',
      'data/shapes/square.geojson',
    ]);
  });

  it('finds nothing when the copies are the same', () => {
    expect(hasChanges(compareDatasets(base, base, { base: files.base, head: files.base }))).toBe(false);
  });
});

describe('compareOverTime', () => {
  it('reports the stretches where a value differs, adding up values that apply together', () => {
    const before = [{ key: 'testland\totherland', s0: 0, e0: 100, km2: 1000 }];
    const after = [
      { key: 'testland\totherland', s0: 0, e0: 100, km2: 1000 },
      { key: 'testland\totherland', s0: 50, e0: 80, km2: 500 },
      { key: 'otherland\ttestland', s0: 10, e0: 20, km2: 2000 },
    ];
    expect(compareOverTime(before, after)).toEqual([
      { key: 'otherland\ttestland', s0: 10, e0: 20, before: 0, after: 2000 },
      { key: 'testland\totherland', s0: 50, e0: 80, before: 1000, after: 1500 },
    ]);
  });

  it('joins back-to-back stretches with the same change, and ignores differences lost in rounding', () => {
    const before = [
      { key: 'k', s0: 0, e0: 10, km2: 1000 },
      { key: 'k', s0: 10, e0: 20, km2: 1000 },
      { key: 'k', s0: 20, e0: 30, km2: 123_456 },
    ];
    const after = [
      { key: 'k', s0: 0, e0: 20, km2: 2000 },
      { key: 'k', s0: 20, e0: 30, km2: 123_444 },
    ];
    expect(compareOverTime(before, after)).toEqual([{ key: 'k', s0: 0, e0: 20, before: 1000, after: 2000 }]);
  });
});

describe('plain and code', () => {
  it('shows text as written, without links, images, HTML, or mentions', () => {
    const text = plain('<b>x</b> [a](https://example.com) ![i](y) @someone `z`');
    expect(text).not.toMatch(/(^|[^\\])[<[\]`]/);
    expect(text).toContain('@​someone');
  });

  it('keeps text to one line and a length', () => {
    expect(plain('a\n\nb')).toBe('a b');
    expect(plain('x'.repeat(50), 10)).toBe(`${'x'.repeat(9)}…`);
  });

  it('shows IDs as code, without backticks that would end it', () => {
    expect(code('a`b')).toBe('`a b`');
  });
});

describe('manifestChanges', () => {
  it('names the fields that changed, with before and after for simple values', () => {
    expect(manifestChanges({ version: '1', settings: { a: 1 }, same: 2 }, { version: '2', settings: { a: 2 }, same: 2, added: 'x' })).toEqual([
      '`added`: not set → `x`',
      '`settings`: changed',
      '`version`: `1` → `2`',
    ]);
  });
});

describe('renderSummary', () => {
  it('says so when nothing in data/ changed', () => {
    const ds = dataset();
    const text = renderSummary(ds, ds, compareDatasets(ds, ds));
    expect(text.startsWith(SUMMARY_MARKER)).toBe(true);
    expect(text).toContain('changes nothing in `data/`');
  });

  const base = dataset({
    assertions: [{ file: 'data/assertions/testland.yaml', value: [record()] }],
    events: [{ file: 'data/events/testland-treaty.yaml', value: { id: 'testland-treaty', title: 'Treaty of Testville', date: '1901-03', summary: 'Made up.', sources: cite } }],
  });
  const head = dataset({
    assertions: [
      { file: 'data/assertions/testland.yaml', value: [record({ end: '1902-04' }), record({ id: 'otherland-1903', subject: 'otherland', start: '1903-05-12', end: 'ongoing', sources: [{ source: 'test-source', locator: 'p. 2', note: 'Otherland’s own account' }] })] },
    ],
    events: [],
    polities: [
      { file: 'data/polities/testland.yaml', value: { id: 'testland', names: [{ text: 'Testland <img src=x>', lang: 'en', sources: cite }] } },
      { file: 'data/polities/otherland.yaml', value: { id: 'otherland', names: [{ text: 'Otherland', lang: 'en', sources: cite }] } },
    ],
  });
  const changes = compareDatasets(base, head, {
    base: new Map([['data/imports/test-import/LICENSE.md', 'x']]),
    head: new Map([['data/imports/test-import/LICENSE.md', 'y']]),
  });
  const text = renderSummary(base, head, changes, { problems: [], baseLabel: 'abc1234' });

  it('describes records in words, with how precise each date is', () => {
    expect(text).toContain('dates: 1901 (year only) – 3 March 1902 → 1901 (year only) – April 1902 (month only)');
    expect(text).toContain('**Added** `otherland-1903`: Otherland (`otherland`), Administered (de facto), 12 May 1903 onwards');
    expect(text).toContain('A Test Atlas, p. 2; note: “Otherland’s own account”');
  });

  it('flags what needs the maintainers: licenses and removed IDs', () => {
    expect(text).toContain('**A license file is changed:** `data/imports/test-import/LICENSE.md`');
    expect(text).toContain('**IDs removed:** `testland-treaty`');
  });

  it('escapes names written by the pull request', () => {
    expect(text).toContain('Testland \\<img src=x\\>');
    expect(text).not.toMatch(/[^\\]<img/);
  });

  it('reports the validator and the comparison point', () => {
    expect(text).toContain('✅');
    expect(text).toContain('`abc1234`');
  });

  it('cuts long sections short, counting the rest', () => {
    const many = dataset({
      assertions: [{ file: 'data/assertions/testland.yaml', value: Array.from({ length: 5 }, (_, i) => record({ id: `r${i}` })) }],
    });
    const short = renderSummary(dataset(), many, compareDatasets(dataset(), many), {}, { maxLines: 2, fullSummaryUrl: 'https://example.org/full' });
    expect(short).toContain('[…and 3 more in the full summary](https://example.org/full)');
    expect(short.match(/\*\*Added\*\*/g)).toHaveLength(2);
  });

  it('describes side effects over time, in days', () => {
    const side = renderSummary(base, head, changes, {
      side: {
        contested: [{ key: 'testland\totherland', s0: 2_415_386, e0: 2_415_751, before: 0, after: 1200 }],
        areas: [],
      },
    });
    expect(side).toContain('administered by Testland');
    expect(side).toContain('legally Otherland (`otherland`)\'s, 1 January 1901 – 1 January 1902: new, 1,200 km²');
    expect(side).toContain('**Land areas:** no change.');
  });
});

describe('fitComment', () => {
  it('leaves short summaries alone, and cuts long ones at a line with a pointer to the full one', () => {
    expect(fitComment('short', 100)).toBe('short');
    const long = Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n');
    const cut = fitComment(long, 300, 'https://example.org/full');
    expect(cut.length).toBeLessThanOrEqual(300);
    expect(cut).toContain('[Read the full summary](https://example.org/full)');
    expect(cut).toMatch(/line \d+\n\n\*\*This summary/);
  });
});
