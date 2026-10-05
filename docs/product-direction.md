# Vita OS: Product Direction

> Last update: 2026/10/04. Replaces the direction of 2025/12/01.

This document says what Vita OS is for and where it is going. `CONTEXT.md` owns the vocabulary and the exact rules; `docs/adr/` records each decision. When this document and either of those disagree, they win and this document is stale.

## Core Idea

**Vita OS holds the open loops of a life so the user's head does not have to.**

Some of those loops are slow situations: a parent's medical follow-up, a tax cleanup, a job search, a decision between two cars. Others are loose captures: a thought, a fact, something to do on Thursday. Vita OS keeps both on one Dashboard, laid out by when they need attention.

It answers one question:

> What is open, and what is asking for attention now?

It is not a task manager, a calendar, a notes app, or a project tool. It borrows a little from each and refuses the rest.

### What success means

Vita OS succeeds when nothing that matters is forgotten, not when things get done. A check-up put off for years is held well if it comes back into view each time the Dashboard opens, whether or not this is the week it happens. Doing stays the user's business; the app keeps the thing in view.

The other half is cost. A system that only stays true while it is maintained gets abandoned, and an abandoned system forgets on the user's behalf. Earlier attempts in general-purpose tools failed exactly this way. So the thesis in full:

> **Keep what matters in view, at the right time, with enough context to pick it up, while costing almost nothing to keep.**

---

## Product Thesis

Many important responsibilities are not continuously actionable. They follow a pattern:

```text
Notice → act once → wait days or months → look again → act or wait again
```

Examples:

- family and personal health follow-ups
- taxes and admin obligations
- career moves
- financial decisions
- household issues
- unresolved personal decisions
- long-term learning efforts

Task managers handle the "act" step. They fail the "wait" step: an item with nothing to do disappears, or it sits in a list and nags. The real problem is **continuity of awareness**. The user needs the situation to come back at the right time, with enough context to pick it up.

Vita OS does three things for a slow situation:

1. **Holds it** as a **Thread**, open until the user resolves it, valid even with nothing to do.
2. **Brings it back** through a **Follow-up date**: a soft date, never a deadline.
3. **Keeps its history** in an automatic **Activity Log** and in **Thread Notes**, so returning after weeks needs no reconstruction.

---

## Positioning

| Tool             | Asks                             |
| ---------------- | -------------------------------- |
| Task manager     | What do I need to do?            |
| Calendar         | When does this happen?           |
| Notes app        | Where do I store this?           |
| Project manager  | How do we execute this work?     |
| **Vita OS**      | **What is open, and what is asking now?** |

The Dashboard is the product. Everything else exists to make the Dashboard trustworthy.

---

## The Model

Two kinds of thing live in Vita OS. Areas label one of them.

```text
Thread → Summary · Moves (one optionally Focused) · Follow-up date · Thread Notes · Activity Log
Standalone Note → Follow-up date
Area → an optional label on a Thread
```

### Thread

An ongoing effort, concern, decision, or situation. It is **Open** or **Resolved**; there is no other status. Creating one needs only a title.

A Thread may carry:

- a **Summary**: what the Thread is about right now.
- **Moves**: useful actions, as unordered peers. No dates, no done state, no order. Completing one removes it and writes it into the Activity Log.
- a **Focused Move**: the one Move the user has singled out, if any. Focus is emphasis only.
- a **Follow-up date**: the soft date that brings the Thread back.
- **Thread Notes**: body-only notes that belong to this Thread and nowhere else.
- an **Activity Log**: the automatic, read-only record of meaningful changes.
- an **Area**.

A plain Open Thread, with no Moves and no Follow-up date, is valid. It means the situation still matters and nothing is clear yet.

### Standalone Note

A body-only capture, valid the moment it is saved: a fact, a thought, or an action. It needs no classification and no processing. It lives on the Dashboard, and it may carry a **Follow-up date**, which places it in a time column instead of the margin. A Note is Open or **Archived**: archiving puts it away unchanged, and it stays findable by its words in the palette's **History**. Notes are archived rather than "done" because most of them are information or thoughts, which are put away, not finished (ADR 0031).

