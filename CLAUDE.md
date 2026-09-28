# CLAUDE.md: working rules for this project

This project is an open-source, collaborative interactive map of how the world's borders changed
through history. It has a world map with a zoomable timeline (from millennia down to single days),
border changes linked to the events behind them, and transparent, sourced corrections. It is a
static site hosted on GitHub Pages.

Repo: https://github.com/chronoatlas-org/chronoatlas. The plan was approved on 2026-09-26; see
[Architecture](#architecture) below.

## Ground rules (always apply; they override convenience)

1. **Sources, never memory.** Never draw, estimate, or fill in a border or a date from your own
   knowledge. Every border, every date, and every event (including its summary text) must come
   from a named source (a dataset or citable reference) recorded in the data.
   - No source means don't add it. Record the gap instead, and the map shows "no data". An honest
     gap beats a confident guess.
   - Never interpolate or morph between two sourced borders. Show the time between them as
     uncertain.
   - Write event summaries in our own words from the cited sources. Never paste Wikipedia text
     (CC BY-SA) into our data.
   - A Wikidata statement counts only as good as its reference. Check what it cites; "imported
     from Wikipedia" is a lead, not a source.
   - Test fixtures use obviously synthetic shapes and names (e.g. "Testland"), flagged as test
     data. Never real-looking borders.
2. **Control, recognition, and claims are different things.** Track them separately: who actually
   controlled an area (de facto), who was legally recognized as sovereign (de jure, and by whom),
   and what each source claims. Puppet governments, occupations, undeclared wars, and moving front
   lines must be representable without flattening them. Japan's war in China (1937–45) is the
   reference test case.
3. **Record precision explicitly.** Every date carries its precision (exact day, month, year,
   approximate, century, and so on). Every shape carries its edge precision (treaty or surveyed
   line, approximate line, frontier zone, unknown). Many older frontiers were zones, and large
   areas had no state. "No state here (per source X)" must look different from "no data yet".
4. **Describe and attribute; don't adjudicate.** State what each source says, with attribution.
   Don't pick sides in disputes; show contested areas as contested. Names get attributed too,
   because what a polity is called can itself be contested.
5. **Check licenses before importing.** Check every dataset's license before importing it. Flag
   non-commercial (NC) and share-alike or copyleft (SA, GPL) terms, and explain what they mean
   for us. Never merge data under incompatible licenses into one file. Keep each third-party
   dataset in its own folder with its license and a manifest (URL, version, checksum, retrieval
   date). Keep `CREDITS.md` current.
6. **Free to run.** Static site on GitHub Pages: no paid services, no API keys, no servers. Mind
   GitHub's limits: 100 MB per file, about 1 GB for the repo and for the published site, and
   100 GB/month bandwidth (soft limit).

Contested and disputed styling never relies on color alone; use line styles, patterns, and text
labels as well. The site must work on phones.

## Working agreements with the maintainer

- Build in small steps. After each step, commit with a clear message, explain how to see it
  running locally, and explain the decisions in plain language. Don't assume familiarity with
  Git, TypeScript, or web frameworks. The maintainer needs to be able to maintain the code and
  review other people's contributions.
- Don't write code for a phase until the maintainer has approved its plan.
- Ask before anything outward-facing, including the first push to the public repo, creating or
  renaming repos, releases, and changes to repo settings.
- Never touch the maintainer's other repositories.
- Never ask for, type, or store passwords or tokens. Authentication goes through `gh auth`, done
  by the maintainer.
- When a decision belongs to the maintainer (licenses, scope, which sources to use), ask instead
  of guessing.

## Privacy and safety of maintainers

This project touches nationalist sensitivities, so maintainers stay pseudonymous.

- The project's only public identities are the GitHub organization `chronoatlas-org` (which
  owns the repo) and the account `chronoatlas-project` (which owns the organization and makes the
  commits). Conduct reports go to `chronoatlas.conduct@gmail.com`.
