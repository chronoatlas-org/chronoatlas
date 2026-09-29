# Tracing a border in OpenHistoricalMap

This guide explains how to trace a country's border from a dated, public-domain map into
[OpenHistoricalMap](https://www.openhistoricalmap.org/) (OHM), so that our importer picks it up
and it appears on chronoatlas. The tracing happens in OHM, not in this repository. We then
import OHM's data (see [why borders are drawn in OHM](architecture.md#where-borders-are-drawn)).

It's written for our current import: country borders in East Asia and Europe, 1900–1950. Where OHM's own
documentation covers a step, this guide links to it. OHM's pages are the authority on OHM; this
guide only adds what our importer needs.

> **How this guide was checked (2026-09-28).** Every statement about OHM links to the OHM page
> it comes from. OHM's documentation is on the OpenStreetMap wiki, and the environment this
> guide was written in couldn't open those pages directly. So their content was checked through
> search results that quote them, and OHM's copyright wording through its website's source code
> ([`config/locales/en.yml`](https://github.com/OpenHistoricalMap/ohm-website/blob/staging/config/locales/en.yml)).
> Before relying on a detail, open the linked page and check it, and please fix this guide if
> OHM's pages have changed. Everything about **our** importer was checked against
> `scripts/import-ohm.ts` and `data/imports/openhistoricalmap/manifest.json`.

Contents:

1. [Before you start](#1-before-you-start)
2. [Choose a dated map and check that it's public domain](#2-choose-a-dated-map-and-check-that-its-public-domain)
3. [Georeference the map](#3-georeference-the-map)
4. [Trace and tag the border](#4-trace-and-tag-the-border)
5. [What our importer reads](#5-what-our-importer-reads)
6. [Never copy from OpenStreetMap or copyrighted maps](#6-never-copy-from-openstreetmap-or-copyrighted-maps)
7. [Re-importing (for maintainers)](#7-re-importing-for-maintainers)
8. [Reporting a problem instead](#8-reporting-a-problem-instead)

---

## 1. Before you start

- **Make a free OHM account** at openhistoricalmap.org. OHM also lets you sign in with an
  OpenStreetMap or Wikimedia account
  ([OHM: Contributing](https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Contributing)).
  Use an account you're comfortable having linked to your edits in public: OHM's edit history
  is public.
- **Learn the editor first.** OHM's main editor is iD: zoom in on the OHM home page and press
  Edit. The first time, iD offers a short interactive tutorial, which OHM recommends
  ([OHM: Contributing](https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Contributing)).
- **Look at what's already there.** Our area probably already has a boundary for the country
  and period you have in mind. Often the right edit is a new version of an existing boundary
  (see [step 4](#4-trace-and-tag-the-border)), not a new one. Our import's list of boundaries
  and their relation numbers is in `data/imports/openhistoricalmap/assertions.yaml`.
- **If you're unsure, ask first**: open an issue here, or ask on the
  [OHM forum](https://forum.openhistoricalmap.org/).

## 2. Choose a dated map and check that it's public domain

### A dated map

- **The map must say when it applies.** Use its publication date, or better, a date it states
  for the situation it shows ("Situation on 1 July 1938"). A border drawn from an undated map
  can't be given honest dates.
- **Remember what the map is:** evidence of what its maker showed or claimed at that time. A
  government or wartime map shows that government's view (see
  [what counts as a source](../CONTRIBUTING.md#what-counts-as-a-source)). Note who made it.
- **Does it show control or a claim?** Our importer currently reads every OHM country boundary
  as the area a polity **administered** (see [section 5](#5-what-our-importer-reads)). If the
  map shows a claimed extent, or a legal border that differs from who actually ran the area,
  open an issue here before tracing, because that's one of the maintainers' open questions
  ([open question 1](phase-2-plan.md#open-questions-found-during-the-work)).

### Public domain, checked and recorded

OHM's own guidance: when tracing old maps, check that they have suitable copyright for
tracing, such as public domain or CC0. That check "can range from very easy (explicit statements
on webpages) to straightforward (200-year-old maps are almost certainly in the public domain)
to complex (commercial maps still in print)"
([OHM: Tracing old maps and imagery](https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Tracing_Old_Maps_and_Imagery)).
OHM also warns that "the specific graphical depiction of a geographical feature may be subject
to copyright protection"
([OHM: Copyright](https://wiki.openstreetmap.org/wiki/Open_Historical_Map/Copyright)).

Maps from 1900–1950 are rarely 200 years old, so for our period the check usually isn't the easy
kind. In practice:

- **Use the holding library's or archive's rights statement.** Many digital collections say on
  the item's own page whether it's public domain or has "no known restrictions". Copy that
  statement and its link; you'll need it below.
- **A work of the US federal government** is often public domain, which is what our own project
  rules mention ([CONTRIBUTING: copyright and tracing](../CONTRIBUTING.md#copyright-and-tracing)).
  Still look for the holder's rights statement rather than assuming.
- **Copyright rules differ between countries**, and a map can be public domain in one country and
  not another. If the rights statement is missing or unclear, **don't trace the map.** Open an
  issue and ask; this is a decision for the maintainers, not a guess.
- **Write down why** you believe the map is public domain, with a link to the evidence, in the
  boundary's `source` tag or `note` tag (see below), and in any issue or pull request you open
  here.

## 3. Georeference the map

A scanned map has to be stretched to fit real coordinates ("georeferenced") before you can trace
over it. What OHM's documentation offers:

- **Map Warper**: web tools that "georeference an image and serve it up as an imagery layer".
  After georeferencing, you add that layer to iD or JOSM and trace from it. OHM's page points to
  the Wikimaps instance at `warper.wmflabs.org`, and its example tile address is
  `http://warper.wmflabs.org/maps/tile/3274/{z}/{x}/{y}.png`, where `3274` is the map's number
  ([OHM: Tracing old maps and imagery](https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Tracing_Old_Maps_and_Imagery)).
- **Allmaps**, for high-resolution maps that libraries and museums publish in the IIIF format
  ([OHM: Imagery](https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Imagery)).
- **Loading it in iD:** open the Background panel, choose "Custom", and paste the tile address
  (a template with `{z}/{x}/{y}` in it)
  ([OHM: Imagery](https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Imagery)).

Tips:

- Place control points on features that haven't moved since the map was made (river mouths,
  mountain peaks, old city walls), spread across the whole map, not just the middle.
- A warped 1930s small-scale map is only accurate to a few kilometres at best. Our importer
  also simplifies lines to about 500 m (see [section 5](#5-what-our-importer-reads)), so there's
  no point tracing finer detail than the map really has.

## 4. Trace and tag the border

### How OHM represents a country border

- **A boundary relation.** A country's border is a relation made of ways (lines) that together
  form closed rings: at least one `outer` way, with `inner` ways for holes. One way can belong to
  several boundaries at once, so a line between two countries is drawn once and shared by both
  ([OSM wiki: Relation:boundary](https://wiki.openstreetmap.org/wiki/Relation:boundary), the model
  OHM inherited from OpenStreetMap).
- **One relation per version.** In OHM, a feature's `start_date` is "the date from which the
  feature and all its tags are accurate", and you can make another copy of the feature to
  represent an earlier stage
  ([OHM: start_date](https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Tags/Key/start_date)).
  So when a border changes, the old relation gets an `end_date`, and a new relation with the new
  shape starts.
- **A chronology relation** can group all the versions of one country in date order. Its members
  "may overlap spatially but should not overlap temporally"
  ([OHM: chronology](https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Tags/Relation/chronology)).
  Our importer doesn't read chronology relations, but they help OHM and other users, so add the
  new version to the country's chronology if it has one.

### The tags to set

For a traced country border in our area, 1900–1950 (a made-up example):

| Tag | Example | Why |
|---|---|---|
| `type` | `boundary` | It's a boundary relation. |
| `boundary` | `administrative` | Our import only reads administrative boundaries. |
| `admin_level` | `2` | Level 2 means a country. Our import only reads level 2. |
| `name` | the name in the local language and script | Copied as the local name. |
| `name:en`, `name:zh`, `name:ja`, … | `Testland` | Copied with their language. `name:en` also decides a new polity's ID. |
| `start_date` | `1938-07` | **Required** (see below). |
| `start_date:edtf` | `1938-07~` | Optional: when you need approximation or uncertainty. |
| `end_date` | `1940` | When this version stopped applying (see below). Leave it off if it still applies. |
| `end_date:edtf` | `1940?` | Optional, as for the start. |
| `wikidata` | `Q…` | Groups versions of the same country together (see below). Use the same value as the country's other versions. |
| `source` | a link to the map's page in the library or archive | The map you traced (see below). |
| `note` | "Traced from a map dated 1 July 1938 in …; public domain per the library's rights statement: <link>" | Your record of the date, the evidence, and the copyright check. |

The example values are made up; take the real ones from your map and its catalogue record.

### Dates and their precision

- **Only as precise as the source.** Write a year (`1938`), a month (`1938-07`), or a day
  (`1938-07-01`), and "only include the day if you know the specific day"
  ([OHM: end_date](https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Tags/Key/end_date)).
  Our site shows a year-only date as year-only, never as 1 January.
- **Approximate or uncertain dates** go in `start_date:edtf` / `end_date:edtf`, using the EDTF
  date format. OHM says to also set `start_date` (and `end_date`) "to the most accurate date that
  can be expressed" in the plain `YYYY-MM-DD` form, for backwards compatibility
  ([OHM: start_date:edtf](https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Tags/Key/start_date:edtf),
  [OHM: end_date:edtf](https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Tags/Key/end_date:edtf)).
  **For our importer, the plain `start_date` is required**: the query that finds boundaries
  filters on it, so a relation with only `start_date:edtf` is never downloaded.
- **Gregorian calendar.** OHM dates use the (proleptic) Gregorian calendar; if your source uses
  another calendar, convert the date before entering it
  ([OHM: start_date](https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Tags/Key/start_date)).
  That matters in our area, where maps may be dated by a Japanese era year or a year of the
  Republic of China. Say in the `note` what the map's own date was.
- **Chaining versions:** give the old version's `end_date` **the same date** as the new
  version's `start_date`. Our importer reads `end_date` as the first day a border no longer
  applied, which is how the OHM boundaries in our area are chained (recorded in the import's
  manifest). On the changeover day the site shows the new version.
- **Seasons** (EDTF `1938-21` and so on) aren't accepted by our importer yet, and a relation
  using one is skipped and listed in the manifest. Use a month range or an approximate month
  instead.

### Grouping versions into one country

Our importer groups relations into one polity by their `wikidata` tag, or by `name:en` when
there's no `wikidata` tag (and by `name` when there's neither). So:

- give each new version the **same `wikidata` value** as the country's other versions in OHM;
- if they have none, use the **same `name:en`**;
- a relation with a new `wikidata` value or a new `name:en` becomes a **new polity** on our map.
  That's right for a genuinely new state; it's a mistake for a new version of an old one.

### Citing your source

OHM asks you to credit your source "in a `source` tag on the feature itself, not merely on the
changeset" as you would in OpenStreetMap. Besides `source`, you can list more sources as
`source:1`, `source:2` and so on, and back a single tag with `name:source` and similar
([OHM: source](https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Tags/Key/source)).

Our importer cites each border as "OpenHistoricalMap, relation N, version V", and the site links
to that relation. So your `source` and `note` tags are what readers and reviewers will follow to
your map. Make them specific: the map's title, maker, date, the sheet if it's a series, and a
link.

### Upload

Save in iD with a changeset comment that says what you traced and from which map. Then tell us
(see [section 8](#8-reporting-a-problem-instead)) with a link to the relation, so the maintainers
can re-import it.

## 5. What our importer reads

This is what `scripts/import-ohm.ts` actually does, with the settings recorded in
`data/imports/openhistoricalmap/manifest.json`:

- **Which relations:** relations tagged `boundary=administrative` and `admin_level=2` that touch
  one of the import's areas, **10–55°N, 73–150°E** (East Asia) or **34–72°N, 25°W–45°E**
  (Europe, added 2026-09-29), with a `start_date` before 1951 and either no `end_date` or one
  after 1900.
- **Dates:** `start_date:edtf` and `end_date:edtf` when present, otherwise `start_date` and
  `end_date`. No `end_date` means "ongoing". A date our date library can't read (such as a season)
  makes the relation skipped, with the reason in the manifest's `skipped` list.
- **License:** a relation with a `license` tag that isn't CC0 or public domain is skipped, for a
  maintainer to review. OHM notes that a few of its features are under other licenses, "as noted
  in license key tags"
  ([OHM website copyright text](https://github.com/OpenHistoricalMap/ohm-website/blob/staging/config/locales/en.yml)).
- **Geometry:** the relation's `outer`, `inner`, and unlabelled ways. They must join into closed
  rings, or the relation is skipped. Lines are simplified to about 500 m, trimmed to the import
  areas they reach, and rounded to about 11 m.
- **Names:** `name` (recorded as the local name) and every `name:<language>` tag.
- **Grouping:** by `wikidata`, otherwise `name:en`, otherwise `name` (see above). Polity IDs, once
  given, are permanent (`polity-ids.json`).
- **Meaning:** every relation becomes "administered by this polity, per OpenHistoricalMap". OHM
  doesn't separate control from legal sovereignty, so no sovereignty is imported from it. That's
  why sovereignty comes from other sources, such as CShapes.
- **Not read:** `source`, `note`, and chronology relations. They stay in OHM, where readers
  reach them through the relation link.
- **Edge precision** is recorded as "unknown", because OHM has no tag for it.

## 6. Never copy from OpenStreetMap or copyrighted maps

- **Not from OpenStreetMap.** OSM's data is under the Open Database License; OHM's is dedicated
  to the public domain (CC0). So "you may freely use OHM data inside OSM or any other project",
  but not the other way round: OHM says data should **not** be copied from OSM unless permission
  is in place
  ([OHM: Copyright](https://wiki.openstreetmap.org/wiki/Open_Historical_Map/Copyright)). That
  includes modern borders and coastlines, even for a border that hasn't changed since.
- **Not from copyrighted maps**, however old they look, and not from Google Maps or other online
  map services. See [section 2](#public-domain-checked-and-recorded).
- **Not from other datasets** unless their license allows it and a maintainer has agreed. That
  includes the other datasets we import: CShapes (non-commercial and share-alike) and Cliopatria
  (attribution required) can't be copied into OHM, whose data is public domain.
- **Not from memory.** A border you "know" is not a source (our
  [ground rules](../CONTRIBUTING.md#ground-rules)).

## 7. Re-importing (for maintainers)

After someone traces a border in OHM, a maintainer brings it into this repository.

**The easy way, on GitHub's website:** open the repository's **Actions** tab, choose
**Re-import a dataset**, press **Run workflow** (on `main`, with the dataset
`openhistoricalmap`, the default), and optionally say why (a
link to the OHM change or the issue). Start it while signed in as the project account, because
the run page shows who started it. A few minutes later it opens a pull request with the
re-imported data, with the data-change summary as its first comment, and starts the build check on
it. If nothing changed in OHM, it says so and opens nothing. Then review the pull request as in
step 3 below. (This needs the repository setting "Allow GitHub Actions to create and approve pull
requests", which the maintainers turn on once; see
[the reviewer guide](reviewing.md#7-repository-settings-done-once).)

**On your own computer,** the same thing with commands. They work the same in PowerShell and other
terminals. Run them in the project folder.

1. **Start from an up-to-date branch:**
   ```
   git switch main
   git pull
   git switch -c ohm-reimport
   ```
2. **Import:** `npm run import:ohm`. This downloads about 100 MB from OHM's Overpass service
   and rewrites `data/imports/openhistoricalmap/` and the OHM names in `data/polities/`. (To
   reprocess the last download without downloading again: `npm run import:ohm -- --offline`.)
3. **Review what changed:**
   - `git status` and `git diff --stat` list the changed files.
   - The new relation should appear in `assertions.yaml` with the right polity and dates, and
     as a new `shapes/ohm-r<number>.geojson` file.
   - Check the manifest's `skipped` list: the new relation mustn't be in it.
   - Other relations will have changed too, because other people edit OHM. Look at each changed
     border, and at any new polity in `polity-ids.json`. GitHub shows `.geojson` changes as
     maps in a pull request.
   - Open the relation in OHM and check its `source` and `note`: is the map dated, and is its
     public-domain status recorded? If not, ask the person who traced it before merging.
4. **Check the data:** `npm run validate`.
5. **Rebuild and look:** `npm run build-data` (about 30 seconds), then `npm run dev` and open
   http://localhost:5173 at a date the new border covers. The build also prints the contested
   areas; look for new ones.
6. **Commit and open a pull request** in the usual way, with the relation links in the
   description. The data-change summary appears as a comment once the build check finishes; you
   can also see it beforehand with `npm run summarize-changes`.

Never fix imported files by hand: if something is wrong, fix it in OHM and import again.

## 8. Reporting a problem instead

You don't have to edit OHM to help. If a border or its dates look wrong:

- On the map, select the territory and press **"Report a problem with this border"**. It opens
  GitHub's border correction form with the territory, the date, and a link to the view filled in.
- Or open the form directly:
  [new border correction](https://github.com/chronoatlas-org/chronoatlas/issues/new?template=border-correction.yml).
  It asks what's wrong, for **a source** (a dated map or document, with a page or sheet), and
  optionally a suggested fix. Filing an issue needs a free GitHub account.
- If you've traced or fixed a border in OHM yourself, use the same form and put the link to the
  OHM relation in "Suggested fix".
