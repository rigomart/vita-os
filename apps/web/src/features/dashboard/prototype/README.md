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

- **Card: C1 "Move over title."** The Next Move is the headline; the Thread
  name sits under it in quiet small text beside the Area glyph. A Thread with
  no move falls back to its title.

## Still open — round 6: the header band

Area condition returns to the Dashboard, and clicking an Area opens the Quick
Panel (Condition segments that re-sort the header, the Standard, capture into
that Area). Both writes are **stubbed to local state** — the fixture's Area ids
are not real and a prototype has no business writing.

The tension: the Dashboard now wants two summaries at once — time-shaped counts
and space-shaped Area conditions — and the columns are full-height, so every
rem the header takes comes off the board.

- `/?variant=H1` — **Two bands.** Production's shape: Areas with their reason
  on top (only non-healthy Areas get words; healthy ones trail as a glyph
  cluster), counts underneath. Most information, most height. Tests whether the
  reason text still earns its line now that every card says what to do.
- `/?variant=H2` — **Merged bar.** One row: Area chips with condition colour
  and a pending count on the left, the five stats at the right end. No reason
  text — the why is one click away. Cheapest in height.
- `/?variant=H3` — **Area tiles.** A tile per Area: name, its own pending
  count, condition, and its soonest date token, with the global counts below.
  Bigger click target and per-Area numbers, at the cost of a taller header.

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
- **Round 5** (`6fc6dc0`) — move-led card, three ways of keeping the Thread
  title. C1 won; C2 (eyebrow) and C3 (inline) retired.

## Run it

The dev server must run from **this worktree**:

```bash
cd .claude/worktrees/prototype-314-dashboard
bun install
bun run dev
```

Then open `/?variant=H1`. The floating bar cycles variants (← / →) and
toggles **Wide / Constrained** (`?narrow=true`) and **Fixture / Live data**
(`?source=live`). Cards still open a Thread in place (`?thread=`); a Note opens
the Notes surface (`?inbox=true`).

## The fixture

5 Areas, 19 Threads, 7 standalone Notes, dated relative to now: overdue, today,
near-term (1–6d), distant (+12/+27/+45d), undated-with-Next-Move, plain open.
Thread Notes are absent by construction.

## What is left to decide

1. Which header — H1, H2, or H3?
2. Does the reason text (H1) earn its height, or is condition colour plus the
   panel enough (H2)?
3. Should an Area chip/tile also *filter* the board, or is click reserved for
   the Quick Panel?

## Parked, in order

1. **Inline card actions** — mark the move done, push the Follow-up, complete a
   Note. The round that most changes daily use.
2. **Undated Notes** — the columns are time-shaped, so a Note with no date
   currently lands nowhere and Resting only accepts Threads.
3. Column overflow caps, empty states, keyboard movement between cards.
4. **#236**: with time as columns the question shrinks to "which column does an
   undated Next Move belong in?" — it currently sits in **Now**. Confirm that
   and the issue closes.
