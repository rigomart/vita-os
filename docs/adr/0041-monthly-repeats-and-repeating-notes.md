# Monthly repeats and repeating Standalone Notes

**Status:** Proposed. Amends [ADR 0032](./0032-moves-with-an-optional-date-and-repeat.md) (monthly rules were out), [ADR 0031](./0031-notes-on-the-dashboard-and-history.md) (a Note is archived, never completed), [ADR 0030](./0030-add-a-note-to-a-thread.md) (what a dated Note brings to a Thread), and the picker of [ADR 0040](./0040-quick-picks-date-picker.md) (Repeat on a **Task** only).
**Date:** 2026-10-11

Some loose things come back on a rhythm: a monthly bill, a filter to replace, plants to water. They are not situations, so the person writes them as a **Standalone Note** with a **Follow-up date**. A Note cannot repeat. Archiving it after the bill is paid puts the rhythm away with it, and nothing comes back next month; keeping it means re-dating it by hand every time, which is the manual reset ADR 0032 named as the evidence for building **Repeat**. The other route, a **Thread** with a repeating **Task**, fails the same case twice: a **Repeat** has no monthly rule, so every 30 days drifts about five days a year, and one bill becomes a Thread whose title and only **Task** say the same thing, with no room for the details a Note body holds, such as an account number.

Cases from health, home, money and pets showed that most loose rhythms are monthly or longer, that a loose thing has one rhythm where a Thread may hold several, and that the details belong with the reminder. Where bills cluster, or a record of each payment matters, a Thread with repeating **Tasks** stays the better home: each completion enters its **Activity Log**.

## Decision

**Anything with a date can repeat.** A **Standalone Note**'s **Follow-up date** may carry a **Repeat**, with the same values and the same next-occurrence rule as a **Task**'s date. It is set in the same picker, on the same Repeat row. A Repeat needs a date, and clearing the date clears it.

**Repeat gains monthly.** Every month on the day of month the date falls on. A month without that day uses its last day and the next month returns to the chosen day: Jan 31, Feb 28, Mar 31. Only every month, not every N months; a yearly rhythm uses every 365 days. The picker adds an `Every month on the <day>` preset, beside the existing ones, for **Tasks** and **Notes** alike.

**A repeating Note is completed, not archived.** Its card offers Complete where a one-off Note offers Archive, and so does its **Note view**. Completing moves it to its next occurrence and records nothing: Notes have no **Activity Log**, and completion leaves no last-done mark. There is no **Skip**, because with nothing recorded it would do exactly what Complete does. Missed occurrences collapse as a **Task**'s do: the Note shows once under Late, and completing it moves it to the first occurrence not before today. The card wears the repeat glyph on its date, as a repeating **Task**'s card does.

**Archive ends the rhythm.** It stays in the **Note view**. An archived repeating Note keeps its date and its Repeat; unarchiving puts it back at that date, under Late if the date has passed, as any unarchived Note returns.

**Adding a repeating Note to a Thread keeps the rhythm.** The dated **Task** its first line becomes carries the Repeat as well as the date and time.

**Undated Notes and Thread Notes are unchanged.** A **Thread Note** still has no date; a **Thread** comes back at its dated **Tasks**.

## Considered Options

- **Re-date the Note by hand.** Works today, but the rhythm holds only while the person remembers not to archive. It fails the "needs upkeep to stay true" test.
- **A Thread with a repeating Task, plus monthly.** Fits a cluster of bills. For one bill it doubles the title and has nowhere for the details. It remains the home for clusters and for anything that wants a record.
- **Rename Standalone Notes to Tasks.** Loose captures were called Tasks before issue 313, which renamed them because many are information or thoughts, and a task name made capture ask which kind it was. Rejected for the same reason.
- **Tasks outside Threads, and Notes without dates.** One rule everywhere: a **Task** brings something back, a **Note** keeps something. The cleanest model, but it needs a migration of every dated Note, a third kind of card on the board, a New task capture path, and a conversion when a Note should come back. Left open: if a repeating Note reads as a task wearing a Note's name in daily use, this is the next step, and the `repeat` column carries over into it.
- **Merge Notes and Tasks everywhere**, one item with a body, a date and a repeat. Puts dates on a Thread's history and a body on every **Task**, and moves every Thread's stored Tasks into the notes table. ADR 0030 rejected making a Note a Move for the same reasons.
- **Every N months.** Covers quarterly and yearly in one rule. The owner chose every month only.
- **A last-done mark on a repeating Note.** Gives Notes a state they do not have. A record belongs in a Thread.

No prototype was kept: the shape reuses the repeating **Task** card's glyph, the card's Complete, and the picker's Repeat row.

## Storage

- `notes` gains a nullable `repeat` column holding the same JSON a **Task**'s Repeat holds in `threads.moves_json`. The migration only adds the column, so the API still serving during deployment keeps working, and every existing Note reads as not repeating.
- A monthly Repeat is a new value inside `moves_json` and the new column. No migration rewrites existing rows. An API rolled back after monthly Repeats were written would refuse them on validation; a rollback must ship a reader that tolerates the new kind, or be avoided.
- Completing a repeating Note carries the caller's IANA time zone, as completing a repeating **Task** does.

## Open

- Whether repeating Notes should become loose **Tasks** (above), decided by use.
- Whether Complete on a Note needs a word of its own if it reads as a **Task** verb.

## Glossary changes when this ships

- **Repeat:** "An optional rhythm on a dated **Task** or a **Standalone Note**'s **Follow-up date**: every N days, weekly on chosen weekdays, or monthly on the date's day of month. Completing a repeating Task or Note moves it to its next occurrence instead of removing or archiving it."
- **Skip:** "Only a repeating **Task** can be skipped." stays; a repeating Note has no Skip.
- **Follow-up date:** add "It may carry a **Repeat**."
- **Standalone Note:** add "A repeating one is completed rather than archived; Archive ends its **Repeat**."
- Relationships: a monthly **Repeat** repeats on its date's day of month, a missing day falling to the month's last day. A repeating **Standalone Note** added to a **Thread** gives a **Task** carrying its **Repeat**.
- Dashboard Structure: a **Standalone Note** offers Archive and its **Follow-up date**, or Complete when it repeats.
- Former and rejected terms: "Done", "completed" for a **Note** stays a former word for archiving; completing names only what a repeating Note does.
