# OpenHistoricalMap import (East Asia, 1900–1950)

Country-level boundaries (`admin_level=2`) from [OpenHistoricalMap](https://www.openhistoricalmap.org/)
(OHM) for the import area 10–55°N, 73–150°E, covering 1900–1950.

| File | Contents |
|---|---|
| `shapes/ohm-r<id>.geojson` | One shape per OHM boundary relation (simplified and trimmed; see manifest) |
| `assertions.yaml` | "According to OHM, <polity> administered <shape> from <start> to <end>" |
| `polity-ids.json` | The permanent polity ID assigned to each group of OHM relations |
| `manifest.json` | The exact query, when it ran, a checksum of the download, every interpretation decision, and anything skipped |
| `raw/` | The last download (not committed; it's about 100 MB) |

Polity names from OHM are written into `data/polities/`, each attributed to the relations that
carry it.

## How to fix something in this data

**Don't edit these files by hand.** The next import would overwrite your change.

1. Fix the boundary or its dates in OpenHistoricalMap itself, citing your source there.
2. Re-import: a maintainer presses **Run workflow** on the "Re-import OpenHistoricalMap" workflow
   (the Actions tab), which opens a pull request. Or run `npm run import:ohm` and open a pull
   request yourself.
3. Review it: the data-change summary on the pull request says what changed in words, and GitHub
   shows changed `.geojson` files as maps.

If the problem is in how we *interpret* OHM (for example, whether something counts as
administration), open an issue instead. Those decisions are listed in `manifest.json`.
