# Data sources: evaluation

This is the record of how each candidate dataset was evaluated: its coverage, precision, format,
license, and what it actually contains for the showcase region (East Asia, 1931–1945).
Evaluated **2026-09-26**, by downloading or querying each dataset rather than relying on its
description. Re-check before relying on anything here, because datasets change.

## Summary

| Dataset | Coverage | Precision | Format | License | Decision |
|---|---|---|---|---|---|
| OpenHistoricalMap (OHM) | Global, crowd-sourced, uneven | Set per feature; many exact to the day | OSM data model: planet dumps, Overpass API, vector tiles with decimal-year dates | CC0 1.0 (some features CC BY/BY-SA via `license=*`) | **Use** (Phase 1 import) |
| CShapes 2.0 | Independent states and dependencies, 1886–2019 | Start and end dates to the day (see caveats) | CSV, GeoJSON (25 MB), Shapefile, R package | CC BY-NC-SA 4.0 | **Use**, as an isolated de jure layer |
| Cliopatria (Seshat) | ~1,800 polities, 3400 BCE–2024 CE | Years; ~40 km² spatial resolution | One GeoJSON (158 MB unzipped, 44 MB zipped) | CC BY 4.0 | **Use** (second opinion; global baseline later) |
| Natural Earth | Present day: physical features plus admin boundaries, ~100 disputed or breakaway areas, ~30 national "point of view" versions | 1:10m, 1:50m, 1:110m | Shapefile, GeoJSON | Public domain | **Use** (base map; model for modern disputes) |
| Wikidata | IDs for polities and events; dates stored with precision and calendar model | Varies by statement | API, SPARQL, dumps | CC0 1.0 | **Use** (identifiers only, not as a source by itself) |
| aourednik/historical-basemaps | 54 global snapshots, 123,000 BCE–2010 | One snapshot per chosen year; `BORDERPRECISION` 1–3 | GeoJSON, ~1.5 MB per year | GPL-3.0 | **Skip** |

## OpenHistoricalMap

- **What it is:** a public-domain, wiki-style historical map built on OpenStreetMap's software.
  Features carry `start_date` / `end_date` tags. Tiles expose `start_decdate` / `end_decdate`
  (decimal years), and OHM publishes a MapLibre plugin, `maplibre-gl-dates`, that filters by date.
- **License:** CC0 1.0. Contributors may only use public-domain or permissively licensed sources.
  Credit is requested but not required.
- **East Asia 1931–45** (Overpass query for `boundary` relations with `admin_level` 1–4 in the box
  15–55°N, 95–150°E, active between 1931 and 1945): **166 relations**.
  - **Present:** Manchukuo (1932 → 1945-08-17, Wikidata Q30623) and several of its provinces; the
    Kwantung Leased Territory (1905 → 1945-09-02); Kwangchowan; Portuguese Macau; British Hong
    Kong and the Hong Kong Occupied Territory (1941-12-25 → 1945-08-29); Korean provinces;
    Karafuto; the South Seas Mandate; the Philippine Executive Commission and the Second
    Philippine Republic; the Japanese occupation of Burma and the State of Burma; and the British
    Empire's changes from Dec 1941 to Feb 1942, exact to the day.
  - **Missing:** no Japanese-occupied area in China proper. The "China" relation changes only on
    1935, 1938-07-03, 1939-04-09 and 1945-10-25. There is also no Provisional Government of the
    Republic of China, no Wang Jingwei regime, and no Mengjiang (searched by name).
  - **Sources:** most of these relations have no feature-level `source` tag. We couldn't check
    changeset-level sources because the OHM API refused our requests.

## CShapes 2.0

- **What it is:** an academic dataset (ETH Zürich) of state and dependency borders. Each row is a
  country-period with start and end dates. Its status codes are independent, colony, protectorate,
  leased territory, and occupied.
