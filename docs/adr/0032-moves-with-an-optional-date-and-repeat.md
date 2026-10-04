# Moves with an optional date and repeat

**Status:** Proposed. Becomes Accepted when issue #397 ships.
**Date:** 2026-10-04

A **Move** becomes text with an optional date and an optional repeat, the way a calendar event is a title with an optional time and repeat. A **Thread**'s own **Follow-up date** is folded into its Moves: a Thread comes back on the **Dashboard** at its soonest dated Move. Issue #397 is the specification.

Some situations need the same small attention again and again: an evening check-in during someone's recovery, a weekly call, a monthly refill. Vita OS could not hold that. Moves had no date and no done state (ADR 0022), so a daily check had to be retyped after every completion. The Follow-up date was a Thread's only date (ADR 0028), so a daily rhythm used it up, left nowhere for a one-off date like an appointment, and had to be reset by hand every night. The product direction named that manual reset as the evidence for building recurrence. In practice the friction was enough for such check-ins not to be tracked in the app at all.

Real cases showed that a Thread often holds several rhythms at once, that the app tracks the user's attention rather than the underlying event (one look each evening, not every dose), that missed occurrences must not pile up, and that the end of a rhythm is usually unknown.

This amends ADR 0022 (Moves gain a date and a repeat, and a repeating Move is not removed when completed), ADR 0028 (Threads no longer have a Follow-up date; Standalone Notes keep theirs), ADR 0017 (a Thread is placed by its soonest dated Move), and ADR 0030 (where a dated Note's date goes when it is added to a Thread, still open). It supersedes the "no recurrence engine" stance in `docs/product-direction.md`.

## Considered Options

- **A repeat on the Thread's Follow-up date.** Rejected: one rhythm per Thread, and it uses up the only date a Thread has.
- **Repeating Moves as a special kind of Move** with their own fields. Rejected as framed: it read as making every Move heavier for the few that repeat.
- **A separate Routine list on each Thread**, beside Moves. Rejected: a Thread would hold Moves, Routines and a Follow-up date, three ways to say "something to do or look at".
- **One Move with an optional date and repeat, absorbing the Thread's Follow-up date.** Chosen. Every extra is optional and hidden until asked for, so a plain Move stays exactly what it is today.

## Decision

- **A Move is text, plus an optional date, plus an optional repeat.** The date is a local day with an optional time of day, with the same meaning and storage as a Follow-up date (ADR 0027). A repeat needs a date.
- **Repeats are calendar-based:** every N days (daily is N = 1), or weekly on chosen weekdays. Monthly rules, "N days after last done", end dates and sub-daily repeats are out.
- **One completion rule.** Completing a Move removes it, unless it repeats; a repeating Move moves to its next occurrence. Both write `move_completed`. Completing may carry a note, which is captured as a **Thread Note**.
- **Skip** moves a repeating Move to its next occurrence without completing it and writes nothing.
- **Missed occurrences collapse.** The next occurrence after completing or skipping is the first one that is not before today. A missed Move shows once as Late, never as copies.
- **Dates stay soft.** A Move's date resurfaces it; it is not a deadline and never notifies. Changing it writes no Activity Log entry.
- **Threads lose their Follow-up date.** "Look at this again in two weeks" is a dated Move. Existing Follow-up dates migrate to a dated Move named "Follow up". Standalone Notes keep their Follow-up date unchanged.
- **Placement.** A Thread with a dated Move sits in **Now**, **This week** or **Later** by its soonest one. A Thread whose Moves are all undated is **Ready to move**; one with no Moves is plain **Open**.
- **Capture is unchanged.** Adding a Move asks only for text.

## Left open

How dated and repeating Moves appear is not decided: the card's move slot, the Thread detail list, whether a timed Move should appear before its time of day, whether the **Focused Move** still earns its place, and where a dated Note's date goes when it is added to a Thread. Issue #397 lists these, to be prototyped and settled with the owner before the UI ships.

## Glossary changes when this ships

- **Move:** "One useful action that could move a **Thread** forward: text, with an optional date and an optional repeat." Remove "with no date and no done state".
- **Repeat** (new): "An optional rhythm on a dated **Move**: every N days or weekly on chosen weekdays. Completing a repeating Move moves it to its next occurrence instead of removing it." _Avoid_: recurrence, routine, habit.
- **Follow-up date:** applies to **Standalone Notes** only. A Thread's resurfacing is its soonest dated **Move**.
- Relationships, Thread Attention and Activity Rules: replace every rule about a Thread's Follow-up date with its soonest dated Move; replace "Moves have no dates, no done states" and "A step that needs a date is a Follow-up date or its own Thread".

## Consequences

- A Thread has one kind of date instead of two, and can hold any number of rhythms.
- The list of Moves can grow dated entries, which risks turning into a dated checklist. The guardrails are soft dates, text-only capture, and missed occurrences that collapse.
- `follow_up_change` entries already written keep their wording; new ones are no longer written for Threads.
