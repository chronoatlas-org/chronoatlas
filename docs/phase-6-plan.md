# Phase 6 plan: a map that is smooth, close-up, and pleasant to watch

> **Status: DRAFT, not approved.** Written 2026-09-29 for the maintainers to review. Nothing here
> is built. Each question in [section 13](#13-questions-for-the-maintainers) has a recommended
> answer; "approve with the recommendations" answers them all. More requests may be added before
> approval.

Phases 1–5 built a map that is honest about its sources and covers the world. Phase 6 makes it
**good to use and good to watch**, for a visitor who has never heard of OpenHistoricalMap:

- **it runs lightly**, so a low-end laptop or phone can scrub and zoom without a fan spinning up;
- **it stays on screen while it loads**: a big jump in time shows the old map until the new one
  is ready, then blends to it, never an empty gap;
- **it holds up close**: borders and coasts line up as far in as the sources can honestly support,
  and the map says so where they can't;
- **you can type a date and travel to it**, watching the map change on the way;
- **a first-time visitor knows what to do:** a play button, search by name, and a lens that shows
  how sure each part of the map is; and events, chosen by what the map needs (section 9);
- **water has names** (oceans, seas, lakes, rivers), attributed like every other name;
- **a polity can show its flag**, where a source records one for that period;
- **the interface is redesigned** to be calmer and more beautiful, on a phone as well as a desktop;
- **the launch showcase is China, 1937–45**, the project's reference case, with its events;
- **stretch goal:** a "local area" card for any place: which states held it over time, and the
  events near it ("my town").

## Sections

1. [Where Phase 5 ends](#1-where-phase-5-ends)
2. [What the maintainers reported, and what we think is behind it](#2-what-the-maintainers-reported-and-what-we-think-is-behind-it)
3. [Feasibility at a glance](#3-feasibility-at-a-glance)
4. [Performance](#4-performance)
5. [Detail up close, and coasts](#5-detail-up-close-and-coasts)
6. [Smooth changes of era, and going to a date](#6-smooth-changes-of-era-and-going-to-a-date)
7. [Names for water](#7-names-for-water)
8. [Flags](#8-flags)
9. [First-time visitor features](#9-first-time-visitor-features)
10. [The interface, redesigned](#10-the-interface-redesigned)
11. [The launch showcase: China 1937–45](#11-the-launch-showcase-china-193745)
12. [Stretch: your local area, over time](#12-stretch-your-local-area-over-time)
13. [Questions for the maintainers](#13-questions-for-the-maintainers)
14. [Order of work](#14-order-of-work)
15. [Keeping the scope in check](#15-keeping-the-scope-in-check)
16. [Decisions](#16-decisions)

---

## 1. Where Phase 5 ends

Phase 5 was closed on 2026-09-29 (decision 15). The map is worldwide, split into eras, with
Cliopatria as the baseline and OpenHistoricalMap as the main map for East Asia and Europe,
1900–1950. The next OpenHistoricalMap region (after Europe) is not chosen; more regions stay on
the data track and don't compete with this phase. **Recommendation: nothing left open from
Phase 5.**

## 2. What the maintainers reported, and what we think is behind it

These are readings of the code and docs, **not measurements**. Step 2 measures each one before
anything is changed.

| Report | Likely causes (to confirm) |
|---|---|
| **Small shapes don't line up when zoomed in** | Several layers were made at different levels of detail: imported borders are simplified to about 500 m (0.005°) at import; tiles simplify again (tolerance 3 tile units) and stop at zoom 7 (about 40 m per unit), so MapLibre enlarges them beyond that; the base map is Natural Earth 1:50m, replaced by 1:10m only from zoom 4 and only inside the imports' areas; Cliopatria's own shapes are coarse (its authors' resolution, not ours). |
| **Fills don't reach the ocean** | By design: Cliopatria's shapes are not cut to the coast, the sea is drawn over them from zoom 4, and land its polygon doesn't include shows the "no data" hatch (Phase 5 step 7). It looks like the same problem because it is the same mismatch between a coarse shape and a fine coast, but it is a **decision** as well as a bug: see question 3. |
| **High GPU use while scrolling and zooming** | Not known. Candidates: about 30 map layers, some full-screen patterned fills (the "no data" hatch covers all land); overdraw from stacked fills and sea layers; drawing at the screen's full pixel density on a large display; several label layers; whether the timeline's frame loop keeps running while idle; the base map's GeoJSON layers. We won't guess: step 2 profiles it. |
| **Big jumps in time show nothing, then the borders** | When the date crosses into another era the map swaps every layer's tiles (`setTiles`), and MapLibre drops the old tiles as soon as they're replaced. The new ones aren't there yet. |

## 3. Feasibility at a glance

| Request | Feasible? | The honest limit |
|---|---|---|
| Lighter on the GPU/CPU | **Yes**, most likely | We can't measure a graphics card in our cloud environment; the maintainers' check on real machines is part of step 2 and step 4. |
| Smooth loading across big jumps | **Yes** | It costs more memory and bandwidth (two eras held at once, neighbours prefetched). Bounded by the caps in section 6. |
| Borders line up close in | **Partly** | We can reduce our own simplification and draw the base map in matching detail. We can't make a source more precise than it is: Cliopatria's shapes are approximate, and OpenHistoricalMap's are only as detailed as its tracing. |
| A detailed view of my local area (not street level) | **Partly** | Street level needs municipal or parcel-level history, which doesn't exist worldwide for most eras. What we can do is (a) go as far as the source supports, (b) say when you've zoomed past it, and (c) a "local area" card: which states held the place over time, and events near it (section 12). |
| Fill all the way to the ocean | **Yes, without changing the rule, but it's a decision** | The gap is mostly Cliopatria's coarse resolution, not a claim that nobody held the land. An approximate margin, drawn only in the build and flagged as such, keeps rule 1 (section 5, option B); it still draws colour where no source did, so it is the maintainers' call. See question 3. |
| Go-to-date box | **Yes** | Depends on the smooth-era work. Very long jumps (thousands of years) will skip time quickly, not play every year. |
| Play button, search by name, more events | **Yes** | Events are written by people from cited sources, so how many there are depends on the data track, not the code (section 9). |
| A lens that shows how sure the map is | **Yes** | Today it can show date precision and each source's resolution; edge precision fills in only as real data records it (section 9). |
| A redesigned, prettier interface | **Yes, and the biggest change to what people see** | It touches every screen, so it starts as mockups the maintainers choose from, then a new layout built once; the panel's logic stays as it is (section 10). |
| A launch showcase: China 1937–45 | **Yes** | The map and the reviewed crosswalk already cover East Asia; what's missing is events and a check of the period's data (section 11). Southeast Asia south of 10°N is not in the import today. |
| Names for oceans, rivers, lakes | **Yes** | Present-day names only, attributed. Some are disputed (the sea between Korea and Japan, the Persian/Arabian Gulf, others): see section 7. |
| Flags | **Yes, for a subset** | Flags are modern. Most polities before about 1800 had none, or none anyone recorded; flags need a source with dates, and their images carry licenses. Default is "no flag on record". |
| History of a spot | **Yes, as a stretch** | Built from the same records as the panel: approximate where the sources are. |

## 4. Performance

**Goal (proposed):** a low-end target machine (an older integrated-graphics laptop, or a mid-range
phone) scrubs and zooms without dropping below about 30 frames a second, and an idle map uses
almost no GPU. Step 2 fixes the real numbers.

- **Measure first (step 2).** Profile the map with DevTools' Performance panel and the built-in
  frame stats: frames per second, GPU time, and layer cost, with layers switched off one at a time
  to see which matter. The maintainers run a short checklist on their own machine (we can't read a
  GPU here); we add a repeatable scripted measure (Chromium with software drawing, useful for
  *comparing* before and after, not as absolute speeds) to `docs/architecture.md`.
- **Likely fixes**, applied in order of measured payoff:
  - draw fewer, simpler layers at low zoom (merge layers; drop patterns until zoomed in);
  - replace the full-land "no data" pattern with a plain tint at low zoom;
  - limit the drawing resolution on large or dense displays (`pixelRatio` cap), with a smaller
    cap while the map is moving;
  - make sure nothing repaints when nothing changes (idle map, idle timeline);
  - hold label layers to what fits on screen, and reduce collision work.
- **A "lighter map" setting.** A toggle in the header (and automatic where the browser says
  the device prefers reduced motion or reports low power) that turns off patterns, soft lines,
  and pulses. The default stays the full map on machines that can show it.
- **Rule:** no change to what the map *says*; only how it is drawn. Every change keeps the
  contested, "no data", and "sources differ" looks distinguishable without colour (project rule).

## 5. Detail up close, and coasts

**Goal:** as far as a source supports, the border and the coast agree. Beyond that, the map says
"closer than this source can tell".

1. **Measure the error (step 2).** A test that, for chosen synthetic and real cases, reports the
   distance between the source line and what the tile draws at each zoom, and between our borders
   and Natural Earth's 1:10m coast. It shows which of the causes in section 2 matters.
2. **Less of our own simplification, where the source is finer.** Reduce the import's 500 m and
   the tiles' tolerance for OpenHistoricalMap's borders, and raise the highest tile zoom above 7,
   only where the source has the detail. Each is a size trade against the 1 GB site limit and the
   era budget (about 6 MB per era set); step 5 measures the cost and comes back to the maintainers
   before applying it broadly.
3. **Matching base map.** Use Natural Earth 1:10m coast at every zoom where borders are drawn in
   detail, not only inside the imports' areas from zoom 4. (Public domain, already imported.)
4. **A detail limit, shown honestly.** Each source has a resolution (tens of kilometres for
   Cliopatria's oldest rows, less for OpenHistoricalMap). Zoomed in past it, a small note appears
   ("Cliopatria's borders are approximate, about X km"), and lines are drawn softer, using the edge
   precision styles that already exist but have had no real data (approximate line, frontier
   zone). That turns a limitation into information.
5. **Coasts, question 3.** The hatch today covers two different things: a source shape that stops
   a few kilometres short of a precise coast (its own resolution; Cliopatria's edges are
   stair-stepped in places), and land the source really doesn't cover. They should look different.
   - **A. Restyle only.** The gap reads as "the source stops short of the coast here", unfilled.
   - **B. An approximate margin.** A strip is drawn in the neighbouring polity's colour, paler and
     patterned, with its own legend entry ("coastal margin, approximate"), only where it is
     narrower than the source's resolution, touches exactly one polity, and no other record
     covers it. Where two polities meet at the coast, or the gap is wide, the hatch stays. It
     exists only in the build's tiles, never in `data/`; areas and figures still come from the
     source shapes, and the panel says the margin isn't part of the record. It doesn't change
     the rule (nothing is asserted), but it draws colour where no source did.
   - **C. Snap the shapes to the coast in the data.** Not recommended: it writes an assumption
     into the dataset.
   - Before choosing, step 2 checks how Cliopatria's authors say the shapes were made (if the
     coarse edge is their own tracing resolution, B restores their intent) and measures how
     much of today's hatch is narrow margin and how much is real gap.
   *Recommended: B, with A as the fallback; the maintainers decide.*

## 6. Smooth changes of era, and going to a date

**Smooth era changes**

- Keep the old era's tiles on screen until the new era's tiles for the current view have loaded,
  then blend across (a single short fade, not the per-frame opacity filtering we measured as slow).
- Load the next and previous eras' tiles for the current view in the background, while idle
  (`prefetch`), with a cap on requests so a phone on mobile data isn't flooded.
- While a long jump runs, show each era's map as it passes if it's ready, and hold the last ready
  one if it isn't. Never blank.
- **Limits (proposed):** at most two eras of a tile set in memory at once, and no prefetch when the
  browser reports a data-saver connection.

**Go to a date**

- A small box at the bottom right (beside the attribution, and above the phone sheet; the layout
  is checked at phone width) takes a date in the form the timeline already understands (`1937`,
  `1937-07-07`, `44 BCE`), validates it with `src/dates` (never JavaScript `Date`), and travels
  there.
- **Travel:** the timeline animates to the date at a speed that depends on the distance, and the
  map follows through the eras (using the smooth changes above). Short jumps play; long ones
  accelerate, then slow. It can be interrupted by any drag or key. The date box and the address
  (`d=`) stay in step, and a "reduced motion" preference jumps straight there.
- New text goes through `src/i18n/`; the box is keyboard- and screen-reader-friendly.

## 7. Names for water

- **Source:** Natural Earth (public domain, already used for the base map): its marine areas
  (oceans, seas, gulfs, bays), lakes, and named rivers, at a scale suited to each zoom. Step 2
  checks which name fields and ranks the files really carry, and the size cost.
- **Shown as present-day names**, and the panel-style credits and legend say so: they are today's
  names on today's coast, the same limit as the coastline. A river's or lake's earlier names are
  out of scope here.
- **Disputed names** (for example the sea between Korea and Japan, the Persian/Arabian Gulf, and
  parts of the South China Sea) are shown with each side's name and attribution, taken from cited
  sources in a small hand-written, CC0 list, never chosen by us (project rule 4). Which waters are
  on that list, and which sources, is for the maintainers to decide (question 4).
- **How they're drawn:** the visitor's own fonts, as for the other words on the map, in an
  understated style that reads as water, not politics. Rivers follow their lines; larger features
  appear first, small ones as you zoom in, so the map isn't cluttered. Original scripts appear
  beside English, as for polities, where Natural Earth carries them.
- **Checked first:** that text along a line works with the local-fonts approach (no `glyphs`);
  if it doesn't, rivers get horizontal labels at points instead.

## 8. Flags

**What we can and can't promise**

- Flags are a modern idea. Before roughly 1800 few polities had one, and older banners and
  standards are a different thing. So the default is a plain line, **"No flag on record"**, and
  it will be the answer for most of history. That is the honest answer, not a gap to hide.
- **A flag is shown only with a source and a period.** Where Wikidata's flag statement (P41) has
  start and end dates and a reference, that is a *lead* (project rule 1); the image's own page on
  Wikimedia Commons gives its author and license, and the polity's own sources should agree the
  flag was in use. We never show a flag outside the period a source gives, and never pick a flag
  for a disputed polity: the panel says whose flag it is ("The flag used by …").
- **Images and licenses.** Most national flags are in the public domain or free to use, but not
  all (some designs are protected, and some Commons files are share-alike). Under project rule 5,
  flags live apart from our CC0 data, each with its license and author in a manifest, in their own
  folder like an import (`data/imports/flags/`), and are credited in the panel and `CREDITS.md`.
- **Hosting.** Images are copied into the site (small, optimised SVGs, loaded only when a panel
  opens), not linked from Wikimedia, so the site stays free to run and doesn't depend on another
  service. A size cap per file, and a total budget, keep to the 1 GB limit.
- **Scope, to start:** the polities in our own data (OpenHistoricalMap's, about a hundred) plus
  present-day states that have Cliopatria/CShapes twins reviewed by crosswalk. We don't match
  Cliopatria's thousands of polities by Wikidata ID (some are wrong; see `docs/data-sources.md`).
- **Contributors** can propose a flag through the same review path as other data: an issue form
  (source, dates, image page) and the data-change summary shows the image and license.

## 9. First-time visitor features

What a person needs in their first minute, in the order they meet it. The first three are in this
phase; the rest are candidates for Phase 7 (question 9).

**In this phase**

- **A play button and the basics (step 9).** The timeline can already advance at a set speed
  (measured in Phase 1); this makes playing the obvious first action, from a good opening view.
  The map itself is the storyteller, so there are no scripted tours. The same step adds what a new
  visitor looks for: an About page (what this is, where the data comes from, that it is run by
  one maintainer, that it was built with AI help and every claim is sourced), a Contribute page
  that links the existing report link and issue forms, and a preview image and title for shared
  links. The link itself already carries the date, map view, selection and view
  (`#d=…&m=…&sel=…`), so a shared link opens at that time and place; only the *preview* (the image
  and title chat apps show) is one generic picture, because the part of a link after `#` never
  reaches a server, so a static site can't make a different preview for each. This step also
  writes an **events-gap report** (below).
- **Search by name (step 10).** Type "Kingdom of Sardinia" or an event's name, and the map goes to
  its years and area. The build writes a small name index (with each name's language and script),
  loaded only when the search box is used. Place search over Natural Earth's towns and cities can
  share the same box later (section 12).
- **"How sure are we?" lens (step 11).** A toggle that colours the map by the precision of what is
  shown: how exact the dates are (day, month, year, approximate, from our EDTF dates) and how
  detailed the source is (each source's resolution). Edge precision (treaty line, approximate,
  frontier zone) is added as sources record it; today every import says `unknown`, and the lens
  says so rather than pretend. Like every other style here it doesn't rely on colour alone:
  patterns and text labels go with it. It turns the project's honesty into something a visitor
  can see.

**Which events to add, and why.** Events are the "why" behind a border change, and the timeline's
markers and "Around this date" both use them. They are written from cited sources, so they are the
data track's work; this phase only makes it easier to choose well. The rules of thumb:

1. **Start from what the map shows.** The change index already lists every day a border changes.
   The **events-gap report** (step 9, a script like the data-change summary) lists those days with
   no event linked through `effects`, largest areas and most polities first, so the events worth
   adding are the ones that explain changes a visitor can already see.
2. **Border-changing events first:** treaties and peace settlements, declarations of independence,
   annexations, partitions, unions and dissolutions, handovers of colonies, plebiscites, and the
   start and end of occupations. A battle is worth an event when it changed control.
3. **Where sources can be cited and read.** Treaties, official documents, and open collections
   (as the Manchukuo events use *Foreign Relations of the United States* and the League of
   Nations' papers) make the best events, because a reviewer can check them. An important event we
   can't source well waits.
4. **Spread them out.** Cover the regions and eras the map has data for (East Asia and Europe,
   1900–1950 first), then the baseline as sources allow, so each visitor finds something near
   their own place. Prefer fewer, well-sourced events (on the order of a dozen per region and
   era) to many thin ones: too many markers clutter the timeline, and `importance` (1–5) decides
   which show when zoomed out.
5. **Contested events get every side.** Attribute each account, and give each citation a `note`
   saying who is speaking (as the Mukden incident does).
6. **Leads, not data.** Topics worth researching for the covered period include the 1919–1923
   settlements after the First World War, the Russian revolution and its treaties, the creation
   of Poland and Ireland's independence, the 1938–1940 changes in central and eastern Europe,
   the wartime occupation zones, the postwar border changes, and in East Asia the annexation of
   Korea and the Chinese revolution of 1911. Dates and details are deliberately left out: they
   must come from the cited sources, never from this list.
7. **Anyone can suggest.** The "missing event" issue form already asks for the sources; the
   Contribute page (step 9) points to it, with the gap report's list as "events we'd like".

**Candidates for Phase 7** (each independent, none started)

- **Compare two dates**, side by side or with a slider: the most shareable view, and useful for
  research.
- **"Cite this view":** a citation with date, place, sources and link, in common formats.
- **Embed:** an iframe of a chosen date and place for teachers and writers.
- **Clip export:** a short recording of the timeline playing, credits included.
- **Data downloads** for researchers, per source, each under its own license.

## 10. The interface, redesigned

**Aim:** a site calm and beautiful enough to leave open for an hour and watch, and clear enough for
a first-time visitor on a phone, that still says everything the sourcing rules require. The
design serves the goals of this project: worth watching, credible as a research tool, and open to
people everywhere.

**Principles**

1. **The map comes first.** Everything else recedes until it is wanted.
2. **Honesty stays visible.** Contested areas, gaps, disagreements and precision keep their
   patterns and words; no new style relies on colour alone (project rule).
3. **A phone first, then a desktop.** Every layout is designed for a small screen and grown, not
   shrunk.
4. **Ready for every language.** Longer words, other scripts, and right-to-left layouts (so an
   Arabic or Hebrew catalog doesn't need a second redesign).
5. **Free to run.** No paid fonts, services or keys. Any font is open-licensed and served by us.
6. **Accessible:** contrast, keyboard, screen readers, reduced motion, larger text.

**What the maintainers' screenshot suggests today** (my reading of one screenshot at desktop
size, not a usability test):

- the top-left card holds the name, two buttons, a paragraph of explanation, the view switch and a
  seven-line key at once, and it covers a good part of Europe and Africa;
- the right panel is one long scroll of small text;
- the dashed "edge of OpenHistoricalMap's area" lines cross the map and compete with borders;
- the timeline's right end has a grey stretch nothing explains;
- the name is plain lowercase text with no logo.

**Ideas to design (the mockups in step 3 choose among them)**

- **A slim top bar:** name and wordmark, search (step 10), the view switch as a clear segmented
  control, Copy link, and a menu (About, Contribute, Language, Lighter map). The paragraph of
  explanation moves to a first-visit note and the About page. The key becomes a button that opens
  a compact key listing only what is on screen.
- **The timeline as the centrepiece:** larger, with the date shown big, play and speed together,
  the go-to-date box (step 8), event markers, and a thin **coverage ribbon** showing where the
  data is precise, approximate (baseline) or absent. The unexplained grey stretch is labelled or
  removed.
- **A calmer panel:** a summary first (name, later the flag, dates, who controlled it, who
  recognised it, one plain sentence), then sections that open on demand (Records, Names, Sources,
  What each source says), with the header staying in view. The phone sheet keeps its heights.
- **Watch mode:** one button or key hides everything but the map, a large date and the play
  controls; space plays and pauses, arrows step. It uses the smooth era changes (step 6) so long
  plays never blank.
- **The look of the map:** a more cohesive, muted palette; clearer label sizes and halos; a
  gentler edge-of-data line; land and sea a little richer. Shaded relief (Natural Earth's public
  domain raster) is optional and only if step 2 shows it fits the speed target.
- **Themes:** light, dark ("night atlas") and high contrast, following the system setting.
- **A first-visit hint and a "?" help:** three short pointers (timeline, click a place, the key)
  that can be dismissed for good, and a help page explaining the hatch, the dots and the lines.
- **A design record:** `docs/design.md` (principles, colour and spacing values held as CSS variables,
  the components), so later changes and other contributors keep the look.

**How it is done**

- **Step 3 (no code):** two or three static mockups on real screenshots, desktop and phone, with a
  wordmark and the name written the way the maintainers choose. Watch three to five people try the
  same three tasks on a mockup or the live site (find a date, open a territory, understand a
  hatched area), with nobody's personal details recorded. The maintainers pick.
- **Step 7 (the build):** layout and styling change; **the panel's logic (`model.ts`), the map's
  data handling and the address format do not.** The work is in the panel's layout (`panel.tsx`),
  `style.css`, the header and the timeline's drawing. Phone layout and translations are checked
  as it goes.
- **Limits:** the overhaul touches every screen, so it is done once and early, before the date
  box, search and lens are built into it. A designer contributor could help; mockups make that
  possible.

## 11. The launch showcase: China 1937–45

**Why:** it is where this project began (the Marco Polo Bridge incident), it is the reference test
case in the ground rules (an undeclared war, puppet governments, occupation and moving fronts),
and it is a stretch of time where watching the map is worth doing. Nothing else shows the project
off as well, so it is the first thing a launch would show.

**When:** after the interface and visitor features above, so it is seen in the finished interface
(step 14).

**What (mostly data work, with the code already in place):**

- **Audit what the data holds for 1937–45** in East Asia (administered, legally recognized,
  Cliopatria as second opinion), and record the gaps: what the map shows, what says "no data yet",
  and what is contested or where sources differ.
- **Events, chosen with the gap report** (section 9): the Marco Polo Bridge incident is listed in
  `docs/data-sources.md` with its Wikidata ID but is not yet an event. The others follow the
  rules of thumb in section 9: border-changing, well sourced, every side attributed.
- **An opening view:** a chosen date, place and selection that a launch link and the About page
  open on.
- **A short recording** of the period playing, credits shown, for a launch post.
- **Southeast Asia:** the import today covers 10°N to 55°N, so Malaya, Singapore and the Dutch
  East Indies are outside it. Whether and how to extend it is a data decision that starts with
  the coverage measure (`npm run measure-ohm`, run on GitHub) and is not part of this phase's code.

**Not in this phase:** game data. Another work's borders, however popular, are not a source
(project rule 1).

## 12. Stretch: your local area, over time

The idea: a visitor from a small town wants to see what happened *around them*, in detail, without
needing street-level borders (which no source has for most times). They click a place, or search
for one, and a "local area" card shows:

- **which states held the place over time,** per source, with dates and citations (reusing the
  tile reading the panel already has, `recordsAt`, across all eras), and "near a border" when the
  spot is within the source's uncertainty of one, so a town on a frontier isn't given a false
  answer;
- **events near the place,** not only near the date (events already carry a place);
- the map zoomed to the area, at the most detail its sources support (section 5).

**Finding a place.** Clicking the map works everywhere. Search would use Natural Earth's
populated places (public domain, bundled, no online service, so it stays free to run); that finds
towns and cities, not small villages. An online geocoder is out, because of the no-services rule.

It is a **stretch** because it depends on the detail work (section 5) and on speed (section 4).
It is only started if steps 2–15 leave room, and it can be a Phase 7 headline instead.

## 13. Questions for the maintainers

1. **Approve the order and cut lines** in sections 14 and 15? *Recommended: yes.*
2. **Performance target:** scrub and zoom at 30 frames a second or better on an older
   integrated-graphics laptop and a mid-range phone; idle map near zero. *Recommended: yes; refined
   by the step 2 numbers.*
3. **Coast gaps** (section 5): A (restyle only), B (a flagged, build-only approximate margin
   where one polity's shape stops short of the coast by less than the source's resolution), or C
   (snap in the data, not recommended). B draws colour where no source did, though it asserts
   nothing. *Recommended: B, with A as the fallback. The maintainers lean toward B (2026-09-29).*
4. **Disputed water names:** show both names, attributed, from a short hand-written, cited list?
   Which waters go on it first, and which sources are acceptable (an international hydrographic
   body, national mapping agencies, both sides' governments)? *Recommended: yes; the maintainers
   choose the list and sources.*
5. **Flags:** the approach in section 8 (own folder, per-file license, a source and period, self-
   hosted, "No flag on record" as the default, starting with our own polities)? *Recommended: yes.*
6. **Lighter map setting:** a header toggle plus automatic on reduced motion or low power?
   *Recommended: yes.*
7. **Your local area** (section 12): keep it as a stretch inside Phase 6, or make it the headline of
   Phase 7? And is search over Natural Earth's larger towns and cities, plus clicking the map,
   enough to start? *Recommended: Phase 7 headline, unless steps 2–15 finish early; yes to the
   search.*
8. **Data-saver behaviour:** no background prefetch when the browser reports a data-saver
   connection? *Recommended: yes.*
9. **First-time visitor features** (section 9): play button, search by name, and the lens in this
   phase, with no scripted tours; compare, cite, embed, clip export and downloads in Phase 7? And
   is choosing events by the gap report and the rules of thumb in section 9 right? *Recommended:
   yes.*
10. **The interface** (section 10): mockups first (step 3), tried with a few people, then one
   build (step 7), with light, dark and high-contrast themes and a self-hosted open-license UI
   font? *Recommended: yes.*
    **The name.** The current name is very close to an existing commercial site
    (`chronoatlas.nl`), so a rename before any launch or marketing is planned. A hyphen or a
    capital letter doesn't separate them. Candidates are checked (existing sites and products,
    GitHub, domains, trademark registers) before anything is renamed; addresses and the repository
    keep `chronoatlas` until then. Renaming is the maintainers' outward-facing step. *Recommended:
    rename, choosing a distinctive word and using a plain description ("borders through time,
    with sources") as the tagline.*
11. **The launch showcase** (section 11): China 1937–45 after the interface work, Southeast Asia
   measured but not imported in this phase? *Recommended: yes.*
12. **New requests** the maintainers add before approval are placed in the order in section 14 by
   the same rule: measure first, then what changes tile size or speed, then what adds on top.

## 14. Order of work

Small steps, each committed, explained, and checked, as in earlier phases. The order follows one
rule: **measure first, then change what everything else depends on (speed, tile detail, the look and
layout), then add features on top**, so nothing is built twice.

| Step | What | Effort |
|---|---|---|
| 1 | Record Phase 5 closed and the Phase 6 decisions (docs only). | low |
| 2 | **Measure before building:** profile the map (frames, layers, idle use), measure the alignment errors of section 5, check Natural Earth's water names and the flag sources (Commons licenses, a sample of Wikidata's flag statements). Results may change this plan; any change comes back to the maintainers. | high |
| 3 | **Design direction (no code):** two or three mockups of the redesigned interface (section 10) on real screenshots, desktop and phone, a wordmark and the display name (after the name check, question 10); tried with a few people; the maintainers choose. | medium |
| 4 | **Performance pass:** the fixes measured to matter, the lighter-map setting, and an idle-repaint check. Repeat the measures. | high |
| 5 | **Detail and coasts:** the matching base map, less simplification where sources are finer, the source-resolution note, and the coast-gap decision (question 3), with the check of how Cliopatria's shapes were made. | high |
| 6 | **Smooth era changes:** keep old tiles until new ones are ready, prefetch neighbours, blend. | high |
| 7 | **The new shell:** the chosen layout and styling as CSS variables, the slim top bar and compact key, the calmer panel, the timeline with its coverage ribbon, watch mode, themes, the first-visit hint, and `docs/design.md`. The panel's logic and the address format don't change. | high |
| 8 | **Go to a date:** the box, travel animation, address, and phone layout. | medium |
| 9 | **Welcome:** the play button, the About and Contribute pages, the share preview, and the events-gap report (border changes no event explains). | medium |
| 10 | **Search by name:** the name index and the search box. | medium |
| 11 | **The "how sure are we?" lens.** | medium |
| 12 | **Water names:** the layers, the disputed-names list and its sources, and the legend and credits. | medium |
| 13 | **Flags:** the import folder and manifest, the panel line and image, the issue form, and the first set for our own polities. | high |
| 14 | **Launch showcase: China 1937–45** (section 11): the data audit, the events chosen with the gap report, the opening view, and a short recording. | medium |
| 15 | **Tidy and launch check:** a phone and low-end check of the finished map, an accessibility pass (keyboard, screen reader, contrast), loading, empty and error states, the docs, the README, `CREDITS.md`, and the roadmap. | medium |
| 16 | **Stretch, only if room: your local area, over time.** | high |
Every step keeps `npm run typecheck`, `npm test`, `npm run validate`, and the build passing.
Steps 4–7 each end with a repeat of step 2's measures, so speed can't quietly get worse.

## 15. Keeping the scope in check

The vision is large on purpose. These are the levers, in the order to reach for them:

1. **Cut lines.** If the phase runs long, cut in this order: your local area (step 16), flags
   (13), water names (12), the lens (11), search (10). Steps 1–9 (fast, close-up, smooth,
   redesigned, a date box, a welcome), the launch showcase (14) and the launch check (15) always
   stay: shipping those alone is a complete phase, and the cut steps move to Phase 7 whole.
2. **Measure before building.** Step 2 exists so a big idea is sized before it's started; a step
   whose measurement is bad is brought back, not pushed through.
3. **One step in flight,** each shippable on its own, so the live site is never left half-changed.
4. **A parking lot.** Ideas that arrive mid-phase go to a list in the roadmap with a rough size,
   not into the current step.
5. **Hidden until ready.** Bigger features can sit behind an address flag (`?labs=1`) while they
   mature, without slowing or confusing regular visitors.
6. **Shrink the feature, not the rule.** If flags or water names grow, ship a smaller set
   (our own polities; the ten largest disputed waters), never relax the sourcing rules.
7. **Help.** The reviewer guide and issue forms already let others take data work, such as flags
   and water-name sources, so it need not all pass through one person.
8. **Costs.** If size or traffic approaches GitHub Pages' limits, the options (a single-file tile
   archive, a second free host, a small paid one) are a maintainers' decision that touches ground
   rule 6, made with measurements, not in a hurry.

## 16. Decisions

*Recorded here when the maintainers approve the plan.* Settled before approval (2026-09-29):

- **Coast gaps:** the maintainers lean toward option B (a flagged, build-only approximate margin).
- **Launch showcase after the interface work:** China 1937–45 is shown once the interface and
  visitor features are done, and the interface is redesigned before they are built into it.
- **Name:** the current name collides with an existing commercial site, so a rename is planned;
  the choice waits for the name check (question 10).
- **No scripted stories:** the map is the storyteller; events are chosen by what the map needs.
- **Report by drawing:** considered and not added; the existing "Report a problem" link is enough.