- **License:** CC BY-NC-SA 4.0.
- **Coding rules (from the codebook):**
  - Only **de jure** changes are coded, dated to when, for example, a treaty was signed.
  - Excluded: changes under 10,000 km²; "territorial exchanges between states that were
    unrecognized, and were reversed at some point (e.g. Japan's occupation of Manchuria)";
    de facto secessions without international recognition; and wartime changes reversed after a
    war.
  - **Date caveat:** when the exact date was unknown, they used 1 January or the first of the
    month. Some dates that look exact aren't.
  - **Bias caveat:** where maps conflicted, they "opted for the map that corresponded most to the
    region's current borders."
- **East Asia 1931–45:**
  - China is a single unchanged polygon from 1921-03-13 to 1945-08-14.
  - Korea (from 1910-08-23), Taiwan (from 1895-04-17), and Southern Sakhalin (from 1905-09-05)
    are separate dependent units, each ending 1945-08-14.
  - There's no Manchukuo, and Hong Kong and Kwantung don't appear as separate units.
- **Citation:** Schvitz et al. (2022), "Mapping the International System, 1886–2017: The CShapes
  2.0 Dataset", *Journal of Conflict Resolution* 66(1): 144–61.
- **Imported 2026-09-27** into [data/imports/cshapes-2-0/](../data/imports/cshapes-2-0/README.md).
  Found while importing:
  - **Missing columns:** the GeoJSON, CSV, and SQL downloads lack the `status`, `owner`, and
    `b_def` columns that the codebook lists. Only the data file in the authors' R package
    (`cshapes_2.0.tar.gz`, same page) has them, and its `DESCRIPTION` file says "License: GPL
    (>= 2)". The maintainers treat them as part of CShapes 2.0 under CC BY-NC-SA 4.0, and asked the
    authors to confirm by email on 2026-09-27.
  - **Dates:** the GeoJSON's date strings are shifted by a time zone ("31.12.1885 23:00:00" means
    1 January 1886). The separate year, month, and day columns are right.
  - **Status values** across the whole dataset: independent (365 rows), colony (219), protectorate
    (62), occupied (39), mandate (23), and N/A (2, both Morocco).

## Cliopatria (Seshat Global History Databank)

- **What it is:** worldwide polity shapes from 3400 BCE to 2024 CE. Fields include `Name`,
  `FromYear`, `ToYear` (integers; negative means BCE), `Area`, `Type`, `Wikipedia`, `Wikidata`,
  `SeshatID`, `Components` and `MemberOf`. Release v0.2.0 has 13,765 features.
- **How it was made:** from hand-colored composite map images (Tollefson, 2014) converted to
  polygons and then hand-edited. Its sources are a bibliography grouped by modern region, not
  recorded per feature. Resolution is about 40 km². The authors say most boundaries without a
  treaty are "necessarily approximate".
- **License:** CC BY 4.0.
- **East Asia 1931–45:**
  - Yearly shapes. The Empire of Japan grows from 748,289 km² (1929–31) to 2,055,326 km²
    (1932–35), 3,103,824 km² (1938), and 7,043,789 km² (1943).
  - The Republic of China and "Communist Party of China" areas also change year to year.
  - **Puppet states are merged into Japan:** there's no separate Manchukuo.
