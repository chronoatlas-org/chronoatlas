# CShapes 2.0 import (worldwide, 1886–2019)

Legally recognized (de jure) borders of states and their dependencies from
[CShapes 2.0](https://icr.ethz.ch/data/cshapes/), worldwide and for every year it covers, 1886–2019
(the import area was East Asia, 1900–1950, until Phase 5 widened it). **Non-commercial and share-alike: read [LICENSE.md](LICENSE.md) first.** Nothing
derived from these files may leave this folder.

| File | Contents |
|---|---|
| `shapes/cshapes-<gwcode>-<start>.geojson` | One shape per CShapes row (simplified and trimmed; see the manifest). Its properties keep CShapes' own values: code, name, first and last day, status, owner, and whether the borders were defined. |
| `assertions.yaml` | "According to CShapes, <state> was sovereign over (or occupied) <shape> from <start> to <end>", with notes on status and date precision |
| `polities/cshapes-<gwcode>.yaml` | CShapes' own units: each state as CShapes identifies it, with its CShapes name. They stay in this folder; the validator checks that nothing outside uses them. |
| `polity-crosswalk.yaml` | **Hand-written, and reviewed like any data change.** Which of our polities (from OpenHistoricalMap) is the same state as each CShapes unit, or administered its dependency, and when. |
| `manifest.json` | The pinned downloads with their checksums, every interpretation decision, and anything skipped |
| `raw/` | The last downloads (not committed) |

## How CShapes' rows become statements

| CShapes status | Becomes |
|---|---|
| independent | `sovereign`: the unit itself |
| colony, protectorate, mandate | `sovereign`: the unit's owner, with the status in the notes |
| occupied | `occupies`: the unit's owner, with the status in the notes |

CShapes follows a state through changes of regime under one code (710 is China under the Qing,
the Republic, and the People's Republic). So the statements name CShapes' own units
(`cshapes-710`), not our polities, and the crosswalk links them. CShapes' rows are never cut up to
fit our polities' dates.

## Things to know about CShapes

These come from its codebook (`raw/CShapes-2.0_Codebook.pdf`, from the dataset page):

- **It codes de jure changes only**, dated to the day a treaty was signed, for example.
- **It leaves some changes out:**
  - territorial changes under 10,000 km², so small concessions, leased territories, and colonies
    such as Hong Kong, Macau, and Goa sit inside the surrounding state;
  - unrecognized changes that were later reversed, such as Japan's occupation of Manchuria;
  - wartime changes that were reversed after the war.
- **Unknown days:** where the exact day was unknown, it used the first of the month or 1 January.
  Those dates carry a note.
- **Conflicting maps:** where maps conflicted, it chose the one closest to present-day borders.

## How to update or fix this data

**Don't edit the generated files by hand.** The next import would overwrite your change.

- **A new CShapes release:** the import stops if an upstream file's checksum no longer matches.
  Review what changed, update the pinned checksum in `scripts/import-cshapes.ts`, run
  `npm run import:cshapes`, and review the diff.
- **To re-run it on the last download:** `npm run import:cshapes -- --offline`.
- **To re-run it on GitHub:** the Actions tab → **Re-import a dataset** → **Run workflow**, with
  the dataset `cshapes-2-0`. It opens a pull request with the data-change summary.
- **An error in CShapes itself:** report it to the CShapes authors (see the dataset page). We
  don't correct their data here.
- **A disagreement with how we interpret CShapes** (the table above, or a crosswalk match): open
  an issue. The decisions are listed in `manifest.json`.
