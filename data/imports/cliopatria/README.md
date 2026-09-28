# Cliopatria import (East Asia, 1900–1950)

The territory each polity held, year by year, as
[Cliopatria](https://github.com/Seshat-Global-History-Databank/cliopatria) (Seshat Global History
Databank) maps it, for the import area 10–55°N, 73–150°E, covering 1900–1950. Shown on the site as a
"second opinion" beside OpenHistoricalMap. **CC BY 4.0: see [LICENSE.md](LICENSE.md).**

| File | Contents |
|---|---|
| `shapes/cliopatria-<name>-<year>.geojson` | One shape per Cliopatria row (simplified and trimmed; see the manifest). Its properties keep Cliopatria's own values: name, years, area, Wikidata, Wikipedia, and Seshat IDs. |
| `assertions.yaml` | "According to Cliopatria, <polity> controlled <shape> from <year> to <year>", with notes |
| `polities/cliopatria-<name>.yaml` | Cliopatria's own polities, with their Cliopatria names. They stay in this folder. |
| `polity-crosswalk.yaml` | **Hand-written, and reviewed like any data change.** Which of our polities is the same as each Cliopatria polity, and the evidence for it. |
| `manifest.json` | The pinned download with its checksum, every interpretation decision, and every row skipped |
| `raw/` | The last download (not committed; 44 MB zipped, 166 MB unzipped) |

## Things to know about Cliopatria

- **Whole years only.** Each row covers whole years, inclusive. Our end date is the year after its
  last year, so a change shows as happening "some time in" that year.
- **"Held", not "ruled legally".** It doesn't separate control from legal sovereignty, so its rows
  become `controls` statements.
- **Puppet states are folded into their patrons.** There is no separate Manchukuo; its land is
  inside the Empire of Japan. That's Cliopatria's view, shown attributed.
- **Groupings are skipped.** Rows like "(British Empire)" group other rows and list them under
  `Components`. We import the parts, not the groupings, so no land is counted twice.
- **Some Wikidata IDs are wrong for this period.** For example, "Republic of China" carries Q148
  (the People's Republic of China) and "Republic of Korea" carries Q423 (North Korea). That's
  why polities are matched by a reviewed crosswalk, never automatically by Wikidata ID.

## How to update or fix this data

**Don't edit the generated files by hand.** The next import would overwrite your change.

- **A new Cliopatria release:** pin its commit and checksum in `scripts/import-cliopatria.ts`, run
  `npm run import:cliopatria`, and review the diff.
- **To re-run it on the last download:** `npm run import:cliopatria -- --offline`.
- **An error in Cliopatria itself:** report it to the Seshat team (see its README). They review
  reported errors with historians.
- **A disagreement with how we interpret Cliopatria** (the notes above, or a crosswalk match): open
  an issue.