- Never put a maintainer's personal details anywhere public: not in files, commits, issues, pull
  requests, or comments. That includes real names, personal accounts or usernames, location,
  school, employer, or family. Write as "the maintainers".
- Commits use the project identity (already set in this repo's local git config) with **UTC
  timestamps**, so they don't reveal a timezone. Prefix commit commands with `TZ=UTC` in Git
  Bash, or set `$env:TZ = 'UTC'` first in PowerShell.
- Before pushing, check that `git log --format='%an <%ae> %ad'` shows only the project identity
  and `+0000`.
- The GitHub CLI also holds the maintainer's personal login. Check that `gh auth status` shows
  `chronoatlas-project` as active before any GitHub operation on this project.

## Review checklist for data changes (for humans and for Claude)

- Does every new or changed border, date, and event cite a source, with a locator such as a page,
  map sheet, or feature ID?
- Is the source's license compatible with where the data is stored?
- Are de facto control, de jure sovereignty, and claims kept distinct?
- Are date precision and edge precision recorded, and not overstated?
- Is the description attributed rather than asserted, so both sides of a dispute would call it
  fair?

## Architecture

The full design is in [docs/architecture.md](docs/architecture.md). The dataset evaluation is in
[docs/data-sources.md](docs/data-sources.md). Keep both current when decisions change.

**Approved decisions (2026-09-26)**

- **Stack:** TypeScript + Vite + MapLibre GL JS, with Vitest for tests. The map and timeline are
  plain TypeScript; the UI framework for panels is decided in Phase 2.
- **Licenses:** code is MIT (`LICENSE`); our own data is CC0 1.0 (`data/LICENSE`).
- **Third-party data** lives only in `data/imports/<dataset>/`, with its own `LICENSE` and a
  manifest. Anything derived from it, including shapes and assertions, stays in that folder, and
  each source ships as its own layer.
- **Datasets:** OpenHistoricalMap (CC0) is used, starting with East Asia 1900–1950 in Phase 1.
  CShapes 2.0 (CC BY-NC-SA) is used as an isolated de jure layer. Cliopatria (CC BY) is used as a
  second opinion and later the worldwide baseline. Natural Earth (public domain) is the base map.
  Wikidata supplies IDs only. **historical-basemaps (GPL-3.0) is not used.**
- **Dates:** EDTF strings in files, converted to Julian Day Number ranges at build time. Never
  use JavaScript `Date` for historical dates.
- **Data model:** Source, Polity, Shape, Assertion (de facto / de jure / claim relations), Event
  (with `effects`), and Coverage. Geometry is kept separate from meaning.
- **Names:** stored with language and script. Original scripts (zh, ja, ko, …) are shown
  alongside English from the start.
- **The architecture must scale** from the East Asia showcase to a worldwide map without
  redesign.

**Approved decisions (2026-09-27)**

- **Home:** the repo lives in the GitHub organization `chronoatlas-org` (moved there on
  2026-09-27), which is owned by the `chronoatlas-project` account. It moved before links spread,
  because GitHub doesn't redirect Pages URLs after a transfer, so the site's address must not
  change again. Organizations also allow triage-only moderator roles. The organization requires
  two-factor authentication for all members.
- **Figures (statistics)** are part of the data model. Each is sourced, dated, ranged where
  possible, and carries a `basis`: `polity-territory`, `present-day-borders`, or
  `computed-from-shape`. Never interpolate between estimates. Never attach a figure based on
  present-day borders to a historical polity as if it described that polity's territory.
- **Translation:** all UI text goes through `src/i18n/` catalogs (English first). Never format
  historical dates with `Intl`.
- **Borders are drawn in OpenHistoricalMap** and imported. Never hand-edit imported geometry;
  fix it upstream and re-import. `data/shapes/` is only for documented exceptions.
- **IDs are permanent** once published: never renamed or reused. Wikidata IDs are
  cross-references only.

**Phase 2 plan approved (2026-09-27)**, with all its recommendations. The plan and the full
list of decisions are in [docs/phase-2-plan.md](docs/phase-2-plan.md#7-decisions-2026-09-27).
The ones that affect everyday work:

- **Preact for the panels only** (JSX in `.tsx` files). The map and timeline stay plain
  TypeScript.
- **CShapes:** independent → `sovereign`; dependency → `sovereign` by the owner, with the status
  in a note. Dates are kept as given, with a note when they fall on the 1st of a month.
- **Cliopatria:** pinned to commit `ad28a691b7c07c1fca89d0e0636d324667d2a258`. Rows become
  `controls`, and `RELATION` rows are skipped at first.
- **Polity records inside an import folder** are allowed for units that aren't in our CC0 list,
  referred to only by that folder's assertions.
- **No population dataset for now.** The first Figure is `area-km2`, computed from our shapes.
  Correlates of War is left out.

**Phase 3 plan approved (2026-09-28)**, with all its recommendations; Phase 2 is closed. The
plan and its decisions are in [docs/phase-3-plan.md](docs/phase-3-plan.md#12-decisions-2026-09-28),
and its order of work gives a recommended effort setting for each step. The ones that affect
everyday work:

- **Uncertain dates look uncertain at both ends:** a record stays on the map, lighter, until the
  last day it could have ended (`e1`, from `dayRanges`; in tiles and polity files only when it
  differs from `e0`). The panel, land areas, contested areas, and colors use the same end. A land
  area measured over a record in its uncertain window says the area held may have been
  smaller.
- **Words:** "contested" means administered by one state and legally recognized as another's (or,
  later, conflicting claims). A disagreement between sources is "sources differ", shown only in
  the compare view.
- **No empty features:** styles with no real data yet (approximate lines, frontier zones,
  claims) are tested with Testland and appear on the map and legend only when the build finds
  real data. "No state" is put off, and the stipple is kept free for it.
- **Words on the map (Phase 3 step 5):** drawn with the visitor's own fonts; the style has no
  `glyphs` and no font files (MapLibre 6 falls back to the browser's fonts), so decision 8's
  hosted font isn't needed. The build writes one label point per record (`scripts/lib/labels.ts`,
  the point farthest from the edges) in a `labels` tile layer, split where the polity's name
  changes, with `a` (area in thousands of km²) to place large territories first and to hide
  small ones until zoomed in. De jure labels for dependencies carry `unit` and `status` ("Korea /
  Colony of Japan"). Contested areas have their own `labels` ("Contested", "Possibly contested"),
  placed before names. Label days are in the change index.
- **Sources differ (Phase 3 step 7; threshold approved 2026-09-28):** `buildDiffer` runs the contested computation
  between the default map and Cliopatria (both record control), keeping pieces at least
  `DIFFER_MIN_WIDTH_KM` (10) wide on average (`meanWidthKm`) and `DIFFER_MIN_KM2` (1,000) in
  area. Its own tile set (`differ-tiles/`, CC BY 4.0, credit Cliopatria) is shown only with the
  second opinion on over the default view (`HistoricalLayers.comparing`); polity files carry
  `differ` entries, worded "Sources differ: …" in the panel.
- **Line styles:** dots mean the second opinion and dashes are already taken, so edge precision
  is shown by sharpness (a softened line, a soft band). The build puts `ep` on lines (1
  approximate, 2 frontier zone; `EDGE_CODES`) and lists the kinds present in `tiles.json`
  (`precision`), and the legend shows those entries only then. Polity files give each territorial
  record's `edge`, which the panel shows as "Border line". No real shape records any yet: every
  import sets `unknown`.

**Phase 4 plan approved (2026-09-28)**, with all its recommendations; Phase 3 is closed, and its
step 9 (claims) is on the showcase data track. The plan and its decisions are in
[docs/phase-4-plan.md](docs/phase-4-plan.md#10-decisions-2026-09-28), with an effort setting for
each step. The ones that affect everyday work:

- **Data-change summary:** `scripts/summarize-changes.ts` compares `main`'s data with a pull
  request's and writes Markdown. `.github/workflows/data-summary.yml` (`workflow_run`, after
  "Build and deploy" finishes on a pull request) runs **main's** code (`scripts/post-summary.ts`),
  which takes only the pull request's `data/` from GitHub's test merge (`refs/pull/N/merge`; first
  parent = base) as files, summarizes it, and posts one comment, updated in place. It never runs
  the pull request's code, so the summary can't be forged (a change from the plan's artifact
  design, step 3). Never interpolate event fields into a `run:` command; the script reads the
  event file.
  - The comment is found by author `github-actions[bot]` plus `SUMMARY_MARKER`; decisions are in
    `scripts/lib/pr-comment.ts` (tested). The full summary goes on the run's summary page.
  - Symbolic links in the extracted data are deleted before reading (`removeLinks`).
  - `workflow_run` workflows run only from the default branch's copy, so a change to them takes
    effect once it's on main.
  - The comparing and wording are in `scripts/lib/summary.ts` (pure, tested). Dates, relations,
    sources, and border-line words reuse the panel's (`describePeriod`, `sourceLink`, `t()`).
  - Everything a pull request wrote goes through `plain()` (escaped, one line, length-capped) or
    `code()`, so it can't add links, images, HTML, or mentions to a comment posted with write
    permission. Only links we build ourselves (OpenHistoricalMap relations, FRUS documents, the
    live map) are clickable.
  - Contested areas, "sources differ", and land areas are recomputed for both copies only when
    territorial records, shapes, or crosswalks changed (about 3 minutes), and compared day by day
    (`compareOverTime`), rounded to 3 significant figures as the site shows them.
  - `loadDataset(dir)` names files from the folder holding that copy (`data/…`) and sets `root`;
    the build reads an import's manifest from `ds.root`.
- **Re-import button:** `.github/workflows/reimport-ohm.yml` (workflow_dispatch, main only)
  re-imports OpenHistoricalMap, commits as `github-actions[bot]` in UTC on
  `import/openhistoricalmap-<date>-<run>`, opens a pull request, posts the summary, and starts
  "Build and deploy" on the branch with `gh workflow run` (a workflow's pull request starts no
  workflows, but a dispatch does). It needs "Allow GitHub Actions to create and approve pull
  requests". CShapes and Cliopatria stay pinned and are updated by hand.
- **Reviewer guide:** `docs/reviewing.md` (reading the summary, checking sources, each kind of
  change, sensitive changes, privacy, merging by fast-forward, and the repository settings).
  Keep it in step with the workflows and forms.
- **Repository settings** (rulesets for main, labels, the Actions pull-request setting) are the
  maintainers' clicks; `docs/reviewing.md` section 7 gives the steps. `.github/CODEOWNERS` asks
  for the project account's review on licenses, import folders, crosswalks, and `.github/`.
- **Merging:** finished work reaches main by fast-forward (option b), never the merge button,
  which stamps a time zone. The reviewer guide has the PowerShell steps.
- **Testing a workflow locally:** a `git fetch --depth=…` into this clone makes it shallow and
  breaks later pushes; undo with `git fetch --unshallow origin`.

**CShapes decisions (2026-09-27)**, made while importing it:

- **Columns from the R package:** its status, owner, and "borders defined" columns come from the
  authors' R package (labelled GPL (>= 2)). They're treated as part of CShapes 2.0 under
  CC BY-NC-SA 4.0. The maintainers asked the authors to confirm (2026-09-27); if they object, the
  import is re-done without those columns or removed.
- **Occupied units** become `occupies` by the owner. Colonies, protectorates, and mandates become
  `sovereign` by the owner.
- **Assertions name CShapes' own units** (`cshapes-<gwcode>`). The hand-written
  `polity-crosswalk.yaml` links them to our polities; never cut CShapes rows to fit our polities.
- **Cliopatria (2026-09-28)** is matched to our polities by a reviewed crosswalk, never
  automatically by Wikidata ID. Some of its IDs are wrong for this period: "Republic of China" has
  Q148, and "Republic of Korea" has Q423.
- **Disagreements under 10,000 km² aren't contested:** CShapes doesn't code changes that small,
  so it has no view on them (Hong Kong, Macau, Goa, concessions, border slivers). Legal status
  for small territories comes from our own sourced records.

**Environment:** the maintainer works on Windows, and commands are run in PowerShell. Git, Node.js
LTS, and the GitHub CLI are installed.

**Commands** (see the README table): `npm install`, `npm run dev` (http://localhost:5173),
`npm run build`, `npm run preview`, `npm run typecheck`, `npm test`, `npm run test:watch`,
`npm run validate`, `npm run summarize-changes` (compares `data/` with `origin/main`; options at the
top of the script), `npm run build-data`, `npm run import:ohm`, `npm run import:cshapes`, and
`npm run import:cliopatria` (add `-- --offline` to reprocess the last download),
`npm run import:natural-earth`.

**Data pipeline**

- **Flow:** import scripts (`scripts/import-*.ts`) write `data/imports/<dataset>/`. Then
  `npm run validate` checks everything against `schemas/*.schema.json` plus references, dates,
  and geometry. Then `npm run build-data` writes `public/data/` (gitignored), which the site
  loads:
  - `tiles/<version>/{z}/{x}/{y}.pbf`: vector tiles, zoom 0–7, source-layer `borders` (the
    fills) and `lines` (the border lines, written apart by `scripts/lib/outlines.ts` without the
    cuts along an import's edge or the stretches more than 2 km out to sea). The de jure and
    second-opinion tile sets have the same two layers, and the map draws every border line from
    `lines`, never by outlining a fill. From zoom 4 (`COAST_MIN_ZOOM`) the default tiles also have
    `land`: each border's land part (`coastCut`, only when its coastal waters are at least 1% of
    it), filled over a faint tint of the whole shape, so fills stop at the coast;
  - `coast-tiles/<version>/…` (zoom 4–7, inside the imports' areas): Natural Earth's 1:10m land,
    sea, and coastline, drawn over the 1:50m base map up close so the coast matches the cut;
  - `edges.json`: where each import's area ends, over land, while its years apply ("Edge of
    imported data");
  - `tiles.json`: version, bounds, zooms, and the change index;
  - `sources.json`: every source's title and address;
  - `events.json`: every event's day range, importance, title, and place, for the timeline's
    markers and the map's pulse;
  - `events/<id>.json`: one event in full (summary, sources, place, effects), for the panel;
  - `changes.json`: every day a territorial record starts or ends, with its polity and source,
    for "Around this date" (it will need splitting by period for the worldwide map);
  - `polities/<id>.json`: one polity's names, every record that mentions it, and its figures
    (land areas), for the territory panel. A visitor downloads only the ones they open, which is what lets this scale
    worldwide.

  The build deletes `public/data/` first. Keep tile properties minimal (only what the map draws
  or filters on), because they're repeated in every tile. Text for the panel belongs in the
  polity files.
- **Performance:** the map only updates when the day crosses a change day
  (`src/map/changes.ts`). Filtering by date uses `filter` with global state, not opacity (we
  measured opacity at 4–5 times slower). Measurements are in
  docs/architecture.md#measured-phase-1-step-7-2026-09-27.
  The format reference for contributors is `docs/data-format.md`; keep it in sync with the
  schemas.
- **`end` is exclusive:** it's the first day a statement no longer applied, or `ongoing`, or
  `unknown`. Convert sources that give the *last* day. CShapes' `gwedate` is inclusive, so add
  one day.
- **OpenHistoricalMap import:** admin_level=2 boundaries become `administers` assertions. How
  contributors trace a border in OHM so this import reads it is in `docs/tracing-guide.md`; keep
  it in step with `scripts/import-ohm.ts`. The query filters on plain `start_date`, so a relation
  with only `start_date:edtf` is never downloaded. Every
  interpretation decision is in `data/imports/openhistoricalmap/manifest.json`. Changing one is
  the maintainer's call. Re-importing replaces the OHM-sourced names in `data/polities/` and keeps
  all other names and fields. Polity IDs are fixed in `polity-ids.json`.
- **CShapes import** (`data/imports/cshapes-2-0/`, CC BY-NC-SA 4.0):
  - Everything derived from it stays in that folder, including its polity records
    (`polities/cshapes-<gwcode>.yaml`) and the hand-written `polity-crosswalk.yaml`.
  - The build's `onDefaultMap()` keeps every import except OpenHistoricalMap off the default
    map. Each other source becomes its own layer.
  - The import stops if an upstream checksum changes. Review the change, then re-pin.
- **Cliopatria import** (`data/imports/cliopatria/`, CC BY 4.0):
  - It's shown as a "second opinion" (`SECOND_OPINION_FOLDERS` in the build): dotted outlines,
    toggled in the header, `alt=cliopatria` in links.
  - Grouping rows ("(British Empire)", with `Components`) are skipped, because their parts
    cover the same land.
  - The zip is read by `scripts/lib/zip.ts`, and the import needs a larger Node memory limit
    (set in its npm script).
- **Contested areas** (`scripts/lib/contested.ts`, Phase 2 step 9):
  - **What they are:** where the default map's administering polity and a de jure source's
    sovereign or occupying state differ on the same days. The crosswalk decides what counts as
    the same state.
  - **Where they go:** computed by the build into their own tile layer (`contested-tiles/`) and
    into polity files. They are never written into `data/`, because they carry CShapes'
    license.
  - **Possibly contested (Phase 3 step 2):** each period is split at the edges of the days both
    records certainly applied (`splitByCertainty`). The parts outside, where a start or end is
    known only to the month or year, are marked `maybe`: a fainter hatch, and "Possibly contested"
    in the panel.
  - **Checking them:** the build prints every contested pair; review it when the crosswalk or an
    import changes.
  - **Map layers:** `tiles.json` lists the extra tile sets under `extra`, the de jure view
    (`dejure-tiles/`) and the contested areas. The change index covers all three.
- **Land areas** (`scripts/lib/land.ts`, `computeAreas` in `scripts/build-data.ts`, Phase 2
  step 11):
  - The build measures the land inside each default-map polity's borders, using Natural Earth's
    1:10m land (`ne_10m_land.geojson`). Only the build uses that file; the site never loads it.
    The results go into polity files as `figures` (`basis: computed-from-shape`).
  - There's one figure per polity, relation, and stretch of time in which the same records
    apply. Several records at once are measured over their union, so overlaps count once.
    Different relations are never added together.
  - Values are rounded to 3 significant figures (the panel shows 2). `partOf` marks a shape cut
    at the edge of its import's area, and `waterKm2` gives coastal waters of at least 1% of the
    border's area. The panel says the coastline is present-day and lakes count as land.
- **Never hand-edit files under `data/imports/`.** Fix upstream and re-import. The one exception
  is `polity-crosswalk.yaml`, which is hand-written by design.
- **Polity records:** records built from CC0/public-domain sources may live in
  `data/polities/`. Nothing derived from NC or SA sources may be written outside that source's
  import folder.
- **Examples and fixtures** in docs and tests use made-up names, dates, and coordinates
  (Testland), never real-looking ones.

**Implementation notes**

- `scripts/*.ts` run directly in Node 24, which strips the types. Keep them to "erasable" syntax
  only: no `enum` and no `namespace`. This is enforced by the `erasableSyntaxOnly` setting.
- Modules shared between the site and Node scripts (for example `src/dates/`) must import each
  other with explicit `.ts` extensions (`from './jdn.ts'`), because Node requires them.
- **Dates:** use `src/dates` for everything: `parseEdtf`, `civilToJdn`/`jdnToCivil`,
  `formatDate`. Every date is a JDN range `[earliest, latest]`. "Approximate" and "uncertain"
  are flags that never widen the range. Seasons (`2001-21`) are rejected until we define their
  months. Tests cross-check against documented reference days and against JavaScript `Date`,
  which is allowed in tests only.
- MapLibre's worker is bundled by Vite (`?worker&url`) and registered with `setWorkerUrl()` in
  `src/main.ts`. Without that, the worker fails to load in both dev and production.
- In dev mode the map, timeline, historical layers, and panel are exposed as `window.map`,
  `window.timeline`, `window.historical`, and `window.panel`, for debugging in the browser
  console.
- **Translation:** never hard-code on-screen text. Add a key to `src/i18n/en.ts` and use
  `t('key', { placeholder })`. Static HTML text uses `data-i18n="key"`, which `src/main.ts`
  fills in. Date wording goes through `src/dates/format.ts`, which uses the catalogs.
- **Timeline:** `src/timeline/scale.ts` holds the pure logic (tick units, calendar-aligned
  ticks, keyboard steps) and is tested. `src/timeline/timeline.ts` holds the DOM, canvas, and
  input. The design is in docs/architecture.md#the-timeline. Event markers' logic (which show
  at a zoom, next/previous, click hit-testing) is in `src/timeline/events.ts`.
  - To see markers before real events exist, inject made-up ones from the dev console
    (`timeline.setEvents([...])`). Never add fake events to `data/`.
- **URL state:** `src/url/state.ts` parses and formats the hash (`d`, `m`, `sel` or `ev`, `lang`), and
  `src/main.ts` syncs it. Anything the timeline calls during its constructor, such as `onChange`,
  must not touch `let`/`const` variables declared after `new Timeline(...)`. A real bug came from
  this. That's why the panel and historical layers are created before the timeline.
- **Territory panel (`src/panel/`):**
  - `model.ts` works out what the panel says, as plain data. It's pure and tested, so put logic
    here.
  - `panel.tsx` only lays that out with Preact, plus a small `TerritoryPanel` class that
    `main.ts` drives (`select`, `setDay`). It loads `polities/<id>.json` on selection. A 404
    means the ID isn't in our data, so the panel closes and `sel` drops out of the address.
  - JSX works through `jsx`/`jsxImportSource` in `tsconfig.json`, which Vite also reads; there's
    no Preact build plugin. Never use `dangerouslySetInnerHTML`: names come from outside data.
  - `sheet.ts` holds the phone bottom sheet's heights and handle (drag, tap, arrow keys). Its
    heights must match `.panel[data-sheet=…]` in `src/style.css`.
  - A map click passes every polity at that spot (`onSelect(polities, spot)`), and the panel offers
    the others ("Also recorded at the spot you clicked"), because records can overlap and none
    may be unreachable.
  - **"What each source says at the spot you clicked"** (Phase 3 step 6): `HistoricalLayers.recordsAt`
    fetches each source's zoom-7 tile at the spot (default map, de jure, second opinion, shown or
    not), reads it with `src/map/mvt.ts` (our own small tile reader, so the site needs no extra
    library), and finds the polygons containing the point. `describeSpot` (model.ts) lays them out
    side by side for the day, with "No record here" per source; `tiles.json` names each tile set's
    `sources` for that.
  - Selecting by click adds a Back-button step (`writeUrlNow({ push: true })`); closing only
    replaces the address.
  - Polity files carry the crosswalk-linked de jure records (`via`, `link`, `m0`/`m1` for when
    the link applies), `contested` entries, `figures`, and each territorial record's `km2`. The panel
    counts a linked record as current only inside its link's window.
  - The map's view switch (`HistoricalLayers.setView`: 'facto' or 'jure') is recorded in the
    address as `v=jure`.
  - The panel shows a `Selection`: `{ kind: 'polity' | 'event' | 'nearby', id }`. 'nearby'
    ("Around this date") lists what's in the timeline's visible range, so the panel redraws
    when the timeline zooms (`onZoom`). When an event's file
    loads, `onEventShown` lets `main.ts` outline its effects (`HistoricalLayers.setEffects`,
    dashed, whatever the date) and pulse its place (`HistoricalLayers.pulse`).
  - The Vite dev server can miss a second quick save of the same file and keep serving the
    older version. If the browser runs code that doesn't match the file, restart the dev server.
  - **Source links:** `sourceLink` links an OpenHistoricalMap "relation N" and a FRUS "document N"
    (in a source whose URL is a history.state.gov volume) to the exact record. Event sources show
    each citation's `note` (who is speaking) on its own line; records fold their citation notes
    into their own notes instead.
  - The panel keeps control, sovereignty, and claims apart. For each date it names the kinds with
    no record ("Not in our data yet for this date: …"), so silence isn't read as "there was none".
    Names get a `lang` attribute, so Chinese and Japanese text use the right glyphs.
- **Testing in the Claude app's browser pane:**
  - A hidden pane has zero size, and pauses both animation frames and resize notifications. Set
    a viewport with `resize_window` before judging layout or drawing, and reset it afterwards.
  - Screenshots can time out when the app window is covered; check state with JavaScript
    instead.
  - Clipboard writes are denied in the pane, so the Copy link fallback message is expected.
  - `history.back()` from a script does nothing in the pane. To test the Back button, use the
    browser tool's navigate with "back".
  - CSS transitions don't advance in a hidden pane, so measured heights lag. Set
    `style.transition = 'none'` before measuring.
- MapLibre waits for the browser's animation frames, which don't run while the page is hidden.
  A map that "never loads" in a background tab may just be paused.
- **Deployment:** `.github/workflows/deploy.yml` builds pull requests and deploys `main` to
  GitHub Pages (https://chronoatlas-org.github.io/chronoatlas/). The Pages source is "GitHub
  Actions", so no Jekyll processing and no `gh-pages` branch. Actions are pinned to full commit
  SHAs with a version comment. To update one, look up the new release's commit, and keep the
  permissions minimal.
- **Issue forms** are in `.github/ISSUE_TEMPLATE/`. Their field `id`s are **stable**, because
  links pre-fill them through query parameters (`issues/new?template=border-correction.yml&territory=…`).
  Never rename or remove one; `scripts/issue-forms.test.ts` checks them.
  - `border-correction.yml`: `territory`, `date_range`, `problem`, `sources`, `ohm_change`
    (added 2026-09-28), `view_link`, `suggested_fix`, `confirmations`.
  - `missing-event.yml`: `event_name`, `date`, `location`, `why_it_matters`, `sources`,
    `related_territories`. (`event_name` was `title` until 2026-09-27, renamed before any link
    used it because `title` is GitHub's own parameter for the issue title.)
  - `bug.yml`: `what_happened`, `expected`, `steps`, `view_link`, `device_browser`.
  - `suggest-source.yml` (added 2026-09-28): `source_title`, `link`, `covers`, `license`,
    `why_useful`, `confirmations`.
  - The panel's "Report a problem with this border" link is built by `src/url/report.ts`
    (`REPORT_FORM` lists the fields it fills). Never add a `labels` parameter: without
    permission GitHub answers 404.
  - `config.yml` contact links must be `https://`; GitHub rejects `mailto:`.
