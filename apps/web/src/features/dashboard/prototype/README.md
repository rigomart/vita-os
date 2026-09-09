# PROTOTYPE — attention-first Dashboard (issue #314)

Throwaway. Not production code, no tests, read-only, dev-only. Delete this
directory (and the prototype block in `src/routes/_authenticated/index.tsx`)
once a direction is picked.

## Where the rounds went

- **Round 1** (`103f42e`) — four whole-page layouts. Rejected: every row read
  like a ledger; too much information per row.
- **Round 2** (`40ee270`) — four row treatments under a two-metadata budget.
  Rejected: it answered density by *removing* information and left the desktop
  empty. Only R1's one-line, title-led row was the right instinct.
- **Round 3** (`cf58032`) — dense: tokens instead of phrases, icons instead of
  names. Verdict: D1 was too small and filled only the top half of the page;
  D2's cards and stat strip were liked but had no way to see time; D3's matrix
  made time legible but risked being the rejected plan view and leaves empty
  cells. And across all three, showing the Next Move *instead of* the Thread
  title was disorienting.
- **Round 4** (current) — keep the cards and the stat strip, put the Thread
  title back above its Next Move, fill the viewport vertically, and ask one
  question three ways: **where does time live if the page must not become a
  plan view?**

## Round 4 variants

- `/?variant=E1` — **Time columns**
- `/?variant=E2` — **Timeline board**
- `/?variant=E3` — **Agenda spine**
- `/?variant=D2` — **Board (no time)** — round 3's board, title restored, kept
  as the baseline so the other three show exactly what a time axis buys.

| | Where time lives | How the height is used |
| --- | --- | --- |
| E1 Time columns | Time *is* the layout: Now · This week · Later · Resting, four columns of cards. | Full-height columns, each scrolling itself — a busy column can't push the others down, an empty one can't leave a hole. |
| E2 Timeline board | Time is a *chart*: a 28-day bar strip above an attention-ordered board. Click a bar to filter the board to that day; nothing is permanently reorganised by date. | Board grows down the page; the strip is fixed height. |
| E3 Agenda spine | Time is a *spine*: a narrow chronological agenda down the right, day markers and all dated items in order. | Both panes full height and independently scrolling; cards keep the width. |

Shared and held constant on purpose (round 4 is about layout, not the card):

- `attention-card.tsx` — **Thread title is the headline; the Next Move is the
  line under it.** Both visible at rest.
- `stat-strip.tsx` — five numbers, no prose: Late · Today · This week · Ready
  to move · Open.
- Dates are tokens (`−6d`, `Today`, `Tue`, `12d`, `Mar 4`); Areas are
  condition-coloured icons with the name in the tooltip.

## Run it

The dev server must run from **this worktree**:

```bash
cd .claude/worktrees/prototype-314-dashboard
bun install
bun run dev
```

Then open `/?variant=E1`. The floating bar cycles variants (← / →) and toggles
**Wide / Constrained** (`?narrow=true`) and **Fixture / Live data**
(`?source=live`). Rows still open a Thread in place (`?thread=`); a Note opens
the Notes surface (`?inbox=true`).

## The fixture

5 Areas, 19 Threads, 7 standalone Notes, dated relative to now: overdue, today,
near-term (1–6d), distant (+12/+27/+45d), undated-with-Next-Move, plain open.
Thread Notes are absent by construction.

## What the review has to answer

1. Is time better as layout (E1), as a chart (E2), or as a spine (E3)?
2. Does E1 read as the rejected plan view now that the rows are real cards, or
   does the card change the verdict?
3. Is the card right — title + move, one date token, one Area glyph — or does
   it still need something (last activity, Area name in words)?
4. Do the full-height, independently scrolling panes solve the dead space, or
   do they just move the scrolling problem?
5. #236 is still open: E1 answers it by column, E2 by sort order, E3 by which
   pane an item lands in. Which framing makes the answer obvious?
