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
| 6 | **Panel and data files by era:** "Around this date" per era, Cliopatria's own areas as figures, polity files. | medium |
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
  - **Today's data** (before the worldwide imports are merged) gets a baseline of 25 pieces: the
    years before 1900 and after 1950 of the East Asian Cliopatria rows.

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
