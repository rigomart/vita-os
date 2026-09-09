# PROTOTYPE — attention-first Dashboard (issue #314)

Throwaway. Not production code, no tests, read-only, dev-only. Delete this
directory (and the prototype block in `src/routes/_authenticated/index.tsx`)
once a direction is picked.

## Round 2 — the Thread row (current)

Round 1 varied the page layout across four whole-Dashboard variations. Verdict:
all four read badly, for two reasons that are upstream of layout — **the row
reads like a ledger** (date rail · title · detail · quiet counter · Area, all
competing on one line) and **there is too much information per row**. Those
variants are preserved in this branch's history at commit `103f42e`.

So this round holds the page still — one plain column, one thin rule between
"asking now" and "just open", a curated 11-item run — and varies only how a
single row is drawn. Every treatment is under a hard budget: **at most two
pieces of metadata visible at rest.**

- `/?variant=R1` — **Quiet lines**
- `/?variant=R2` — **Sentences**
- `/?variant=R3` — **Cards**
- `/?variant=R4` — **Peek**

They disagree about *where the metadata goes*:

| | What it does with the columns |
| --- | --- |
| R1 Quiet lines | Drops them. One line, title-led; a date only when it is pressing, the Next Move only on rows that need you now. Area is a single coloured dot. |
| R2 Sentences | Folds them into prose. The Next Move becomes the row and the Thread title and date are the tail of the sentence — no chips, no rail, nothing right-aligned. |
| R3 Cards | Moves them off the title's line onto a card footer. Costs vertical space; buys a title with nothing next to it. |
| R4 Peek | Hides them. Bare titles at rest; everything but a late date appears only on the row you are hovering or focusing. |

## Run it

The dev server must run from **this worktree** — a server started in the main
checkout does not have the prototype:

```bash
cd .claude/worktrees/prototype-314-dashboard
bun install
bun run dev
```

Then open `/?variant=R1`. The floating bar cycles treatments (← / → work too)
and carries two toggles:

- **Wide / Constrained** — `?narrow=true` clamps the column to ~26rem.
- **Fixture / Live data** — `?source=live` swaps in the real Convex queries;
  the fixture is default and shows a curated run.

Rows still behave like the real Dashboard: a Thread opens in place
(`?thread=`), a standalone Note opens the Notes surface (`?inbox=true`).

## The fixture

`prototype-fixture.ts` — 5 Areas, 19 Threads, 7 standalone Notes, dated
relative to now (overdue, today, near-term, distant, undated-with-Next-Move,
plain open). The row lab shows a curated subset; `?source=live` uses real data.
Thread Notes are absent by construction — the Notes here are standalone only.

## What the review has to answer

1. Which row treatment stops the ledger feeling — and at what cost?
2. What is the row's *irreducible* content? Title alone (R4), title + date
   (R1), or the Next Move as the headline (R2)?
3. Is losing the aligned date rail a real loss, or was the alignment the thing
   that made it read as a ledger?
4. Should a resting Thread look different from one that is asking, or just
   sit lower in the list?

Once the row is settled, layout comes back as round 3 — including the ordering
question in #236, which round 1 could not usefully settle while every variant
looked wrong.
