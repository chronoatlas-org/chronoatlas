# CLAUDE.md: working rules for this project

This project is an open-source, collaborative interactive map of how the world's borders changed
through history. It has a world map with a zoomable timeline (from millennia down to single days),
border changes linked to the events behind them, and transparent, sourced corrections. It is a
static site hosted on GitHub Pages.

Repo: https://github.com/chronoatlas-project/chronoatlas. The plan was approved on 2026-09-26; see
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

- The project's only public identity is the GitHub account `chronoatlas-project`. Conduct
  reports go to `chronoatlas.conduct@gmail.com`.
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

**Environment:** the maintainer works on Windows, and commands are run in PowerShell. Git, Node.js
LTS, and the GitHub CLI are installed.

**Commands** (see the README table): `npm install`, `npm run dev` (http://localhost:5173),
`npm run build`, `npm run preview`, `npm run typecheck`, `npm run import:natural-earth`. Still to
come in Phase 1: `npm test`, `npm run validate`, and `npm run build-data`.

**Implementation notes**

- `scripts/*.ts` run directly in Node 24, which strips the types. Keep them to "erasable" syntax
  only: no `enum` and no `namespace`. This is enforced by the `erasableSyntaxOnly` setting.
- MapLibre's worker is bundled by Vite (`?worker&url`) and registered with `setWorkerUrl()` in
  `src/main.ts`. Without that, the worker fails to load in both dev and production.
- In dev mode the map is exposed as `window.map`, for debugging in the browser console.
- MapLibre waits for the browser's animation frames, which don't run while the page is hidden.
  A map that "never loads" in a background tab may just be paused.
- **Deployment:** `.github/workflows/deploy.yml` builds pull requests and deploys `main` to
  GitHub Pages (https://chronoatlas-project.github.io/chronoatlas/). The Pages source is "GitHub
  Actions", so no Jekyll processing and no `gh-pages` branch. Actions are pinned to full commit
  SHAs with a version comment. To update one, look up the new release's commit, and keep the
  permissions minimal.
