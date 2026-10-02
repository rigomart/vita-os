# An optional time orders a day

**Status:** Accepted
**Date:** 2026-10-01

When many items share a day, **Now** has no order worth reading. Everything due today is sorted by a timestamp that is the same local midnight for all of them, so the user's **Thread** order decides, and that order was never chosen for today. The user wants to say "this first, that this afternoon" without turning a **Follow-up** into a deadline.

## Decision

**A Follow-up and an Attention Date may carry a time of day.** The picker keeps its calendar and gains an `Add time` button under it, which opens a time field you type into (the browser's own time dropdown is hidden, as in shadcn's date-and-time picker). A date that already has a time opens with the field showing. Picking a day still saves and closes in one click, carrying any time already typed. A time typed for a day already chosen is saved when the picker closes, and Enter closes it, so editing a time writes one change and one **Activity Log** entry rather than one per keystroke. Removing the time puts the item back to its day alone.

**The time orders; it never places.** Columns and group headings stay in whole days: a 3 PM item is in **Now** and under `Today` from the start of the day, and after 3 PM it is still there, neither late nor moved. Within a day, a date alone comes first, as an all-day event does on a calendar, then timed items in time order. Nothing pings.

**A date alone is local midnight**, as the pickers have always stored it, so midnight is the one time that cannot be chosen: it reads as no time. This needs no migration and no new field. Existing dates keep reading as dates.

On a card, a time sits where the date would. Under a heading that names the day (`Today`, a day of **This week**), the token is the time alone (`3 PM`). Elsewhere it follows the date token (`Tue · 3 PM`, `Oct 14 · 3 PM`). Thread detail, the Note card, and the Note view write the date and time the same way.

**An Activity Log entry for a Follow-up records the raw timestamps**, and the log writes them in the reader's time zone, time and all. The API that records the entry does not know the user's time zone; it used to write the date in UTC, which named the day before for anyone east of UTC. Entries recorded before this change hold their date already written, and read as they are.

## Considered Options

- **A clock time as a reminder that pings**: what the glossary warns against. It would need push delivery the app does not have, and it makes a soft resurfacing point into an appointment.
- **A time that holds an item out of Now until it passes**: splits Today into "here" and "not yet", and an item could appear mid-session on its own.
- **Manual drag order within Now**: the board is for reading, not rearranging (ADR 0014), and a hand-kept order goes stale as dates change.
- **A separate "has time" flag**: makes midnight choosable, at the cost of a migration on both Threads and Notes and a field every write must keep in step. Midnight is not a time anyone sets a soft resurfacing point for.
- **Timed items before dated ones within a day**: puts the items the user ordered on top, but reorders every day for anyone who never sets a time. The all-day convention leaves those days as they were.

## Consequences

- Amends `CONTEXT.md`'s **Follow-up** and **Attention Date** entries and its board ordering rules.
- Amends ADR 0026's "cards under a heading that names its day drop their date token": a timed card keeps a token, and it says only the time.
- Reaffirms ADR 0017's columns and ADR 0026's headings: both still read whole days.
- Moving between time zones moves stored times with the clock, as dates already did.
