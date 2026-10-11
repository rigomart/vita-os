# Thread Tasks in one list

**Status:** Accepted. Amends the Thread detail decision of [ADR 0032](./0032-moves-with-an-optional-date-and-repeat.md).
**Date:** 2026-10-10

ADR 0032 listed a **Thread**'s dated **Tasks** first, soonest first, then a quiet "No date" divider, then the undated ones. Each row carried every command on one line: a focus radio, the repeat glyph, the text, the date, Remove, Skip, Complete with a note, and Complete. In the pane at its narrowest the text was left a column of about 120px, so a long **Task** wrapped to five lines. The divider split one set of peers into two lists, and a **Task** jumped to another place when it gained or lost a date.

## Decision

**One list, in capture order.** Thread detail shows every **Task** in the order it was captured, dated or not. A date is shown on its row and never moves it. This is the order the glossary already gives **Tasks**; the Dashboard still places a **Thread** by its soonest dated **Task**.

**The text gets the row.** Complete leads, as in a checklist, and is one click. The text takes the row's width for up to two lines. Editing it opens a field that shows all of it and grows as it is typed into. A **Task** stays one line of text: Enter saves, and a pasted line break becomes a space.

**The commands sit under the text, at the right.** The date sits at the left of that line, with the repeat glyph on it. At the right are the row's commands as icons, each named by a tooltip: **Skip** when the **Task** repeats, the date, Focus, Complete with a note, and Remove. Skip comes first, so the others keep their places from row to row. In the pane they wait for the row's hover or focus, in room kept for them, so the list never shifts. In the phone drawer they always show.

**Focus is a toggle among the commands.** It replaces the radio. The **Focused Task** is still tinted where it sits, and the hint that asked to focus one is gone.

## Why

The text is what the person reads; the commands are what they reach for now and then. Moving the commands off the text's line gives a long **Task** three times the width, and keeping their room reserved means hovering never reflows the list. Capture order keeps a **Task** where the person last saw it.

## Considered Options

The decision came out of a prototype in the design lab, over the product's own commands and a scenario with long, dated, repeating Tasks. The prototype was removed once this shipped, so it would not drift from the product it copies. It is commit `2dced3e` in the pull request that added this ADR (`git log` on this file finds it).

- **Checklist**: the text with its date under it, and every other command behind a ⋯ menu. Clean, but each command took two clicks.
- **Open to act**: closed rows showing complete, text and date; opening one spelled its commands out. It hid too much behind a step.
- **Floating toolbar**: commands in a pill over the hovered row. It covered the row above, and needed a tap-to-select on touch.
- **Agenda**: the date as a left column, soonest first. It kept dates prominent but narrowed the text again.
- **Bottom bar, always shown**: the chosen layout with the commands always visible. Seven rows of icons were noisy.
- **Bottom bar**: chosen.

## Consequences

- Every row has a second line, even without a date. In the pane that line is empty until the row is hovered.
- Text cut at two lines is read in full by editing it; there is no tooltip with the whole text.
- Thread detail names a near day in words (Today, Tomorrow, a weekday) and a far one by its date. The Dashboard's tokens are unchanged.
- The lab gains a "Long tasks" scenario: one **Thread** with long, dated, late, repeating and focused **Tasks**.
