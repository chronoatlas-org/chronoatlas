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
| UI panels | Plain TypeScript at first; framework decided in Phase 2 | Fewer moving parts while the core is built |
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

**No state vs. no data:**
- Inside a source's coverage, an area with no polity is shown as **"no state (per source)"**.
- Outside every source's coverage, it's **"no data yet"**.
- A source can also state explicitly that an area was stateless.

**Computed at build time:**
- **Contested** means claims conflict, or the controller differs from the legal sovereign, or
  sources disagree about who controlled an area.
- **Views:**
  - de facto (the default)
  - de jure (per a chosen source)
  - claims
  - compare sources

### Example (real, verified values)

```yaml
# data/imports/ohm/assertions/manchukuo.yaml
- relation: administers          # de facto; how OHM maps to this is documented in the import manifest
  subject: manchukuo             # Wikidata Q30623
  shape: ohm/r2885965
  start: "1932"                  # year precision, as OHM records it
  end: "1945-08-17"
  sources: [{ source: ohm, locator: "relation 2885965, snapshot 2026-09-26" }]

# data/imports/cshapes-2.0/assertions/china.yaml
- relation: sovereign            # de jure
  subject: republic-of-china
  shape: cshapes/710-1921-03-13
  start: "1921-03-13"
  end: "1945-08-14"
  sources: [{ source: cshapes-2.0, locator: "gwcode 710",
              note: "codes de jure only; excludes the occupation of Manchuria (codebook §3)" }]
```

In 1937 both assertions cover Manchuria. The map hatches it as contested, and the territory
panel shows "administered by Manchukuo (per OHM) / sovereign: Republic of China (per CShapes)".

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

- **Change index:** the build lists every day on which anything changes. While you drag the
  timeline, the map only updates when the date crosses one of those days (found by binary
  search), so most frames cost nothing.
- **How the map filters by date:** the current date is stored in MapLibre's "global state" and
  used in style expressions. Per MapLibre's docs, using it in a *filter* makes tiles reload,
  while using it in a *paint* property (for example, opacity) doesn't. Phase 1 benchmarks both.
  If neither is smooth enough, the fallback is GPU filtering with deck.gl.
- **Data delivery:** the showcase data is small enough to load as GeoJSON, once per source. The
  worldwide data (Cliopatria is 158 MB) will be cut into map tiles grouped by era.
  - We'll start with a plain folder of tiles made by Node.js tools, which run on Windows, Mac,
    and Linux.
  - We avoid PMTiles for now, because there are open reports of it loading unreliably on GitHub
    Pages.
- **Limits:** 100 MB per file in the repo; about 1 GB for the repo and for the published site;
  100 GB/month bandwidth (soft limit).

## Visual language (never color alone)

| Meaning | Style |
|---|---|
| Boundary | solid line |
| Claim | dashed line |
| Approximate border | dotted line |
| Contested, or controller differs from legal sovereign | hatched fill |
| Frontier zone | blurred edge |
| No state (per source) | light stipple, plus a label |
| No data yet | gray crosshatch, plus a label |

Every style is also explained in words in the territory panel. Motion effects, such as event
pulses, respect the browser's reduced-motion setting.

## URL and sharing

The map state lives in the URL hash, for example `#d=1937-07-07&m=5/35/115&sel=manchukuo`
(date, zoom/latitude/longitude, selected territory). Hash URLs work on static hosting with no
server.

## Names

Polity names are stored with language and script tags. Original-script names (for example
Chinese, Japanese, and Korean) are shown alongside English from the start.

## Roadmap

- **Phase 0, setup:** repo, licenses, README, CONTRIBUTING, code of conduct, credits, CLAUDE.md,
  design docs.
- **Phase 1, map and timeline, live on GitHub Pages:**
  1. ✅ Vite + TypeScript + MapLibre with a Natural Earth base map.
  2. ✅ Automatic deployment to GitHub Pages, plus a build check on pull requests. This was moved
     up from step 7 so that every later step is visible online.
  3. ✅ A date library (EDTF → day numbers, BCE, precision) with tests, in `src/dates/`.
  4. The timeline: zoom from millennia to days, drag, play/pause, speed, keyboard control.
  5. Data schema, validator, and a pinned import of OHM for East Asia 1900–1950. Everywhere else
     shows "no data".
  6. URL state and phone layout.
  7. A scrubbing benchmark.
  8. Data checks in CI; basic issue forms.
- **Phase 2, panel, events and transitions (the showcase begins):**
  - Territory panel with a "Report a problem with this border" button.
  - Events on the timeline, a pulse on the map, and transitions linked to events.
  - A "world around this date" panel.
  - CShapes (de jure) and Cliopatria (second opinion) layers.
  - First borders traced from public-domain maps.
- **Phase 3, contested and uncertain borders:** the full visual language, soft edges, a
  compare-sources view, and "no state" vs "no data".
- **Phase 4, contribution pipeline:**
  - Complete issue forms and a pull request template.
  - A bot comment summarizing each data change.
  - A reviewer guide, and an upstream-to-OHM guide.
- **Phase 5, worldwide:** Cliopatria as the global baseline with era-grouped tiles, more regions,
  and UI translations.

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
