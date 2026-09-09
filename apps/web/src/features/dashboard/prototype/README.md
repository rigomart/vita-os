# PROTOTYPE — attention-first Dashboard (issue #314)

Throwaway. Not production code, no tests, read-only, dev-only. Delete this
directory (and the prototype block in `src/routes/_authenticated/index.tsx`)
once a direction is picked.

## Where the rounds went

- **Round 1** (`103f42e`) — four whole-page layouts. Rejected: every row read
  like a ledger (date rail · title · detail · quiet counter · Area) and there
  was too much information per row.
- **Round 2** (`40ee270`) — four row treatments under a two-metadata budget.
  Rejected: it answered density by *removing* information and leaving the
  desktop empty. Of the four, only **R1 (quiet lines)** was the right instinct
  — one line, title-led, metadata as a token — so round 3 keeps that row and
  scales it up. R2 (prose) added text, R3 (cards) wasted vertical space, R4
  (hover-to-reveal) hid what a dashboard exists to show.
- **Round 3** (current) — density is the *goal*, spent better: short tokens
  instead of phrases, Area icons instead of names, no summaries anywhere,
  ~26px rows, and three ways of actually filling the desktop.

## Round 3 variants

- `/?variant=D1` — **Wrapped run**
- `/?variant=D2` — **Board**
- `/?variant=D3` — **Matrix**

| | How it uses the width | What a row/chip says |
| --- | --- | --- |
| D1 Wrapped run | One continuous attention run (Late · Today · Can move now · This week · Later · Open) flowing down and wrapping into 2–3 columns. Width buys *more list*, not more per row. | Area icon · text · date token |
| D2 Board | Uniform tiles packed 4–5 across, sorted by attention, under a five-number status strip. A whole life above the fold. | Area icon · text (2 lines max) · date token |
| D3 Matrix | Areas down the side, time across the top (Late · Today · This week · Later · No date). Position carries the metadata. | text only — its cell already says which Area and when |

Shared vocabulary (`dense-shared.tsx`), so the variants differ in structure
rather than in wording:

- **Dates are tokens, never sentences**: `−6d`, `Today`, `Tue`, `12d`, `Mar 4`.
- **Areas are icons**, coloured by condition; the name lives in the tooltip.
- **A row says one thing**: the Next Move if there is one, else the Thread
  title. Summaries, last-activity and "quiet Nd" are gone.

## Run it

The dev server must run from **this worktree** — a server started in the main
checkout does not have the prototype:

```bash
cd .claude/worktrees/prototype-314-dashboard
bun install
bun run dev
```

Then open `/?variant=D1`. The floating bar cycles variants (← / →) and toggles
**Wide / Constrained** (`?narrow=true`) and **Fixture / Live data**
(`?source=live`). Rows still open a Thread in place (`?thread=`); a Note row
opens the Notes surface (`?inbox=true`).

## The fixture

`prototype-fixture.ts` — 5 Areas, 19 Threads, 7 standalone Notes, dated
relative to now: overdue, today, near-term (1–6d), distant (+12/+27/+45d),
undated-with-Next-Move, and plain open. Thread Notes are absent by
construction; the Notes here are standalone only.

## What the review has to answer

1. Which shape earns the width — a wrapped run, a tile board, or a matrix?
2. Is the token vocabulary (`−6d`, icon-only Areas) intuitive without a legend,
   or does something need its word back?
3. Is dropping summaries and last-activity from the Dashboard right, or is one
   of them load-bearing at a glance?
4. Does showing the Next Move *instead of* the Thread title work, or does the
   Thread need to be identifiable first?
5. #236 is now visible as structure: D1 makes it a group order, D2 a sort key,
   D3 a column. Which framing makes the answer obvious?
