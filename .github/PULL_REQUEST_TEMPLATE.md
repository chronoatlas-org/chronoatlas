<!-- Thank you for contributing! Describe the change, then tick each box that applies.
     Guides: CONTRIBUTING.md (what counts as a source) and docs/data-format.md (file format). -->

## What this changes

<!-- A short description, and a link to the issue it fixes, if any (for example "Fixes #12"). -->

## Checklist

For data changes (borders, dates, events, names, figures):

- [ ] Every new or changed border, date, and event cites a source, with a locator (page, map
      sheet, or feature ID).
- [ ] The source's license is compatible with where the data is stored (third-party data only in
      `data/imports/<dataset>/`).
- [ ] De facto control, de jure sovereignty, and claims are kept distinct.
- [ ] Date precision and edge precision are recorded, and not overstated.
- [ ] Descriptions are attributed rather than asserted, so both sides of a dispute would call
      them fair. Summaries are in my own words, not pasted from Wikipedia or elsewhere.

For every change:

- [ ] `npm run validate` and `npm test` pass.
