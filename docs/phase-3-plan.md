# Phase 3 plan: contested and uncertain borders

> **Status: approved by the maintainer on 2026-09-28**, with the recommended answer to every
> question. The decisions are recorded in [section 12](#12-decisions-2026-09-28).

Phase 2 made the map **explain itself in the panel**. Phase 3 makes the **map itself show how
sure we are**, and lets a visitor compare the sources directly:

- borders whose dates are uncertain look uncertain at both ends, not only at the start;
- fills stop at the coast, and borders no longer end in a straight line where our imported data
  ends;
- how precise a line is (surveyed, approximate, a frontier zone) can be seen;
- the map carries words (names, "Contested"), not only colors and patterns;
- a compare view shows, for any spot and day, what each source says and where they differ.

Sections:

1. [Where Phase 2 ends](#1-where-phase-2-ends)
2. [What the data holds today](#2-what-the-data-holds-today)
3. [Uncertain dates on the map](#3-uncertain-dates-on-the-map)
4. [Border lines, coasts, and the edge of the data](#4-border-lines-coasts-and-the-edge-of-the-data)
5. [How precise a line is](#5-how-precise-a-line-is)
6. [Claims, and "no state" vs "no data"](#6-claims-and-no-state-vs-no-data)
7. [Words on the map](#7-words-on-the-map)
8. [Comparing sources](#8-comparing-sources)
9. [Left out of Phase 3](#9-left-out-of-phase-3)
10. [Order of work](#10-order-of-work)
11. [Questions for the maintainer](#11-questions-for-the-maintainer)
12. [Decisions (2026-09-28)](#12-decisions-2026-09-28)

---

## 1. Where Phase 2 ends

- **Steps 1–12 are done.** The seven sourced events for Manchuria 1931–33 (step 12) were merged
  on 2026-09-28, in pull requests #1–#7.
- **Step 13's guide is done** ([tracing-guide.md](tracing-guide.md), merged in pull request #8).
  The first traced border is still to come, because people do the tracing in OpenHistoricalMap.
- **Recommendation: close Phase 2 now.** What's left depends on people, not code. The first
  traced border and the Phase 2 open questions move to the showcase data track
  ([section 10](#showcase-data-track-in-parallel)), which runs alongside Phase 3.
- **Two Phase 2 leftovers belong here:**
  - text labels on the map (step 9 left them out for lack of fonts; see [section 7](#7-words-on-the-map));
  - Cliopatria in the comparison of sources (step 10 left it out; see
    [section 8](#8-comparing-sources)).

## 2. What the data holds today

Counted in the data on 2026-09-28. This shapes the whole plan: some of the visual language has
real data to show now, and some has none yet.

| What the map could show | Records that have it today |
|---|---|
| A start known only to the month or year | 29 of 162 OpenHistoricalMap (OHM) records; all 286 Cliopatria records |
| An end known only to the month or year | 16 of 162 OHM records; all 286 Cliopatria records. CShapes' 68 records all have exact days. |
| "Approximate" (`~`) or "uncertain" (`?`) dates | none |
| Edge precision other than `unknown` | none. All 516 shapes are `unknown`, because no import records precision per shape: OHM has no such tag, Cliopatria says many of its borders are approximate but not which ones, and no CShapes unit in our area is marked as having partly undefined borders. |
| Claims | none |
| Coverage (a source saying it's complete, which is what "no state" needs) | none; see [section 6](#no-state-vs-no-data) |
| Coastal waters inside a border | many OHM shapes. For example, about 23% of the Empire of Japan's 1931–39 shape is sea. |
| Borders cut where an import's area ends | all three imports, at 10–55°N, 73–150°E |

**What follows from this:**

- **Visible now:** uncertain end dates, fills that stop at the coast, the edge of the imported
  data, words on the map, and the comparison of sources.
- **No real data in our area yet:** approximate lines, frontier zones, claims, and "no state".
  - Where they're built in Phase 3, they're tested with made-up "Testland" data only.
  - **They appear on the map and in the legend only when the build finds real data of that
    kind.** A visitor never sees an empty toggle, or a legend line for something that isn't on
    the map.

## 3. Uncertain dates on the map

- **Today:**
  - A border whose start is known only to the year is drawn lighter during that year.
  - A border whose end is known only to the year **disappears on 1 January** of that year, the
    earliest day it could have ended. For example, a record with `end: 1945` vanishes on
    1945-01-01, although its source says only that it ended some time in 1945.
- **Proposed:** keep it on the map, lighter, until the last day it could have ended. Then an
  uncertain date looks uncertain at both ends.
- **Where one border follows another** within the same uncertain window, both are drawn lighter,
  one over the other. That's ground rule 1 ("show the time between them as uncertain"). The map
  never morphs one border into the other.
- **Cliopatria:** its dates are whole years, so each change year would show both the old and the
  new dotted outline. That matches what the Phase 2 plan says its end year means: "the change
  happened some time in that year"
  ([section 4](phase-2-plan.md#4-cliopatria-import-second-opinion)).
- **How:**
  - The tiles gain the last possible end day, but only where it differs from the first.
  - The filter and the lighter fill use it, and the change index includes it.
  - The filtering method stays the same (the global-state `filter`), so scrubbing stays as fast.
- **The panel, land areas, and contested areas follow the same rule,** so they never disagree
  with the map:
  - During that window the panel lists the record as current, with a note that it may already
    have ended, just as it notes an uncertain start today.
  - Land areas and contested areas count the record until its last possible day. That changes
    some computed numbers, and the step lists which.

## 4. Border lines, coasts, and the edge of the data

### Border lines as their own features

- **Today:** the map draws each border by outlining its filled shape. That outlines everything:
  - the rings OHM draws around islands, a few kilometres out to sea;
  - the straight cut where an import's area ends (for example along 55°N), which looks like a
    real border but isn't one.
- **Proposed:** the build writes the lines separately from the fills, as a second layer in the
  same tiles. Each shape's outline is written **without**:
  - the parts along the edge of its import's area;
  - the parts at sea.

  The fills stay as they are, for color and clicking.
- **What this opens up later:** a line can be styled stretch by stretch instead of shape by
  shape (see [section 5](#5-how-precise-a-line-is)).
- **Cost, measured today:** the full outlines as separate features would add about 5.0 MB to the
  default map's tiles (5.2 MB now). Dropping the parts at sea and along the edges should remove
  a large share of that. The step measures the result, including the download for the opening
  view (about 0.3 MB in Phase 1). A visitor only downloads the tiles in view, whatever the total.

### The edge of the imported data

- A dashed gray line runs along the edge of each import's area, over land, labelled "Edge of
  imported data" (once the map has text; [section 7](#7-words-on-the-map)).
- Beyond it, the existing "No data yet" hatch continues as now.
- The line's position comes from each import's manifest (`settings.bbox`), as the land areas
  already do.

### Fills that stop at the coast

As planned in the [architecture roadmap](architecture.md#roadmap):

- The build splits each shape into its **land part** and its **coastal-waters part**, using
  Natural Earth's land, the same way step 11 measured land areas (`scripts/lib/land.ts`).
- The land part is filled as now. The water part gets a faint tint and no outline, and the legend
  says "Coastal waters, as the source draws them". The coastal waters stay in the data; only the
  drawing changes.
- **Why not paint the sea over the fills,** which would be simpler: that would hide small islands
  missing from the base map's coastline, and in East Asia those are often the most disputed
  places.
- **The base map** uses Natural Earth's 1:10m land at close zooms, so the coast matches the cut.
  - That file is 8.4 MB as GeoJSON, so it's cut into tiles like the borders, and visitors only
    download what's in view.
  - At lower zooms the base map keeps the 1:50m file. There the difference between the two
    coastlines is about a pixel or less.
  - The "No data yet" hatch follows the same land.

## 5. How precise a line is

The data model already gives every shape an `edge_precision`: `treaty-line`, `approximate-line`,
`frontier-zone`, or `unknown`. None is set to anything but `unknown` yet (section 2).

**Proposed look:**

| Edge precision | Drawn as |
|---|---|
| `treaty-line` (a treaty or surveyed line) | a solid line, as now |
| `unknown` (the source doesn't say) | a solid line, as now |
| `approximate-line` | a **softened** (blurred) line of the same width: "about here" |
| `frontier-zone` | a **wide, soft band** with no crisp line, labelled "Frontier zone" |

- **Why blur rather than dots or dashes:** dots already mean the second opinion (Cliopatria).
  Dashes already mean a dependency in the de jure view, a contested edge, and an event's
  effects. Sharpness is a different visual channel, so the difference doesn't depend on color.
- **Why `unknown` looks like `treaty-line`:** almost every border is `unknown`. Drawing all of
  them as uncertain would make the map look vague everywhere, and it would then say nothing about
  precision. Instead:
  - the legend says "Solid line: a treaty or surveyed border, or one whose source doesn't say
    how precise it is";
  - the panel names each border's precision in words.

  This is a question for the maintainer (question 3).
- **Per shape, for now:** a territory's edges often mix precision, for example a treaty line on
  one side, an undefined frontier on another, and a coast. The model records precision per
  shape, which is enough to start.
  - Once lines are their own features (section 4), precision could be recorded per stretch of
    line. That would need a new kind of record, such as "per source X, this stretch of OHM way N
    is a treaty line".
  - That's not proposed now. It's revisited when the first sourced precision arrives
    (question 4).
- **Where real precision would come from:** a traced border whose source map says how precise
  its lines are, for example a map whose legend separates defined and undefined boundaries.

## 6. Claims, and "no state" vs "no data"

### Claims

- **There are no claim records yet.** The first could come from:
  - Phase 2's [open question 1](phase-2-plan.md#open-questions-found-during-the-work): OHM's
    Republic of China boundary for 1935–38 covers Manchuria, which Manchukuo's boundary also
    covers, and its own tags suggest it shows a claimed extent (Outer Mongolia raises the same
    question, per Phase 2 step 9);
  - claims we record ourselves, each from a named source, such as a government's stated position
    in a FRUS document.

  Either way, that's a data decision, not code.
- **Proposed look:**
  - A claim is drawn as a line with small ticks on its inner side (a "claim line"), with no
    fill, so it never hides who administered the area.
  - Its words go in the panel and on the line: "Claimed by X (per source)".
  - It's an overlay that can be switched on in either view, and the switch appears only when the
    build has claim records.
- **Contested:** the architecture counts conflicting claims as contested. So once claims exist,
  the contested computation (`scripts/lib/contested.ts`) also compares a claim against another
  polity's administration, and the panel names which kind of dispute it is.
- This step waits for the first claim records (question 10).

### "No state" vs "no data"

- **The design (architecture):** inside a source's *coverage* (where the source says it's
  complete), land with no polity is "no state (per source)". Everywhere else it's "no data yet".
- **No coverage exists in our area, and none is likely soon:**
  - OHM doesn't claim to be complete; its import manifest says so.
  - Cliopatria's README (at the pinned commit, read on 2026-09-28) calls it "comprehensive", but
    describes its polities as "sampled at varying timesteps and spatial scales". It doesn't say
    it's complete, or what its blank areas mean.
  - CShapes' codebook must be read by hand: its website is blocked from the environment this
    plan was written in.
  - **Even if CShapes does claim completeness,** it would show almost nothing here. Measured on
    2026-09-28 for four dates between 1905 and 1943: the land in our area with no CShapes unit is
    about 48,000 km², in about 1,330 pieces, **none as large as 10,000 km²**. They're gaps
    between separately simplified borders and differences between coastlines, not stateless
    land.
- **"No data yet" already works as designed.** For example, OHM has no boundary for mid-1937
  over an area of about 450,000 km², roughly present-day Thailand, and the map hatches it as "No
  data yet".
- **Recommendation: defer the "no state" style** until a source states that it's complete, or
  that an area had no state. Keep the architecture's design (a light stipple and a label), and
  keep the stipple free for it. This changes a line of the roadmap, so it's the maintainer's call
  (question 5).

## 7. Words on the map

- **Today the map has no text at all.** The base map deliberately has no place names, and the
  historical layers have no labels. Contested areas are explained only by the legend and the
  panel. CLAUDE.md asks for text labels on contested areas as well as patterns.
- **Proposed labels:**
  1. **Territory names,** placed inside each territory's land part at the point farthest from its
     edges, so a label doesn't land in the sea or in a thin strip.
     - The name is the one the source gives for that record: in the reader's language where the
       source has one, with the local-script name beneath.
     - Names have dates, so where a name changes during a record, the build splits the label.
  2. **"Contested"** on contested areas.
  3. **"Edge of imported data"** along that line.
  4. Later, with their data: "Frontier zone" and "Claimed by …".
- **Fonts:**
  - MapLibre draws text from "glyph" files that the site has to host itself (no outside
    services).
  - Latin text needs one font's glyph files, downloaded range by range as needed.
  - Chinese, Japanese, and Korean text uses fonts already on the visitor's device
    (`localIdeographFontFamily`), as the architecture decided. That avoids very large downloads.
    It has one limit: on the map, unlike the panel, Han characters can't switch between their
    Chinese and Japanese forms by language.
  - **Candidate font: Noto Sans** (SIL Open Font License 1.1). The OFL lets us host the font
    with its license file. Before importing, check:
    - the license on the font's own release page;
    - whether converting it to glyph files counts as a "Modified Version" under the OFL, which
      matters if the font has a Reserved Font Name.

    The font would get its own folder with its license and a manifest, like a dataset, and a
    line in `CREDITS.md` (question 8).
- **Cost:**
  - Label points are a small extra layer in the tiles.
  - Text is MapLibre's most expensive kind of layer, so scrubbing is measured again, as in
    Phase 1 step 7.

## 8. Comparing sources

- **Today:**
  - The default map shows OHM's borders, and the de jure view swaps in CShapes'. Cliopatria's
    borders can be laid over either as dotted outlines.
  - Contested areas compare only OHM and CShapes.
  - The panel shows other sources' records for our polities, through the crosswalks.
- **The goal:** for any spot and day, see what each source says, and where the sources differ.

**Options:**

| Option | Strengths | Weaknesses |
|---|---|---|
| Two maps side by side, moving together | The clearest comparison | Two maps double the memory and downloads, which is heavy on phones; a phone screen splits badly |
| Swipe (two maps, one cut away by a slider) | Good on a desktop | The same cost; the slider fights with dragging the map on touch screens |
| **One map:** source A as fills, source B as outlines, their differences marked, plus "what each source says here" in the panel | Cheapest; works on phones; builds on what exists | Less immediate than two maps |

**Recommendation: one map.**

- **Choosing:** a "Compare" option in the view switch picks which source is drawn as fills and
  which as outlines, from OHM, CShapes, and Cliopatria. The address records the choice.
- **"Sources differ":** for each pair of sources, the build computes where they name different
  holders on the same days, by generalizing `scripts/lib/contested.ts` to any pair.
  - It's drawn with its own pattern, not the contested cross-hatch.
  - It shows in the compare view only.
- **"What each source says here":** clicking a spot lists each source's record at that spot on
  that day, side by side and each attributed, including "no record" for a source that has
  nothing there.
  - It's computed in the browser from the tiles already loaded, so there are no new files to
    download.
  - This is useful on its own, so it's a separate, earlier step.
- **Keeping two words apart:** "contested" is reserved for disputes in the world: the
  administering power differs from the legally recognized one, or claims conflict. A
  disagreement between sources is **"sources differ"**, which can come from detail, resolution,
  or dating rather than a dispute.
  - That means rewording today's legend line, "Contested: the sources disagree", for example to
    "Contested: administered by one state, legally recognized as another's (per the sources
    named)".
  - The wording is the maintainer's call (question 7).
- **Why differences aren't hatched on the default map:** Cliopatria folds puppet states into their
  patrons, works at about 40 km² resolution, and dates changes by year. Hatching every such
  difference on the main map would present ordinary differences of detail as disputes.
- **Thin strips:**
  - At Cliopatria's resolution, its borders wander a few kilometres either side of the others'.
    That produces long, thin difference strips, which the 10,000 km² threshold doesn't remove,
    because a long strip can be large.
  - The step measures the differences on the real data first. It then proposes a width
    threshold based on Cliopatria's stated resolution, for the maintainer to approve.
  - The legend then says what's left out: "Differences narrower than about N km aren't shown."
- **Licensing:**
  - Each pair's difference layer carries the stricter license of the two: OHM with Cliopatria is
    CC BY 4.0 (credit Cliopatria), and any pair that includes CShapes is CC BY-NC-SA 4.0.
  - Like the contested areas, these layers exist only in the build output, never in `data/`, and
    are credited on the map.

## 9. Left out of Phase 3

- **Coloring the map by a figure** (for example population), listed as optional in the roadmap.
  The only figure we have is land area, and coloring by area tells a visitor nothing the map
  doesn't already show. It's worth revisiting once there's population data, which Phase 2
  decision 10 put off (question 9).
- **"No state",** unless question 5 is answered differently (section 6).

## 10. Order of work

Small steps, each committed, explained, and viewable locally and online, as in Phases 1 and 2.
Each step lists the **recommended effort setting** for the AI assistant doing it: higher where
geometry, licensing, or the visual language needs care, and lower where the work is routine.

| Step | What | Effort |
|---|---|---|
| 1 ✅ | Record Phase 2 as closed and the Phase 3 decisions. *Done 2026-09-28,* with the legend's contested line reworded (decision 7). | low |
| 2 ✅ | **Uncertain ends on the map** (section 3). *Done 2026-09-28;* see [progress](#progress). | medium |
| 3 ✅ | **Border lines as their own features,** without the import edges, and the dashed "edge of imported data" line (section 4). *Done 2026-09-28;* see [progress](#progress). | high |
| 4 ✅ | **Fills that stop at the coast:** land and coastal-waters parts, and the 1:10m base map at close zooms, tiled (section 4). *Done 2026-09-28;* see [progress](#progress). | high |
| 5 | **Words on the map:** the font (after its license check), territory names, "Contested", and "Edge of imported data" (section 7). Scrubbing measured again. | high |
| 6 | **"What each source says here"** in the panel (section 8). | medium |
| 7 | **The compare view:** "sources differ" for each pair of sources, with the strip threshold measured and proposed first (section 8). | high |
| 8 | **Precision styles:** softened approximate lines and frontier zones, tested with Testland, shown only when real data exists (section 5). | medium |
| 9 | **Claims overlay,** and claims in the contested computation, only once the first claim records exist (section 6). | high |
| 10 | **Measure and tidy:** performance, the phone layout with the longer legend (folding on phones), docs. | medium |

Every step keeps `npm run typecheck`, `npm test`, `npm run validate`, and the build passing, and
updates `docs/architecture.md` and CLAUDE.md where it changes how things work.

### Progress

**Step 2, uncertain ends (done 2026-09-28):**

- **On the map:** a border whose end is known only to the month or year stays on the map, lighter,
  until the last day it could have ended. For example, in May 1942 British Burma (ending
  "1942-05") and the Japanese occupation of Burma (starting "1942-05") are both drawn lighter;
  from June only the occupation is, at full strength.
- **In the panel:** the record is listed as current in that window, with a note: "The source gives
  this end only as May 1942, so it may already have ended."
- **Found while building: "possibly contested".** Counting a record until its last possible end
  (and, as before, from its first possible start) made some contested areas depend on a date
  that's only known to the month or year. For example, OpenHistoricalMap dates Manchukuo's
  border only to "1932", so Manchuria was hatched as contested from 1 January 1932. Now each
  contested period is split where both records certainly apply:
  - the certain part is hatched as before;
  - the uncertain parts are hatched more faintly, and the panel says "Possibly contested", with
    the reason.

  In the real data this marks, among others, Manchuria through 1932, and southern Sakhalin from
  5 September to 31 December 1905. Sakhalin's contested pair (Russian Empire per OpenHistoricalMap
  vs Japan per CShapes, about 32,000 km²) is new: OpenHistoricalMap ends the older Russian
  border only "1905", and CShapes gives the south to Japan on 5 September 1905.
- **Land areas:** in an uncertain window, a polity's area is measured over both its old and new
  borders together, and the panel now says the area held "may have been smaller". Areas changed
  for 12 polities. The largest change: the Russian Soviet Federative Socialist Republic in 1920
  reads about 3,500,000 km² instead of 2,000,000, because its older border, ending "1920", may
  still apply.
- **Contested entries changed for 13 polities,** each by extending the period to the end of the
  uncertain month or year, plus the new Sakhalin pair.
- **Sizes:** the change index grew from 288 to 299 days, all tiles together from 11.4 to 11.6 MB,
  and the polity files from 1,474 to 1,500 KB. The new `e1` and `maybe` properties appear only
  where needed.

**Step 3, border lines apart from the fills (done 2026-09-28):**

- **What changed on the map:**
  - Borders no longer run around islands out at sea. OpenHistoricalMap draws many borders a few
    kilometres offshore; those stretches, more than 2 km from land, are no longer drawn as
    lines. About 40% of OpenHistoricalMap's outline was at sea. (The fills still reach out to
    sea until step 4.)
  - Borders no longer stop in a straight line where the imported data ends. A dashed gray line
    marks the edge instead (over land, 1900–1950), with "Edge of imported data" in the legend.
- **How:** `scripts/lib/outlines.ts` works out which stretches of each outline to keep. It
  checks distances against Natural Earth's 1:10m land through a grid, so the whole build takes
  about a second more per source.
- **Borders along coasts are kept,** because they're within 2 km of the coastline. CShapes keeps
  almost all of its outline (its borders follow the coast), Cliopatria about three quarters.
- **Size:** each tile set grows by about half. The opening view's default tiles went from about
  0.28 to 0.43 MB. The de jure view adds about 0.09 MB, and the second opinion 0.22 MB, only
  when they're switched on. All tiles together went from 11.6 to 18.6 MB on the server.
- **Noticed, not changed:** a lighter fill (an uncertain date) lets the "No data yet" hatch
  under it show through. For example, British Burma in 1937, whose border starts "1937", looks
  hatched. That has been so since Phase 1. It reads as "not certain yet", but a clearer look
  may be wanted; it's listed for the maintainer.

**Step 4, fills that stop at the coast (done 2026-09-28):**

- **What changed on the map:** from zoom 4, a border's coastal waters (as its source draws them)
  are a faint tint, and only its land is filled. For example, Japan's islands no longer sit in
  colored rings, and Hong Kong's square of waters is tinted while its land is filled. The legend
  says "Faint tint (zoomed in): coastal waters, as the source draws them".
- **How, and a change from the plan:** instead of splitting each border into land and water
  parts, the whole border is drawn as the tint and its land part is filled over it. That needs
  half the geometry, and the two can never leave a gap. Only borders whose coastal waters are
  at least 1% of their area (106 of 162) get a land part. The land parts are simplified like the
  imports (0.005°, about 500 m), which is under a pixel at the map's closest tile zoom.
- **Up close, the base map is more detailed:** inside the imported area, from zoom 4, it uses
  Natural Earth's 1:10m land, sea, and coastline (as tiles), so the coast matches where the fills
  are cut. Outside the area, the 1:50m base map stays.
- **Why from zoom 4:** below it, the coastal bands are under a pixel wide. At zoom 4.5 they still
  showed as halos, so the cut starts at 4 rather than the planned 5.
- **Size:** the opening view (zoom 3) is unchanged, at about 0.43 MB. A zoom-4 view grows by
  about 0.2 MB, and a zoom-5 tile averages 44 KB instead of 28. The detailed coast adds about
  0.1 MB per view. The build takes about 20 seconds longer (73 seconds in all).
- **Phones: the map key now folds.** The legend had grown to four lines, about a quarter of a
  phone screen. On phones (and short landscape screens) it now starts folded behind "Map key",
  and on wider screens it starts open. This was planned for step 10, but done now because each
  step goes live.
- **Not changed:** the de jure view (CShapes) and the second opinion follow their sources' own
  coastlines, so they aren't cut. Contested areas aren't cut either; they're mostly on land.

### Showcase data track (in parallel)

This is work for people and data decisions, not Phase 3 code. Each item becomes its own pull
request when it's ready.

| Item | Waiting on | Effort to import or record |
|---|---|---|
| The first border traced in OHM (Phase 2 step 13), then re-imported | a contributor tracing in OHM | medium |
| A gazetteer for event places (Phase 2 open question 3), then places for the seven events | the maintainer's choice. The candidates' license pages (`geonames.nga.mil`, `www.geonames.org`) are blocked from the environment this plan was written in, so either the network settings allow them, or the maintainer reads the licenses by hand. | medium |
| OHM boundaries that overlap another polity's: administered, or claimed? (Phase 2 open question 1) | the maintainer's decision. It gates step 9. | high, if boundaries are to be re-imported as claims |
| Duplicate OHM boundaries for Bhutan, the British Raj, and Thailand (Phase 2 open question 2) | the maintainer's decision, or a contributor checking in OHM | low |
| China 1937–45: areas under Japanese control, traced from dated public-domain maps (the flagship stage) | contributors tracing in OHM ([data-sources.md](data-sources.md#gap-front-lines-in-china-193745) lists a first candidate map) | medium per import |
| The CShapes authors' reply about the R package's columns (Phase 2 decision 14) | the authors | low |

## 11. Questions for the maintainer

Each has a recommended answer. "Approve with the recommendations" answers them all.

1. **Close Phase 2 now,** with the first traced border and the open questions moving to the
   showcase data track? *Recommended: yes.*
2. **Uncertain ends:** keep a border on the map, lighter, until the last day it could have ended?
   *Recommended: yes.*
3. **Precision styles:** a solid line for both "treaty or surveyed" and "unknown" (with the panel
   and legend saying which), a softened line for approximate, and a soft band for frontier zones?
   *Recommended: yes.*
4. **Precision per shape** for now, with records per stretch of line only when real data needs
   them? *Recommended: yes.*
5. **"No state":** put it off until a source says it's complete, or that an area had no state,
   and keep the stipple free for it? *Recommended: yes.*
6. **The compare view:** one map (fills, outlines, "sources differ" areas, and a list of what
   each source says at a spot), rather than two maps? *Recommended: yes.*
7. **"Contested" vs "sources differ":** keep the two apart, and reword today's legend line?
   *Recommended: yes.* The exact wording is yours to approve.
8. **Map text:** Noto Sans for Latin text, hosted with the site in its own folder with its
   license, and device fonts for Chinese, Japanese, and Korean? This depends on the license check
   in step 5. *Recommended: yes.*
9. **Coloring the map by a figure:** leave it out of Phase 3? *Recommended: yes.*
10. **Claims overlay:** build it only once the first claim records exist (from Phase 2 open
    question 1 or a sourced claim)? *Recommended: yes.*

## 12. Decisions (2026-09-28)

The maintainer approved the plan with the recommended answer to each question.

1. **Phase 2 is closed.** The first traced border and Phase 2's open questions move to the
   showcase data track.
2. **Uncertain ends:** a border stays on the map, lighter, until the last day it could have
   ended. The panel, land areas, and contested areas follow the same rule.
3. **Precision styles:** a solid line for both "treaty or surveyed" and "unknown" (the legend and
   panel say which), a softened line for approximate, and a soft band for frontier zones.
4. **Precision is recorded per shape** for now. Records per stretch of line wait until real data
   needs them.
5. **"No state" is put off** until a source says it's complete, or that an area had no state. The
   stipple stays free for it.
6. **The compare view is one map:** fills, outlines, "sources differ" areas, and a list of what
   each source says at a spot.
7. **"Contested" and "sources differ" are kept apart.** The legend's contested line now reads
   "Contested: administered by one state, legally recognized as another's (per the sources
   named)".
8. **Map text:** Noto Sans for Latin text, hosted with the site in its own folder with its
   license, and device fonts for Chinese, Japanese, and Korean, subject to the license check in
   step 5.
9. **Coloring the map by a figure** is left out of Phase 3.
10. **The claims overlay** is built only once the first claim records exist.
