# No Skip on a repeating Task

**Status:** Proposed. Amends [ADR 0032](./0032-moves-with-an-optional-date-and-repeat.md) (Skip moves a repeating Move to its next occurrence and writes nothing). Follows the reasoning [ADR 0041](./0041-monthly-repeats-and-repeating-notes.md) gave for leaving Skip off a repeating Note.
**Date:** 2026-10-31

ADR 0032 gave a repeating **Task** two ways to reach its next occurrence: Complete, which writes an **Activity Log** entry, and **Skip**, which writes nothing. Both show on every repeating line of the **Dashboard** and on every repeating row in **Thread** detail. In use Skip goes untouched: the owner completes every occurrence, done or not. So each repeating line carries a control nobody uses, and a choice nobody makes.

The two differ only in the record. That record matters only when the **Activity Log** is later read as evidence that an occurrence happened, mostly for long rhythms such as a filter replaced every 90 days. Nothing in the app counts completions, so a completion written for a passed occurrence changes no number anywhere. Where the record does matter, the **Task**'s date control already moves it to any day and writes nothing, as ADR 0032 had Skip do.

## Decision

**A repeating Task has no Skip.** Complete is the one command that moves it to its next occurrence. Skip leaves the Dashboard line, the Thread detail row, the application contract, the HTTP API and core.

**Passing an occurrence without a record goes through the date.** Setting the **Task**'s date writes no **Activity Log** entry, and a weekly or monthly **Repeat** snaps or moves with the new date as it does today. Nothing is added to support it.

**Nothing stored changes.** Skip never wrote anything, so no migration runs and no existing row reads differently. The `skip` route goes away without an alias; an old tab reloads, as AGENTS.md has it.

## Considered Options

- **Keep Skip.** Costs one control on every repeating line and a concept in the glossary, for a case the date control already covers.
- **Keep Skip in Thread detail only.** Takes the icon off the board but keeps the concept, the command, the route and the contract test.
- **Move Skip into a menu.** Hides it without removing it: the same cost, and less clear.

No prototype was built: the only visual change is one fewer button.

## Consequences

- The **Activity Log** can show a completion for an occurrence the person let pass. Someone who reads it as evidence moves the date instead.
- Passing an occurrence without a record takes the date picker, a click or two more than Skip took.
- The verify-vita-os Tasks feature file drops its Skip checks.

## Glossary changes when this ships

- **Skip:** remove the entry. "Skip" becomes a plain word.
- Relationships: the weekly **Repeat** rule says "Completing advances to the first occurrence after the current date that is not before today; missed occurrences collapse into one Task, shown once under Late until it is completed. Completing acts on the occurrence on screen, so a double activation moves it once."
- Relationships: drop "Skipping a repeating **Task** moves it to its next occurrence without an **Activity Log** entry." Keep "Setting or clearing a **Repeat** adds no **Activity Log** entry."
- Dashboard Structure: a line's controls complete the **Task** it names and set, change, and clear its date and **Repeat**; drop "skip it when it repeats".
- Dashboard Structure: Thread detail's row commands are Remove, Complete with a note, and Complete; drop "**Skip** when the **Task** repeats".
- `docs/product-direction.md`: drop "and an occurrence can be skipped" from **Tasks**, and "skips it when it repeats" from the board's actions.
