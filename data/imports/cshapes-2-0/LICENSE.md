# License: CShapes 2.0 (CC BY-NC-SA 4.0)

**Everything in this folder is derived from CShapes 2.0 and is licensed under
[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/)
(CC BY-NC-SA 4.0).** That differs from the rest of this repository: the code is MIT and our own
data is CC0.

## Source and credit

CShapes 2.0, by Guy Schvitz, Seraina Rüegger, Luc Girardin, Lars-Erik Cederman, Nils Weidmann,
and Kristian Skrede Gleditsch (ETH Zürich), published at <https://icr.ethz.ch/data/cshapes/>
under CC BY-NC-SA 4.0. Please cite:

> Schvitz, Guy, Seraina Rüegger, Luc Girardin, Lars-Erik Cederman, Nils Weidmann, and Kristian
> Skrede Gleditsch. 2022. "Mapping The International System, 1886-2017: The CShapes 2.0 Dataset."
> *Journal of Conflict Resolution* 66(1): 144–61.

The data is provided as is, without warranties, as the license states.

## What the license means here

- **NonCommercial:** nobody may use these files, or anything made from them, for commercial
  purposes. That includes forks of this project. Anyone who wants to reuse this repository
  commercially must leave this folder out, along with anything the build makes from it.
- **ShareAlike:** anything made from these files must be shared under CC BY-NC-SA 4.0 too. That's
  why every file derived from CShapes, including the hand-written `polity-crosswalk.yaml` (it's
  built on CShapes' coding), stays in this folder. CShapes data is never merged into
  `data/polities/`, never contributed to OpenHistoricalMap, and never copied elsewhere in this
  repository.
- **Attribution:** CShapes is credited here, in [CREDITS.md](../../../CREDITS.md), and wherever
  the site shows its data.

## What we changed

We selected the rows for East Asia (10–55°N, 73–150°E) overlapping 1900–1950. We simplified,
trimmed, and rounded their borders, converted their dates (our end date is the day after
CShapes' last day), and restated each row as a sovereignty or occupation statement with notes.
[`manifest.json`](manifest.json) lists every change and decision.

## A note on three columns

CShapes' codebook lists `status`, `owner` (called `ruledby` in the codebook), and `b_def` among
the dataset's variables. The GeoJSON, CSV, and SQL files on the dataset page don't include them,
but the data file in the authors' R package (`cshapes_2.0.tar.gz`, on the same page) does. That
package's `DESCRIPTION` file says "License: GPL (>= 2)".

On 2026-09-27 the maintainers decided to treat these columns as part of CShapes 2.0, under its
dataset license (CC BY-NC-SA 4.0), and asked the authors to confirm by email the same day. If the authors say
otherwise, this folder will be removed or re-imported without those columns.
