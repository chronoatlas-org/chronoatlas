# Credits and licenses

This file lists every third-party dataset, document, and (later) software library this project
uses, with its license and the attribution it asks for. Licenses were reviewed **2026-09-26**.
See [docs/data-sources.md](docs/data-sources.md) for the full evaluation.

## Data currently in this repository

| Source | License | Where | What | Attribution |
|---|---|---|---|---|
| [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) v5.1.2 | Public domain | [data/imports/natural-earth/](data/imports/natural-earth/README.md) | Base map: land, lakes, and rivers at 1:50m | "Made with Natural Earth", shown in the map's attribution |
| [CShapes 2.0](https://icr.ethz.ch/data/cshapes/), downloaded 2026-09-27 (checksums in its manifest) | **CC BY-NC-SA 4.0** (non-commercial, share-alike) | [data/imports/cshapes-2-0/](data/imports/cshapes-2-0/README.md) only | Legally recognized (de jure) borders of states and their dependencies, East Asia 1900–1950. Its status, owner, and "borders defined" columns come from the authors' R package, whose file says GPL (>= 2); we treat them as part of the dataset, and asked the authors to confirm on 2026-09-27 (see its [LICENSE.md](data/imports/cshapes-2-0/LICENSE.md)). | Schvitz, Guy, Seraina Rüegger, Luc Girardin, Lars-Erik Cederman, Nils Weidmann, and Kristian Skrede Gleditsch. 2022. "Mapping The International System, 1886-2017: The CShapes 2.0 Dataset." *Journal of Conflict Resolution* 66(1): 144–61. Shown in the map's attribution when its layers are shown, and in the territory panel's credits wherever its data appears. The contested areas the build computes from it (with OpenHistoricalMap) carry the same license and are credited the same way. **Nobody, including forks, may use it commercially. It can't be merged with differently licensed data or contributed to OpenHistoricalMap.** |
| [Cliopatria](https://github.com/Seshat-Global-History-Databank/cliopatria) (Seshat Global History Databank), v0.2.0, commit `ad28a69`, downloaded 2026-09-28 | CC BY 4.0 | [data/imports/cliopatria/](data/imports/cliopatria/README.md) only | The territory each polity held, year by year, East Asia 1900–1950, shown as a "second opinion" (dotted outlines) | "Cliopatria, Seshat Global History Databank, version 0.2.0, licensed under CC BY 4.0", with what we changed; shown in the map's attribution when its layer is on, and in the territory panel's credits. Paper: [*Scientific Data* (2025)](https://www.nature.com/articles/s41597-025-04516-9). |
| [OpenHistoricalMap](https://www.openhistoricalmap.org/copyright), snapshot of 2026-09-27 | CC0 1.0. The import skips any feature with a non-public-domain `license` tag; this snapshot had none. | [data/imports/openhistoricalmap/](data/imports/openhistoricalmap/README.md), plus names in `data/polities/` | Country-level borders (admin level 2), East Asia 1900–1950 | "Borders: OpenHistoricalMap" in the map's attribution. OHM's requested wording: "Map data courtesy of the OpenHistoricalMap project, in the public domain unless otherwise noted." |

## Planned data sources

| Source | License | How we plan to use it | Attribution / notes |
|---|---|---|---|
| [Wikidata](https://www.wikidata.org/) | CC0 1.0 | Stable IDs for polities and events | We cite the references behind Wikidata statements, not Wikidata alone. |

## Evaluated and not used

| Source | License | Why not |
|---|---|---|
| [aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps) | GPL-3.0 | Copyleft: anything derived from it would have to be GPL, and GPL applied to data is legally unclear. It's also too coarse for our showcase region (only 1930, 1938, and 1945 snapshots, all marked at the highest precision level). |

## Documents

| Document | Source | License |
|---|---|---|
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | [Contributor Covenant 3.0](https://www.contributor-covenant.org/version/3/0/) | CC BY-SA 4.0 |
| [LICENSE](LICENSE) | MIT License text, from GitHub's license templates | Standard license text |
| [data/LICENSE](data/LICENSE) | [CC0 1.0 legal code](https://creativecommons.org/publicdomain/zero/1.0/legalcode) | Creative Commons legal code |

## Software

**Included in the published site** (bundled into the JavaScript served to visitors; license
notices are kept in the bundle):

| Library | Version | License | Use |
|---|---|---|---|
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | 6.11.2 | BSD-3-Clause | Draws the map |
| [@maplibre/maplibre-gl-style-spec](https://github.com/maplibre/maplibre-style-spec) | 26.4.4 | ISC | Map style definitions (part of MapLibre) |
| [Preact](https://preactjs.com/) | 10.29.8 | MIT | Draws the territory panel |

**Development tools only** (used to build and check the site; not shipped to visitors):

| Tool | Version | License |
|---|---|---|
| [Vite](https://vite.dev/) | 8.3.1 | MIT |
| [TypeScript](https://www.typescriptlang.org/) | 7.0.2 | Apache-2.0 |
| [Vitest](https://vitest.dev/) | 5.0.2 | MIT |
| [yaml](https://eemeli.org/yaml/) | 2.9.1 | ISC |
| [Ajv](https://ajv.js.org/) (JSON Schema validator) | 8.20.0 | MIT |
| [polygon-clipping](https://github.com/mfogel/polygon-clipping) | 0.15.7 | MIT |
| [geojson-vt](https://github.com/mapbox/geojson-vt) | 5.0.2 | ISC |
| [vt-pbf](https://github.com/mapbox/vt-pbf) | 3.1.3 | MIT |
| [pbf](https://github.com/mapbox/pbf) (used in tests to read tiles back) | 5.1.2 | BSD-3-Clause |
| [@mapbox/vector-tile](https://github.com/mapbox/vector-tile-js) (used in tests to read tiles back) | 3.0.0 | BSD-3-Clause |
| [xz-decompress](https://github.com/httptoolkit/xz-decompress) (used by the CShapes import to unpack the R package's data file) | 0.2.3 | MIT (per its package.json; the npm package has no license file) |
| [@types/node](https://github.com/DefinitelyTyped/DefinitelyTyped) | 26.6.3 | MIT |

Exact versions of every package, including indirect ones, are recorded in `package-lock.json`.
