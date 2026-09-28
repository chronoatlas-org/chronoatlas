# Phase 4 plan: the contribution pipeline

> **Status: approved by the maintainers on 2026-09-28**, with the recommended answer to every
> question. The decisions are recorded in [section 10](#10-decisions-2026-09-28).

Phases 1–3 built the map. Phase 4 makes it **easy and safe for other people to improve it**, and
for the maintainers, who aren't full-time programmers, to review what they send:

- every data change gets a **plain-language summary** posted on its pull request, so a reviewer
  reads "Testland: administered from 1901 (year only), per OpenHistoricalMap, relation 1234"
  instead of a YAML diff, and sees what the change does to contested areas and land areas;
- a border fixed in OpenHistoricalMap can be **re-imported from GitHub's website**, without
  installing anything;
- the issue forms and pull request template are **refined from what we've learned**;
- a **reviewer guide** says, step by step, how to review each kind of change, including the
  sensitive ones.

Sections:

1. [Where Phase 3 ends](#1-where-phase-3-ends)
2. [What exists today, and what we've learned](#2-what-exists-today-and-what-weve-learned)
3. [The data-change summary](#3-the-data-change-summary)
4. [Re-importing from OpenHistoricalMap on GitHub](#4-re-importing-from-openhistoricalmap-on-github)
5. [Forms, the pull request template, and labels](#5-forms-the-pull-request-template-and-labels)
6. [The reviewer guide](#6-the-reviewer-guide)
7. [Protecting main (repository settings)](#7-protecting-main-repository-settings)
8. [Order of work](#8-order-of-work)
9. [Questions for the maintainers](#9-questions-for-the-maintainers)
10. [Decisions (2026-09-28)](#10-decisions-2026-09-28)

---

## 1. Where Phase 3 ends

- **Steps 1–8 and 10 are done and live** (pull requests #10–#18), with decisions 1–15 recorded in
  [phase-3-plan.md](phase-3-plan.md#12-decisions-2026-09-28).
- **Step 9 (claims) waits for data:** there are no claim records yet. The first could come from
  Phase 2's open question 1 (overlapping OpenHistoricalMap boundaries) or from a sourced claim.
- **Recommendation: close Phase 3 now**, and move step 9 to the showcase data track, as Phase 2's
  traced border was. The data track's other items stay open: the first traced border, a gazetteer
  for event places, Phase 2's open questions 1–2, and China 1937–45.

## 2. What exists today, and what we've learned

**What exists:**

| Piece | Where | What it does |
|---|---|---|
| Issue forms | `.github/ISSUE_TEMPLATE/` | Border correction, missing event, and bug report, each asking for a source with a locator. The map's "Report a problem with this border" button pre-fills the first. |
| Pull request template | `.github/PULL_REQUEST_TEMPLATE.md` | The review checklist from CLAUDE.md |
| Automatic checks | `.github/workflows/deploy.yml` | On every pull request: validate the data, run the tests, build the site |
| Contributor docs | `CONTRIBUTING.md`, `docs/data-format.md`, `docs/tracing-guide.md` | What counts as a source, the file format, how to trace in OpenHistoricalMap |
| Labels | GitHub | `border-correction`, `missing-event`, `needs-source`, `bug` |
| Dependency updates | `.github/dependabot.yml` | Weekly, grouped pull requests for libraries and pinned GitHub Actions |

**What we've learned** (from the seven event pull requests, the three imports, and Phase 3):

- **Diffs are hard to review.** An event's diff is readable YAML. But a border change is a wall of
  coordinates, and a one-line crosswalk change can move contested areas across a whole country
  without any sign of it in the diff. (Phase 2 step 9 found this; the build now prints every
  contested pair, but only in the build log.)
- **Who is speaking matters.** The event pull requests needed a `note` on each citation saying
  whose account it is (a government's statement, a diplomat's report). The forms don't ask for it
  yet.
- **The OpenHistoricalMap round trip is manual.** A contributor fixes a border in OHM and opens an
  issue; then a maintainer has to run `npm run import:ohm` on their own computer and open a pull
  request. That needs Node.js and some confidence with the command line.
- **Merging on GitHub's website stamps a timezone.** GitHub's merge button made commits marked
  `-0700`, while the project keeps `+0000`. Since 2026-09-28, finished work has been added to
  `main` by fast-forward instead (option b), which keeps our own `+0000` commits.
- **No outside contributions yet:** no issues have been filed, so the forms haven't met real
  users. Phase 4 should make them easy to improve, not guess at every need.
- **Small leftovers:** the border-correction form's header comment still calls the "Report a
  problem" button "planned", although it has existed since Phase 2.

## 3. The data-change summary

### What it says

For each pull request that changes `data/`, a comment summarizing the change in words, grouped by
kind. Each line names the file, so a reviewer can find it:

- **Territorial records** (added, removed, or changed): the polity's name, the relation in words
  ("Administered (de facto)"), the dates with their precision ("1901 (year only) – 3 March
  1902"), each source with its locator, the shape's area and how it changed, and its edge
  precision.
- **Borders:** for a changed shape, the land area before and after, and roughly where it changed
  (the area gained and lost, in km², with a bounding box a reviewer can look at on the map).
- **Events:** title, date and precision, importance, sources with who is speaking, and the
  records they affect.
- **Polities and names:** names added or removed, with language and source.
- **Figures:** metric, value or range, date, and `basis`.
- **Crosswalks:** links added or removed, with their `why`.
- **Import folders:** a changed manifest (version, checksums, retrieval date), and **a changed
  `LICENSE.md`, flagged at the top**, because a license change is always the maintainers'
  decision.
- **Sources:** new sources and their license.
- **Side effects, computed only when records, shapes, or crosswalks change:** contested pairs and
  "sources differ" pairs that appear, disappear, or change in area, and land areas that change. This
  is what catches the silent crosswalk case above.
- **What the checks confirmed:** the validator's result, and a reminder of the items only a
  person can check (the source says what the data says, the wording is fair to both sides).

### Where it appears

- **On the pull request, as one comment** that's updated in place on each push, rather than a new
  comment each time.
- **In the build's summary page** (the Actions tab), in full. A comment is limited to 65,536
  characters, so a very large change links there instead.

### How it runs safely

A pull request can come from anyone, including someone who changes the code the checks run. So:

1. **The existing check** (`pull_request`) runs the summary script with **read-only**
   permissions, as it runs the tests now. It compares the pull request's data with `main`'s and
   saves the summary as a file (an "artifact").
2. **A second, small workflow** (`workflow_run`, which starts when the check finishes) has
   permission to comment. It **never runs the pull request's code**: it only downloads the saved
   summary, treats it as text, and posts it.

This is the pattern GitHub recommends for commenting on pull requests from forks. It keeps the
token that can write to the repository away from code the pull request can change. The workflow
files are pinned and commented like `deploy.yml`.

### How it's built

- `scripts/summarize-changes.ts` loads two copies of the data, `main`'s and the pull request's
  (`loadDataset` already takes a folder), and writes Markdown. The comparing and wording are pure
  functions, tested with Testland fixtures.
- The wording reuses the panel's (`src/panel/model.ts` and `src/dates/format.ts`), so a date reads
  the same in the summary as on the site.
- **Cost:** GitHub Actions is free for public repositories. The side effects need the contested
  computation twice, which adds up to a couple of minutes, only when records, shapes, or crosswalks
  change.

### Pictures of changed borders (optional, question 3)

A reviewer would get the most from **before-and-after pictures** of a changed border. The build
could draw them (with the browser the tests already can use), but GitHub doesn't let a workflow
put images inside a comment. The options are to attach them to the run as a downloadable zip (one
click for a signed-in reviewer), or to leave pictures out for now. *Recommended: leave them out of
Phase 4, and revisit once there are real border contributions to review.*

## 4. Re-importing from OpenHistoricalMap on GitHub

- **What it does:** a workflow a maintainer starts from the Actions tab ("Re-import
  OpenHistoricalMap", with a "Run workflow" button). It runs `npm run import:ohm`, then
  validate, test, and build. If anything changed, it pushes a branch and opens a pull request
  with the data-change summary.
- **Who can start it:** only people with write access to the repository. It never runs for pull
  requests.
- **Permissions:** it needs to write a branch and open a pull request, and only this workflow
  gets those permissions.
- **Two GitHub rules to know:**
  - **A repository setting** must allow GitHub Actions to create pull requests ("Allow GitHub
    Actions to create and approve pull requests"). Changing a setting is the maintainers' step.
  - **A pull request opened by a workflow doesn't start other workflows** (GitHub prevents
    loops). So this workflow runs the checks itself and posts their result on the pull request.
    It doesn't rely on the normal check running.
- **Commits** come from `github-actions[bot]`, in UTC, so they reveal nothing about a maintainer.
- **CShapes and Cliopatria** are pinned to exact versions, so they don't get a button. A new
  version is a license and interpretation review, done by hand.

## 5. Forms, the pull request template, and labels

Small, experience-based changes. **Every existing field `id` stays** (links pre-fill them, and
`scripts/issue-forms.test.ts` checks them). New fields get new ids.

- **Border correction:**
  - a new optional field `ohm_change`: "Link to your OpenHistoricalMap change", so a fixed
    border can be re-imported straight away (section 4);
  - the stale "planned" comment is fixed.
- **Missing event:** the sources field asks **who is speaking** in each source (a government, a
  diplomat, a commission), as the event data does. The location field asks for a source for the
  coordinates, and how precise they are.
- **A new form, "Suggest a source or dataset":** a title, what it covers, its license (with a
  link), and why it's useful. New datasets always need a license check (ground rule 5), so this
  gives that check a place to start.
- **Pull request template:**
  - separate short checklists for a data change and a code change;
  - "How to see it" (a link to the map view);
  - "I read the data-change summary".
- **Labels:** `import` (re-imports), `sources` (source and dataset suggestions), `crosswalk`,
  `good first issue`, and `needs-review` for pull requests waiting on a maintainer. Creating labels
  is a repository change, so the maintainers create them, or allow me to.

## 6. The reviewer guide

A new `docs/reviewing.md`, written for reviewers who aren't programmers. It covers:

- **Reading the data-change summary,** and when to open the files themselves.
- **Checking a source:**
  - open the cited page, sheet, or document, and see that it says what the data says, with the
    precision the data claims;
  - for a traced border, compare it with the map it was traced from;
  - for a new dataset, check its license.
- **By kind of change:** an event, a border via re-import, a crosswalk change, a new source or
  dataset, a figure, a code change, and a Dependabot update.
- **Sensitive changes:**
  - wording that's fair to both sides ("according to …");
  - adding the other side's account rather than choosing one;
  - asking for more sources without discouraging;
  - what to do with an edit war;
  - reporting conduct problems privately.
- **Privacy:** never mention a maintainer's or contributor's personal details, and write as "the
  maintainers".
- **Merging, and how it's recorded:** how to add finished work to `main` without GitHub's timezone
  stamp. Either a fast-forward from the command line with `TZ=UTC` (the steps given for PowerShell
  on Windows), or the assistant doing it, as with option (b). And what to do if the merge button
  is used anyway.

`CONTRIBUTING.md` links to it, and gets a short "After you open a pull request" section: what the
summary is, and how review works.

## 7. Protecting main (repository settings)

These are GitHub settings, so they're **the maintainers' decisions and the maintainers' clicks**.
The plan only recommends them, with instructions in the reviewer guide:

- **Require the build check to pass** before anything reaches `main`, and block force-pushes and
  deleting `main`.
- **Keep "Require approval for first-time contributors"** for workflows, which is GitHub's
  default. A first-time contributor's checks wait until a maintainer clicks "Approve and run".
- **Don't require a second person's approval yet.** With one active maintainer, that would block
  every merge. Revisit when there are moderators.
- **A `CODEOWNERS` file** that asks for a maintainer's review on licenses, import folders, and
  crosswalks, however small the change.
- **Keep option (b) working:** a rule that requires pull requests would block the fast-forward
  pushes. The maintainers either allow the project account to bypass that rule, or go back to
  merging on GitHub (question 6).

## 8. Order of work

Small steps, each committed, explained, and checked, as in Phase 3. Each step gives its
recommended effort setting.

| Step | What | Effort |
|---|---|---|
| 1 | Record Phase 3 as closed and the Phase 4 decisions (docs only). | low |
| 2 | **The summary script:** comparing two copies of the data and writing Markdown, with the side effects (section 3). Tested with Testland. | high |
| 3 | **The summary on pull requests:** the read-only check saves it, and the commenting workflow posts it (section 3). Checked on a test pull request. | high |
| 4 | **Re-import from GitHub:** the manual OpenHistoricalMap workflow (section 4), after the maintainers change the setting. | high |
| 5 | **Forms, pull request template, and labels** (section 5). | medium |
| 6 | **The reviewer guide** and CONTRIBUTING changes (section 6). | medium |
| 7 | **Settings checklist:** the maintainers apply section 7 using the guide's steps; the assistant checks the result where it can. | low |
| 8 | **Tidy:** docs, README, and roadmap. | medium |

Every step keeps `npm run typecheck`, `npm test`, `npm run validate`, and the build passing.

**Left out of Phase 4:**
- **Preview sites for each pull request:** GitHub Pages hosts one site per repository, and other
  hosts would add a service to depend on.
- **An editor in the browser:** borders are drawn in OpenHistoricalMap by design.
- **Pictures of changed borders:** see question 3.

### Progress

- **Step 1 (2026-09-28): done.** The plan was approved with every recommendation (section 10),
  and Phase 3 was closed.
- **Step 2 (2026-09-28): done.** `npm run summarize-changes` writes the summary
  (`scripts/summarize-changes.ts`, with the comparing and wording in `scripts/lib/summary.ts`).
  - **Checked on real data**, on a scratch copy with a changed date, a moved border, a removed
    crosswalk link, a made-up Testland event, and changed license and manifest files. Each shows
    up in words. The removed crosswalk link shows as a new contested area (129,000 km² for
    1902–1935), which a diff would never show.
  - **Time:** about 2 seconds without map changes. With them, about 3 minutes, most of it
    recomputing contested areas, "sources differ", and land areas for both copies. A re-import
    that changes 100 borders takes under a minute more.
  - **Size:** the comment shows at most 40 lines per section and counts the rest; the full
    summary keeps them all for the check's summary page (step 3).
  - **Safety:** text from the pull request is escaped, so it shows as written and can't add
    links, images, HTML, or mentions (tested).
  - A small change to the data loader: it can read a second copy of `data/` from another folder,
    which is how main's copy is compared.
- **Step 3 (2026-09-28): built; checked on a test pull request once it's on main** (a
  `workflow_run` workflow only runs from main's copy).
  - **A change from section 3, for safety:** instead of the pull request's own check writing the
    summary and a second workflow posting it, the second workflow writes it too, with **main's**
    code. It takes only the pull request's data files (read as YAML and JSON, never run) from
    GitHub's test merge of the pull request, whose first parent is the base branch. So a pull
    request that changes the summary script can't change what its summary says, and no artifact
    passes between the two. It still starts only after the build check finishes, so a first-time
    contributor's pull request waits for a maintainer's "Approve and run" here too.
  - `.github/workflows/data-summary.yml` has permission to read and to comment on pull requests,
    nothing else. The script reads the event from GitHub's event file, never from text pasted into
    a command, so a branch name can't inject one. Symbolic links in the pull request's data are
    deleted before anything is read.
  - One comment per pull request, found by its author (`github-actions[bot]`) and a hidden marker,
    and updated on each push, including to "changes nothing in `data/`" if a change is undone. A
    pull request that never changes `data/` gets no comment.
  - The full summary is on the workflow run's summary page, which the comment links to when a
    section is cut short.
  - Checked here: the test merge of a real pull request fetched and summarized, and the GitHub
    calls against a stand-in server (it found the right pull request, ignored a look-alike comment
    by someone else, and updated its own).

## 9. Questions for the maintainers

Each has a recommended answer. "Approve with the recommendations" answers them all.

1. **Close Phase 3,** with step 9 (claims) moving to the showcase data track? *Recommended: yes.*
2. **The data-change summary** as a comment on each pull request, posted by a separate workflow
   that never runs the pull request's code (section 3)? *Recommended: yes.*
3. **Pictures of changed borders:** leave them out of Phase 4? *Recommended: yes, revisit once
   there are border contributions.*
4. **Re-import from GitHub** with a "Run workflow" button, after you allow Actions to create pull
   requests in the repository settings? *Recommended: yes.*
5. **Forms and template:** the new `ohm_change` field, "who is speaking", the new "Suggest a source
   or dataset" form, and the five new labels? *Recommended: yes.*
6. **Protecting main:** require the build check, block force-pushes, add `CODEOWNERS`, and let the
   project account bypass the pull-request rule so fast-forwards keep working? *Recommended: yes.*
   You make the setting changes yourself, following the guide.

## 10. Decisions (2026-09-28)

The maintainers approved the plan with the recommended answer to each question.

1. **Phase 3 is closed.** Step 9 (claims) moves to the showcase data track, and is built once the
   first claim records exist.
2. **The data-change summary** is posted as one comment on each pull request that changes
   `data/`, updated in place. A separate workflow posts it and never runs the pull request's code.
3. **Pictures of changed borders** are left out of Phase 4, to be revisited once there are border
   contributions.
4. **Re-import from GitHub:** a "Run workflow" button for OpenHistoricalMap, once the maintainers
   allow GitHub Actions to create pull requests in the repository settings.
5. **Forms and template:** the new `ohm_change` field, "who is speaking", the new "Suggest a
   source or dataset" form, and the five new labels.
6. **Protecting main:** require the build check, block force-pushes, add `CODEOWNERS`, and let the
   project account bypass the pull-request rule so fast-forwards keep working. The maintainers
   change the settings themselves, following the reviewer guide.
