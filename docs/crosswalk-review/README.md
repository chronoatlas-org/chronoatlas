# Crosswalk reviews

Contested areas ("administered by one state, legally recognized as another's") are worked out only
where the maintainers have reviewed which units in the two sources are the same state (Phase 5
decision 6). Everywhere else, the panel says "Not yet checked against legal borders here".

Each file here is a region and period's **suggestions**, written by
`npm run suggest-crosswalk -- --region=W,S,E,N --years=FROM,TO --out=… --trial`. Nothing in them is
in the data yet.

## How a review goes

1. **Read the suggested links.** Each says which CShapes unit a Cliopatria polity held most of, and
   how much of the polity lay there. Accept a link only when the two really are the same state (a
   change of government or of name is still the same state), or a colony, protectorate, or mandate
   of it.
2. **Read "Look closer".** Breakaway states, rival governments, occupation zones, and occupying
   powers are listed there on purpose, not suggested: linking one would hide what "contested"
   exists to show. Link one only if the review finds it really was the same state.
3. **Read the trial.** It lists the contested areas the map would show with every suggestion
   accepted. Each should be something a fair reader on either side would call a real difference
   between who administered the land and whose it legally was. A row that isn't (a gap in one
   source, say) points at a link to add, or at a problem to report upstream.
4. **Answer** with the links to accept, change, or leave out. The accepted links then go into
   `data/imports/cshapes-2-0/polity-crosswalk.yaml`, each with its `why` and the review date, and
   the region and years into `crosswalk-reviewed.yaml`, in a pull request whose data-change summary
   shows what they do to contested areas.

## Reviews

- [Europe 1914–1950](europe-1914-1950.md) (Phase 5 step 8), **reviewed 2026-09-29:** the
  maintainers accepted all 75 suggested links, linked Vichy France (with France) and the Russian
  Republic (with Russia) from "Look closer", and marked 25°W–45°E, 34–72°N, **1914–1944** as
  reviewed. 1945–1950 is left unchecked: Cliopatria has no postwar Poland, and Hungary, Bulgaria,
  and Czechoslovakia are missing in 1945–1947, which would show as false disputes.
