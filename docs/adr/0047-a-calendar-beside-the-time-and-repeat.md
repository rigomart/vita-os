# A calendar beside the time and the Repeat

**Status:** Accepted. Supersedes the picker of [ADR 0040](./0040-quick-picks-date-picker.md).
**Date:** 2026-10-21

ADR 0040 kept the picker short by putting each part on a page of its own: a menu of quick picks, time chips and a Repeat row, from which the calendar, a typed time, the Repeat's presets and Custom each replaced the menu and came back with ←. Five pages deep, it was hard to tell where a choice lived, and the calendar, the one way to reach any day, was always a click away.

## Decision

**The calendar is always open, with the time and the Repeat beside it.** On a wide screen the picker is a popover: the calendar on the left, always six weeks so it keeps one height; beside it, as tall, a line saying the When (`Fri, Oct 23 · 9 AM · Weekdays`) with ✕ to remove the date, then Time, then the Repeat. Nothing is folded except Custom, which takes the column while it is open.

**No quick picks.** With the calendar in view, Today, Tomorrow and this weekend are cells beside each other, today marked. The calendar is the one way to pick a day.

**The time is one field and four presets.** A time field, as the browser draws it, to type into or step with ↑ and ↓ (the system's own wheel on a phone), empty until a time is set, and 9 AM, 12 PM, 3 PM and 6 PM under it, one tap each. A typed time saves a moment after the typing stops, at once on Enter or on leaving the field, and when the picker closes. Remove, in the Time heading, takes the time away; it shows only when there is a time. Midnight is still no time (ADR 0027): the field says so and saves nothing.

**The Repeat is one word per choice.** Daily, Weekdays, Weekly, Biweekly, Monthly and Custom, two rows of three. Weekly is the date's weekday and Monthly its day of month, as the presets were. Each says in full what it does to a screen reader and in its tooltip (`Every Thursday`, `Every weekday, from Mon` where it moves the date). Doesn't repeat is no choice: Stop, in the Repeat heading, or the chosen one again, stops it. Custom keeps every N days and weekly on chosen weekdays, with its line and Save repeat.

**With no date, the time and the Repeat show, disabled.**

**On a phone it is a drawer.** The When as its title, the calendar, then Time and Repeat as rows naming their value that open in place, one at a time, Remove or Stop in the open row, and the row that removes the date. From inside the Thread drawer or a Note's, it is a nested drawer.

**Every choice still saves as it is made**, and the picker still holds its controls while a write is in flight, except the time field, which stays editable and saves once the write lands. A day or a Repeat still closes it on a Dashboard line and in a Note view and leaves it open on a Thread's Task row. **A time no longer closes it anywhere**: it is saved while still being typed, and closing would take the field away mid-edit.

## Considered Options

The decision came out of four rounds in the design lab, against the shipped picker, on a Task row, a Dashboard card, a Note and a card low on the screen, with a log of every write. Every variant is kept in commit `cc0d64c` (`apps/design/src/prototypes/date-picker`).

- **One page**: the calendar in view under three day chips, with Time and Repeat opening beside the picker. A second layer of popovers.
- **Wide popover**: everything in view at once, quick picks included; taller than the calendar beside it, too big for a phone.
- **Dialog**: the same in a centred dialog holding a draft until Save. Deliberate, but Tomorrow took two clicks.
- **Split tokens**: day, time and Repeat as three tokens on the row, each with its own picker. Too much on a Dashboard line.
- **Big popover with quick picks**, folded three ways (an accordion, the shipped menu beside the calendar, panels opening on demand). The quick picks repeated what the calendar showed.
- **Calendar only**, chosen, with three times tried inside it: a list of every half hour under a field (three rows in view), an hour grid with quarter hours (no time before 6 AM or finer than a quarter), and the time field, chosen, with presets added in a later round.

## Consequences

- Supersedes ADR 0040's quick picks, time chips, `Other…` field and Repeat pages. ADR 0027 still holds: a time orders a day and never places it.
- A day in another month takes paging the calendar, where `In a month` was one click.
- Setting a day, a time and a Repeat on a Dashboard line takes one opening for the time and the Repeat together, after the day.
- The time field draws as the browser does, so it looks slightly different from one browser to the next.
- `Calendar` in `packages/ui` draws no surface of its own inside a drawer, as it already did inside a popover.
