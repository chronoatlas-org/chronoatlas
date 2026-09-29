# Contributing to chronoatlas

Thank you for helping. Borders are politically sensitive, and people care deeply about how their
history is shown. This project handles that by being transparent: every border and event is
traced to a source, every change is reviewed in public, and disputes are shown as disputes rather
than settled by us.

Everyone taking part follows our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ground rules

1. **Sources, never memory.** Every border, every date, and every event (including its summary)
   must come from a named source recorded in the data. "Everyone knows" is not a source. Where
   there is no source, we leave a visible gap. An honest gap beats a confident guess.
2. **Control, recognition, and claims are different things.** We record separately who actually
   controlled an area (de facto), who was legally recognized as its owner (de jure, and by whom),
   and what each source claims.
3. **Precision is part of the data.** Record how precise each date is (exact day, month, year,
   approximate, century) and how precise each border is (treaty or surveyed line, approximate
   line, frontier zone). Don't make anything look more precise than the source is.
4. **Describe and attribute; don't adjudicate.** Write "Source X shows…", not "The border was…"
   when sources disagree. If two good sources disagree, we add both. We don't pick one.
5. **Respect licenses.** Only contribute material you have the right to contribute (see
   [Copyright and tracing](#copyright-and-tracing)).

## Ways to contribute

### Report a problem

[Open an issue](https://github.com/chronoatlas-org/chronoatlas/issues/new/choose) on GitHub and
pick a form:

- **Border correction:** a border, date, or name that looks wrong.
- **Missing event:** an event the timeline should show.
- **Suggest a source or dataset:** a map, book, archive, or dataset we could use, with its
  license.
- **Bug report:** something on the website that doesn't work.

The forms ask for the place, the date or date range (as an [EDTF date](docs/data-format.md#conventions)),
what's wrong, and **a source** that supports the correction (see below). A link to the map view
helps too: copy it from the address bar or with the site's "Copy link" button.

Every territory on the map has a "Report a problem with this border" button in its panel that
fills most of this in for you.

Conduct problems are reported privately, never in a public issue: see the
[Code of Conduct](CODE_OF_CONDUCT.md#reporting-an-issue).

### Propose a change yourself

Edit the data files and open a pull request (PR). The PR description includes a short review
checklist. Every PR is reviewed in public before it's merged, and automatic checks
(`npm run validate` and `npm test`) confirm that dates are well-formed, geometry is valid, and
sources are present. The data format is described in [docs/data-format.md](docs/data-format.md).

### Help with code

The [README](README.md#running-it-on-your-computer) explains how to run the site on your computer.
Discussion on issues is very welcome too.

### Translate the site

The site's own words can be translated into your language: [docs/translating.md](docs/translating.md)
explains how, and which words need the most care (such as "contested" and "occupied"). A
translation is published once a second native speaker has reviewed it.

## What counts as a source

Every citation needs **enough detail to find it** (author, title, year, and a publisher, URL, DOI,
or ISBN) and **a locator** (page, map sheet, figure, or feature ID).

**Good sources**

- Peer-reviewed scholarship, and academic atlases or historical GIS datasets with documented
  methods.
- Treaties, laws, and other official documents (primary sources).
- Maps made at the time, as evidence of what their maker depicted or claimed.
- Reputable reference works with editorial oversight, for events.

**Use with care, and attribute clearly**

- **Government and wartime maps** show that government's view or claims. Cite them as such
  ("Map published by X in 1938 shows…"), not as neutral fact.
- **Wikipedia and Wikidata** are good leads, not sources. Follow them to what they cite and cite
  that. Wikidata IDs are welcome as identifiers.

**Not accepted**

- Personal knowledge or memory, however confident.
- Maps or claims with no traceable origin.
- AI-generated text, maps, or "facts".

## Copyright and tracing

- **Facts** (such as a treaty's date) may come from any source, with a citation.
- **Geometry may only be traced from maps that are public domain or openly licensed** in a way
  compatible with CC0, such as many works of the US federal government. Tracing a copyrighted
  map, even an old-looking one, is not allowed. Record the map's license or copyright status in
  its source entry.
- **Write summaries in your own words.** Don't paste text from Wikipedia (CC BY-SA) or other
  sources. A short, attributed quotation is fine.

## Licensing of contributions

By submitting a contribution, you confirm you have the right to submit it, and you agree that:

- **code** you contribute is licensed under the [MIT License](LICENSE);
- **data** you contribute (outside `data/imports/`) is dedicated to the public domain under
  [CC0 1.0](data/LICENSE).

Third-party datasets enter only through the import process, which keeps them in their own
`data/imports/<dataset>/` folder under their own license.

## How review works

- Every change is a pull request, and the discussion stays public.
- Reviewers check:
  - that each change is sourced, with a locator;
  - that the license is compatible;
  - that de facto, de jure, and claims are kept distinct;
  - that precision isn't overstated;
  - that the wording is attributed rather than asserted.
- Reviewers may ask for more or better sources. Being asked is normal and not a rejection.
- When good sources disagree, the resolution is to represent the disagreement, not to choose a
  winner.
- How reviewers go about it, step by step: [docs/reviewing.md](docs/reviewing.md).

### After you open a pull request

- **The build check** runs the data checks and the tests, and builds the site. If it's your first
  contribution, it waits until a maintainer presses "Approve and run"; that's GitHub's safety rule
  for new contributors, not a judgment of your change.
- **A data-change summary** appears as a comment a few minutes after the check finishes, if you
  changed anything in `data/`. It says in words what your change does: records, dates and how
  precise they are, sources, borders, and what that changes elsewhere on the map (contested areas,
  land areas). Read it: if it says something you didn't mean, fix the files and push again, and
  the comment updates. You can see the same summary before opening the pull request with
  `npm run summarize-changes`.
- **A maintainer reviews it,** checking your sources at the pages you cite. Changes to licenses,
  import folders, crosswalks, and workflows always wait for a maintainer.

## Drawing or fixing a border line

Border lines are drawn in [OpenHistoricalMap](https://www.openhistoricalmap.org) (OHM), a
public-domain historical map that anyone can edit with a free account. We then import them. OHM's
editor shares each line between the neighbors on both sides, so one fix corrects both, and the
whole OHM community benefits.

- **New or corrected lines, and their dates:** edit them in OHM, citing your source there. Then
  open an issue here with a link to your OHM change, so we can re-import it. OHM accepts only
  public-domain or permissively licensed sources, which matches our rules.
- **Everything else belongs here:** claims, recognition, contested status, comparisons between
  sources, events, summaries, and figures.
- **We never hand-edit imported geometry** in this repository, because the next import would
  undo the fix.

Step by step: [docs/tracing-guide.md](docs/tracing-guide.md) explains how to trace a border in OHM
from a dated public-domain map, how to tag it so our import reads it, and how maintainers
re-import it. If you're unsure, open an issue and ask.

## Figures (statistics)

Numbers such as population or area follow the same rules as borders: a source, a date, and
honest precision (give a range, `low`–`high`, when the source does). Also say what territory the
number counts: the polity's own territory at the time, or a modern country's borders. Many
historical statistics are organized by today's countries, and those can't be attached to a
historical state as if they described its territory.
