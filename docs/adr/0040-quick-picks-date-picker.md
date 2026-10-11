# A date picker of quick picks and time chips

**Status:** Accepted. Amends the picker of [ADR 0027](./0027-optional-time-orders-a-day.md).
**Date:** 2026-10-11

One picker sets every When: a **Task**'s date and **Repeat**, on its row in **Thread** detail and on a Dashboard card, and a **Standalone Note**'s **Follow-up date**. It had grown to a hint, a calendar, an `Add time` button and its field, four Repeat modes with a stepper or seven weekday toggles, a summary line, and Clear and Done: about 570px before Weekly added its row, so a card low on the screen opened it past the bottom. It saved a picked day at once but a time and a Repeat only when it closed. The days most often chosen, tomorrow or next week, took a hunt through the calendar. The hint, written for a **Note**'s **Follow-up date**, showed on **Tasks** too.

## Decision

**A menu of quick picks.** The picker opens on Today, Tomorrow, This weekend, Next week, In 2 weeks and In a month, each with the day it lands on (`Mon, Oct 12`); a pick that lands on an earlier one's day is left out. Under them are `Pick a date…`, the time, and on a **Task** its Repeat, one row each, then Clear. The calendar, a typed time, and the Repeat's choices replace the menu in place and come back with ←, so the picker is never taller than a calendar.

**The time is four chips.** 9 AM, 12 PM, 3 PM and 6 PM each save in one click, and the chosen one again removes the time. `Other…` opens a field that offers what a partly typed time could be: `7` is 7 AM or 7 PM, `745p` is 7:45 PM, and Enter saves the highlighted one. An hour typed without AM or PM offers both rather than guessing. This replaces ADR 0027's `Add time` button and typed field; the time still only orders a day.

**Repeat presets, and Custom.** `Doesn't repeat`, `Every day`, `Every weekday`, `Every <the date's weekday>` and `Every 2 weeks` each save in one click, and a preset that would move the date names the day it moves to (`Every weekday, from Mon`). `Custom…` holds every N days and weekly on chosen weekdays, with the line saying what the **Task** will do and where a weekly one moves its date, and saves with `Save repeat`. Every 2 weeks is every 14 days, which the **Repeat** already holds.

**Every choice saves as it is made.** There is no Done. The picker moves on at once, and holds its controls while a write is in flight, so a day picked after a Repeat is judged by it. On a **Thread** detail row it stays open on its menu, so a time or a Repeat can follow the day. On a card and in the **Note view** a choice closes it: a card moves to its new day's heading, or trades its date control for a time token, out from under an open picker.

**A time and a Repeat wait for a day.** On an undated item the chips and the Repeat row are disabled until a day is picked.

## Considered Options

The decision came out of two rounds of prototypes in the design lab, against the shipped picker, on a card, a **Thread** detail row, a **Note**, and a card low on the screen, with a log of every write. The prototype was not kept.

- **Type it**: one field reading "tomorrow 3pm" or "every mon", with the quick picks under it when empty. Fast from the keyboard, but it needed a phrase parser and hid the choices behind knowing the words.
- **Compact calendar**: the calendar kept, with three day chips above it and the time, a Repeat menu and Clear on one line under it. The smallest change, but the footer was too narrow for a Repeat's name.
- **Quick picks**: chosen. Its first time row was a field typed in place, which read as a label and was hard to hit; a second round tried:
  - **Named times**: Morning, Midday, Afternoon, Evening, Night on a page of their own, with the field on top. One click more than chips for the same choices.
  - **Half hours**: every half hour in a scrolling list, with the field on top. Familiar, but the slowest way to the common times.
  - **Time chips**: chosen.

## Consequences

- Amends ADR 0027: the time is set from chips or `Other…`, not an `Add time` button, and saves when chosen, not when the picker closes. A time still orders a day and never places it, and midnight is still no time.
- The picker no longer explains the **Follow-up date** in a hint.
- Setting a time and a Repeat on one visit writes one change for each, as before.
- On a card a day, a time and a Repeat take one opening each.
- A popover opened from a drawer renders inside it. The drawer traps focus, so a popover rendered outside it could not take a keystroke: the typed time, and the Area picker's search, could not be typed into on a phone. Escape closes such a popover alone, not the drawer.
