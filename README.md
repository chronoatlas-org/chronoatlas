# chronoatlas

An open-source interactive map of how the world's borders changed through history. Drag the
timeline or press play, and every state, empire, colony, city-state, and everything in between
redraws for that date. Every border and event on the map is traced to a named source.

**Live site: https://chronoatlas-org.github.io/chronoatlas/**

> **Status: Phase 1 complete; Phase 2 is being planned.** Country borders for East Asia,
> 1900–1950, imported from OpenHistoricalMap, change as you move the timeline; click a territory
> for its name, dates, and source. Everywhere else shows "no data yet". The address bar always
> links to the exact date and view you're looking at, so you can share it. Problems can be
> reported with the [issue forms](https://github.com/chronoatlas-org/chronoatlas/issues/new/choose).
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
| `npm run build-data` | Compiles `data/` into the files the site loads (`public/data/`); runs automatically before `dev` and `build` |
| `npm run import:ohm` | Re-imports the OpenHistoricalMap borders (see [data/imports/openhistoricalmap](data/imports/openhistoricalmap/README.md)) |
| `npm run import:natural-earth` | Re-downloads the Natural Earth base map from its pinned release (see [data/imports/natural-earth](data/imports/natural-earth/README.md)) |

The data format is documented in [docs/data-format.md](docs/data-format.md).

**Publishing** is automatic. Every push to `main` runs
[.github/workflows/deploy.yml](.github/workflows/deploy.yml), which builds the site and publishes
it to GitHub Pages. The same workflow builds every pull request as a check, without publishing it.
You can follow each run in the repository's **Actions** tab.

## Contributing

Corrections are welcome, especially from people who know a region's history and sources well.
Because borders are politically sensitive, every change goes through a transparent, sourced review.
Read [CONTRIBUTING.md](CONTRIBUTING.md) to learn how to report a problem or propose a change, and
what counts as a source. Everyone taking part follows our [Code of Conduct](CODE_OF_CONDUCT.md).

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
- [docs/phase-2-plan.md](docs/phase-2-plan.md): the proposed plan for Phase 2 (awaiting
  approval).
