# A card for every dated Task

**Status:** Accepted. Amends [ADR 0037](./0037-one-list-under-the-sky.md) (an Open Thread may stand in more than one group) and [ADR 0038](./0038-board-cards-as-sheets.md) (a dated card leads with its Task). Retires the Focused Task of [ADR 0022](./0022-peer-moves-with-an-optional-focus.md) and the Focus command of [ADR 0039](./0039-thread-tasks-in-one-list.md).
**Date:** 2026-10-16

A **Thread** stood on the **Dashboard** once, at its soonest dated **Task**, and its card named one **Task**. A frequent **Repeat** is almost always the soonest, so it held the card, and the **Tasks** dated after it were not named anywhere on the board. A Thread with a daily evening check-in, a pickup on Saturday and an appointment on Tuesday showed the check-in every day; on Saturday the card read "2 tasks that day", on Tuesday "2 tasks today", and the appointment's words appeared only in **Thread** detail. Each dated **Task** is a point where the person asked the Thread to come back, and the board was dropping all but the first.

## Decision

**Every dated Task places a copy of its Thread's card**, under the group its date falls in. A **Thread** with three dated **Tasks** stands three times. A repeating **Task** places one copy, at its next occurrence, as a **Repeat** is one **Task** with one date; missed occurrences still collapse into one copy under Late. A **Thread** with no dated **Task** stands once in **No date**, as before. Undated **Tasks** of a **Thread** that has a dated one are not on the board; **Thread** detail lists them.

**On the list, a copy leads with its Task.** The card keeps its three rows and its height. The first is the **Task** that placed it, in the title's weight, after the repeat glyph when it repeats or a hollow dot when it does not. The second is the **Thread**'s title, muted. The footer is unchanged: the **Task**'s date and the **Area** at the left, Skip (for a repeating **Task**) and Complete at the right, revealed on hover or focus. Every control on a copy acts on its own **Task** only. A copy is late when its own **Task** is. Opening any copy opens the **Thread**.

**In No date, the Thread leads**, over its only **Task**, or "N tasks" when it has several. Nothing picks one: the card must not invent a headline the person never chose. Setting a date there sets the only **Task**'s date, or adds a **Task** named "Follow up" when there are several or none.

**The far groups' one-line rows read "Task · Thread"** with the date, so two rows of one Thread in a week read apart.

**Hovering or focusing a copy rings the Thread's other copies**, cards and one-line rows, when the **Thread** stands more than once. The ring is the accent the focus ring uses: an interaction state, never a colour at rest, so colour on the board still belongs to time.

**Counts.** A group's heading counts its cards. The filter pills still count **Open Threads** and **Standalone Notes**, so "All" is how many things are open, not how many cards.

**Focus is retired.** With every dated **Task** named on the board and the undated ones counted, the **Focused Task** has no job: it only chose the headline of a No date card, and a count does that without asking anything of the person. There is no Focus command, no tint in **Thread** detail, and no pips on the card. Completing or removing a **Task** has no focus to clear. Stored `focused_move_id` values stop being read or written and stay in place; a later migration drops the column once no deployed API reads it. Focus never wrote **Activity Log** entries, so the log is unchanged.

## Why

A dated **Task** is the product's way of saying "bring this back then". Placing the **Thread** only at the first one kept the board tidy at the cost of the thing it exists for. Copies keep the rule that the board is read by time: each card is under the day it is about. Leading with the **Task** is what makes copies readable: two cards with the same title side by side read as a duplicate, two **Tasks** with the same **Thread** under them read as two things to do. The ring answers the cost of copies, that one **Thread** is now spread across the week, without drawing anything at rest.

## Considered Options

The decision came out of a prototype in the design lab on a "Several dated Tasks" scenario. The prototype was removed when this shipped, so it would not drift from the product it copies. The commits named below are in the pull request that added this ADR (`git log` on this file finds it).

- **Every Task on one card**, **Dated Tasks listed**, **Then** (the day's Tasks and one "Then Sat · …" line): one card per **Thread** naming more of its **Tasks**. Each grew the card with the **Thread**'s size, and ADR 0022 had already rejected the full list under a card for density. Commit `7aa8406`.
- **A card per dated Task** with the **Thread** title first: two "Kitchen tap" cards side by side read as a bug.
- **A card per day**: same-day **Tasks** shared a copy, which brought back a list on the card.
- **Copies that point at each other**: each copy named the **Thread**'s other days ("Also Sat · Tue 9:30 AM"). One more line on every card, and a late date read as "Also −2d".
- **First card, then lines**: later copies drawn as one line. Weight followed the order of copies, not how near they were.
- **Rhythms apart**: repeating **Tasks** as pills atop their day. A second kind of thing on the board. These five are commit `bbb7c95`.
- **Task first, with the ring on hover**: chosen. Commit `f24e8b1`; the same copies without the ring were its comparison.

## Consequences

- A busy **Thread** can fill a week of the board. The ring is how a person sees that it is one **Thread**.
- Two **Tasks** of one **Thread** on the same day are two cards; "2 tasks today" is gone.
- A person who used Focus to keep one **Task** in mind loses that emphasis. **Thread** detail lists the **Tasks** in capture order, as before.
- The glossary changes when this ships:
  - **Dashboard**: "one list of every dated **Task**'s **Thread** and every dated open **Standalone Note**…"; an **Open Thread** stands once per dated **Task**, or once in **No date**.
  - **Thread Attention**: "A **Thread** is placed by its soonest dated **Task**" becomes "Every dated **Task** places its **Thread**"; "Every **Open Thread** and open **Standalone Note** appears in exactly one group or run" becomes "every dated **Task** and dated **Standalone Note** in exactly one group, and every undated item in exactly one run".
  - **Dashboard Structure**: the task-slot paragraph is replaced by this ADR's card; the rail completes the card's own **Task**.
  - **Focused Task** moves to "Former and rejected terms", with "Focus never affects attention" and the focus clauses in Relationships and Activity Rules removed.
