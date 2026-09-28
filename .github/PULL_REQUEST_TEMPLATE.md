<!-- Thank you for contributing! Describe the change, then tick each box that applies.
     Guides: CONTRIBUTING.md (what counts as a source) and docs/data-format.md (file format). -->

## What this changes

<!-- A short description, and a link to the issue it fixes, if any (for example "Fixes #12"). -->

## How to see it

<!-- A link to the map view that shows it (copy it from the site's address bar or "Copy link"),
     or the steps to see it when running the site locally. -->

## Checklist

**For a data change** (borders, dates, events, names, figures, sources):

- [ ] Every new or changed border, date, and event cites a source, with a locator (page, map
      sheet, or feature ID), and events say who is speaking in each source.
- [ ] The source's license is compatible with where the data is stored (third-party data only in
      `data/imports/<dataset>/`).
- [ ] De facto control, de jure sovereignty, and claims are kept distinct.
- [ ] Date precision and edge precision are recorded, and not overstated.
- [ ] Descriptions are attributed rather than asserted, so both sides of a dispute would call
      them fair. Summaries are in my own words, not pasted from Wikipedia or elsewhere.
- [ ] I read the data-change summary that appears as a comment once the checks finish, and it
      says what I meant to change.

**For a code change:**

- [ ] On-screen text goes through the translation catalogs (`src/i18n/`), and historical dates
      through `src/dates/`.
- [ ] It works on a phone-sized screen, and contested styling doesn't rely on color alone.
- [ ] New logic has tests.

**For every change:**

- [ ] `npm run validate` and `npm test` pass.
