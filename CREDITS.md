# Credits and licenses

This file lists every third-party dataset, document, and (later) software library this project
uses, with its license and the attribution it asks for. Licenses were reviewed **2026-09-26**.
See [docs/data-sources.md](docs/data-sources.md) for the full evaluation.

## Data currently in this repository

| Source | License | Where | What | Attribution |
|---|---|---|---|---|
| [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) v5.1.2 | Public domain | [data/imports/natural-earth/](data/imports/natural-earth/README.md) | Base map: land, lakes, and rivers at 1:50m | "Made with Natural Earth", shown in the map's attribution |
| [OpenHistoricalMap](https://www.openhistoricalmap.org/copyright), snapshot of 2026-09-27 | CC0 1.0. The import skips any feature with a non-public-domain `license` tag; this snapshot had none. | [data/imports/openhistoricalmap/](data/imports/openhistoricalmap/README.md), plus names in `data/polities/` | Country-level borders (admin level 2), East Asia 1900–1950 | "Borders: OpenHistoricalMap" in the map's attribution. OHM's requested wording: "Map data courtesy of the OpenHistoricalMap project, in the public domain unless otherwise noted." |

## Planned data sources

| Source | License | How we plan to use it | Attribution / notes |
|---|---|---|---|
| [Wikidata](https://www.wikidata.org/) | CC0 1.0 | Stable IDs for polities and events | We cite the references behind Wikidata statements, not Wikidata alone. |
| [CShapes 2.0](https://icr.ethz.ch/data/cshapes/) | **CC BY-NC-SA 4.0** (non-commercial, share-alike) | A separate "de jure borders (per CShapes)" layer | Schvitz et al. (2022), "Mapping the International System, 1886–2017: The CShapes 2.0 Dataset", *Journal of Conflict Resolution* 66(1): 144–61. **Kept only in its own folder and map layer. Nobody, including forks, may use it commercially. It can't be merged with differently licensed data or contributed to OpenHistoricalMap.** |
| [Cliopatria](https://github.com/Seshat-Global-History-Databank/cliopatria) (Seshat Global History Databank) | CC BY 4.0 | A yearly second-opinion layer, and later the worldwide baseline | Credit and note changes. Paper: [*Scientific Data* (2025)](https://www.nature.com/articles/s41597-025-04516-9). |

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
| [@types/node](https://github.com/DefinitelyTyped/DefinitelyTyped) | 26.6.3 | MIT |

Exact versions of every package, including indirect ones, are recorded in `package-lock.json`.
