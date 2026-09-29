# Phase 5 plan: the worldwide map

> **Status: approved by the maintainers on 2026-09-28**, with the recommended answer to every
> question. The decisions are recorded in [section 12](#12-decisions-2026-09-28).

Phases 1–4 built the map, taught it to say how sure it is, and made it safe for others to improve.
All of that works on one region: East Asia, 1900–1950. Phase 5 makes the map **worldwide, from
3400 BCE to today**, without redesigning it:

- **everywhere outside OpenHistoricalMap's area, Cliopatria fills the map** as the baseline, on
  its own layer, credited and described as what it is (yearly, approximate borders);
- **the tiles are split into eras**, so a visitor downloads only the borders of the period they're
  looking at, and the opening view stays small;
- **CShapes' legal borders cover the world** from 1886 to 2019, as today's de jure view does for
  East Asia;
- **contested areas grow region by region,** as the maintainers review which units are the same
  state, never matched automatically;
- **more languages** can be added, each reviewed by a native speaker.

The East Asia showcase stays as it is: OpenHistoricalMap remains the main map where it has data,
and Cliopatria stays its dotted second opinion there.

Sections:

1. [Where Phase 4 ends](#1-where-phase-4-ends)
2. [What we measured](#2-what-we-measured)
3. [The baseline: Cliopatria outside OpenHistoricalMap's area](#3-the-baseline-cliopatria-outside-openhistoricalmaps-area)
4. [Tiles split by era](#4-tiles-split-by-era)
5. [Legal borders worldwide (CShapes)](#5-legal-borders-worldwide-cshapes)
6. [Contested areas, region by region](#6-contested-areas-region-by-region)
7. [Panel, figures, coasts, and "Around this date"](#7-panel-figures-coasts-and-around-this-date)
8. [More regions from OpenHistoricalMap, and more languages](#8-more-regions-from-openhistoricalmap-and-more-languages)
9. [Sizes, limits, and speed](#9-sizes-limits-and-speed)
10. [Order of work](#10-order-of-work)
11. [Questions for the maintainers](#11-questions-for-the-maintainers)
12. [Decisions (2026-09-28)](#12-decisions-2026-09-28)

---

## 1. Where Phase 4 ends

- **Steps 1–8 are done and live** (decisions 1–6 in
  [phase-4-plan.md](phase-4-plan.md#10-decisions-2026-09-28)): the data-change summary on every
  pull request, the re-import button, the refined forms, the reviewer guide, and `CODEOWNERS`.
- **Tested for real:** the button opened a genuine re-import,
  [pull request 24](https://github.com/chronoatlas-org/chronoatlas/pull/24), whose summary found
  two OpenHistoricalMap boundaries for the State of Burma that overlap from 1 to 18 August 1943.
  Reviewing it is a data decision for the maintainers, on the data track.
- **Left for the maintainers:** the rulesets for `main` and the labels
  ([reviewing.md, section 7](reviewing.md#7-repository-settings-done-once)).
- **Recommendation: close Phase 4.**

## 2. What we measured

Measured on 2026-09-28 from the pinned Cliopatria file (v0.2.0, the one already imported,
checksum verified), processed exactly as the import processes it (simplified to about 500 m,
coordinates to 4 decimals), worldwide and for every year:

| | Worldwide, all years | Imported today (East Asia, 1900–1950) |
|---|---|---|
| Rows (a polity's shape for a run of years) | 12,043 | 286 |
| Polities | 1,540 | 46 |
| Shape files | 51 MB | 2.7 MB |
| Years | 3400 BCE – 2024 | 1900 – 1950 |

- **At any one year, few rows apply:** at most about 190 polities and 0.6 MB of shapes (2000),
  and 87 in 1937. What makes a worldwide map heavy isn't one year but many years in one file.
- **Rows are short:** half of them last 8 years or less, and 90% last 48 years or less.
- **Test tiles** for one worldwide era (1900–1950, 883 rows, the densest): 14.7 MB of fills,
  built in 2 seconds. With the border lines and labels, a worldwide era comes to roughly 25 MB.
  **70–95% of the tiles were empty** (sea, or places with no row in that era).
- **Eras with a size budget:** if each era may hold at most about 3 MB of shapes, the whole
  dataset splits into **about 22 eras**: centuries in antiquity, a few decades around 1700, and
  10–20 years each in the twentieth century. A row that spans two eras is copied into both,
  which adds only about 10%.
- **Not measured yet:** OpenHistoricalMap's coverage outside East Asia (its query service is
  blocked from the environment this plan was written in; a workflow can run the query, see
  section 8), CShapes worldwide (its whole GeoJSON is 25 MB before simplifying), and speed on a
  phone with worldwide tiles. Step 2 measures these before anything is built for real.

## 3. The baseline: Cliopatria outside OpenHistoricalMap's area

**Today** the map is filled only where OpenHistoricalMap was imported (East Asia, 1900–1950), and
everything else says "no data yet". Cliopatria is a dotted second opinion over it.

**Proposed:**

- **Outside OpenHistoricalMap's area and years,** Cliopatria's borders are **filled**, as the
  baseline. Inside, nothing changes: OpenHistoricalMap is the main map, and Cliopatria is its
  second opinion (Phase 3 decision 15).
- **Its own layer and tile set,** as every source has (the approved rule that each source ships as
  its own layer, and never mixed in one file with another license). The build cuts Cliopatria's
  shapes at the edge of OpenHistoricalMap's area for the years it covers, and draws them under
  OpenHistoricalMap's layer.
- **Said plainly:** the legend gets an entry such as "Borders outside East Asia 1900–1950:
  Cliopatria (yearly, approximate)", and the panel names Cliopatria as the source of every such
  record, as it already does for the second opinion. Cliopatria's credit (CC BY 4.0) shows
  whenever its borders are on screen, which is now by default.
- **The dashed edge line** keeps its place, reworded "Edge of OpenHistoricalMap's area": beyond
  it, the map continues from another source instead of stopping.
- **Dates:** Cliopatria gives whole years, so each row starts and ends "(year only)" and is drawn
  lighter in its first and last year, as every uncertain date is (Phase 3 decision 2). When one
  row of a polity follows another, both are drawn lighter during the year of change, which is
  honest: the source doesn't say when in that year it happened. Step 2 checks that this reads
  well on a full map.
- **How precise its lines are:** Cliopatria's authors say most borders without a treaty are
  "necessarily approximate", at about 40 km² resolution, but its rows don't say which ones are
  treaty lines. *Recommended (question 5):* keep `unknown` on each shape, as every import does
  now, and say at the source level, in the legend and the panel, that Cliopatria's borders are
  approximate and yearly.
- **"No state" vs "no data":** Cliopatria maps polities, not stateless areas, and doesn't claim
  to be complete. So places with no row stay "no data yet" (Phase 3 decision 5 still holds).

## 4. Tiles split by era

A worldwide tile set covering every year at once would put thousands of overlapping rows in each
low-zoom tile. So:

- **Eras:** the build splits time into eras, each holding at most a set amount of shapes (about
  3 MB, measured in step 2), and writes one tile set per era. A row that spans two eras goes into
  both. Era boundaries follow the data, so there are few old, long eras and many short recent
  ones. The eras are listed in `tiles.json` with their days and versions.
- **Switching:** the map loads the era of the selected day, and changes tile set only when the
  day crosses into another era, as it now updates only on change days. Each era has its own
  change index.
- **Empty tiles aren't written.** Today the build writes an empty tile for every place inside the
  data's area, so no request fails. Worldwide that would be hundreds of thousands of files, most
  of them empty. Each era's `tiles.json` entry lists the area it covers, and step 2 checks how
  MapLibre treats a missing tile (it should draw nothing). If it misbehaves, the fallback is one
  PMTiles file per era, which we avoided in Phase 1 because of reports of unreliable loading on
  GitHub Pages; that would be re-checked first.
- **All tile sets split the same way:** the default map, the baseline, the second opinion, the
  legal borders, contested areas, and "sources differ", so switching eras swaps them together.

## 5. Legal borders worldwide (CShapes)

- **The whole of CShapes 2.0,** 1886–2019 and worldwide, becomes the de jure view, still in its
  own folder under CC BY-NC-SA 4.0 and still off the default map (the approved license rules
  don't change).
- **The same processing and interpretation decisions** as the East Asia import (colonies,
  protectorates, and mandates as `sovereign` by the owner; occupied units as `occupies`; dates as
  given). Its manifest records every row it skips, as now.
- **Still waiting:** the authors' reply about the R package's columns (Phase 2 decision 14). If
  they object, the worldwide import is redone without those columns, as the East Asia one would be.

## 6. Contested areas, region by region

"Contested" means administered by one state and legally recognized as another's. It needs to know
which units in two sources are the same state, and the approved rule is that this is decided by a
reviewed crosswalk, never automatically (Cliopatria even carries some wrong Wikidata IDs).
Worldwide, from 1886 to 2019, that's hundreds of units in each source, too many to review at once.

**Proposed:**

- **A suggestion tool** (`npm run suggest-crosswalk -- --region <area> --years <range>`) lists
  likely matches between Cliopatria's units and CShapes' units: shared Wikidata IDs, similar
  names, and how much their shapes overlap in the same years. It writes suggestions only; nothing
  enters a crosswalk until a maintainer has reviewed it in a pull request (the data-change summary
  then shows what each accepted link does to contested areas).
- **Region by region,** in an order the maintainers choose (question 6). The map computes
  contested areas only where the crosswalk has been reviewed for those years. Elsewhere, the
  panel says "Not yet checked against legal borders here", so silence isn't read as "not
  contested".
- **The same size threshold as today** (disagreements under 10,000 km² aren't contested, because
  CShapes doesn't code changes that small), plus the width rule from "sources differ", because
  Cliopatria's lines wander a few kilometres.

## 7. Panel, figures, coasts, and "Around this date"

- **Polity files:** about 1,500 more (one per Cliopatria polity), each downloaded only when opened,
  as now.
- **Land areas:** today the build measures the land inside every default-map polity. For the
  baseline that would mean measuring about 12,000 rows worldwide on every build. *Recommended
  (question 7):* show Cliopatria's own `Area` for its rows, as a figure from Cliopatria
  (`computed-from-shape`, credited to Cliopatria), and keep our own measurement for
  OpenHistoricalMap's polities. The panel already says who measured a figure and how.
- **A link to Wikipedia** (added 2026-09-29, at the maintainers' request): the territory panel links
  each polity to its Wikipedia article, so a visitor can read about it at once. It's a link only:
  nothing from Wikipedia is copied into our data (its text is CC BY-SA), and the panel says it
  leads to an outside site, written by others, that this map hasn't checked (ground rule 4).
  - **Where the link comes from** (never guessed from a name):
    - **Our polities** (from OpenHistoricalMap; 48 of 62 have one): their Wikidata ID, a
      cross-reference as the approved decisions allow. The link is Wikidata's "go to the linked
      article" address (`https://www.wikidata.org/wiki/Special:GoToLinkedPage/enwiki/Q…`), which
      opens the article in the visitor's language when there is one (and later in the site's
      language), and Wikidata's page when there's none. No API, key, or server is involved.
    - **Cliopatria's polities matched to ours** in its reviewed crosswalk: our polity's link.
    - **Cliopatria's other polities** (about 1,500): Cliopatria's own `Wikipedia` column, the
      article its authors cite for the row, with "Wikipedia article, as Cliopatria links it". Not
      its Wikidata IDs, which are wrong for some rows: its "Republic of China" carries Q148 (the
      People's Republic), while its Wikipedia column correctly names "Republic of China
      (1912-1949)". This is question 14.
    - **CShapes' units:** through its crosswalk only (CShapes has no Wikipedia column).
    - **No link** where none of these gives one: the panel just doesn't show it.
  - **Where it goes:** in the polity files (one field per polity), not in the tiles, so it costs
    nothing on the map. Events that have a Wikidata ID can get the same link later.
- **"Around this date":** `changes.json` is split by era, like the tiles, and loaded for the era in
  view.
- **Coasts:** the detailed coast (Natural Earth 1:10m, from zoom 4) extends worldwide. Whether
  Cliopatria's fills also stop at the coast, as OpenHistoricalMap's do, depends on how long that
  takes to compute for 12,000 rows; step 2 measures it. If it's too slow, the baseline is drawn
  whole, with the coastline over it.
- **Labels:** one per row, as now. Step 2 measures their cost worldwide.
- **The timeline** already runs from 10,000 BCE to today, and the opening view stays East Asia in
  mid-1937.

## 8. More regions from OpenHistoricalMap, and more languages

**More regions.** OpenHistoricalMap's coverage outside East Asia is uneven, and we haven't
measured it. Proposed:

- a one-off workflow run counts OpenHistoricalMap's country-level boundaries by region and period,
  and the result goes into [data-sources.md](data-sources.md);
- the maintainers pick the next region from that (question 8);
- adding a region means widening the import's area in its settings, a change the data-change
  summary and the review cover like any other. The re-import button then keeps it current.

**More languages.** The translation system exists since Phase 1: all on-screen text is in
`src/i18n/en.ts`. For others to add a language safely:

- **a translator's guide** (`docs/translating.md`): how to add a catalog, test it, and open a pull
  request;
- **a glossary of sensitive terms** ("contested", "occupied", "administered", "sovereign",
  "sources differ", "puppet state"), with what each means on this map, because a loaded
  translation would take sides;
- **a test** that every catalog has every key, and that placeholders match;
- **no machine-translated catalog is published** without review by a native speaker
  (question 9). Chinese (simplified and traditional), Japanese, and Korean are the natural first
  candidates for the East Asia showcase, as volunteers come forward.

## 9. Sizes, limits, and speed

Estimates, to be confirmed in step 2:

| | Today | Estimated after Phase 5 | GitHub's limit |
|---|---|---|---|
| Repository | about 26 MB of data | about 100 MB (Cliopatria 51 MB, CShapes worldwide perhaps 15 MB) | about 1 GB |
| Published site | 50 MB | about 300–450 MB (22 eras of each tile set, without empty tiles) | 1 GB |
| Opening view download | 0.43 MB | under 1 MB (target) | — |
| Build on GitHub | about 2 minutes | under 15 minutes (target) | 6 hours per job |

- **Speed targets:** the opening view downloads under 1 MB, changing the date inside an era takes
  no longer than now, and crossing into another era takes under a second on a phone. Step 2 checks
  them on a real phone (as Phase 3 did), before the rest is built.
- **Largest file:** no single file gets near 100 MB (the largest Cliopatria shape is about 0.1 MB).

## 10. Order of work

Small steps, each committed, explained, and checked, as in Phases 3 and 4. Each step gives its
recommended effort setting.

| Step | What | Effort |
|---|---|---|
| 1 | Record Phase 4 as closed and the Phase 5 decisions (docs only). | low |
| 2 | **Measure before building:** a scratch worldwide build (not published) of Cliopatria and CShapes with era tiles, to confirm the sizes, how MapLibre treats missing tiles, build time, the coast cut's cost, and speed on a phone. The results may change the numbers in this plan; any change is brought back to the maintainers. | high |
| 3 | **Import Cliopatria worldwide, all years,** and **CShapes worldwide** (settings changes to the two imports, reviewed with the data-change summary). | medium |
| 4 | **Era tile sets** in the build, and era switching on the map, with a change index per era. | high |
| 5 | **The baseline layer:** Cliopatria filled outside OpenHistoricalMap's area, with its legend entry, credit, panel wording, and the reworded edge line. | high |
| 6 | **Panel and data files by era:** "Around this date" per era, Cliopatria's own areas as figures, polity files, and the link to Wikipedia (section 7; added 2026-09-29). | medium |
| 7 | **Coasts worldwide,** as measured in step 2. | medium |
| 8 | **Contested areas region by region:** the suggestion tool, "Not yet checked against legal borders here", and the first region's crosswalk review (with the maintainers). | high |
| 9 | **OpenHistoricalMap's coverage by region** (a one-off workflow run), recorded in data-sources.md. | low |
| 10 | **Translations:** the translator's guide, the glossary, and the catalog test. | medium |
| 11 | **Tidy:** a phone check of the finished map, docs, README, and roadmap. | medium |

Every step keeps `npm run typecheck`, `npm test`, `npm run validate`, and the build passing.

### Progress

- **Step 1 (2026-09-28): done.** The plan was approved with every recommendation (section 12),
  and Phase 4 was closed.
- **Step 2 (2026-09-28): measured.** A scratch worldwide build, never published: the real
  Cliopatria import run for the whole world and every year, then the real build, then its layer
  split into eras. What it found:

  | | Result |
  |---|---|
  | Worldwide import | 18 seconds; 12,043 rows as 1,539 polities; **57 MB committed** (51.5 MB of shapes, 4.9 MB of records) |
  | Whole build, unchanged, no eras | 5 minutes 15 seconds, 3 GB of memory; 1,621 polity files (9 MB); 1,218 change days |
  | Cliopatria as one tile set for every year | 222 MB; largest tile 6.2 MB; **4.6 MB** for the East Asia opening view, **8.7 MB** for the whole world at zoom 1 |
  | Split into eras, 3 MB budget (fills and lines) | **39 eras**, 297 MB in 133,000 tiles (empty ones not written); largest tile 370 KB; at most **0.51 MB** for the whole world at zoom 1, 0.27 MB for East Asia at zoom 3 |
  | Split into eras, 6 MB budget | **18 eras**, 254 MB in 65,000 tiles; largest tile 665 KB; at most **0.72 MB** for the whole world at zoom 1 |
  | Building the layer, labels, tiles | 18 s for fills and lines, 15 s for a label on every row, 18–23 s for all the era tiles |
  | Missing tiles | MapLibre draws nothing for a tile that isn't there ("404 not found"), with no error and no effect on the tiles that are there. So empty tiles needn't be written, and PMTiles isn't needed. (The local development server answers a missing file with the page itself, so it needs a setting to answer "not found" under `/data/`.) |
  | Speed (software rendering, 1280×720) | Changing the date in the busiest era (the 1940s) took 97 ms over East Asia and 88 ms over Europe, against 87 ms with today's tiles; 145 ms with the whole world in view. A real phone check stays in step 11. |
  | Coast cut for Cliopatria | **Too costly:** about 77 minutes per build, and the cut shapes are 3.6 times bigger (about 173 MB more). Worldwide coast tiles themselves are small (9.3 MB). |

  - **Found in the data:** 1,038 rows are dated BCE, and their IDs as the import writes them now
    (`…--0041`) break the ID rule; one pair of rows shares a name and a first year, and so an ID.
  - **Blocked from this environment:** CShapes' download server and OpenHistoricalMap's query
    service. Cliopatria downloads fine.
  - **Changes these call for,** put to the maintainers before step 3 and approved (decisions
    10–13):
    1. **Era budget:** 6 MB rather than 3 MB. Both keep every view under 1 MB; 6 MB halves the
       number of files the site publishes (65,000 rather than 133,000 for the baseline alone),
       which keeps deployments quick.
    2. **The coast:** Cliopatria's fills aren't cut at the coast. From zoom 4 the detailed sea and
       coastline are drawn over them, so they still stop at the coast. Unlike
       OpenHistoricalMap's borders, Cliopatria's (at about 40 km² resolution) don't record small
       islands, so the sea can't hide any. OpenHistoricalMap keeps its exact cut.
    3. **IDs for BCE rows:** `cliopatria-<name>-41bce` (for a row starting in 41 BCE), and `-2`
       added to the second of two rows with the same name and first year. Existing IDs don't
       change.
    4. **Importing CShapes worldwide:** its server is blocked here, so the import has to run on
       GitHub's machines or a maintainer's computer. Recommended: let the re-import workflow also
       re-run the pinned CShapes and Cliopatria imports (a choice of dataset). The pins still
       hold: the import stops if a file's checksum changes, and a new version is still reviewed
       by hand. It opens a pull request with the summary, like an OpenHistoricalMap re-import.
- **Step 3 (2026-09-28): done; the data waits for steps 4–5.** The imports' settings cover the
  world (Cliopatria 3400 BCE–2024, CShapes 1886–2019), and the button re-runs any pinned import
  ("Re-import a dataset", decision 13). It opened two pull requests, which pass the data checks:
  - **Cliopatria,** [pull request 33](https://github.com/chronoatlas-org/chronoatlas/pull/33):
    11,757 records and 1,493 polities added, 190 shapes changed (no longer cut to East Asia).
  - **CShapes,** [pull request 36](https://github.com/chronoatlas-org/chronoatlas/pull/36): 638
    records and 167 polities added, 38 shapes changed; no change to contested areas.
  - **They're merged only with steps 4–5,** because until then the site would publish one tile set
    for every year (the 4.6–8.7 MB views measured in step 2), and would draw the "edge of imported
    data" line along the world's edge. If `main`'s data changes before then, they're regenerated
    with the button rather than merged.
  - **Found on the way, and fixed first:**
    - **The summary was too slow** for a whole new dataset (hours): each border is now measured
      once, and a change of more than 300 borders gets land and movement for the first 300 only.
    - **Unreviewed contested areas:** with CShapes worldwide, Cambodia after 1953 (among others)
      read as contested, only because nobody had linked it to CShapes' "Cambodia (Kampuchea)".
      Contested areas are now computed only inside the places and years listed in a hand-written
      `crosswalk-reviewed.yaml` (decision 6); CShapes' lists East Asia 1900–1950. Today's 102
      contested areas are unchanged.
    - **Owners CShapes doesn't name:** Danzig (1919–1938) and West Irian (1962–63) list their
      owners as codes 0 and 1, which aren't states in CShapes. Rather than guess, the import skips
      them and lists them in its manifest. *For the maintainers:* CShapes' codebook (on its
      download page, which this environment can't reach) should say what the two codes stand for;
      then they can be imported with the right owner.
    - **Cliopatria's year 0:** its data has one (six rows end in year 0, followed by rows starting
      in year 1), so its years are astronomical, as ours are: -40 is 41 BCE. Recorded in its
      manifest.
- **Step 4 (2026-09-28): done.** Every tile set that changes with time (the default map, the
  legal borders, the second opinion, contested areas, "sources differ") is written once per era,
  and the map switches era when the day crosses into another.
  - **The build:** `chooseEras` (`scripts/lib/eras.ts`) picks the eras from all those tile sets
    together, at about 6 MB each (decision 10); each set's tiles are written per era with their own
    version (eras with the same contents share tiles), empty tiles are left out, and `tiles.json`
    lists the eras with each one's change index.
  - **The map:** `HistoricalLayers` loads the era of the day shown and, when the day crosses into
    another, points every time-bearing layer at that era's tiles (`setTiles`); the layers and styles
    stay as they are. "What each source says here" reads the current era's tiles.
  - **Today's data** (East Asia): 6 eras (before 1910, each decade to 1950, and after), because the
    default map's fills, lines, labels, and land parts together pass 6 MB. So a visitor at 1937 now
    downloads only the 1930s. 16,470 tiles (47 MB, against 35.7 MB before: a record that spans
    several decades is in each one's tiles); the build still takes about 2 minutes.
  - **Worldwide** (the scratch copy with all of Cliopatria): 19 eras, 105,056 tiles, 305 MB, built in
    7 minutes. In the browser, the map switched eras correctly from 200 BCE to 1960, drew
    Cliopatria's borders in each, and the spot lookup worked, with no errors.
  - **Found on the way:** Vite's development server watched every file in `public/`, and with the
    worldwide tiles it hit the system's limit and stopped; it now ignores `public/data/`. It also
    answered a missing tile with the page itself; it now answers "404" for a missing tile, as
    GitHub Pages does.
- **Step 5 (2026-09-29): done.** Cliopatria fills the map outside OpenHistoricalMap's area and
  years, as the baseline (decision 2).
  - **The build** cuts Cliopatria's records at the edge of OpenHistoricalMap's coverage (East
    Asia, 1900–1950): outside is the baseline (`baseline-tiles`, filled and named), inside the
    second opinion (dotted, as before). Records keep their IDs, so the panel finds them.
    OpenHistoricalMap is drawn only during its import's years, where it is complete; before, it
    held a few records that started earlier or ran later, beside nothing else. "Sources differ" is
    cut to the coverage, and the "edge" line is drawn only for OpenHistoricalMap, reworded "Edge of
    OpenHistoricalMap's area".
  - **The map** draws the baseline under the default map, with the same colors, softer lines, and
    names; from zoom 4 the detailed sea is drawn over it, so its fills stop at the coast (decision
    11). It's clickable, part of the administered view, credited "Borders elsewhere: Cliopatria
    (CC BY 4.0)", and has its own legend entry. "What each source says here" reads it as
    Cliopatria. The intro now says where each source's borders come from.
  - **Colors, fixed on the way:** neighbours were picked by overlapping bounding boxes, and
    worldwide the boxes of large empires overlap nearly everything, so the eight colors ran out and
    France and Italy came out alike in 1914. Polities now count as neighbours when their shapes
    have corners in a shared half-degree square at the same time; the build takes no longer.
  - **Checked** on the worldwide scratch copy (20 eras, 325 MB, 7.5 minutes): the whole world in
    1937 and 1500, Europe's coasts in 1914 up close, the edge at 73°E, a click on the French Third
    Republic (its Cliopatria record in the panel), with no errors. Thin hatched slivers remain along
    some coasts where Cliopatria's coarse shapes stop short of Natural Earth's coastline: land
    Cliopatria doesn't cover, shown as "no data".
  - **The data then on main** (before the worldwide imports were merged) got a baseline of 25
    pieces: the years before 1900 and after 1950 of the East Asian Cliopatria rows.
- **Worldwide data merged (2026-09-29).** Both imports were regenerated on the current main with
  the "Re-import a dataset" button, checked (build, validation, and the posted summary), and
  brought onto main by fast-forward; the earlier pull requests, made from an older main, were
  closed.
  - **Cliopatria** (pull request 40): 11,757 records, 11,757 borders, and 1,493 polities added,
    all inside `data/imports/cliopatria/` (91 MB on disk, no file near GitHub's 100 MB limit).
    Its only effect on today's views: 10 "sources differ" entries in 1900 grew or appeared,
    because Cliopatria's rows that end "in 1900" (year only) now exist and stay on the map until
    the last day they could have ended (Phase 3 decision 1), beside the rows starting in 1900.
  - **CShapes** (pull request 41): 638 records, 638 borders, and 167 polities added, 38 borders
    changed (no longer cut to East Asia), all inside `data/imports/cshapes-2-0/` (16 MB).
    Contested areas are unchanged, because they're computed only where the crosswalk has been
    reviewed (East Asia 1900–1950). 4 of CShapes' 710 rows are skipped and listed in its
    manifest: Danzig and West Irian (owner codes 0 and 1, above) and Morocco 1904–1912, for
    which CShapes gives no status.
  - **Colors, fixed after the maintainer's first look (2026-09-29):** a state had two colors, one
    on each side of the edge of OpenHistoricalMap's area (Russia green inside, pink outside),
    because each layer colored its own polities. The default map and the baseline are now colored
    together, and a Cliopatria polity matched to ours in the reviewed crosswalk takes its color.
    And a lighter fill (a record whose start or end is known only to the month or year, which is
    every Cliopatria row near its ends) let the "no data" hatch show through, as if there were no
    data; plain land now lies under it, so it's just paler.
  - **Both builds and the deploy passed;** the live site is worldwide. The Cliopatria deploy took
    about 7 minutes, most of it the data build.

- **Step 6 (2026-09-29): done.** The panel and its files, for the worldwide map.
  - **"Around this date"** read one `changes.json` of every change: 5.8 MB with the whole world.
    Now each era has its own file (`changes/<version>.json`, listed in `tiles.json`), with the
    names of the polities it lists, so no polity file is loaded just for a name. The panel loads
    the era holding the day first, and the others only while they could hold one of the 25
    nearest changes. A record that ends the day the next one of the same polity begins is listed
    once, as "Border changes", instead of an end and a start: that halves Cliopatria's yearly rows
    (14,934 entries instead of 25,457; 4.3 MB over 23 eras, the largest 0.47 MB).
  - **Cliopatria's areas** (decision 7): each of its records shows the area Cliopatria gives for
    its shape, as "Area" (not "Land area"), credited to Cliopatria and marked as not measured by
    us.
  - **The link to Wikipedia** (section 7): "Read about it on Wikipedia", for our polities with a
    Wikidata ID and the import units matched to one of them as the same state, marked as an
    outside site the map hasn't checked. Cliopatria's other polities wait on question 14.
  - **Checked** in the browser on the worldwide build: "Around this date" in 1500 loads one file
    (no polity files); Ming in 1500 shows Cliopatria's area; Qing's link opens its article; no
    errors. A file that fails to load now says so, rather than "no border changes".

- **Question 14 (2026-09-29): approved.** Cliopatria's polities without an ID of ours link the
  English article Cliopatria's `Wikipedia` column gives for the row in effect (12 of its 1,540
  polities give different articles for different periods, such as "Tibet" and "History of
  Tibet"), and the panel says it's the article Cliopatria links.
- **Step 7 (2026-09-29): done.** Coasts worldwide.
  - **The coast tiles** already covered the world: they follow the imports' areas, and
    Cliopatria's has been the world since step 3.
  - **What was left** showed up close: Cliopatria's border lines ran along every coast a few
    kilometres from the real coastline (which the map draws anyway), making a rough second
    coastline, and straight lines from island to island. About a quarter of its outline length
    (measured on a twelfth of its shapes) is coastal or at sea.
  - **Now** Cliopatria's layers draw only land borders: stretches on land more than 3 km from the
    coast, tested in pieces of about 2 km (`COARSE_INLAND_KM`). A first version wrote a point for
    every piece tested, which made the lines bigger and the eras more (52); points now go only
    where a line starts or stops. OpenHistoricalMap's precise lines are unchanged.
  - **The build** now writes 24 eras, 189,579 tiles, 392.8 MB (404.7 MB before), in about 8½
    minutes, as before.
  - **Left as they are:** thin "no data" slivers where Cliopatria's coarse shapes stop short of
    the real coast. That land isn't inside any of its borders, so it's shown as a gap rather than
    filled in (ground rule 1).
  - **Checked** in the browser: Italy in 117 CE, the Aegean in 1500, Europe in 1914, the edge at
    73°E in 1937, all without errors.

- **Step 8 (2026-09-29): the tools are done; Europe 1914–1950 waits for the maintainers' review.**
  - **Contested areas where Cliopatria is the map:** the build now also compares Cliopatria's
    baseline with CShapes, inside the reviewed places and years, with the 10 km width rule of
    "sources differ". A crosswalk may now link CShapes' units to Cliopatria's polities (the
    validator allows that, and nothing else outside our own). Today's 109 contested areas (East
    Asia) are unchanged; the map credits Cliopatria once it contributes any.
  - **"Not yet checked against legal borders here"** (or "only in part") in the panel, for a
    territory outside the reviewed places and years, in years CShapes covers.
  - **The suggestion tool** (`npm run suggest-crosswalk`) samples 1 July of each year. A first
    version suggested any polity lying inside a unit, which would have linked the Independent
    State of Croatia to Yugoslavia and Georgia to Russia, and missed Nazi Germany. It now suggests
    a link only where a polity held most of one of its main holder's units, and lists breakaway
    states, rival governments, occupation zones, and occupiers of other states' units under "Look
    closer", never suggested. `--trial` lists the contested areas every suggestion would leave.
  - **Reviewed (2026-09-29):** the maintainers accepted all 75 suggested links, linked Vichy
    France and the Russian Republic from "Look closer", and marked Europe (25°W–45°E, 34–72°N)
    1914–1944 as reviewed; 1945–1950 waits, because Cliopatria's gaps after the war would show as
    false disputes. The build now shows 612 contested areas there (721 in all, with East Asia's
    109): the two World Wars' occupations, the Soviet annexations of 1940, the Independent State
    of Croatia, Georgia, Armenia. Areas that the edge of a reviewed scope cuts below 10,000 km² are
    dropped, as CShapes codes nothing that small. Contested areas now take about 2 minutes of the
    build.
  - **Europe 1914–1950** ([the report](crosswalk-review/europe-1914-1950.md), about 3 minutes):
    75 suggested links, 45 to look at closer, and a trial of 124 contested pairs (the two World
    Wars' occupations, the Soviet annexations of 1940, Vichy France, the Independent State of
    Croatia; and some that point at a gap, such as Cliopatria having no postwar Poland).

- **Step 9 (2026-09-29): done.** `npm run measure-ohm` counts OpenHistoricalMap's country-level
  boundaries by region and period; its server can't be reached from this environment, so a
  read-only "Measure OpenHistoricalMap's coverage" button runs it on GitHub. First run: 4,112
  boundaries, Europe with the most in every period (1,338 in all, 256 in 1900–1949; East Asia
  has 546). The table is in [data-sources.md](data-sources.md#openhistoricalmap); choosing the
  next region is the maintainers' call (decision 8).
- **Step 10 (2026-09-29): done.** [The translator's guide](translating.md), with the glossary of
  words that need the most care, and a test (`catalogProblems`) that every catalog has every
  English key, no unknown keys, nothing empty, and the same placeholders. CONTRIBUTING.md links
  it. No other language yet: each waits for a volunteer and a second native speaker's review.

- **Step 11 (2026-09-29): done.** A phone check (390×844, touch) of the finished map, and the docs.
  - **Downloads:** the opening view takes 2.33 MB uncompressed, 2.2 MB of it the base map's
    land, rivers, and lakes; GitHub Pages compresses those (the land file from 1.26 MB to 422 KB,
    measured in Phase 1), so about 0.85 MB, under the 1 MB target. Crossing into another era
    (1937 → 222 BCE) took 3.1 seconds in the test browser (software drawing, no graphics chip)
    and 0.4 MB.
  - **Fixed:** a long date ("10 August 222 BCE") was cut off beside the timeline's buttons; on
    phones it now wraps onto a second line. Long event titles in "Around this date" were
    centred; they're left-aligned now.
  - **Checked:** the bottom sheet, "Around this date", the map key, and the date switch, with no
    errors and no sideways scrolling.
  - **Docs:** README (the status), the roadmap in architecture.md, data-sources.md (both
    imports worldwide, and OpenHistoricalMap's coverage), CLAUDE.md.
  - **Noticed, left for later:** Cliopatria's source line for ancient rows quotes its own years
    ("-222 to -219"), beside dates written "223 BCE". It's what the source's fields say, but a
    change to the import could write "223 BCE to 220 BCE" instead.

**Proposed: close Phase 5** (question 15, for the maintainers). Every step is done. Europe after
1944 and more contested regions, the next OpenHistoricalMap region, and translations continue as
data work, as the showcase data track did after Phase 3.

**Left out of Phase 5:**

- **A search box** ("find a territory"): useful on a world map, but it needs a name index for
  every era. It's worth its own small plan once the worldwide map exists.
- **"No state" areas and coloring the map by a figure,** still waiting for data (Phase 3 decisions
  5 and 9).
- **Events outside East Asia:** events come from contributors, with sources, through the forms.
- **Cliopatria's `RELATION` rows** (which polity was part of which), still skipped (Phase 2).

## 11. Questions for the maintainers

Each has a recommended answer. "Approve with the recommendations" answers them all.

1. **Close Phase 4,** with the repository settings and pull request 24 left to the maintainers?
   *Recommended: yes.*
2. **Cliopatria as the filled baseline** outside OpenHistoricalMap's area and years, on its own
   layer, with OpenHistoricalMap still the main map where it has data? *Recommended: yes.*
3. **All of Cliopatria at once** (3400 BCE–2024, worldwide, about 51 MB in the repository), rather
   than a window of years first? *Recommended: yes; the measurements show it's small enough.*
4. **CShapes worldwide** (1886–2019) as the de jure view, still isolated under its license?
   *Recommended: yes.*
5. **Cliopatria's line precision:** keep `unknown` on each shape and describe its borders as
   approximate and yearly at the source level, rather than marking every line approximate?
   *Recommended: yes.*
6. **Contested areas region by region,** from reviewed crosswalks with a suggestion tool, and
   "Not yet checked against legal borders here" elsewhere? And which region first?
   *Recommended: yes; first Europe 1914–1950, where the two World Wars give the best test of
   occupations and legal sovereignty after East Asia.*
7. **Land areas for Cliopatria's polities** from Cliopatria's own `Area`, credited to it, instead of
   measuring 12,000 rows on every build? *Recommended: yes.*
8. **More regions from OpenHistoricalMap:** measure its coverage first, then choose? *Recommended:
   yes.*
9. **Translations** only with a native speaker's review, starting with whichever of Chinese,
   Japanese, and Korean has a volunteer first? *Recommended: yes.*

Added on 2026-09-29, with the link to Wikipedia the maintainers asked for (section 7):

14. **Wikipedia links for Cliopatria's unmatched polities** (about 1,500): use Cliopatria's own
    `Wikipedia` column, worded "as Cliopatria links it", or show links only where our own reviewed
    IDs give one (our polities, and Cliopatria's 26 matched ones)? *Recommended: use Cliopatria's
    column, attributed.* **Approved 2026-09-29 (decision 14).** Its authors chose each article for the row, and it's right where its
    Wikidata IDs are wrong (the "Republic of China" rows); without it, the world outside East Asia
    would have almost no links. A wrong one is reported like any other problem, and fixed by a
    note in the build until Cliopatria fixes it upstream.

Added on 2026-09-29, after step 11:

15. **Close Phase 5,** with Europe after 1944, more contested regions, the next OpenHistoricalMap
    region (decision 8), and translations continuing as data work? *Recommended: yes.*

(Questions 10–13 were step 2's proposed changes, decided as decisions 10–13 below.)

## 12. Decisions (2026-09-28)

The maintainers approved the plan with the recommended answer to each question.

1. **Phase 4 is closed.** The repository settings and pull request 24 (the first re-import) are
   left to the maintainers.
2. **Cliopatria is the filled baseline** outside OpenHistoricalMap's area and years, on its own
   layer and credited. OpenHistoricalMap stays the main map where it has data, with Cliopatria as
   its second opinion there.
3. **All of Cliopatria at once:** 3400 BCE–2024, worldwide.
4. **CShapes worldwide** (1886–2019) is the de jure view, still isolated under CC BY-NC-SA 4.0.
5. **Cliopatria's line precision** stays `unknown` on each shape; the legend and panel describe
   its borders as approximate and yearly.
6. **Contested areas region by region,** from crosswalks the maintainers review, helped by a
   suggestion tool; "Not yet checked against legal borders here" elsewhere. **Europe 1914–1950
   first.**
7. **Land areas for Cliopatria's polities** come from Cliopatria's own `Area`, credited to it;
   OpenHistoricalMap's polities keep our own measurement.
8. **More OpenHistoricalMap regions:** its coverage is measured first, then the maintainers choose.
9. **Translations** are published only after a native speaker's review, starting with whichever of
   Chinese, Japanese, or Korean has a volunteer first.

Decided later on 2026-09-28, after step 2's measurements (the maintainers approved its four
proposed changes):

10. **Era budget: about 6 MB** of shapes (fills and lines) per era, rather than 3 MB: 18 eras for
    Cliopatria, every view under 1 MB, and half as many files to publish.
11. **Coasts:** Cliopatria's fills aren't cut at the coast (about 77 minutes per build); from zoom
    4 the detailed sea and coastline are drawn over them. OpenHistoricalMap keeps its exact cut.
12. **IDs for BCE rows:** `cliopatria-<name>-<year>bce` (for example `…-41bce`), and `-2`, `-3`, …
    for further rows with the same name and first year. Existing IDs don't change.
13. **The re-import button re-runs any pinned import** (OpenHistoricalMap, CShapes, or Cliopatria).
    The pins still hold: an import stops if a file's checksum changes, and a new version is still
    reviewed by hand.

Decided on 2026-09-29 (the maintainers approved question 14):

14. **Wikipedia links for Cliopatria's unmatched polities** come from Cliopatria's own `Wikipedia`
    column, for the row in effect on the day shown, and say "The article Cliopatria links for
    this polity". Not from its Wikidata IDs. A polity with a Wikidata ID of ours (or matched to one
    of ours as the same state) keeps that link.