- **Imported 2026-09-28** into [data/imports/cliopatria/](../data/imports/cliopatria/README.md).
  Found while importing:
  - **The file:** the zip at the pinned commit holds `cliopatria_polities_only.geojson`
    (166 MB). It has 13,380 POLITY rows and 385 RELATION rows, and its last year is 2024.
  - **Grouping rows:** some POLITY rows are groupings, such as "(British Empire)", "(French
    Third Republic)", and "(Vichy France)". Their names are in parentheses and `Components`
    lists their parts. The import skips them (61 rows in our area), because their parts already
    cover the land.
  - **Wrong Wikidata IDs:** some are wrong for this period. "Republic of China" carries Q148
    (the People's Republic of China), and "Republic of Korea" carries Q423 (North Korea). So
    polities are matched by a reviewed crosswalk, never automatically by Wikidata ID.

## Natural Earth

- **License:** public domain. Credit is suggested but not required.
- **Relevant layers:** coastlines, land, rivers, lakes (our base map); ~100 breakaway and disputed
  areas; disputed boundary lines; ~30 national "point of view" versions (including China, Japan,
  South Korea, and Taiwan). These layers are a model for showing modern disputes by attribution.

## Wikidata

- **License:** CC0 1.0.
- **IDs we checked:**

  | Entity | Wikidata ID |
  |---|---|
  | Manchukuo | Q30623 |
  | Mukden incident | Q242099 |
  | Marco Polo Bridge incident | Q219230 |
  | Provisional Government of the Republic of China (1937–40) | Q704714 |
  | Mengjiang | Q697837 |
  | Wang Jingwei regime | Q696242 |

- **Reference quality varies by statement.** For Q219230, the start date (1937-07-07, day
  precision, Gregorian calendar) cites *The Rise of Modern China* (6th ed.), p. 578. The
  coordinates, though, are only "imported from Dutch Wikipedia". So we treat Wikidata as an ID
  system and a lead, and cite the underlying references.
- **Names differ by language**, for example the Chinese and Japanese Wikipedia titles for Q219230.
  This is one reason we store names with their language and source.

## aourednik/historical-basemaps (not used)

- **License:** GPL-3.0. The author calls it a "work in progress" and doesn't record sources per
  feature.
- **East Asia:** only the 1930, 1938 and 1945 snapshots cover our period.
  - The China polygon is identical in all three, and is labelled "Chinese Warlords" in 1930 and
    1938.
  - The 1938 file has no separate Manchuria, and assigns Cambodia and Cochin China to the "Empire
    of Japan". That conflicts with OHM, which shows the Indochinese Union throughout 1938.
  - Every feature here is marked `BORDERPRECISION` 3 ("determined by international law"), so the
    precision flag isn't reliable for this region.

## Statistics (Figures) datasets

Evaluated **2026-09-27** for the Figures part of the data model (see
[architecture](architecture.md#data-model)). Licenses were read on each project's own website.
Where the website blocked automated access, we used the dataset's DOI record at DataCite, which
the publisher supplies. **Nothing has been imported.** The recommendation is in
[phase-2-plan.md](phase-2-plan.md#5-statistics-figures).

The key question for each is its **basis**: does a number describe a historical polity's own
territory, or a present-day country's? Present-day-border numbers must never be attached to a
historical polity as if they described its territory.

| Dataset | Coverage | Basis | Format | License | Decision |
|---|---|---|---|---|---|
| Maddison Project Database 2023 | 169 countries, 1 CE–2022, sparse before 1820 | Not stated on the project's pages; other sources say present-day borders (unconfirmed) | Excel (4.9 MB), Stata | CC BY 4.0 | Not now; confirm basis first |
| Gapminder population, v8 | Countries 1800–2100 (later years are UN projections); world total from 10,000 BCE | **Present-day borders** (stated) | Excel, online spreadsheets | CC BY 4.0 | Not now |
| HYDE 3.3 | Global grid, 5 arc-minutes (~85 km²), 10,000 BCE–2023 CE | A grid: can be summed inside any shape (`computed-from-shape`) | ESRI ASCII grids | **CC BY-NC-SA 4.0** (DOI record) | Candidate; maintainer to decide |
| Seshat Databank | 864 polities in 10 macro-regions (a sample) | **Historical polity** | Web database and downloads (registered users) | **CC BY-SA 4.0** | Candidate; maintainer to decide |
| COW National Material Capabilities v7.0 | Members of the state system, 1816–2022 | State-system members (historical states) | ZIP of CSV, Stata, text | Custom terms: **no redistribution** without written permission; no commercial use | **Not usable** without permission |

### Maddison Project Database 2023

- **Site:** https://www.rug.nl/ggdc/historicaldevelopment/maddison/releases/maddison-project-database-2023
  (DOI [10.34894/INZBF2](https://doi.org/10.34894/INZBF2)).
- **License (quoted from the site):** "Maddison Project Database, version 2023 by Jutta Bolt and
  Jan Luiten van Zanden is licensed under a Creative Commons Attribution 4.0 International
  License." The DOI record also gives `cc-by-4.0`.
- **Citation:** Bolt, Jutta and Jan Luiten van Zanden (2024), "Maddison style estimates of the
  evolution of the world economy: A new 2023 update", *Journal of Economic Surveys*, 1–41,
  DOI 10.1111/joes.12618.
- **Extra citation rule:** the original papers (listed in the workbook's source sheet) must be
  cited when "the data is shown in any graphical form", or when a subset of fewer than 12
  countries is used. A panel showing a figure would need the original paper, not just the MPD.
- **Coverage and format:** GDP per capita and population, "for 169 countries and aggregate
  regions from 1 AD up to 2022" (DOI record); Excel and Stata.
- **Basis: not confirmed.** The project's page and DOI record don't say whether countries are
  measured within present-day borders. The data file (on DataverseNL) and the article (Wiley) both
  refused automated access, so this must be checked by hand before any use.

### Gapminder population (version 8)

- **Documentation:** https://www.gapminder.org/data/documentation/gd003/
- **License:** Gapminder's [free material page](https://www.gapminder.org/free-material/) says:
  "All Gapminder material linking here are freely available under the Creative Commons
  Attribution 4.0 International license." The dataset's page doesn't state a license itself.
  Gapminder builds on Clio Infra, Maddison, and the UN World Population Prospects, whose own terms
  we'd also check before any import.
- **Coverage:** a world total from 10,000 BCE, and country estimates "from 1800 to 2100". From 1950
  it uses UN World Population Prospects 2024, with the medium-fertility forecast after the
  estimates end. Projections are never historical data and would never be imported.
- **Basis: present-day borders, stated plainly.** Gapminder's
  [changing country borders](https://www.gapminder.org/data/geo/changes/) page says it treats
  countries "as if they always had the borders they have today".
- **Format:** Excel and online spreadsheets.

### HYDE 3.3 (History Database of the Global Environment)

- **Dataset:** DOI [10.24416/UU01-AEZZIT](https://doi.org/10.24416/UU01-AEZZIT), Utrecht
  University, issued 2023-11-30, updated 2024-07-12. Landing page:
  https://public.yoda.uu.nl/geo/UU01/AEZZIT.html (it blocked automated access).
- **License: CC BY-NC-SA 4.0.** The DOI record's rights statement is "Creative Commons Attribution
  Non Commercial Share Alike 4.0 International" (SPDX `cc-by-nc-sa-4.0`). **Caution:** a web
  search summary claimed CC BY 4.0. Treat the dataset as NC-SA unless the landing page, checked
  by hand, says otherwise. NC-SA would mean the same isolation as CShapes.
- **Coverage and format (DOI record):** "The period covered is 10 000 BCE to 2023 CE. Spatial
  resolution is 5 arc minutes (approx. 85 km2 at the equator), the files are in ESRI ASCII grid
  format." Population comes as total, urban, and rural grids, plus density.
- **Basis:** a grid, not countries, so the population inside any of our shapes can be summed
  (`basis: computed-from-shape`). The grids are modelled, though, by spreading country-level
  estimates over the map, so any figure computed from them is an estimate and must say so, with
  its method.

### Seshat Databank

- **Site:** https://seshat-db.com/, terms at https://seshat-db.com/terms/current/
- **License (quoted from the terms):** "Public Data: Can be viewed by anyone and downloaded by
  registered users who have accepted the Terms. Licensed under the Creative Commons
  Attribution–ShareAlike 4.0 International License (CC BY-SA 4.0)." Share-alike means anything
  derived must stay under CC BY-SA, so it would be isolated in its own import folder.
- **Access:** downloading needs a registered account that has accepted the terms. The maintainers
  would have to create one, and the import couldn't run without it.
- **Coverage:** the home page lists 864 polities in 10 macro-regions, with 77 social-complexity
  variables (including population) coded for 544 polities. It's a sample, not a complete list.
- **Basis: historical polity.** Seshat codes each polity, not a modern country, so it's the only
  candidate whose numbers could carry `basis: polity-territory`.
- **Not the same as Cliopatria:** Cliopatria (the shapes) is CC BY 4.0. The Databank's variables
  are CC BY-SA 4.0.

### Correlates of War: National Material Capabilities (v7.0)

- **Site:** https://correlatesofwar.org/data-sets/national-material-capabilities/
- **Coverage:** "total population, urban population, iron and steel production, energy
  consumption, military personnel, and military expenditure of all state members, currently from
  1816-2022". It's a ZIP of CSV, Stata, and text files.
- **Terms** (https://correlatesofwar.org/data-sets/): downloading means agreeing to terms that
  forbid commercial use and say: "Users agree not to distribute the dataset to any third party
  without written permission of the COW director and data host."
- **Decision: not usable.** Putting any of it in a public repository or on the site would be
  redistribution, which needs written permission. Asking for it would be an outward-facing step
  for the maintainer to decide.
- **Basis:** members of the state system. Whether a member's population includes its colonies
  wasn't checked.

## Gap: front lines in China, 1937–45

No open vector dataset of Japanese-controlled areas in China proper was found. The candidate path
is to trace from **dated public-domain maps**. One example is the US Army / US Military Academy
map "Chinese Territory Seized Prior to July 1937 and Major Japanese Drives in 1937", public domain
in the US as a work of the US Army
([Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Major_Japanese_drives_in_1937.jpg)).
Modern user-drawn maps on Wikimedia Commons (typically CC BY-SA, with unclear sources) are **not**
usable as sources.

## Other projects checked

- **OHM's own website:** a time slider over OHM data.
- **Built on historical-basemaps:** Point in History, Atlas Pi, and ourednik.info. The dataset's
  README lists Historic Borders as currently unavailable.
- **Research viewers:** Seshat's Cliopatria viewer, and the CShapes visualizer.
- **Chronas:** per-year provinces with rulers. Its code is MIT; its data is CC BY-SA 4.0, derived
  mostly from Wikipedia.

None of these that we checked separates control, recognition, and claims; links border changes to
events; or compares sources side by side. That is chronoatlas's niche: **a view across several
sources, not another border dataset.**
