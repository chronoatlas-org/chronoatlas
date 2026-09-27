# Data format

This is the reference for the files in `data/`. The exact rules are the JSON Schemas in
[`schemas/`](../schemas/); `npm run validate` checks every file against them, and against the
extra checks listed at the end. Read [CONTRIBUTING.md](../CONTRIBUTING.md) first for what counts as
a source.

## Conventions

- **IDs** are lowercase letters, digits, and hyphens (`manchukuo`, `ohm-r2885965`). Once
  published, an ID never changes and is never reused (see
  [architecture](architecture.md#permanent-ids)). A single-record file is named after its ID:
  `data/polities/manchukuo.yaml`.
- **Dates** are [EDTF](https://www.loc.gov/standards/datetime/):

  | Written | Means |
  |---|---|
  | `1937-07-07` | exact day |
  | `1937-07` | month |
  | `1932` | year |
  | `1932~` | approximate |
  | `1932?` | uncertain |
  | `193X` | the 1930s |
  | `-0220` | 221 BCE (year `0000` is 1 BCE) |

  Dates use the proleptic Gregorian calendar. If your source gives a date in another calendar,
  convert it and put the original wording in the citation's `note`.
- **`end`** means **the first day on which the statement no longer applied**, i.e. the date of
  the change. So `start: 1932` and `end: 1945-08-17` mean "from sometime in 1932 until the change
  on 17 August 1945". Use `ongoing` if it still applies, or `unknown` if the source doesn't say.
- **Citations** always pair a source ID with a **locator** that lets someone find the exact spot:
  a page, a map sheet, a table, a feature ID.

  ```yaml
  sources:
    - source: openhistoricalmap
      locator: relation 2885965, version 15
      note: optional — e.g. the original date wording
  ```

## Sources: `data/sources/<id>.yaml`

Who says it. Datasets and maps must state a `license`, because that decides what we may copy or
trace.

```yaml
id: openhistoricalmap
kind: dataset            # dataset | book | article | map | document | archive | website
title: OpenHistoricalMap
publisher: OpenHistoricalMap contributors
url: https://www.openhistoricalmap.org/
license: CC0-1.0 (public domain dedication)
attribution: Map data courtesy of the OpenHistoricalMap project, in the public domain unless otherwise noted.
```

## Polities: `data/polities/<id>.yaml`

Anything that can hold, claim, or govern territory. Names are listed with their language
(`und` = the local name, language not recorded), their dates, and their source. Rival names can
coexist; the site shows the one in the reader's language, plus the local name.

```yaml
id: manchukuo
wikidata: Q30623         # cross-reference only
names:
  - text: Manchukuo
    lang: en
    start: "1932"
    end: 1945-08-17
    sources:
      - source: openhistoricalmap
        locator: name tags on relation 2885965
```

## Assertions: `data/assertions/**/*.yaml` (a list per file)

The heart of the data: **"According to *source*, *subject* *relation* *shape* from *start* to
*end*."**

| `relation` | Meaning |
|---|---|
| `controls`, `administers` | De facto: who actually ran the area |
| `occupies` | De facto military occupation |
| `sovereign` | De jure: legally recognized owner (add `recognized_by` if the source says) |
| `claims` | A claim, recognized or not |
| `leased-to`, `protectorate-of`, `puppet-of` | A link to another polity (`object`) instead of a shape |

```yaml
- id: ohm-r2885965
  relation: administers
  subject: manchukuo
  shape: ohm-r2885965
  start: "1932"
  end: 1945-08-17
  sources:
    - source: openhistoricalmap
      locator: relation 2885965, version 15
```

Two sources that disagree are two assertions. We never merge or choose between them.

## Shapes: `data/shapes/<id>.geojson`

Geometry only: one GeoJSON Feature per file, a `Polygon` or `MultiPolygon` in
longitude/latitude. Required properties: `id` and `edge_precision` (`treaty-line`,
`approximate-line`, `frontier-zone`, or `unknown`). Outer rings run counter-clockwise, holes
clockwise.

**Most borders are drawn in OpenHistoricalMap and imported**, not added here. See
[architecture](architecture.md#where-borders-are-drawn).

## Events: `data/events/<id>.yaml`

```yaml
id: example-event
wikidata: Q0000000       # optional
title: Example event
date: 1901-05-12         # a date or an interval (1901-05/1901-09)
location:                # optional
  coordinates: [10.5, 20.25]   # [longitude, latitude]
  precision_km: 5
  sources: [{ source: some-source, locator: p. 12 }]
summary: >-
  Written in our own words from the cited sources. Never pasted from Wikipedia.
effects: [some-assertion-id]   # assertions this event started or ended
importance: 3            # 1–5: when it shows on the timeline
sources:
  - source: some-source
    locator: pp. 12–14
```

## Figures: `data/figures/**/*.yaml` (a list per file)

Sourced statistics. Give `value`, or `low` and `high` when the source gives a range. **`basis`
says what territory the number counts:** `polity-territory` (the polity's own territory at the
time), `present-day-borders` (a modern country's; name it in `basis_detail`), or
`computed-from-shape` (we calculated it; name the shape and method in `basis_detail`).

```yaml
- id: example-population-1935
  polity: example-polity
  metric: population     # population | area-km2 (extend in schemas/figure.schema.json)
  low: 30000000
  high: 34000000
  date: "1935"
  basis: polity-territory
  method: estimate
  sources:
    - source: some-source
      locator: table 4
```

## Coverage: `data/coverage/*.yaml` (a list per file)

Add coverage only when a source **itself claims** to be complete for a region and period. Inside
a source's coverage, land with no polity is shown as "no state (per source)"; everywhere else
it's "no data yet".

## Imports: `data/imports/<dataset>/`

Third-party data, converted to the formats above by a script in `scripts/`, under the dataset's
own license. Every import folder has a `LICENSE.md`, a `README.md`, and a `manifest.json`
recording exactly what was fetched, when, with checksums, and every decision made in
interpreting it. **Don't edit imported files by hand:** fix the problem upstream and re-import.

## What `npm run validate` checks

1. Every file matches its schema.
2. IDs are unique, and single-record files are named after their ID.
3. Every reference (polity, shape, source, assertion) exists.
4. Every date parses, and nothing ends before it starts.
5. Every shape is valid: closed rings, real coordinates, correct orientation.
6. Every import folder has its license, readme, and manifest.

The site's build (`npm run build-data`) refuses to run on invalid data, and pull requests are
checked automatically.

**Tip:** the free "YAML" extension for VS Code can check files as you type. Add this line at the
top of a file:
`# yaml-language-server: $schema=../../schemas/polity.schema.json`, adjusting the path so it
points at the matching schema.
