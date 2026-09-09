# PROTOTYPE — attention-first Dashboard (issue #314)

Throwaway. Not production code, no tests, read-only, dev-only. Delete this
directory (and the prototype block in `src/routes/_authenticated/index.tsx`)
once a direction is picked.

## Run it

From the repo root of **this worktree**:

```bash
bun install
bun run dev
```

Then open the Dashboard with a variant param:

- `/?variant=A` — Now / Ahead
- `/?variant=B` — Time bands
- `/?variant=C` — Horizon ribbon
- `/?variant=D` — Area lanes

The floating bar at the bottom cycles variants (← / → also work) and carries
two extra toggles:

- **Wide / Constrained** — `?narrow=true` clamps the page to ~26rem so every
  variant can be judged at a phone-ish width without resizing the window.
- **Fixture / Live data** — `?source=live` swaps the fixture for the real
  Convex queries. The fixture is the default because it guarantees overdue,
  today, near-term, and distant examples are all on screen at once.

Rows still behave like the real Dashboard: a Thread opens in place
(`?thread=`), a standalone Note opens the Notes surface (`?inbox=true`). The
real Area condition strip sits above every variant, so nothing is judged in a
vacuum.

## The fixture

`prototype-fixture.ts` — 5 Areas (one critical, two needs-attention, two
healthy), 19 Threads and 7 standalone Notes, dated relative to now:

| Case | Threads | Notes |
| --- | --- | --- |
| Overdue | 2 (−6d, −2d) | 2 (−4d, −1d) |
| Today | 2 | 1 |
| Near-term (1–6d) | 3 | 1 (+3d) |
| Distant (10d+) | 3 (+12d, +27d, +45d) | 1 (+21d) |
| Undated, has Next Move | 4 | — |
| Plain open | 5 | 2 undated |

Thread Notes are absent by construction — the Notes here are standalone only.

## What each variant claims about #236

The question in #236 is whether an actionable undated Thread should outrank a
scheduled-but-distant Follow-up. Each variant commits to a different answer, so
picking a variant *is* the decision:

- **A — Now / Ahead.** Actionability wins outright. The primary run holds only
  what can be acted on today; every future date leaves the run and becomes a
  forward agenda in a second column. The main list can never go non-monotonic,
  because it has no future dates in it at all.
- **B — Time bands.** No global rule; membership decides. The Today band holds
  overdue + due-today + undated Next Moves together (late first). Future dates
  live in quieter side bands and never compete with Today.
- **C — Horizon ribbon.** The in-between outcome #236 names. Only Follow-ups
  within two days outrank undated Next Moves; anything further out drops below
  the plain open Threads onto a "Scheduled" shelf and is represented on a
  21-day ribbon across the top. Calendar awareness moves out of the list order
  and into the ribbon.
- **D — Area lanes.** The ordering question mostly dissolves. Only the top
  strip is attention-ordered; below it the width is organised by Area, not by
  time, and each lane sorts its own items. A distant Follow-up is never near
  the top — it is a quiet chip in its Area, with the lane header carrying that
  Area's next date.

## What the review has to answer

1. Which variant's answer to #236 is right — or which pieces of which?
2. Is "current attention" still unmistakably primary at both widths?
3. Does a distant Follow-up (+27d, +45d) read as *awareness* rather than as
   something demanding action, in whichever variant wins?
4. Do dated Notes returning to attention belong in the same run as Threads
   (A, B, C) or in their own lane (D)?
5. What does the extra horizontal space genuinely buy — a second column of
   future (A), parallel bands (B), a calendar ribbon (C), or Area lanes (D)?
