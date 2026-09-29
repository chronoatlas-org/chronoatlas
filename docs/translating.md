# Translating chronoatlas

Thank you for helping. This guide covers how to add or improve a language, and the words that need
the most care. A translation is published only after a second person who speaks the language
natively has reviewed it (Phase 5 decision 9): on this map, a single loaded word can take a side.

## What gets translated, and what doesn't

- **The site's own words** are translated: buttons, the map key, the panel's headings and
  sentences, dates. They're all in one file, [`src/i18n/en.ts`](../src/i18n/en.ts), each with a
  key such as `'panel.report'`, and many with a comment saying where they appear.
- **Names of places and states are not.** They come from the data, each with its language and its
  source, so a name in another language is added as data (with a source), never in a translation
  file. Descriptions from sources, such as event summaries, are data too.
- **Dates** are built from the `date.…` keys (month names, "BCE", "year only", and so on). Change
  the order of day, month, and year there if your language needs it; never format a historical
  date with the browser's date tools, which get old calendars wrong.

## Adding a language

1. Copy `src/i18n/en.ts` to a file named after the language's code, such as `src/i18n/ja.ts`
   (`zh-Hans` and `zh-Hant` for Chinese written in simplified and traditional characters).
2. Rename the export (`export const ja: Catalog = { … }`, importing `Catalog` from `./index.ts`)
   and translate each text, keeping every key as it is.
3. Keep every `{placeholder}` exactly as written, such as `{name}` or `{date}`. You can move it
   within the sentence, but not rename, drop, or add one: the code fills it in.
4. List the language in `CATALOGS` in `src/i18n/index.ts` (`{ en, ja }`).
5. Run `npm test`. It checks that your file has every English key, no key English doesn't have,
   no empty text, and the same placeholders as English, and says which key is wrong.
6. Look at the site with `npm run dev`, adding `&lang=ja` to the address, on a phone-sized window
   too: some languages are longer, and the map key and panel must still fit.
7. Open a pull request. It is merged only after a native speaker other than you has reviewed it.

When English text changes later, the test fails for every language until the key is updated.
That's on purpose: an out-of-date translation is worse than a missing one.

## Glossary: the words that need the most care

These words have exact meanings on this map. Translate the meaning, not the English word, and
choose the most neutral term your language has: one that people on both sides of a dispute would
accept as a description. Avoid words that praise or condemn (lawful, illegal, liberated, invaded,
fake, bogus), even where they're common in your language's usual history-writing.

| English | Key(s) | What it means here |
|---|---|---|
| Administered (de facto) | `relation.administers` | The state that actually ran the area, per a source (OpenHistoricalMap). Says nothing about whether that was lawful. |
| Controlled (de facto) | `relation.controls` | The same idea, in a source (Cliopatria) that doesn't separate control from legal rule. |
| Occupied | `relation.occupies`, `map.status.occupied` | Held by a state that, per the source, wasn't the legal sovereign: the neutral legal term, not "invaded" or "liberated". |
| Sovereign (de jure) / legally recognized | `relation.sovereign`, `legend.jure` | Legally recognized as the state's, per the source named (and by whom, when a source says). Recognition, not control. |
| Claimed | `relation.claims` | A claim a source records. Says nothing about control or recognition. |
| Contested | `map.contested`, `legend.contested`, `panel.contested…` | Administered by one state while legally recognized as another's, per the sources named. Not "illegal", not "occupied", and not a war. |
| Possibly contested | `map.maybeContested` | Only possibly, because a date involved is known only to the month or year. |
| Sources differ | `map.differ`, `panel.differ` | Two sources name different holders: a disagreement between sources, not a dispute in the world. Keep it clearly different from "contested". |
| Described as a puppet state of … | `relation.puppet-of` | Attributed: a source describes it so. Keep "described as"; avoid your language's pejorative terms for such states. |
| No data yet | `legend.noData` | Our data doesn't cover this place and time yet. Never "no state" or "no one's land": that would be a claim about history. |
| Not yet checked against legal borders | `panel.notChecked`, `panel.partlyChecked` | The maintainers haven't reviewed which states in two sources are the same here, so contested areas aren't worked out. |
| Edge of OpenHistoricalMap's area | `map.edge`, `legend.edge` | Where one source's data ends and another's begins; not a border. |
| Border line precision | `legend.approximate`, `legend.zone` | How precise a source says a line is: a treaty or surveyed line, an approximate line, or a frontier zone. |

When unsure, say so in the pull request: the reviewers would rather discuss a word than find it
later.
