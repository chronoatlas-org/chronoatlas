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
