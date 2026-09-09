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

- **Header: H2 "Merged bar."** One row — the date, then each Area as *status*
  (condition-coloured icon, name, pending count) with no pill outline, then the
  five counts at the right end. Clicking an Area opens the Quick Panel:
  Condition segments, the Standard, capture into that Area. Both writes are
  **stubbed to local state** — the fixture's Area ids are not real and a
  prototype has no business writing.

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
- **Round 6** (`3f7c891`, restyled in `5c3306d`) — the header band, three ways.
  H2 won; H1 (two bands with reason text) and H3 (per-Area tiles) retired. The
  chips read as filters, so the pill outline came off.

## Run it

The dev server must run from **this worktree**:

```bash
cd .claude/worktrees/prototype-314-dashboard
bun install
bun run dev
```

Then open `/?variant=A1`. The floating bar cycles variants (← / →) and
toggles **Wide / Constrained** (`?narrow=true`) and **Fixture / Live data**
(`?source=live`). Cards still open a Thread in place (`?thread=`); a Note opens
the Notes surface (`?inbox=true`).

## The fixture

5 Areas, 19 Threads, 7 standalone Notes, dated relative to now: overdue, today,
near-term (1–6d), distant (+12/+27/+45d), undated-with-Next-Move, plain open.
Thread Notes are absent by construction.

## Still open — round 7: inline card actions

The Dashboard can say what needs attention but not let you clear it, so every
correction happens elsewhere and the board is always slightly wrong. The verbs
are small — **complete the move**, **push the Follow-up**, **done** for a Note.
The question is where they live.

- `/?variant=A1` — **Hover rail.** Nothing at rest; a tick and a clock fade in
  at the card's top-right on hover or keyboard focus. No cost to the card, but
  actions you can't see are actions you forget you have.
- `/?variant=A2` — **Always on.** No new chrome: a leading tick box finishes the
  move, and the date token itself opens the date menu (undated cards get a faint
  "+ date" on hover). Always reachable, permanently busier.
- `/?variant=A3` — **Action menu.** The card becomes a menu — every verb listed,
  including Open Thread. Nothing hidden, but opening a Thread costs two clicks.

A Thread with no Next Move has nothing to finish, so it offers only the date; a
Note offers Done and its date. Writes are stubbed to session state: finishing
removes the card, pushing a date really moves it into another column, and a
line under the header counts the changes and undoes the last one.

## Parked after that

1. **Undated Notes** — the columns are time-shaped, so a Note with no date
   currently lands nowhere and Resting only accepts Threads.
3. Column overflow caps, empty states, keyboard movement between cards.
4. **#236**: with time as columns the question shrinks to "which column does an
   undated Next Move belong in?" — it currently sits in **Now**. Confirm that
   and the issue closes.