A Note that turns out to belong to a situation can be added to an Open Thread, or start a new one, from its Note view. It keeps its body and creation time, and the earlier Follow-up date wins. Nothing prompts it: a Note with no Thread is complete (ADR 0030).

### Area

An optional label naming the part of life a Thread concerns: Family Health, Career, Home. It is a name and an icon. It has no state, no page, and no effect on attention. Its one job is to filter the Dashboard to one part of life.

### History

Finished things leave the Dashboard but not the product. The palette's **History** holds every Resolved Thread and every Archived Note, searchable, and opens either in place, where it can be reopened or unarchived (ADR 0029, ADR 0031).

---

## The Dashboard

The Dashboard lays every Open Thread and every open Standalone Note on one axis of time:

- **Now**: a Follow-up date today or earlier.
- **This week**: the next six days.
- **Later**: day seven onward.
- **The unscheduled margin**: **Ready to move** (Threads with Moves), **Open** (plain Threads), **Notes** (undated Notes).

Placement is derived from dates and from whether a Thread has Moves. The user never sets a status. A date outranks undated Moves, so a Thread with Moves and no Follow-up date leads the margin and never enters Now. Nothing is capped or hidden.

A row above the board filters it to one Area, to unlabeled Threads, or to Notes alone. Notes have no list of their own: the Notes filter is where to read them together.

The board can act on what it shows. A card completes the Move it displays and sets, changes, or clears the Follow-up date; a Note can be archived or given a date. Everything else happens in Thread detail, which opens in place over the board.

The intended loop takes one to two minutes:

```text
Open the Dashboard → read Now → handle or reschedule what is asking → glance at the margin → close
```

---

## Principles

1. **Capture asks nothing.** A Thread needs a title. A Note needs a body. Area, Moves, Follow-up date, and Summary are optional and can come later.
2. **Derive, never ask.** Attention comes from dates and Moves. The user does not maintain statuses, conditions, or priorities.
3. **The app never invents a priority.** Capture order is not rank. If several Moves exist and none is focused, the card says so rather than picking one.
4. **Dates are soft.** A Follow-up date means "bring this back", not "due". There are no deadlines.
5. **Colour belongs to time.** Lateness is the only thing the board colours. Areas are neutral.
6. **Reading is not handling.** Opening a Thread never clears its Follow-up date. The user clears, reschedules, or resolves it.
7. **Keep Threads alive, not noisy.** The Activity Log records what changed without being asked and records nothing trivial.
8. **One board.** No second schedule, no per-Area pages, no tabs.
9. **Plain words.** A familiar thing gets its familiar word. A new term is coined only when the familiar word would promise behaviour the app does not have (see Naming in `CONTEXT.md`).

---

## The Thesis as a Filter

Every idea is checked against the thesis before its shape is designed. An idea earns a place if it does at least one of these:

1. **Brings things back.** It helps something return to view at the right time.
2. **Restores context.** It helps the user pick a Thread up after weeks without reconstructing it.
3. **Makes carrying cheaper.** It lowers the cost of keeping something in the app: capture, upkeep, or guilt.

It stays out if it does any of these:

- **Pressures doing.** Overdue counts, streaks, completion stats, badges. They turn "not done yet" into "the app is unhappy with me", which is how a tool gets abandoned.
- **Needs upkeep to stay true.** If a skipped week leaves the app wrong, it repeats the failure Vita OS exists to avoid.
- **Plans execution.** Subtasks, priorities, estimates, dependencies. That is the work itself; a Thread Note or a dedicated tool can hold it.

Resembling another tool is not a test. Task managers have repeats, and repeats pass here: missed occurrences collapse, and a rhythm comes back without being reset by hand. The question is whether an idea serves remembering or doing.

