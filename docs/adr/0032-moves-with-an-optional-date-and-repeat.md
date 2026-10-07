# Moves with an optional date and repeat

Terminology amended by ADR 0033: **Move** is renamed **Task** (Moves become Tasks, Focused Move becomes Focused Task). This ADR keeps its original wording, and the sections added below use the new terms.

**Status:** Accepted. Amended by #402: compatibility window closed, `threads.follow_up` dropped.
**Date:** 2026-10-04

Amended by [ADR 0034](./0034-plain-application-writes.md): current-state Task commands and independent optimistic writes replace client revision coordination; conversion destinations appear after confirmation without a Thread lock.

A **Move** becomes text with an optional date and an optional repeat, the way a calendar event is a title with an optional time and repeat. A **Thread**'s own **Follow-up date** is folded into its Moves: a Thread comes back on the **Dashboard** at its soonest dated Move. Issue #397 is the specification.

Some situations need the same small attention again and again: an evening check-in during someone's recovery, a weekly call, a monthly refill. Vita OS could not hold that. Moves had no date and no done state (ADR 0022), so a daily check had to be retyped after every completion. The Follow-up date was a Thread's only date (ADR 0028), so a daily rhythm used it up, left nowhere for a one-off date like an appointment, and had to be reset by hand every night. The product direction named that manual reset as the evidence for building recurrence. In practice the friction was enough for such check-ins not to be tracked in the app at all.

Real cases showed that a Thread often holds several rhythms at once, that the app tracks the user's attention rather than the underlying event (one look each evening, not every dose), that missed occurrences must not pile up, and that the end of a rhythm is usually unknown.

This amends ADR 0022 (Moves gain a date and a repeat, and a repeating Move is not removed when completed), ADR 0028 (Threads no longer have a Follow-up date; Standalone Notes keep theirs), ADR 0017 (a Thread is placed by its soonest dated Move), and ADR 0030 (a dated Note's date becomes a dated Task when the Note is added to a Thread). It supersedes the "no recurrence engine" stance in `docs/product-direction.md`.

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

## Decisions on the open questions

The owner settled these. They use the new terms (ADR 0033).

- **Card slot.** In a time column (Now, This week, Later) the dated Task that placed the Thread leads, with a repeat glyph when it repeats. Two dated Tasks on the same day read "2 tasks today" and never pick one. In the No date tray today's rule holds: the Focused Task, else the only Task, else "N tasks · none focused".
- **Thread detail.** Dated Tasks first, soonest first, then a quiet "No date" divider, then undated Tasks in capture order. A date is set from the row's calendar button, never at capture. Adding a Task stays one line and Enter.
- **A timed Task before its time.** It appears under Today from the start of its day. ADR 0027 is unchanged: a time orders, never places.
- **Focus.** It stays and may be put on a dated Task. In a time column the dated Task leads even when another Task is focused. In the No date tray focus works as today.
- **A dated Standalone Note added to a Thread**, or used to start one. The Note's first line becomes a dated Task carrying the Note's date and time. The whole Note joins the Thread's Notes. Nothing is dropped.
- **The note on completing.** Offered on every Task, in Thread detail only. Completing from a Dashboard card stays one click.
- **Migrated cards.** A Thread that had one undated Task plus a Follow-up date leads with "Follow up" after the migration. Accepted. Story 22 of issue #397 reads: each Thread's Follow-up date becomes a dated Task, time included, so every Thread stays in the same column and under the same heading.
- **The card's date control.** On a card that shows a Task, it sets or changes that Task's date. On a card that shows no single Task (no Tasks, or several undated with none focused), setting a date creates a Task named "Follow up" with that date. "Look at this again in two weeks" stays one action on the board.

## Storage and compatibility

- The migration converts each Thread's Follow-up date into a dated "Follow up" Task, time kept, not focused. It **keeps** the `threads.follow_up` column, no longer read, so a rollback loses nothing. A later cleanup drops it.
- During the compatibility window the API returns the Thread's `followUp` derived from its soonest dated Task. It refuses a Thread `followUp` write as a non-retryable conflict, which makes an old client reload. The API deploys before the web app, as with ADR 0028.
- Thread Follow-up changes no longer write `follow_up_change`. Existing entries keep their wording.

## Time zone

The API does not know the user's time zone (see `packages/core/src/thread-changes.ts` and ADR 0027). Commands that compute a next occurrence, complete and skip on a repeating Task, carry the caller's IANA time zone. Core computes calendar dates in it and keeps the local time of day across daylight-saving changes.

Monthly rules stay out of scope.

## Delivery

Sub-issues of #397, in order:

1. #400 Rename Move to Task. No behavior change.
2. #401 Iteration 1: dated Tasks replace the Thread's Follow-up date. One PR in two stages: dated Tasks, then the fold of the Follow-up date.
3. #402 Remove the compatibility window for the Task rename and the Follow-up fold. Blocked until the owner ends the soak.
4. #403 Iteration 2a: repeating Tasks in core and the API.
5. #404 Iteration 2b: repeating Tasks in the UI.
6. #405 Iteration 3: complete a Task with a note, then close out. This ADR becomes Accepted.

## Glossary changes when this ships

- **Move:** "One useful action that could move a **Thread** forward: text, with an optional date and an optional repeat." Remove "with no date and no done state".
- **Repeat** (new): "An optional rhythm on a dated **Move**: every N days or weekly on chosen weekdays. Completing a repeating Move moves it to its next occurrence instead of removing it." _Avoid_: recurrence, routine, habit.
- **Follow-up date:** applies to **Standalone Notes** only. A Thread's resurfacing is its soonest dated **Move**.
- Relationships, Thread Attention and Activity Rules: replace every rule about a Thread's Follow-up date with its soonest dated Move; replace "Moves have no dates, no done states" and "A step that needs a date is a Follow-up date or its own Thread".

## Consequences

- A Thread has one kind of date instead of two, and can hold any number of rhythms.
- The list of Moves can grow dated entries, which risks turning into a dated checklist. The guardrails are soft dates, text-only capture, and missed occurrences that collapse.
- `follow_up_change` entries already written keep their wording; new ones are no longer written for Threads.
