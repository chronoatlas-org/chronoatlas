# chronoatlas

An open-source interactive map of how the world's borders changed through history. Drag the
timeline or press play, and every state, empire, colony, city-state, and everything in between
redraws for that date. Every border and event on the map is traced to a named source.

**Live site: https://chronoatlas-org.github.io/chronoatlas/**

> **Status: Phase 5 is closed** (the worldwide map; [plan](docs/phase-5-plan.md); Phases
> [2](docs/phase-2-plan.md), [3](docs/phase-3-plan.md), and [4](docs/phase-4-plan.md) are done
> too). Next: importing Europe from OpenHistoricalMap. Borders cover the whole world, from 3400 BCE to today, and
> change as you move the timeline: from OpenHistoricalMap in East Asia, 1900–1950, and from
> Cliopatria (approximate and year by year) everywhere else.
>
> - Click a territory to open a panel with its names over time, every record with its dates and
>   sources, its area, a link to its Wikipedia article, and what isn't in our data yet. The panel
>   has a button to report a problem with that border.
> - A switch shows the borders as administered or as legally recognized (CShapes 2.0, 1886–2019,
>   non-commercial). A cross-hatch marks contested areas, administered by one state and legally
>   recognized as another's, in East Asia 1900–1950 and Europe 1914–1944, where the maintainers
>   have reviewed which states in the two sources are the same; elsewhere the panel says "Not yet
>   checked against legal borders here".
> - A "Second opinion" toggle lays Cliopatria's borders over OpenHistoricalMap's as dotted outlines,
>   and shows where the two sources differ.
> - The map shows how sure the sources are: a border whose start or end is known only to the month
>   or year is drawn lighter for that stretch, and a contested area that depends on such a date is
>   hatched more faintly ("Possibly contested").
> - "Around this date" lists the border changes and events near the selected date.
> - Clicking the map shows, in the panel, what each source records at that spot on that date, side
>   by side.
> - Seven sourced events for Manchuria, 1931–33, are marked on the timeline.
> - The address bar always links to the exact date, view, and selection, so you can share it.
> - For contributors: every pull request that changes the data gets a plain-language summary as a
>   comment; a dataset can be re-imported with a button on GitHub; reviewers have a
>   [guide](docs/reviewing.md), and translators a [guide and glossary](docs/translating.md).
>
> See the [roadmap](docs/architecture.md#roadmap).

## What it will do

- **A world map with a timeline** that zooms from thousands of years down to single days, with
  play/pause and speed controls.
- **Border changes linked to the events behind them.** An event appears as a marker on the timeline
  and a brief pulse on the map. The territorial changes it led to follow it, and clicking the event
  opens a short summary with sources.
- **Click a territory** to see what it was on that date: its names, who controlled it, who was
  recognized as its legal owner, who else claimed it, and the sources for each.
- **A side panel** summarizing what was happening around the world near the selected date.
- **Contested borders shown as contested**, using distinct line styles and patterns (never color
  alone), plus a way to compare what different sources say.
- **Honest uncertainty.** The map shows how precise each border and date is. "No state here" looks
  different from "no data yet".
- **Shareable links** to an exact date and map view.
- **Works on phones.**

## Principles

1. **Sources, never memory.** Every border, date, and event comes from a named source recorded in
   the data. Where we have no data, the map says so.
2. **Control, recognition, and claims are tracked separately.** Who actually ran an area, who was
   legally recognized as owning it, and what each source claims.
3. **Precision is recorded**, both for dates (exact day to rough century) and for borders (treaty
   line to frontier zone).
4. **We describe and attribute; we don't adjudicate.** Disputes are shown as disputes.
5. **Licenses are checked** before any data is imported (see [CREDITS.md](CREDITS.md)).
6. **Free to run:** a static site on GitHub Pages, with no paid services or API keys.

The full rules are in [CONTRIBUTING.md](CONTRIBUTING.md#ground-rules).

## Running it on your computer

You need [Git](https://git-scm.com/) and [Node.js](https://nodejs.org/) (the LTS version).

```bash
git clone https://github.com/chronoatlas-org/chronoatlas.git
cd chronoatlas
npm install
npm run dev
```

Then open http://localhost:5173 in your browser. The page reloads automatically when you edit a
file. Stop the server with <kbd>Ctrl</kbd>+<kbd>C</kbd>.

| Command | What it does |
|---|---|
| `npm install` | Downloads the libraries the project uses into `node_modules/`. Run it once, and again after the dependencies change. |
| `npm run dev` | Starts a local development server with automatic reload |
| `npm run build` | Checks the code for type errors, then builds the published site into `dist/` |
| `npm run preview` | Serves the built `dist/` folder locally, exactly as it will be published |
| `npm run typecheck` | Only checks the code for type errors |
| `npm test` | Runs the automated tests once |
| `npm run test:watch` | Re-runs the tests every time you save a file |
| `npm run validate` | Checks every data file: format, references, dates, geometry, licenses |
| `npm run summarize-changes` | Describes, in words, what your copy of `data/` changes compared with `main` (records, borders, events, licenses, and what that does to contested areas and land areas). Pull requests get the same summary as a comment |
| `npm run suggest-crosswalk -- --region=W,S,E,N --years=FROM,TO --out=report.md --trial` | Suggests which CShapes units are the same state as Cliopatria's polities in a region and period, for the maintainers to review before contested areas are shown there (see `docs/crosswalk-review/`). Changes nothing in `data/` |
| `npm run measure-ohm` | Counts OpenHistoricalMap's country-level boundaries by region and period, to choose the next region to import. The "Measure OpenHistoricalMap's coverage" button in the Actions tab runs it on GitHub. Changes nothing in `data/` |
| `npm run build-data` | Compiles `data/` into the files the site loads (`public/data/`); runs automatically before `dev` and `build` |
| `npm run import:ohm` | Re-imports the OpenHistoricalMap borders (see [data/imports/openhistoricalmap](data/imports/openhistoricalmap/README.md)) |
| `npm run import:cshapes` | Re-imports CShapes 2.0 from its pinned files (non-commercial; see [data/imports/cshapes-2-0](data/imports/cshapes-2-0/README.md)) |
| `npm run import:cliopatria` | Re-imports Cliopatria from its pinned release (see [data/imports/cliopatria](data/imports/cliopatria/README.md)) |
| `npm run import:natural-earth` | Re-downloads the Natural Earth base map from its pinned release (see [data/imports/natural-earth](data/imports/natural-earth/README.md)) |

The data format is documented in [docs/data-format.md](docs/data-format.md).

**Publishing** is automatic. Every push to `main` runs
[.github/workflows/deploy.yml](.github/workflows/deploy.yml), which builds the site and publishes
it to GitHub Pages. The same workflow builds every pull request as a check, without publishing it.
You can follow each run in the repository's **Actions** tab. Two more workflows help review:
[data-summary.yml](.github/workflows/data-summary.yml) posts the data-change summary on pull
requests, and [reimport.yml](.github/workflows/reimport.yml) is the "Re-import a dataset" button
(OpenHistoricalMap by default, or a pinned import).

## Contributing

Corrections are welcome, especially from people who know a region's history and sources well.
Because borders are politically sensitive, every change goes through a transparent, sourced review.
Read [CONTRIBUTING.md](CONTRIBUTING.md) to learn how to report a problem or propose a change, and
what counts as a source. To draw or fix a border, see
[docs/tracing-guide.md](docs/tracing-guide.md): borders are traced in OpenHistoricalMap from dated
public-domain maps, then imported. Reviewers: see [docs/reviewing.md](docs/reviewing.md). Everyone
taking part follows our
[Code of Conduct](CODE_OF_CONDUCT.md).

## Licenses

| What | License |
|---|---|
| Code | [MIT](LICENSE) |
| Data we create (borders, events, summaries, sourced assertions) | [CC0 1.0](data/LICENSE) (public domain dedication) |
| Third-party datasets in `data/imports/` | Their own licenses. See each folder's `LICENSE` and [CREDITS.md](CREDITS.md). **Some are non-commercial.** |
| Code of Conduct | Adapted from the Contributor Covenant 3.0 (CC BY-SA 4.0) |

## Design documents

- [docs/architecture.md](docs/architecture.md): how the site and data fit together, plus the
  roadmap and showcase plan.
- [docs/data-sources.md](docs/data-sources.md): the evaluation of each dataset (coverage,
  precision, format, license), including statistics datasets.
- [docs/phase-2-plan.md](docs/phase-2-plan.md): the plan for Phase 2 (approved 2026-09-27),
  with progress and open questions.
- [docs/phase-3-plan.md](docs/phase-3-plan.md): the plan for Phase 3, contested and uncertain
  borders (approved 2026-09-28), with progress.
- [docs/phase-4-plan.md](docs/phase-4-plan.md): the plan for Phase 4, the contribution pipeline
  (approved 2026-09-28), with progress.
- [docs/phase-5-plan.md](docs/phase-5-plan.md): the plan for Phase 5, the worldwide map
  (approved 2026-09-28), with measurements and progress.
- [docs/reviewing.md](docs/reviewing.md): how to review a pull request, merge it without a time
  zone stamp, and set up the repository's settings.
- [docs/tracing-guide.md](docs/tracing-guide.md): how to trace a border in OpenHistoricalMap
  from a dated public-domain map so that our import picks it up.
