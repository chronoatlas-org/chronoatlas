# License: Cliopatria (CC BY 4.0)

**Everything in this folder is derived from Cliopatria and is licensed under
[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
(CC BY 4.0).** That differs from the rest of this repository: the code is MIT and our own data
is CC0.

## Source and credit

Cliopatria, by the [Seshat Global History Databank](https://seshatdatabank.info/), version 0.2.0,
from <https://github.com/Seshat-Global-History-Databank/cliopatria> (commit
`ad28a691b7c07c1fca89d0e0636d324667d2a258`), licensed under CC BY 4.0. Its README thanks Charles
de Dampierre (Bunka.ai) and Nicolas Baumard (Institut Jean Nicod, École normale supérieure) for an
initial set of Wikidata IDs.

The data is provided as is, without warranties, as the license states.

## What the license means here

- **Attribution:** we credit Cliopatria here, in [CREDITS.md](../../../CREDITS.md), on the map when
  its layer is shown, and in the territory panel wherever its data appears.
- **No share-alike and no non-commercial terms,** unlike CShapes. Still, it isn't public domain,
  so its data stays in this folder and is never merged into `data/polities/` (which holds only
  CC0 and public-domain records).

## What we changed

We selected the worldwide POLITY rows and skipped grouping rows. We simplified, trimmed, and
rounded their borders, converted their years to our date format, and restated each row as a
"controls" statement with notes. For the Sudan split, we changed the transition date using
the source in [date-transitions.json](date-transitions.json), retaining Cliopatria’s geometry.
[`manifest.json`](manifest.json) lists every change and decision.
