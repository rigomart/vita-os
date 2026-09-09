# PROTOTYPE — attention-first Dashboard (issue #314)

Throwaway. Not production code, no tests, read-only, dev-only. Delete this
directory (and the prototype block in `src/routes/_authenticated/index.tsx`)
once the remaining question is settled.

## Settled so far

- **Layout: E1 "Time columns."** Four full-height columns — Now · This week ·
  Later · Resting — of cards, under a five-number stat strip. Each column
  scrolls itself, so a busy column can't push the others down and an empty one
  can't leave a hole.
- **The Next Move is the most relevant thing on a card**, not the Thread title.
  The move is the headline; a Thread with no move captured falls back to its
  title, since there is nothing more relevant to show.
- **Dense is the goal**, spent on tokens rather than prose: dates are `−6d` /
  `Today` / `Tue` / `12d` / `Mar 4`, Areas are condition-coloured icons, and
  summaries and last-activity stay off the Dashboard.

## Still open — round 5

Dropping the Thread title entirely was disorienting, so the only question left
is **how the title stays present while the move leads**. Three treatments of
the same card inside the same fixed layout:

- `/?variant=C1` — **Move over title.** Move is the headline; the Thread name
  sits under it in quiet small text next to the Area glyph. Reads as "do this —
  on that Thread".
- `/?variant=C2` — **Eyebrow.** The Thread name rides above the move as a small
  uppercase eyebrow: you know where you are before you read what to do, and the
  title never competes for weight.
- `/?variant=C3` — **Inline.** One line — move first, Thread name trailing in
  muted text. Roughly twice the cards per column; the title is easier to miss.

## Round history

- **Round 1** (`103f42e`) — four whole-page layouts. Rejected: rows read as a
  ledger, too much per row.
- **Round 2** (`40ee270`) — four row treatments. Rejected: answered density by
  removing information and left the desktop empty.
- **Round 3** (`cf58032`) — dense variants. D1 too small and only filled the top
  half; D2's cards and stats liked but no time axis; D3's matrix legible for
  time but close to the rejected plan view and prone to empty cells.
- **Round 4** (`2b62fdc`) — where time lives, three ways. E1 (time as layout)
  won; E2 (time as chart) and E3 (time as spine) retired.

## Run it

The dev server must run from **this worktree**:

```bash
cd .claude/worktrees/prototype-314-dashboard
bun install
bun run dev
```

Then open `/?variant=C1`. The floating bar cycles treatments (← / →) and
toggles **Wide / Constrained** (`?narrow=true`) and **Fixture / Live data**
(`?source=live`). Cards still open a Thread in place (`?thread=`); a Note opens
the Notes surface (`?inbox=true`).

## The fixture

5 Areas, 19 Threads, 7 standalone Notes, dated relative to now: overdue, today,
near-term (1–6d), distant (+12/+27/+45d), undated-with-Next-Move, plain open.
Thread Notes are absent by construction.

## What is left to decide

1. Which card treatment — C1, C2, or C3?
2. Is the fallback right when a Thread has no Next Move (title as headline), or
   should those Threads look visibly different from ones you can act on?
3. Does a Note need to be distinguishable from a Thread card by more than the
   dashed glyph?
4. #236: with time as columns, the ordering question becomes "which column does
   an undated Next Move belong in?" — it currently sits in **Now**. Confirm or
   change that, and the issue can be closed with the answer.
