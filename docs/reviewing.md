# Reviewing a pull request

This guide is for the people who review changes to the map. You don't need to be a programmer:
most of the work is checking that what the data says is what its sources say. It goes with the
review checklist in [CONTRIBUTING.md](../CONTRIBUTING.md#how-review-works) and the
[ground rules](../CONTRIBUTING.md#ground-rules).

Contents:

1. [Reading the data-change summary](#1-reading-the-data-change-summary)
2. [Checking a source](#2-checking-a-source)
3. [By kind of change](#3-by-kind-of-change)
4. [Sensitive changes](#4-sensitive-changes)
5. [Privacy](#5-privacy)
6. [Merging, and how it's recorded](#6-merging-and-how-its-recorded)
7. [Repository settings (done once)](#7-repository-settings-done-once)

## 1. Reading the data-change summary

When a pull request changes anything in `data/`, a comment titled **Data-change summary** appears
on it a few minutes after the build check finishes, and is updated after every push. It's written
by the project's own code on `main`, from the pull request's data files, so the pull request can't
change what it says.

It says, in words:

- **For the maintainers** (at the top): things that always need a maintainer's decision, such as a
  changed license, a changed import manifest, crosswalk links, removed IDs (which would break
  shared links), and changes inside import folders (which should come from a re-import, never a
  hand edit).
- **Records:** who held what, how (administered, sovereign, occupied, claimed), from when until
  when, and per which source. Dates show their precision: "1901 (year only)". An end date is the
  first day a record no longer applied, as in the data.
- **Borders:** for a changed shape, the area before and after, how much was gained and lost, and
  roughly where, with a link to the live map there (which still shows `main`'s borders).
- **Events, names, figures, crosswalk links, sources, and other files.**
- **What it changes elsewhere on the map:** contested areas, "sources differ" areas, and land
  areas that appear, disappear, or change, day by day. A one-line change to a crosswalk can move
  these across a whole country, which the file diff never shows.
- **Still for a person to check:** what no program can check. That's your part (sections 2–4).

Long sections are cut short in the comment; the link at the end of a section opens the full
summary on the workflow run's page. Open the files themselves (the **Files changed** tab) when the
summary says something you didn't expect, or when you want to read an event's summary in full.

If the summary says `npm run validate` found problems, the build check will fail too. Ask the
contributor to fix them, or help: the message names the file.

## 2. Checking a source

For every new or changed record, event, name, or figure:

- **Open the cited source at the locator** (the page, map sheet, document number, or feature ID)
  and see that it says what the data says, **with the precision the data claims**. A source that
  says "in the spring of 1901" doesn't support `1901-04-12`; the data should say `1901` or give a
  range.
- **For an OpenHistoricalMap relation,** the summary's "open" link goes to it. Check its `source`
  and `note`: is the map it was traced from dated, and is its public-domain status recorded?
  (See the [tracing guide](tracing-guide.md).)
- **For a traced border,** compare it with the map it was traced from.
- **For a new source or dataset,** check its license (below).
- **Wikipedia and Wikidata are leads, not sources.** Ask for what they cite.
- **No source, no data.** A gap on the map is better than a guess: the map shows "no data".

## 3. By kind of change

**An event** (`data/events/`):

- Its summary is in the contributor's own words, not pasted from Wikipedia or the source. Search
  for a sentence from it if in doubt.
- Each source says **who is speaking**: a government's statement, a diplomat's report, a
  commission's finding. The summary attributes claims to them ("according to…").
- Its date isn't more precise than its sources, and its `effects` point to the records it changed.

**A border, via a re-import from OpenHistoricalMap** (a pull request titled "Re-import
OpenHistoricalMap", often opened by the workflow):

- Other people edit OpenHistoricalMap too, so **look at every changed border**, not only the one
  you expected. The summary lists them with the area gained and lost.
- New contested or "sources differ" areas usually mean a border moved or a date changed. Check
  that it's what the relation's source says.
- A problem is fixed in OpenHistoricalMap and re-imported, never by editing the files here.

**A crosswalk change** (`polity-crosswalk.yaml` in an import folder): a crosswalk says which of an
import's units is the same state as one of ours. It decides where the map shows "contested", so:

- read the side effects in the summary carefully;
- each link needs a `why`, and dates (`from`, `until`) when it applies only for some years;
- a crosswalk change is a data decision for the maintainers; ask for the evidence for each year
  range.

**A new source or dataset:**

- **License:** public domain and CC0 can go anywhere. CC BY needs credit. Non-commercial (NC) and
  share-alike (SA, GPL) terms mean the data stays in its own import folder, as its own layer, and
  may make it unusable. When in doubt, ask the maintainers before anything is imported.
- Third-party data lives only in `data/imports/<dataset>/`, with its `LICENSE.md` and a manifest,
  and `CREDITS.md` is updated.

**A figure** (statistics): it's sourced and dated, and its `basis` says what it measures. A figure
for **present-day borders** must never be attached to a historical polity as if it described that
polity's territory.

**A code change:** the build check has to pass (it runs the tests). Look at the site locally
(`npm run dev`) or at the pull request's "How to see it", including on a phone-sized screen. Ask
the contributor to explain anything you don't follow. Explaining is part of their job, not a
favor.

**A Dependabot update** (a pull request from `dependabot[bot]` updating libraries or GitHub
Actions): if the build check passes, it's usually safe. Read its release notes for anything
marked "breaking". A GitHub Actions update must stay pinned to a full commit, with the version in
a comment, as Dependabot writes it.

## 4. Sensitive changes

This map touches borders people care about deeply. Review for fairness as carefully as for
accuracy:

- **Attribute, don't assert.** "According to the Testland government, …" rather than stating one
  side's account as fact. Would both sides of the dispute call the wording fair?
- **Add the other account rather than choosing one.** When good sources disagree, the data
  records both, each attributed, and the map shows the area as contested or as "sources differ".
- **Control, legal recognition, and claims stay apart.** An occupation isn't sovereignty; a claim
  isn't control.
- **Ask for more sources without discouraging.** Being asked for a better source is normal, and
  saying so helps: "Thank you! Could you add a page number for this?"
- **An edit war** (the same thing changed back and forth): stop merging changes to it, and ask
  both sides to bring their sources to one issue. The outcome is usually to record both
  accounts.
- **Conduct problems** (insults, harassment, nationalist abuse) are reported privately to the
  moderators at chronoatlas.conduct@gmail.com, never argued in public. See the
  [Code of Conduct](../CODE_OF_CONDUCT.md).

## 5. Privacy

Maintainers stay pseudonymous. In comments, reviews, commits, and files:

- never mention a maintainer's or contributor's real name, location, school, employer, family,
  or personal accounts;
- write as "the maintainers";
- work on this project signed in as the project account, `chronoatlas-project`.

## 6. Merging, and how it's recorded

Every commit records the time it was made **with its time zone** (for example `+0000` or `-0700`),
and a time zone hints at where someone lives. The project's own commits use UTC (`+0000`).
GitHub's **Merge pull request** button makes a new commit stamped with a time zone, so the project
adds finished work to `main` without it, as a **fast-forward**: `main` simply moves forward to the
pull request's last commit, and no new commit is made. GitHub then shows the pull request as
merged.

**The easy way:** ask the assistant to add it to `main` once the build check passes.

**Yourself, in PowerShell** (replace `123` with the pull request's number):

```
$env:TZ = 'UTC'
git switch main
git pull
git fetch origin pull/123/head:pr-123
git merge --ff-only pr-123
git log --format='%an <%ae> %ad' -5
git push origin main
```

- `git merge --ff-only` stops with an error if `main` has moved on since the pull request was
  made. Then the pull request needs updating first: ask the assistant, or ask the contributor to
  bring `main` into their branch.
- `git log` shows the latest commits: check the names and time zones before pushing. A
  contributor's own commits show their own time zone; that's their choice.
- Delete the local copy afterwards with `git branch -d pr-123`.

**If the Merge button is used anyway,** nothing breaks. The merge commit stays in the history
(`main` is never rewritten; force-pushing is blocked), and the next change goes in by
fast-forward again.

## 7. Repository settings (done once)

These are GitHub settings, so they're the maintainers' decisions and the maintainers' clicks
(Phase 4 decisions 4–6). Sign in as `chronoatlas-project` and open the repository's **Settings**.

**Protect `main`** (**Rules → Rulesets → New ruleset → New branch ruleset**). Make two rulesets,
because the second lets the project account bypass it and the first doesn't:

1. **"main: never rewritten"**: Enforcement status **Active**; Target branches: **Include default
   branch**; tick **Restrict deletions** and **Block force pushes**. Leave the bypass list empty.
   Save.
2. **"main: checked changes"**: Active; Include default branch; tick **Require a pull request
   before merging** (required approvals: **0**, for now, while there's one active maintainer) and
   **Require status checks to pass**, then **Add checks** and choose **build** (from GitHub
   Actions). Under **Bypass list**, add **Repository admin** with **Always allow**, so the project
   account can keep adding checked work by fast-forward. Save.

**Let the re-import button open pull requests.** The organization's setting comes first: while
it's off, the repository's checkbox is greyed out (the pointer shows a "not allowed" sign).

1. **The organization:** open
   [the organization's Actions settings](https://github.com/organizations/chronoatlas-org/settings/actions)
   (profile picture → **Your organizations** → `chronoatlas-org` → **Settings** → **Actions** →
   **General**). At the bottom, under **Workflow permissions**, keep **Read repository contents and
   packages permissions**, tick **Allow GitHub Actions to create and approve pull requests**, and
   press **Save**.
2. **The repository:** in the repository's **Settings → Actions → General**, the same checkbox at
   the bottom is now available. Reload the page, tick it if it isn't ticked, and press **Save**.

(Approvals aren't required yet, so the "approve" half has no effect. Keep the read-only default:
each workflow asks for exactly the extra permissions it needs.)

**Keep first-time contributors' checks waiting for approval** (**Actions → General → Approval for
running fork pull request workflows from contributors**): keep **Require approval for first-time
contributors**, GitHub's default. Their checks, and so their data-change summary, wait until a
maintainer presses **Approve and run** on the pull request. Look at the changed files before
approving: a pull request that changes `.github/` or `scripts/` deserves a careful look.

**Labels** (the **Issues** tab → **Labels** → **New label**), with these descriptions:

| Label | Description |
|---|---|
| `import` | A re-import of a dataset, or a change to an import |
| `sources` | Suggesting or checking a source or dataset |
| `crosswalk` | Changes to how an import's units match our polities |
| `good first issue` | A good place to start contributing (GitHub creates this one by default; keep it) |
| `needs-review` | A pull request waiting for a maintainer |

**Code owners:** the file [`.github/CODEOWNERS`](../.github/CODEOWNERS) asks for the project
account's review on licenses, import folders, crosswalks, and workflows. It needs no setting.
