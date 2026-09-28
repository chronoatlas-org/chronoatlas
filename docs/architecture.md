# Architecture

Approved 2026-09-26. This is a living document: update it when a decision changes, and say why.

## Goals that shape the design

- **Every border and event is traceable to a source**, and reviewable as a plain-text change in a
  pull request.
- **Scrubbing the timeline feels smooth**, from millennia down to days.
- **Honest uncertainty:** date precision, border precision, "no state", and "no data" are all
  first-class.
- **Several sources side by side**, never silently merged. This also keeps differently licensed
  data apart.
- **Free and static:** GitHub Pages, with no servers, paid services, or API keys.
- **Starts regional (East Asia), grows worldwide** without redesign.

## Stack

| Piece | Choice | Why |
|---|---|---|
| Language | TypeScript | JavaScript with types, which catches mistakes before the code runs |
| Build tool | Vite | Fast local development server; bundles the site for GitHub Pages |
| Map | MapLibre GL JS | Open source, no API keys, and GPU-rendered. Supports dashed lines, fill patterns (hatching), and blurred lines (soft edges). OpenHistoricalMap uses it too. |
| UI panels | Preact (decided 2026-09-27), for the panels only; the map and timeline are plain TypeScript | About 4 KB compressed. Components describe what a panel shows for the current data, and Preact keeps the page in step, so there's no hand-written "find this element and update it" code. Its JSX is the same as React's, which most contributors know. See [phase-2-plan.md](phase-2-plan.md#should-we-adopt-a-ui-framework-for-the-panels). |
| Tests | Vitest | Works directly with Vite and TypeScript |
| Hosting | GitHub Pages, deployed by GitHub Actions | Free; deploys automatically on merge |

## How data flows

```
data/            human-edited YAML and GeoJSON, reviewed in pull requests
  │
  ├─ npm run validate    schema, valid geometry, sources present, dates parse, licenses known
  ├─ npm run build-data  converts to compact files: one set per source, plus a change index
  │
public/data/     generated (not committed)
  │
  └─ Vite build → GitHub Pages → browser (MapLibre map + timeline + panels)
```

### Folder layout

```
src/            site code (TypeScript)                                  [Phase 1]
scripts/        validate / import / build-data scripts                  [Phase 1]
data/           CC0, except data/imports/
  sources/      one YAML file per source
  polities/     one YAML file per polity
  shapes/       GeoJSON, one shape per file
  assertions/   YAML, grouped by region
  events/       YAML, one file per event
  figures/      YAML: sourced statistics (population, area, …), grouped by polity
  coverage/     YAML: where each source claims to be complete
  imports/<dataset>/   third-party data converted to our format: LICENSE + manifest + files
docs/           design documents
.github/        issue forms and workflows                               [Phase 1/4]
```

Everything derived from a third-party dataset, including its shapes and assertions, stays inside
that dataset's `imports/` folder, under its license. That makes each folder a clear license
boundary.

## Data model

The core idea is that **geometry is kept separate from meaning, and every piece of meaning is a
sourced assertion.**

| Entity | What it is | Key fields |
|---|---|---|
| **Source** | Who says it: a dataset, book, article, map, or archive | citation, URL/DOI/ISBN, license, version |
| **Polity** | Anything that can hold, claim, or govern territory: state, empire, colony, protectorate, leased territory, concession, puppet government, occupation authority, city-state, confederation | Wikidata ID, type, `names[]` (each with language, script, dates, source) |
| **Shape** | Geometry only | GeoJSON; edge precision (`treaty-line`, `approximate-line`, `frontier-zone`, `unknown`); where it came from |
| **Assertion** | "According to *source*, *polity* *relation* *shape* from *date* to *date*." | relation, subject, shape, start, end, `sources[]` (with locator), notes |
| **Event** | Something that happened at a date and place | Wikidata ID, date, location and its precision, summary (our words), `sources[]`, `effects[]` |
| **Figure** | A sourced number about a polity at a date: "According to *source*, *polity* had *metric* of *value* as of *date*." | polity, metric (population, area, GDP, …), value or `low`–`high` range, unit, date (EDTF), **basis**, method, `sources[]` |
| **Coverage** | "Source X is complete for region R during period P" | source, region, period |

**Assertion relations:**
- `controls`, `administers`: de facto
- `sovereign`: de jure, with `recognized_by`
- `claims`
- `occupies`, `leased_to`, `protectorate_of`
- `puppet_of`: links one polity to another

Every assertion needs at least one source with a locator.

**Events drive transitions:** an event's `effects` list names the assertions it starts or ends.
That's how clicking an event on the timeline can highlight the border changes that followed it.

**Figures (statistics)** follow the same rules as borders:
- **Every number has a source, a date, and a precision.** Ranges (`low`–`high`) are preferred
  where sources give them. When sources disagree, we show them side by side.
- **We never fill the gap between two estimates.** The panel shows the nearest estimate together
  with its date.
- **`basis` records what territory a number counts.** Many historical statistics datasets are
  organized by *today's* countries, and such numbers must not be attached to a historical polity
  as if they described its own territory. Values:
  - `polity-territory`: the polity's own territory at the time.
  - `present-day-borders`: a modern country's territory; say which one.
  - `computed-from-shape`: we calculated it from a specific shape, such as its area, or the
    population inside it from a gridded population dataset. The build computes `area-km2` this
    way for every polity on the default map: the land inside its borders (Natural Earth's 1:10m
    land), for each stretch of time in which the same records apply, counting overlapping records
    once and never adding different relations together.
- **Metric names are a fixed, documented list** (for example `population`, `area-km2`), so the
  same figure from different sources can be compared.

**No state vs. no data:**
- Inside a source's coverage, an area with no polity is shown as **"no state (per source)"**.
- Outside every source's coverage, it's **"no data yet"**.
- A source can also state explicitly that an area was stateless.

**Computed at build time:**
- **Contested** means claims conflict, or the controller differs from the legal sovereign. It's
  reserved for disputes in the world.
- **Sources differ** means two sources name different holders for the same place and day. That
  can come from detail, resolution, or dating rather than a dispute, so it's shown only in the
  compare view (Phase 3 decision 7).
- **Views:**
  - de facto (the default)
  - de jure (per a chosen source)
  - claims, as an overlay on either view, once claim records exist
  - compare sources

### Example (real, verified values)

```yaml
# data/imports/openhistoricalmap/assertions.yaml (imported; this record exists now)
- id: ohm-r2885965
  relation: administers          # de facto; the mapping is recorded in the import manifest
  subject: manchukuo             # Wikidata Q30623
  shape: ohm-r2885965
  start: "1932"                  # year precision, as OHM records it
  end: 1945-08-17                # the first day it no longer applied
  sources:
    - source: openhistoricalmap
      locator: relation 2885965, version 15

# data/imports/cshapes-2-0/assertions.yaml (imported 2026-09-27; this record exists now)
- id: cshapes-710-1921-03-13
  relation: sovereign            # de jure
  subject: cshapes-710           # China as CShapes identifies it; polity-crosswalk.yaml links it to our china
  shape: cshapes-710-1921-03-13
  start: 1921-03-13
  end: 1945-08-15                # CShapes gives the last day (1945-08-14); ours is the day after
  sources:
    - source: cshapes-2-0
      locator: gwcode 710, period 1921-03-13 to 1945-08-14
```

In 1937 both assertions cover Manchuria (checked against the imported shapes on 2026-09-27).
CShapes' codebook says it leaves out unrecognized territorial exchanges that were later reversed,
and gives Japan's occupation of Manchuria as its example. From Phase 2, step 9, the map will hatch
the area as contested, and the territory panel will show "administered by Manchukuo (per OHM) /
sovereign: China (per CShapes)".

## Dates

- **In files:** dates are written in [EDTF](https://www.loc.gov/standards/datetime/), the Library
  of Congress date format that became part of ISO 8601-2.

  | Written as | Means |
  |---|---|
  | `1937-07-07` | exact day |
  | `1937-07` | month |
  | `1932` | year |
  | `1932~` | approximate |
  | `1932?` | uncertain |
  | `1937-07/1937-09` | range |
  | `-0220` | 221 BCE (astronomical year numbering: year 0 = 1 BCE) |

- **Also supported:** unspecified digits (`193X` = the 1930s, `19XX`, `1985-04-XX`) and years
  beyond four digits (`Y-12000`). **Not supported yet:** seasons (`2001-21`), because EDTF level
  1 doesn't say which months or hemisphere a season means; use a month range such as
  `1938-03/1938-05` instead. Times of day aren't supported either.
- **Approximate (`~`) and uncertain (`?`)** are flags. They don't widen a date's range, because
  EDTF doesn't say by how much; the map shows them through styling instead.
- **Internally:** the date library (`src/dates/`) converts every date into a range of whole day
  numbers (Julian Day Numbers), from its earliest to its latest possible day. BCE dates and mixed
  precision become plain integers. We never use JavaScript's `Date` for historical dates.
- **Calendars:** dates are stored in the proleptic Gregorian calendar (the Gregorian calendar
  extended backwards). When a source gives a date in another calendar (Julian, Chinese lunar, a
  Japanese era year), the original wording is kept in the citation.
- **Between two sourced states,** the map shows the change as uncertain or in transition. It
  never animates a morph, because interpolating a border would mean inventing one.

## Rendering and smooth scrubbing

- **Vector tiles:** the build (`scripts/build-data.ts`, using `scripts/lib/tiles.ts`) cuts the
  borders into Mapbox Vector Tiles for zooms 0–7 and writes them as a plain folder,
  `public/data/tiles/<version>/{z}/{x}/{y}.pbf`.
  - The browser downloads only the tiles in view, simplified to that zoom.
  - `<version>` is a fingerprint of the data, so a browser never mixes cached tiles from two
    builds.
  - Empty tiles inside the data's bounds are still written, so no request ever returns 404.
  - Zoom 7 is the highest level with its own tiles (about 40 m per tile unit, finer than the
    data); MapLibre enlarges those tiles when you zoom in further.
  - The tools are pure Node.js (geojson-vt, vt-pbf), so the build runs on Windows, Mac, and
    Linux. We avoid PMTiles for now, because there are open reports of it loading unreliably
    on GitHub Pages.
- **Border lines apart from fills (Phase 3, step 3):** each tile set has two layers, the fills
  and the lines. The build writes each border's outline as lines without the straight cuts where
  an import's area ends, and without stretches more than 2 km from Natural Earth's land (the
  rings OpenHistoricalMap draws around islands). Borders that follow a coast are kept. The map
  draws every line from that layer, and the edge of the imported data as a dashed line of its
  own (`public/data/edges.json`). This adds about half again to each tile set: the opening
  view's default tiles went from about 0.28 to 0.43 MB.
- **Fills that stop at the coast (Phase 3, step 4):** from zoom 4, a border that takes in coastal
  waters (at least 1% of its area) is drawn as a faint tint, and its land part, cut with Natural
  Earth's 1:10m land and simplified like the imports (0.005°), is filled over it. The land parts
  are a third layer in the default tiles, only from zoom 4, so the opening view's download is
  unchanged. Up close, inside the imports' areas, the base map switches to Natural Earth's 1:10m
  land, sea, and coastline (`coast-tiles/`), so the coast matches the cut; outside them the
  1:50m base map stays. At lower zooms the coastal bands are under a pixel wide, and the fills
  are drawn whole, as before.
- **Change index:** the build lists every day on which some border starts, stops being
  uncertain, may have ended, or has certainly ended (`changes` in `public/data/tiles.json`). The map only updates when the date
  crosses one of those days (`src/map/changes.ts`, a binary search); between them it looks
  identical.
- **How the map filters by date:** the current date is stored in MapLibre's global state and
  used in the layers' `filter`. We measured the alternative of hiding inactive borders with a
  paint expression (opacity), and it was 4–5 times slower, so we use filters.
- **Growing worldwide:** the tiles can also be split by era when Cliopatria (158 MB) arrives.
- **Limits:** 100 MB per file in the repo; about 1 GB for the repo and for the published site;
  100 GB/month bandwidth (soft limit).

### Measured (Phase 1, step 7, 2026-09-27)

Measured in the Claude app's embedded browser at 1280×720, with frames driven at about 60 per
second, over the 1937 East Asia view (162 borders). Compare the columns rather than reading the
numbers as absolute speeds.

| | Before (one GeoJSON file) | After (vector tiles + change index) |
|---|---|---|
| Data downloaded for the opening view | 9.2 MB (3.1 MB compressed) | about 0.3 MB (6 tiles at zoom 3) |
| Time until borders appear (local server) | 1,317 ms | 63 ms |
| One map update after a date change (median) | 35 ms | 34 ms (about two frames) |
| Map updates while dragging day by day through 1937 | 365 | 3 (99.2% of steps skipped) |
| Map updates playing 1900–1950 at 1 month per second | 36,718 frames | 147 (99.6% skipped) |

**How it was measured, to repeat later:**
1. In a dev build, create a MapLibre map over that view.
2. Add the borders as a source with the date `filter`.
3. For 51 dates (1 July of each year 1900–1950), call `setGlobalStateProperty('day', …)` and
   time how long until the map's `idle` event.
4. Count skipped updates by running `segmentOf` over the change list for each step of a drag
   or of playback.

## The timeline

- **A fixed playhead:** a red line in the middle marks the selected day, and time slides beneath
  it. Zooming always keeps the selected day under the playhead, so you can zoom from 12,000 years
  down to single days without losing your place.
- **State:** a fractional day number (the position; the selected day is `Math.floor(position)`)
  and a zoom level (days per pixel). The range runs from 10,000 BCE to today.
- **Ticks** are chosen for the zoom level: days, then months, then years in steps up to 2,000.
  They fall on calendar boundaries: the 1st of the month, 1 January, and round BCE years such as
  "200 BCE". That logic lives in `src/timeline/scale.ts`, which contains no browser code and is
  covered by tests.
- **Input:**
  - Drag to move through time, click to jump, and scroll or pinch to zoom.
  - The track is an ARIA slider. Arrow keys step one tick unit, Page Up and Page Down take 10
    units, Home and End jump to the ends, `+` and `−` zoom, `[` and `]` jump between
    events, and Space plays or pauses.
- **Events** are marked along the top edge of the bar, from `public/data/events.json`.
  - **Shapes:** a diamond for a single day, and a bar when the date range is wide enough to
    see. Filled when the date is exact; hollow when it's approximate, uncertain, or has an open
    end. The difference is in the shape, not only the color.
  - **Importance** (1–5) decides the zoom level from which an event shows: only 5s beyond 1,000
    years across, and everything below 5 years.
  - **Picking an event:** click a marker, or press `[` and `]` to jump to the previous or next
    event. Either calls `onEventSelect(id)`.
  - **Screen readers** hear the events on the selected day after the date.
  - The logic is in `src/timeline/events.ts`, with tests.
- **Playback:** 1 day to 100 years per second. Grabbing the track pauses playback.
- **Output:** the component calls `onChange(day)` only when the selected day actually changes.
  The map will listen to it to filter historical layers. Drawing happens at most once per
  animation frame, on a `<canvas>`.

## Visual language (never color alone)

| Meaning | Style | Status |
|---|---|---|
| Boundary | solid line | built |
| Contested: administered by one state, legally recognized as another's (later also: conflicting claims) | magenta cross-hatch with a dashed edge, the word "Contested" on the map, a legend label, and a sentence in the panel | built (Phase 2, step 9; the word on the map, Phase 3 step 5) |
| No data yet | gray diagonal hatch, plus a legend label | built |
| Uncertain start (a date known only to the year, say) | lighter fill until the date is certain | built |
| Uncertain end | lighter fill from the first to the last day it could have ended, plus a note in the panel | built (Phase 3, step 2) |
| Possibly contested (one of the two records may not apply yet, or any more) | the contested cross-hatch and edge, fainter, plus "Possibly contested" in the panel | built (Phase 3, step 2) |
| A dependency, in the de jure view (colony, protectorate, or occupied) | lighter tint of the holding state's color, with dashed edges | built (Phase 2, step 9) |
| A second opinion (another source's borders) | dotted teal outlines, plus a legend label | built (Phase 2, step 10) |
| Sources differ (OpenHistoricalMap against Cliopatria, with the second opinion on over the default view) | teal dots with a thin teal edge, the words "Sources differ" on the map, a legend label, and a sentence in the panel | built (Phase 3, step 7) |
| Coastal waters, as the source draws them | a faint tint, no outline, from zoom 4 | built (Phase 3, step 4) |
| Edge of imported data | dashed gray line over land, plus a legend label (a label on the map comes with map text) | built (Phase 3, step 3) |
| Treaty or surveyed line, or precision unknown | solid line (the panel says which) | built |
| Approximate border | softened (blurred) line, plus a legend line and the panel's "Border line" | built (Phase 3, step 8); shown once a shape records it |
| Frontier zone | a wide soft band, plus a legend line and the panel's "Border line" (a label on the map comes with map text) | built (Phase 3, step 8); shown once a shape records it |
| Claim | a line with ticks on its inner side, plus a label | once claim records exist (Phase 3, step 9) |
| No state (per source) | light stipple, plus a label (kept free for this) | put off until a source gives it (Phase 3, decision 5) |

Every style is also explained in words in the territory panel. After a click on the map, the panel
also lists what each source records at that spot on that day, side by side ("What each source
says at the spot you clicked", Phase 3 step 6), including "No record here" for a source that has
nothing there. Motion effects, such as event
pulses, respect the browser's reduced-motion setting.

## URL and sharing

The view lives in the URL hash, so any moment can be shared as a link. Hash URLs work on static
hosting with no server. The logic is in `src/url/state.ts` and is covered by tests.

```
#d=1937-07-01&m=4.5/38.2/118.9&sel=testland&lang=ja
```

| Key | Meaning |
|---|---|
| `d` | Selected day, as EDTF (`-0220-03-15` for BCE). A month or year opens on its first day. Clamped to the timeline's range. |
| `m` | Map view: zoom/latitude/longitude (OpenStreetMap order). 2 decimals for zoom, 4 for coordinates. |
| `sel` | Selected territory, as a polity ID (permanent, so old links keep working). Opens the territory panel. Anything not shaped like an ID is ignored, and an ID that isn't in our data closes the panel and drops out of the address. |
| `ev` | Selected event, as an event ID, instead of `sel` (the panel shows one or the other). It opens the event in the panel, outlines its effects, and pulses its place. |
| `v` | `jure` for the borders as legally recognized (per CShapes); absent for the default, as administered (per OpenHistoricalMap). |
| `alt` | `cliopatria` to lay Cliopatria's borders over either view as dotted outlines (a second opinion). |
| `lang` | Interface language. Only present if chosen explicitly; otherwise the browser's languages are used. |

- **Updating the address:** it updates 300 ms after the view stops changing, with
  `history.replaceState`, so scrubbing doesn't flood the Back button (browsers also limit how
  often it may be called). The tab title shows the date.
- **Following edits:** editing the address, or going Back/Forward, fires `hashchange`, and the
  timeline and map follow.
- **Damaged links:** anything unreadable is ignored and the rest still applies.
- **Copy link:** the button opens the system share sheet on touch devices, and copies to the
  clipboard elsewhere. If copying isn't allowed, it says the link is in the address bar.
- **Selecting a territory** by clicking it adds a Back-button step (`pushState`), so Back closes
  the panel, or returns to the territory selected before. Closing the panel (its button or
  Escape) replaces the address instead, so it never sends a visitor who arrived by a shared link
  off the site.

## Names

Polity names are stored with language and script tags. Original-script names (for example
Chinese, Japanese, and Korean) are shown alongside English from the start.

## Permanent IDs

Every polity, event, source, and shape has an ID (a short lowercase slug, such as `manchukuo`).
**Once published, an ID never changes and is never reused,** because shared links and other data
refer to it. If something needs a new name, the old ID stays and its display names change. If two
entries turn out to be the same thing, one redirects to the other. Wikidata IDs are stored as
cross-references, not used as our IDs, because not everything has one and Wikidata sometimes
merges or deletes items.

## Where borders are drawn

New or corrected border lines are drawn in **OpenHistoricalMap (OHM)**, then imported. OHM's
editor shares each line between the neighbors on both sides, so one correction fixes both, and
OHM's community benefits too. This repo holds imported snapshots, plus the interpretation layered
on top: claims, recognition, contested status, events, and figures. Imported geometry is never
hand-edited here. A problem in an imported snapshot is fixed upstream and re-imported. `data/shapes/`
is only for geometry OHM can't hold, and each case is documented. How to trace a border in OHM so
that our import reads it is in the [tracing guide](tracing-guide.md).

## Translation (i18n)

- **All on-screen text goes through translation catalogs** (`src/i18n/`), with English first.
  Adding a language means translating one file, not hunting through the code. Translations are
  contributed and reviewed like any other change.
- **Date wording** (month names, "c.", "BCE", word order) also lives in the catalogs. Historical
  dates are never formatted with the browser's `Intl` date formatter, because it switches to the
  Julian calendar before 1582.
- **Map labels (Phase 3, step 5):**
  - All text on the map is drawn with fonts already on the visitor's device. The style has no
    `glyphs` address and no font files: MapLibre 6 draws each character with the browser's own
    fonts when none is supplied. Nothing is downloaded, and no third-party font is involved.
  - Territory names show the English name with the local name beneath, as the source gives them.
    Where a polity's name changes during a record, the build splits the label. Smaller
    territories' names appear only as the map zooms in.
  - Han characters on the map use one form for every language: unlike the panel, the map can't
    switch between Chinese and Japanese glyph forms by language.
  - Right-to-left scripts (Arabic, Hebrew, Persian) need MapLibre's RTL plugin, which will be
    added when those labels arrive.

## Hosting and growth

To stay within GitHub's free limits (about 1 GB for the repo, about 1 GB for the published site,
and 100 GB/month bandwidth as a soft limit):

- **Large third-party datasets are not committed.** The build downloads them from the URL in
  their manifest and verifies the checksum. A copy is kept as a GitHub release asset (up to 2 GB
  per file, not counted toward the repo size), so builds don't depend on the original host.
- **Published data is split by era and region,** so visitors download only what they're viewing.
- **GitHub Pages compresses our files automatically** (the land file goes from 1.26 MB to 422 KB).
- **The site is plain static files,** so it can move to another free static host without code
  changes if traffic ever outgrows GitHub Pages.

## Roadmap

- **Phase 0, setup:** repo, licenses, README, CONTRIBUTING, code of conduct, credits, CLAUDE.md,
  design docs.
- **Phase 1, map and timeline, live on GitHub Pages:**
  1. ✅ Vite + TypeScript + MapLibre with a Natural Earth base map.
  2. ✅ Automatic deployment to GitHub Pages, plus a build check on pull requests. This was moved
     up from step 7 so that every later step is visible online.
  3. ✅ A date library (EDTF → day numbers, BCE, precision) with tests, in `src/dates/`.
  4. ✅ The translation layer (`src/i18n/`) and the timeline (`src/timeline/`): zoom from
     millennia to days, drag, play/pause, speed, keyboard control.
  5. ✅ Data schema (including Figures) in `schemas/`, the validator, the build step, and a
     pinned import of OHM for East Asia 1900–1950 (162 boundaries, 62 polities), filtered by the
     timeline, with a click popup. Everywhere else shows "no data". The format is documented in
     `docs/data-format.md`.
  6. ✅ Shareable URLs (date, map view, language) with a Copy link button, and the phone layout:
     compact header, short speed labels, 44 px touch targets, safe areas for notches, and a
     landscape layout.
  7. ✅ Performance: vector tiles instead of one large file, and the change index, with before
     and after measurements (see [Measured](#measured-phase-1-step-7-2026-09-27)).
  8. ✅ Data checks in CI (`npm run validate` and `npm test` run on every push and pull
     request), issue forms for border corrections, missing events, and bugs
     (`.github/ISSUE_TEMPLATE/`), and a pull request template with the review checklist.
- **Phase 2, panel, events and transitions (the showcase begins), closed 2026-09-28.** The
  detailed plan is [phase-2-plan.md](phase-2-plan.md) (approved 2026-09-27), which lists the
  steps. Done:
  step 1 ✅ (panel foundation: Preact, a side panel replacing the popup, and `sel` in the
  address) and step 2 ✅ (one data file per polity; the panel shows names over time and every
  record, keeping control, sovereignty, and claims apart), and step 3 ✅ (phone bottom sheet;
  focus, Escape, and Back; every overlapping record reachable), and step 4 ✅ (the "Report a
  problem with this border" button), and step 5 ✅ (the events pipeline and timeline markers,
  tested with made-up events; there are no real events yet), and step 6 ✅ (the event panel, the
  pulse on the map, and dashed outlines of an event's effects), and step 7 ✅ ("Around this date":
  the events and border changes in the part of the timeline in view), and step 8 ✅ (the CShapes
  import, in its own folder, with the crosswalk), and step 9 ✅ (the de jure view, and contested
  areas computed at build time), and step 10 ✅ (Cliopatria as a second opinion, with a reviewed
  crosswalk), and step 11 ✅ (the first Figure: each territory's land area, computed from its
  borders and Natural Earth's coastline, with its method and sources), and step 12 ✅ (seven
  sourced events for Manchuria 1931–33, merged 2026-09-28; no map locations until a gazetteer is
  chosen). Step 13's guide is done
  ([tracing-guide.md](tracing-guide.md)); the first traced border is still to come, because
  people do the tracing in OpenHistoricalMap. The goals:
  - Territory panel with a "Figures" section (each number with its source and date) and a
    "Report a problem with this border" button.
  - Evaluate statistics datasets (coverage, basis, license) before importing any.
  - Events on the timeline, a pulse on the map, and transitions linked to events.
  - A "world around this date" panel.
  - CShapes (de jure) and Cliopatria (second opinion) layers.
  - First borders traced from public-domain maps (the guide is written; the tracing is next).
- **Phase 3, contested and uncertain borders:** the full visual language, soft edges, a
  compare-sources view, and "no state" vs "no data". Optionally, map coloring by a figure (for
  example population), keeping "no data" visually distinct. The detailed plan is
  [phase-3-plan.md](phase-3-plan.md) (approved 2026-09-28). It puts off "no state" and coloring
  by a figure, for lack of data, and adds a showcase data track for the work that waits on
  people. Done so far (all 2026-09-28): step 1 ✅ (the decisions), step 2 ✅ (uncertain end dates,
  and "possibly contested"), step 3 ✅ (border lines apart from fills, the edge of the imported
  data), step 4 ✅ (fills that stop at the coast, a detailed coastline up close), step 5 ✅ (words
  on the map, with the device's own fonts), step 6 ✅ (what each source says at a clicked spot),
  step 8 ✅ (approximate lines and frontier zones, shown once data has them), and step 10 ✅
  (tidying), and step 7 ✅ (where OpenHistoricalMap and Cliopatria name different holders, with
  the second opinion on). Phase 3 closed on 2026-09-28; step 9 (claims) moved to the showcase data
  track, and waits for the first claim records. It also includes:
  - **Fills that stop at the coast.** OpenHistoricalMap draws many borders a few kilometres out
    to sea to include coastal waters, often as a ring around each island. About 23% of the
    Empire of Japan's 1931–39 shape is sea, in bands 4–10 km wide. The map fills the whole shape,
    so the color runs past the coastline.
    - **The fix:** the build splits each shape into its land part and its coastal-waters part,
      using Natural Earth's land. The land part is filled as now. The coastal-waters part gets
      only a faint tint and no outline, and the legend says "Coastal waters, as the source draws
      them".
    - **Why not paint the sea over the fills,** which would be simpler: it would hide small
      islands missing from the base map's coastline, and in East Asia those are often the most
      disputed places.
    - **The base map** moves to Natural Earth's 1:10m coastline at close zooms, so the coast
      isn't blocky where the split is visible.
    - Coastal waters stay in the data; this only changes how they're drawn.
  - **A dashed "edge of imported data" line** where an import's area ends, instead of borders
    that stop in a straight line.
- **Phase 4, contribution pipeline** (detailed plan: [phase-4-plan.md](phase-4-plan.md), approved
  2026-09-28; Phase 3 closed the same day, with step 9, claims, moved to the showcase data track):
  - Refine the issue forms and pull request template from experience.
  - A bot comment summarizing each data change.
  - A reviewer guide. (The guide to tracing in OHM was written early, in Phase 2 step 13.)
- **Phase 5, worldwide:** Cliopatria as the global baseline with era-grouped tiles, more regions,
  and more UI translations (the translation system itself exists from Phase 1).

## Showcase: East Asia 1931–1945

1. **Manchuria, 1931–33:** proves the mechanics.
   - **Data:** Manchukuo from OHM, the de jure view from CShapes, and Cliopatria as a yearly
     second opinion.
   - **Gap:** OHM starts Manchukuo at "1932". The months after the Mukden incident show as "not
     yet sourced" until they're traced from sources.
2. **China, 1937–45:** the flagship.
   - Trace Japanese-controlled areas from dated public-domain maps, contribute the geometry to
     OHM, and import it back.
   - Expect month or season precision at best.
   - If the sources describe control of cities and rail lines rather than whole areas, show that
     as partial or zone control.
3. **Southeast Asia and the Pacific, Dec 1941–45:** OHM already has day-level changes here, so
   this stage is mostly importing and writing events.
