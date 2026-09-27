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