| Idea | Verdict | Why |
| --- | --- | --- |
| Moves with a date and repeat (ADR 0032) | In | Brings a rhythm back with no manual reset; missed occurrences collapse. |
| One-tap "not now, next week" on a card | In | Deferring cheaply is the product. |
| A recap when a Thread is opened after weeks away | In | Restores context. |
| "Last touched N months ago" on a Thread | Only if neutral | Plain information passes; a warning colour pressures. |
| Priority levels | Out | Ranks the doing; the time columns already say what is asking. |
| Subtasks under Moves | Out | Plans execution. |
| "You completed 12 Moves this week" | Out | Scores doing. |
| Push notifications | Out for now | The Dashboard is a place the user looks, not something that chases; dates are soft and never ping (ADR 0027). |

---

## What Changed Since the First Direction, and Why

The first direction (2025/12/01) described a life-domain dashboard: Areas with a manual Condition, Threads under Areas, a single Next Move, and an Inbox of Tasks to process. Daily use pushed the product narrower. Each change below removed a structure the user was maintaining for the app's sake.

| Then | Now | Why | Decision |
| --- | --- | --- | --- |
| Every Thread belongs to an Area; each Area has a Condition | An Area is an optional label with no state | Capture always asked "which part of life?" first. Condition was a judgment nothing prompted, so it was stale or a chore. The Dashboard took its urgency from dates anyway. | ADR 0021 |
| Inbox Tasks: Done, Discard, Move to Thread, When | Standalone Notes that need no processing; Thread Notes on Threads | A saved body is already useful, whether information, a thought, or an action. Classifying and processing it added work before capture counted. | ADR 0015, 0016 |
| One Next Move, then an Up Next queue | Peer Moves with an optional Focus | Most situations have no known order. The queue turned capture order into a priority the user never chose. | ADR 0022 |
| A read-only list of status groups | Time columns with an unscheduled margin, actionable in place | One column wasted a desktop screen, and a board that cannot fix what it shows is always slightly wrong. | ADR 0017 |
| Manual Activity Log entries | An automatic Activity Log plus Thread Notes | Prose and change history were mixed. Separating them keeps Notes editable and the changelog trustworthy. | ADR 0016 |
| A Notes panel beside the board; Notes marked done | Notes on the Dashboard with a Notes filter; Notes archived and found in History | The panel listed the same Notes the board already showed. "Done" claimed a fact or a thought was a finished task. | ADR 0031 |

**What was given up.** The app no longer shows a neglected part of life that has no Threads. A part of life that needs a periodic look gets a Thread with a Follow-up date, such as "Review finances" in two weeks.

---

## Open Directions

Ordered by how directly they serve the thesis. None is committed; each needs a spec before work starts.

1. **Moves with an optional date and repeat** (issue #397, ADR 0032, proposed). The evidence this direction waited for arrived: a daily check-in did not fit a single Follow-up date, and was never tracked in the app at all. A Move becomes text with an optional date and repeat, and a Thread's Follow-up date folds into its Moves. Move is renamed Task first (ADR 0033, #400). Delivery is in iterations: dated Tasks and the fold (#401), repeating Tasks in core and the API (#403) and the UI (#404), then completing with a note (#405). Cleanup of the compatibility window is #402.
2. **Cross-device freshness stays parked** (issue #342) until normal use shows that refresh on focus is not enough.

Reaching Resolved Threads again, once an open direction, shipped as the palette's History (ADR 0029), which now holds Archived Notes too (ADR 0031).

---

## Not Now

These fail the filter above, mostly by pressuring or planning the doing. Each stays out until the simple model fails in real use.

- manual Thread status (active, waiting, paused)
- priorities, deadlines, due dates
- subtasks, checklists, done states on Moves, Move ordering
- multiple tags per Thread
- Area pages, Area health, or any Area state
- kanban or calendar views
- gamification and streaks
- collaboration and sharing
- AI planning

---

## One-Sentence Definition

**Vita OS holds your open Threads and loose Notes on one time-shaped Dashboard, so the slow situations of your life come back when they need you and you can stop carrying them in your head.**
