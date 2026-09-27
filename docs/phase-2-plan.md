# Phase 2 plan: panel, events, and transitions

> **Status: approved by the maintainer on 2026-09-27**, with the recommended answer to every
> question. The decisions are recorded in [section 7](#7-decisions-2026-09-27). Drafted and
> approved 2026-09-27.

Phase 1 put borders on a map with a timeline. Phase 2 makes the map **explain itself**: clicking a
territory opens a panel with everything we know about it and where each fact comes from, events
appear on the timeline, and a second and third source (CShapes and Cliopatria) show where sources
disagree. It's the start of the East Asia showcase, beginning with Manchuria, 1931–1933.

Sections:

1. [Territory panel](#1-territory-panel)
2. [Events on the timeline and the map](#2-events-on-the-timeline-and-the-map)
3. [CShapes 2.0 import (de jure layer)](#3-cshapes-20-import-de-jure-layer)
4. [Cliopatria import (second opinion)](#4-cliopatria-import-second-opinion)
5. [Statistics (Figures)](#5-statistics-figures)
6. [Order of work](#6-order-of-work)
7. [Decisions (2026-09-27)](#7-decisions-2026-09-27)

---

## 1. Territory panel

Today, clicking a territory opens a small popup with its name, dates, and source. The panel
replaces that popup with a fuller view.

### What it shows

For the territory you clicked, on the selected day:

- **Names over time.** Every recorded name with its language and dates, for example the English
  name alongside the Chinese and Japanese names, each with its source. Names are attributed,
  because a name can itself be contested (ground rule 4).
- **Relations, kept apart** (ground rule 2), each on its own line with its source:
  - **Administered / controlled by** (de facto), per a named source;
  - **Sovereign** (de jure), per a named source, with `recognized_by` when the source gives it;
  - **Claimed by**, per a named source.

  For example, in 1937 over Manchuria: "Administered by Manchukuo (per OpenHistoricalMap)" and,
  once CShapes is imported, "Sovereign: China (per CShapes)". (The OHM half is in our data now:
  relation 2885965. The CShapes half is what the
  [CShapes evaluation](data-sources.md#cshapes-20) leads us to expect; it's confirmed against
  the imported data, not assumed.) When those differ, the panel says in words that the area is
  contested, which matches the hatching on the map.
- **Dates with their precision.** "From 1932 (year only) until 17 August 1945", worded by
  `src/dates/format.ts`, so an approximate or year-only date never looks exact.
- **Sources**, each with its locator (for example "OpenHistoricalMap, relation 2885965,
  version 15") and a link where one exists.
- **Figures**, later in the phase (see [section 5](#5-statistics-figures)): each number with its
  source, date, range, and `basis`, and the nearest estimate's date rather than an invented
  in-between value.
- **Events** linked to this territory's changes (see [section 2](#2-events-on-the-timeline-and-the-map)).

**Where the panel's data comes from.** The vector tiles stay small: they only carry what the map
needs to draw (each border's assertion `id` and `polity` are already there). The build will also
write one small file per polity, `public/data/polities/<id>.json`, with its names, all its
assertions, and their sources. The panel downloads that file when you click. This scales to a
worldwide map, because a visitor only ever downloads the polities they open.

### The `sel` URL parameter

The address will also record the selected territory, so a shared link opens the panel:

```
#d=1901-05-12&m=4.5/10.0/20.0&sel=testland
```

- `sel` holds a **polity ID** (a permanent ID, never renamed or reused; see
  [architecture](architecture.md#permanent-ids)).
- An unknown ID is ignored, like any other damaged part of a link.
- If the selected polity has no territory on the chosen day, the panel still opens and says so
  ("No territory recorded for Testland on this date"), instead of silently closing.
- Parsing and formatting go in `src/url/state.ts`, with tests, like `d`, `m`, and `lang`.

### "Report a problem with this border"

A button in the panel opens GitHub's border correction form with the fields already filled in:

```
https://github.com/chronoatlas-org/chronoatlas/issues/new?template=border-correction.yml&territory=Testland%20(testland)&date_range=1901-05-12&view_link=https%3A%2F%2Fchronoatlas-org.github.io%2Fchronoatlas%2F%23d%3D1901-05-12%26sel%3Dtestland
```

- **Checked against GitHub's documentation (2026-09-27):** a form field's `id` "is the canonical
  identifier for the field in URL query parameter prefills"
  ([form schema syntax](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-githubs-form-schema#keys)),
  and "You can also use URL query parameters to fill custom text fields that you have defined in
  issue form templates"
  ([creating an issue from a URL query](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue#creating-an-issue-from-a-url-query)).
  The ids `territory`, `date_range`, and `view_link` were added in Phase 1, step 8, and are
  protected by `scripts/issue-forms.test.ts`.
- **We won't pass `labels`** in the address: GitHub requires permission to add labels, and an
  invalid parameter gives the visitor a 404 page. The form adds its own label.
- **`territory`** gets the displayed name plus the ID in brackets, so reviewers can find the exact
  record.
- **`date_range`** gets the selected day (decision 3).
- **`view_link`** gets the full share link, including `sel`.
- Values are encoded with `encodeURIComponent`. GitHub answers "414 URI Too Long" for very long
  addresses; ours stay short.
- The URL builder is a small pure function with tests.
- **Note:** filing an issue needs a GitHub account. That's accepted for now (decision 4).

### On phones: a bottom sheet

On narrow screens the panel slides up from the bottom, above the timeline, instead of covering
the map:

- **Three heights:** a "peek" strip with just the name and relation, half height, and full height.
  You drag the handle, or tap it to cycle; buttons do the same for keyboard and screen-reader
  users.
- The map stays usable while the sheet is at peek height.
- It respects the safe areas for notches (as the Phase 1 layout does) and keeps 44 px touch
  targets.
- **Closing:** a close button, the Escape key, or the Back button (because `sel` is in the
  address, Back returns to the view without a selection).
- On wider screens the same component is a side panel on the right.

**Accessibility:** the panel is a labelled region. Opening it moves keyboard focus to its heading,
and closing it returns focus to the map. All its text goes through `src/i18n/`.

### Should we adopt a UI framework for the panels?

The map and timeline stay plain TypeScript either way. The question is only about the panels,
which are mostly "turn this data into a list of labelled lines, and redraw when the date or
selection changes".

| Option | Size added to the site | What contributors need to learn | Fit |
|---|---|---|---|
| **None** (plain TypeScript, as now) | 0 | Nothing new | Fine for the popup. For a panel with several sections that must all update when the date, selection, or language changes, we'd be hand-writing "find this element and update it" code, which is where bugs hide (the Phase 1 URL bug was an ordering problem of a related kind). |
| **Preact** | about 4–5 KB compressed | JSX (HTML-like tags inside TypeScript) and "components". The same model as React, which most web developers already know. | Our existing tools already check `.tsx` files. No new file type or separate compiler. |
| **Svelte** | small (it compiles away) | Svelte's own `.svelte` file format and its "runes" syntax, which changed substantially in Svelte 5 | Pleasant to write, but it adds a compiler, a new file type, and a separate type checker (`svelte-check`). |
| **React** | about 45 KB compressed | JSX and components | The most familiar, but about ten times Preact's size for the same job, which matters on phones. |

**Recommendation: Preact, used only for the panels.**

- **It keeps the page in step with the data.** You describe what the panel should look like for a
  given date and selection, and Preact updates the page to match. That removes the class of bugs
  that come from updating the page by hand.
- **It's small** (a few KB), so it doesn't slow down phones.
- **It's reviewable.** JSX is the most widely known way of writing components, so contributors are
  more likely to know it already, and the maintainer can learn one pattern that also works in
  React. Everything stays in TypeScript, checked by `npm run typecheck`.
- **It's easy to contain.** The panel is one Preact "island" mounted into a `<div>`. If we ever
  regret the choice, only the panel code changes.
- **Before committing to it**, the first step builds the panel in Preact and confirms that
  TypeScript 7 and Vite 8 check and build it cleanly. If they don't, we fall back to plain
  TypeScript, and say so.

---

## 2. Events on the timeline and the map

The data format for events already exists (`data/events/<id>.yaml`, see
[data-format.md](data-format.md#events-dataeventsidyaml)), and the validator already checks it.
There are no events yet, because each needs a citable source.

### How events appear

- **Timeline markers:** small marks on the timeline canvas at each event's date. A date range is
  drawn as a bar, and an approximate date as a soft-edged mark. `importance` (1–5) decides which
  events show at which zoom level, so the timeline doesn't become cluttered when zoomed out.
  Markers are also reachable by keyboard, and are listed as text in the panel for screen readers.
- **Clicking an event** moves the timeline to its date and opens the event in the panel: its
  title, date (with precision), our summary, its sources, and its effects.
- **A pulse on the map:** when the playhead crosses an event that has a location, a ring expands
  briefly from that point. The ring's size reflects the location's `precision_km`, so a vague
  location looks vague. **If the browser's reduced-motion setting is on**
  (`prefers-reduced-motion: reduce`), there's no animation: a static ring appears for a few
  seconds instead.
- **Effects:** an event's `effects` list names the assertions it started or ended. When an event is
  selected, the borders of those assertions are outlined on the map (the tiles already carry each
  border's assertion `id`), and the panel lists them. The map never animates a border into
  another shape; a change is shown as a change (see
  [architecture: dates](architecture.md#dates)).

### "The world around this date"

A panel section (a tab, on phones) listing what happened near the selected date:

- events within a window that scales with the timeline's zoom (days when zoomed in, decades when
  zoomed out), nearest first;
- **border changes** near the date, taken from the change index that already exists
  (`changes` in `tiles.json`), such as "Testland's border changes (per OpenHistoricalMap)". This
  part works even before any events are added.

Everything in it links back to its source.

### Candidate events for the first showcase stage (Manchuria, 1931–1933)

These are **candidates only**, fetched live from the Wikidata API on 2026-09-27
(`wbsearchentities` and `wbgetentities`). They are listed as Wikidata IDs, English labels, and
the dates Wikidata records, with the **reference behind each date statement**. They're here to
show what's needed, not to be imported. No summaries are written.

| Wikidata ID | Label (Wikidata, English) | Date statement(s) on Wikidata | Reference for that statement |
|---|---|---|---|
| Q242099 | Mukden incident | point in time 1931-09-18 (day) | **none** |
| Q1551794 | Japanese invasion of Manchuria | point in time 1931-09-18 (day); start 1931-09-18; end 1932-02-27 | point in time: imported from English Wikipedia (revision 945925744). Start and end: **none** |
| Q1627032 | Jiangqiao campaign | point in time 1931-11-18 (day) | imported from English Wikipedia |
| Q1361205 | Jinzhou Operation | point in time 1931-12-21 (day) | imported from English Wikipedia |
| Q283243 | Stimson doctrine | point in time 1932-01-07 (day) | **none** |
| Q712645 | Defense of Harbin | point in time 1932-02-04 (day) | imported from English Wikipedia |
| Q30623 | Manchukuo | inception 1932-03-01 (day); dissolved 1945-08-18 | **none** (both) |
| Q702574 | Japan–Manchukuo Protocol | point in time 1932-09-15 (day) | imported from Russian Wikipedia |
| Q700443 | Lytton Report | publication date 1932-10-02 (day) | **none** |
| Q105222106 | Lytton Commission | no date statements | — |
| Q2948000 | Battle of Rehe | start 1933-02-21; end 1933-03-01 | imported from English Wikipedia |
| Q708451 | defense of the Great Wall | point in time 1933-05-31; start 1933-01-01; end 1933-05-21 | point in time and start: imported from English Wikipedia. End: **none** |
| Q715590 | Tanggu Truce | point in time 1933-05-31 (day) | imported from Russian Wikipedia |
| Q814242 | Pacification of Manchukuo | start 1931-11-04; end 1941-01-01 (year) | imported from English Wikipedia |

No Wikidata item was found by searching for Japan's withdrawal from the League of Nations.

**What this shows:**

- **Not one of these dates has a citable reference on Wikidata.** Every reference is either
  missing or "imported from Wikipedia", which is a lead, not a source (ground rule 1). So none of
  them can be imported as they stand.
- **Wikidata is internally inconsistent here.** For example, Q708451 has an end date (1933-05-21)
  ten days before its "point in time" (1933-05-31), and a start date of 1 January 1933 that may be
  a placeholder for "some time in 1933". Q30623 gives Manchukuo a day-precise inception
  (1932-03-01), while OpenHistoricalMap records only the year "1932". Differences like these are
  why each date must come from a cited source with its own precision.

**Citable sources still needed** (each event needs at least one, with a locator):

- **Primary documents**, cited as what they are. Examples of where to look:
  - *Papers Relating to the Foreign Relations of the United States, Japan, 1931–1941, Volume I*
    (US Government Printing Office, 1943). Its first section, "Occupation of Manchuria by Japan
    and statement of policy by the United States" (documents 1–117), is online at
    [history.state.gov](https://history.state.gov/historicaldocuments/frus1931-41v01). As a US
    government work, it's in the public domain. The specific document for each event still has
    to be located and cited by number.
  - The Lytton Commission's report, as published by the League of Nations (an archival copy, with
    its League document number as the locator).
  - The published text of the Japan–Manchukuo Protocol, and of the Tanggu Truce.
- **Scholarly histories** of the period, with page numbers, for events that aren't a single
  document (battles and campaigns). Where Chinese- and Japanese-language scholarship dates or
  describes an event differently, both are cited and attributed.
- Whoever adds each event writes the summary in their own words from those sources.

---

## 3. CShapes 2.0 import (de jure layer)

CShapes 2.0 records **legally recognized** (de jure) borders of states and dependencies, 1886–2019.
Its evaluation is in [data-sources.md](data-sources.md#cshapes-20).

### Licensing: an isolated folder

- **License: CC BY-NC-SA 4.0.** In plain terms:
  - **BY:** we must credit it (in `CREDITS.md`, the folder's `LICENSE.md`, and wherever its data
    is shown).
  - **NC (non-commercial):** nobody may use this data commercially. Our site is non-commercial,
    so showing it is fine. But anyone who reuses our repository commercially has to leave this
    folder out. `CREDITS.md` and the README already warn that some imports are non-commercial.
  - **SA (share-alike):** anything we derive from it must be shared under the same license. That's
    why every file derived from it stays in its folder.
- Everything lives in **`data/imports/cshapes-2-0/`**: `LICENSE.md`, `README.md`,
  `manifest.json` (download URL, version, checksum, retrieval date, and every interpretation
  decision), and the converted shapes and assertions. The raw download is not committed if it's
  large; the import script fetches the pinned version and verifies its checksum.
- Only the East Asia region and the years 1900–1950 are imported at first, matching the OHM
  import.

### Dates

- CShapes gives each unit's period as `gwsdate` (first day) and `gwedate` (**last** day, inclusive).
  Our `end` is exclusive, so **`end` = `gwedate` + 1 day**, computed with `src/dates` (never
  JavaScript `Date`). Example: a `gwedate` of 1945-08-14 becomes `end: 1945-08-15`.
- **Precision caveat:** the codebook says that when the exact date was unknown, the authors used 1
  January or the first of the month, so some dates that look exact aren't. We can't tell which
  from the data. Decided: record the dates as given, and add a note to every assertion whose
  start or end falls on the 1st of a month, which the panel shows ("CShapes may use the first of
  the month when the exact day is unknown"). See decision 7.

### Matching CShapes units to our polity IDs

CShapes identifies units by Gleditsch–Ward code (`gwcode`, for example 710 for China), not by
our IDs.

- A **crosswalk file**, `data/imports/cshapes-2-0/polity-crosswalk.yaml`, maps each `gwcode` (and,
  for dependencies, the owner's code) to one of our polity IDs, such as `710 → china`. It's
  written and reviewed by hand, **and it stays inside the CShapes folder**, so nothing derived from
  the NC-SA data is written outside it.
- Where a unit has no matching polity in `data/polities/` (which only holds records from CC0 or
  public-domain sources), the import creates a **polity record inside the CShapes folder**, with
  its CShapes name. That needs a small validator change: polity records inside an import folder,
  which can only be referred to by that folder's own assertions.
- **Our IDs never change** (see architecture: permanent IDs). If a CShapes unit turns out to be the
  same as an OHM polity, the crosswalk is corrected, and no ID is renamed.

### Interpretation (approved, decision 5)

| CShapes row | Becomes |
|---|---|
| An independent state | a `sovereign` assertion: that state over the shape |
| A dependency (colony, protectorate, leased territory, occupied), with an owner | a `sovereign` assertion by the **owner** over the shape, with the CShapes status in the note. Status-specific relations (`leased-to`, `protectorate-of`) could be added later as links between polities. |

Every decision goes into the manifest, as the OHM import does.

### A de jure view and the "contested" hatching

- CShapes becomes **its own layer**, with its own tiles (each source ships as its own layer). A
  view switch offers **de facto** (the default, from OHM) or **de jure (per CShapes)**.
- **Contested:** at build time, wherever a de facto assertion (`administers`, `controls`,
  `occupies`) and a `sovereign` assertion cover the same place on the same days **for different
  polities**, the build computes the overlapping area (with `polygon-clipping`, already a
  dependency) and its day range, and marks it as contested. The map draws it with a **hatched
  fill and a text label**, never color alone. The panel says in words: "Administered by Manchukuo
  (per OpenHistoricalMap). Sovereign: China (per CShapes)."
- These computed areas combine CShapes (NC-SA) with OHM (CC0), so they're also NC-SA. They live
  only in the build output (`public/data/`, not committed), are credited on the site, and are
  never written into `data/`.
- **Reference test:** Manchuria in 1937 is expected to show as contested. The basis for that
  expectation is the [CShapes evaluation](data-sources.md#cshapes-20): CShapes has China as one
  unchanged polygon from 1921-03-13 to 1945-08-14, and its codebook excludes Japan's occupation
  of Manchuria. The test is written only after checking the pinned import confirms it; if the
  data says otherwise, the test follows the data. A synthetic "Testland" fixture tests the
  geometry code.
- A risk to watch: a crosswalk mistake (for example, matching a colony to the wrong owner) would
  create false "contested" areas. The crosswalk is reviewed like any other data change, and the
  build lists how many contested areas each polity pair produces, so surprises stand out.

---

## 4. Cliopatria import (second opinion)

Cliopatria, from the Seshat Global History Databank, has worldwide polity shapes from 3400 BCE to
2024 CE. Evaluation: [data-sources.md](data-sources.md#cliopatria-seshat-global-history-databank).

- **License: CC BY 4.0**, confirmed in the repository's `LICENSE.md` on 2026-09-27. We must credit
  it and say what we changed. It's not share-alike, so it's easier to combine than CShapes, but
  it still lives only in `data/imports/cliopatria/` (it isn't CC0, so it doesn't go in
  `data/polities/`). Note that Cliopatria's license differs from the Seshat Databank's own
  (CC BY-SA 4.0, see [section 5](#5-statistics-figures)).
- **Getting it:** the latest release is `v0.2.0` (tagged 2026-05-16). A `v0.2.0-duplicate` tag
  followed on 2026-05-24, but both tags point to the same commit,
  `ad28a691b7c07c1fca89d0e0636d324667d2a258` (checked with the GitHub API on 2026-09-27), so
  there's nothing to ask about: **we pin that commit** (decision 9). The data is one zipped GeoJSON in the
  repository (158 MB unzipped), also on Zenodo. **It's too large to commit** (GitHub's limit is
  100 MB per file), so the import script downloads a pinned version, checks its checksum, filters
  it to East Asia 1900–1950, and commits only the filtered, converted result. We'll measure that
  result's size before committing.
- **Dates:** Cliopatria's `FromYear` and `ToYear` are whole years, **inclusive** ("the year of
  interest is between the row's FromYear and ToYear, inclusive", per its README). So:
  - `start` = `FromYear` (year precision);
  - `end` = `ToYear` + 1 (year precision), meaning "the change happened some time in that year".
    The map shows that year as uncertain, which is honest for yearly snapshots.
  - For BCE years, we must confirm whether Cliopatria's negative years count year 0 (as EDTF does,
    where `0000` is 1 BCE) or not. That doesn't affect 1900–1950, but it must be settled before a
    worldwide import.
- **What it means:** Cliopatria maps "territory held" and doesn't separate control from
  sovereignty. Decided: import its rows as `controls` assertions, with a manifest note saying the
  source doesn't make that distinction. Rows of `Type` `RELATION` (rather than `POLITY`) are
  skipped at first, and the count of skipped rows is recorded.
- **Puppet states are merged into their patron.** For example, there's no separate Manchukuo; its
  area is inside the Empire of Japan. We show this **as Cliopatria's view, attributed**, not as an
  error. Side by side with OHM, it's exactly the kind of disagreement the site exists to show.
- **Matching:** each row has a `Wikidata` ID. Rows whose Wikidata ID matches one of our polities
  use that polity's ID. Others get polity records inside the Cliopatria folder, as for CShapes.
- **On the map:** a "second opinion" layer, drawn as outlines only over the default view, with a
  label saying whose view it is. The full compare-sources view is Phase 3.

---

## 5. Statistics (Figures)

The five candidate datasets were checked on 2026-09-27 on each project's own website (or, where
the website blocked automated access, the dataset's registered DOI record). Full details,
quotations, and links are in
[data-sources.md](data-sources.md#statistics-figures-datasets). In short:

| Dataset | Coverage | Territory basis | License | Usable? |
|---|---|---|---|---|
| Maddison Project Database 2023 | 169 countries, 1 CE–2022 (sparse early on) | Not confirmed on the project's own pages (other sources say present-day borders) | CC BY 4.0 | Only as `present-day-borders` figures, once the basis is confirmed |
| Gapminder population v8 | Countries 1800–2100 (the later years are UN projections); world total from 10,000 BCE | **Present-day borders**, stated by Gapminder | CC BY 4.0 | Only as `present-day-borders` figures |
| HYDE 3.3 | Global grid (about 85 km² per cell), 10,000 BCE–2023 | A grid, so population inside any of our shapes can be added up (`computed-from-shape`) | **CC BY-NC-SA 4.0** (per its DOI record) | Yes, but NC-SA like CShapes, so isolated |
| Seshat Databank | 864 polities (a sample, not every polity) | **Historical polity** | **CC BY-SA 4.0**; download needs a registered account | Conceptually the best fit, but share-alike, and access needs an account |
| COW National Material Capabilities v7.0 | Members of the state system, 1816–2022 | The state as a member of the state system | Custom terms: **no redistribution** without written permission, no commercial use | **No**, unless COW gives written permission |

**Recommendation:**

1. **Import none of these yet.** For the showcase polities (Manchukuo, for example), none of the
   country-based datasets describes the polity's own territory, and attaching a present-day-borders
   number to a historical polity is exactly what CLAUDE.md forbids.
2. **First Figure: `area-km2` computed from our own shapes** (`basis: computed-from-shape`). The
   inputs are CC0 (OHM), so there's no license problem, and it demonstrates the whole Figures
   pipeline (panel, source, method, date, precision).
3. **Population: neither for now** (decision 10). The two options, for when it's revisited:
   - **HYDE 3.3**, summed inside each of our shapes (`computed-from-shape`), isolated under
     NC-SA like CShapes. It's consistent everywhere and fits "computed from a specific shape"
     exactly, but it's modelled (country totals spread over a grid), so it would be shown as an
     estimate with its method. Only the computed totals would be stored, not the large grids.
   - **Seshat**, for polity-territory populations where Seshat has them (a sample of polities),
     isolated under CC BY-SA. The maintainer would need to create an account to download it, and
     the import couldn't run without that account.
4. Gapminder and Maddison could later feed a clearly labelled "within today's borders of …"
   comparison, but that's low priority.

---

## 6. Order of work

Small steps, each committed, explained, and viewable locally and online, as in Phase 1.

1. ✅ **Panel foundation.** Add Preact and confirm that type-checking and the build work. Move the popup's content into a side panel. Add `sel` to the URL, with tests.
   *Done 2026-09-27.* TypeScript 7 and Vite 8 handle Preact's JSX with two `tsconfig.json`
   settings and no extra build plugin. The whole step added 4.7 KB compressed to the site's
   JavaScript (288.2 → 292.9 KB), including Preact's license notice, which its files don't
   carry and which we add in `src/panel/panel.tsx` so it's kept in the published code. Until step 2, the panel reads its facts from the border
   tiles the map has downloaded, so it says when a territory's border isn't in the loaded
   area rather than claiming there's no record.
2. ✅ **Per-polity data.** The build writes `public/data/polities/<id>.json`. The panel shows names
   over time, all relations kept separate, dates with precision, and sources with locators.
   *Done 2026-09-27.*
   - `atlas.json` (235 KB, loaded up front) became `sources.json` plus 62 polity files
     (744 KB in total, loaded one at a time; the largest compresses to about 3 KB).
   - The tiles no longer carry the panel's text, which took them from 6.1 to 5.2 MB.
   - The panel has three parts:
     - **On this date:** each record with its dates, notes, and sources, plus which kinds of
       statement (control, sovereignty, claims) have no record for that date.
     - **All records:** each with a "Go to its start" button.
     - **Names:** grouped by source, each with its language.
3. ✅ **Phone bottom sheet** and panel accessibility (focus, Escape, Back button).
   *Done 2026-09-27.*
   - On phones the panel has three heights (small, half, large). You drag the handle, tap it
     to cycle, or use the arrow keys on it. At the small height it shows the name and one line
     saying what's in effect.
   - Clicking a territory moves keyboard focus to the panel's heading. Closing it returns focus
     to the map.
   - Escape closes the panel, and Back undoes a selection.
   - **Added while testing: overlapping records.** Clicking in Manchuria in 1937 hits two
     records, Manchukuo's and China's. OpenHistoricalMap's China boundary for 1935–38
     (relation 2694471) includes Manchuria. The map drew one on top of the other, and only the
     top one could be clicked. The panel now lists every other polity recorded at the clicked
     spot ("Also recorded at the spot you clicked: China"), so none is unreachable. How such
     overlaps should be *drawn* belongs to the contested-areas work (step 9, and Phase 3). How
     to *interpret* OHM boundaries like this one is a question for the maintainer (see
     [open questions](#open-questions-found-during-the-work)).
4. **"Report a problem with this border"** button, with a tested URL builder.
5. **Events pipeline.** The build writes the events and their effects. Timeline markers by
   importance and zoom, and keyboard access. Tested with synthetic "Testland" events only.
6. **Event panel, map pulse (reduced-motion aware), and effect highlighting.**
7. **"The world around this date"**: nearby events and border changes from the change index.
8. **CShapes import**: script, license, manifest, crosswalk, polity records inside import
   folders (a validator change), and East Asia 1900–1950.
9. **De jure view and contested hatching**, computed at build time, with the 1937 Manchuria test.
10. **Cliopatria import** and the "second opinion" outline layer.
11. **First Figure**: `area-km2` computed from shapes, shown in the panel.
12. **First sourced events** for Manchuria 1931–33, once citable sources are located (see
    [section 2](#candidate-events-for-the-first-showcase-stage-manchuria-19311933)). Each is proposed as
    its own pull request, with sources for review.
13. **First borders traced from public-domain maps.** Write a short guide to tracing in
    OpenHistoricalMap from a dated public-domain map, then import the result. The tracing itself is
    done by people in OHM, not in this repository.

Steps 1–7 need no new data licenses. Steps 8–11 each add a data source, and each is reviewed for
licensing before its data is committed.

---

## Open questions found during the work

These came up while building. None blocks the current steps; each needs the maintainer.

1. **Overlapping OHM boundaries: administered, or claimed?**
   - **What overlaps:** in mid-1937, OpenHistoricalMap has the Republic of China's boundary
     (relation 2694471, 1935 to 1938-07-03) covering Manchuria, which Manchukuo's boundary
     (relation 2885965) also covers. We import every OHM national boundary as `administers`,
     so our data currently says both administered Manchuria.
   - **What OHM's own tags say:** the relation's tags describe it as the Republic of China
     (`official_name` 中華民國). Its `start_event` is a map published in April 1935 that set
     out South China Sea territory, and its `end_event` is French forces occupying the Paracel
     Islands. That suggests this boundary shows claimed extent rather than day-to-day
     administration.
   - **What it affects:** that is exactly the de facto / claim distinction of ground rule 2, and
     it touches disputed areas. The OHM import decisions are the maintainer's call (see
     `data/imports/openhistoricalmap/manifest.json`).
   - **Options:**
     1. Keep `administers` (no change, with the panel's existing caveat).
     2. Import OHM boundaries that overlap another polity's boundary as `claims`. That's a
        rule, and it needs care to avoid mislabelling real administration.
     3. Keep the import as it is, and raise the question with OHM's community, which would be
        an outward-facing step.

## 7. Decisions (2026-09-27)

The maintainer approved the plan with the recommended answer to each question.

1. **The plan is approved**, with one wording fix: the Manchuria example and reference test now
   say what their CShapes expectation is based on, and that it's confirmed against the imported
   data rather than assumed.
2. **UI framework: Preact, for the panels only.** Step 1 confirms that TypeScript 7 and Vite 8
   check and build it; if not, we fall back to plain TypeScript.
3. **Report button:** `date_range` is pre-filled with the **selected day**.
4. **Reporting needs a GitHub account**, which is acceptable for now.
5. **CShapes mapping:** independent state → `sovereign`; dependency → `sovereign` by the owner,
   with the CShapes status in a note.
6. **Polity records inside import folders** are allowed for units that aren't in our CC0 polity
   list. They can only be referred to by that folder's own assertions.
7. **CShapes first-of-the-month dates** are kept as given, with a note shown in the panel.
8. **Cliopatria** is imported as `controls` (de facto), and `RELATION` rows are skipped at first
   (with the count recorded).
9. **Cliopatria version:** pinned to commit `ad28a691b7c07c1fca89d0e0636d324667d2a258`, which
   both `v0.2.0` tags point to, so there's no need to ask its maintainers.
10. **Population: neither dataset for now.** If Seshat is chosen later, its account must be
    registered under the project identity, never a maintainer's personal one.
11. **Correlates of War** is left out, and COW is not contacted.
12. **Labels:** `border-correction`, `missing-event`, and `needs-source` are created (`bug`
    already existed as a GitHub default).
13. **Missing-event form:** the field `title` is renamed to `event_name` now, before any link
    depends on it, because `title` is also GitHub's own address parameter for the issue title.
    This is the only rename allowed; from now on the ids are fixed.
