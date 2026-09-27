# Data

This folder holds the data behind the map, in human-readable files, so that every correction
shows up as a reviewable change in a pull request.

## License: read this before reusing the data

- **Data we create is dedicated to the public domain under [CC0 1.0](LICENSE).** That covers
  everything in this folder **except** `imports/`.
- **`imports/<dataset>/` folders hold third-party data under that dataset's own license.** Each
  one has its own `LICENSE` and a manifest recording where the data came from. Some of these
  licenses are **non-commercial and/or share-alike**. For example, CShapes 2.0 is CC BY-NC-SA
  4.0. Files from different import folders are never merged together.
- See [CREDITS.md](../CREDITS.md) for the full list and the attribution each source requires.

## Layout (planned for Phase 1)

| Folder | Contents |
|---|---|
| `sources/` | One YAML file per source (a dataset, book, article, map, or archive) |
| `polities/` | One YAML file per polity: anything that can hold, claim, or govern territory |
| `shapes/` | Geometry only, as GeoJSON, one shape per file |
| `assertions/` | Sourced statements saying who controlled, was sovereign over, or claimed which shape, when |
| `events/` | Dated, located events with summaries and sources |
| `figures/` | Sourced statistics (population, area, …) for polities, each with a date and a basis |
| `coverage/` | Where each source claims to be complete (used to tell "no state" from "no data") |
| `imports/<dataset>/` | Third-party data converted to our format, under its own license |

How these fit together is explained in [docs/architecture.md](../docs/architecture.md#data-model).
