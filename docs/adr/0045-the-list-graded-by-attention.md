# The Dashboard's list graded by attention

**Status:** Accepted. Amends [ADR 0037](./0037-one-list-under-the-sky.md) (file tabs, fills, two cards to a row, one-line rows from next week), [ADR 0038](./0038-board-cards-as-sheets.md) (cards as sheets now only in No date) and [ADR 0044](./0044-a-card-for-every-dated-task.md) (a dated copy is a line, not a card). Amended by [ADR 0046](./0046-no-date-as-lines.md): No date draws lines too. Amended by [ADR 0048](./0048-later-folds-at-the-foot-of-the-list.md): the weeks and months fold into Later at the foot of the list.
**Date:** 2026-10-18

ADR 0037 drew each group of the list as a file tab on a fill, with its items as cards two to a row, and ADR 0038 made every card a sheet. Every group then wore the same shape: Late, Today, Tuesday and Saturday were all a tab over a box, so nothing read first, and distance rested on small steps in heading size. Most days hold one item, which left half of each box empty, and a card took about 90px for two lines of words. A week of one-item days ran long.

## Decision

**Every group is a ruled heading over lines.** A heading sits on a rule across the list: the date's number when the group names one day, the label, then how far out it is. Under it each item is one line: a marker (the repeat glyph, a hollow dot, or a small dog-eared sheet for a Note), the Task, the Thread's title muted after it, then the Area and the date at the right. Skip, the date and Complete are revealed on hover or focus, on every line, near or far. On a narrow list the Thread's title drops under the Task.

**Nearer reads louder.** Each group's distance (Late and Today; Tomorrow; two or three days out; the rest of the week; the weeks; the months) sets the size, weight and ink of its heading and its lines, and the room around them. Late and Today lead in large bold type; the rest of the week steps down; the weeks and months are small and faint, and a faint line comes back to full ink under the pointer. Late's heading is in the attention colour, and a late line's date is too. There are no fills and no cards on the list.

**Headings no longer count their items.** The lines are short enough to count at a glance.

**No date keeps its cards** (ADR 0038), beside the list from `lg` and folded at the top of it below.

## Why

The question the list answers is "what is asking, then what comes next", read downward. A different shape per group made the eye stop on every box. One shape, graded, puts the weight where the attention is: Today's lines are the largest thing on the page, and what is weeks out recedes without being hidden. Lines also make the list shorter, so more of the week is on the first screen.

## Considered Options

The decision came out of a prototype in the design lab, in rounds, over the product's own models, controls and scenarios. The prototype was removed when this shipped. Its commits are in the pull request that added this ADR (`git log` on this file finds it).

- **Round one** (`2d2fdb2`): **Agenda**, the day in a sticky gutter beside its lines; **Spotlight**, Late and Today in one raised panel of cards over quiet lines; **Day pages**, one sheet per day with its items ruled on it. Agenda and Spotlight were dropped; Day pages was kept as a comparison, not a direction.
- **Round two** (`400bc28`): **Timeline**, a line down the left with a stop per group; **Zoom**, items changing form with distance (big cards, then chips, then a line of names); **Week strip**, a pinned row of the next seven days over a plain list of ruled headings and lines.
- **Round three** (`214d08b`): Week strip's list with Zoom's forms, big cards for Late and Today and chips or lines for the week. Mixing three forms read as three designs.
- **Round four** (`0d5db84`): **Graded list**, chosen: Week strip's list without the strip, and Zoom's principle without its forms.

## Consequences

- ADR 0037's file tabs, fills, two-to-a-row cards and one-line rows from next week are gone from the list. The folded No date below `lg` keeps its file tab for now.
- A dated item far out now has the same controls as one near: completing or rescheduling something months away no longer means opening it.
- The late tint on cards is gone with Late's fill: no card in No date is late.
- The cards (`ThreadAttentionCard`, `DashboardNote`) still render a dated item, a Task-first headline and a date under a heading, though the Dashboard now draws them only in No date.
- `CONTEXT.md` describes the list as lines graded by distance, and drops "a group's heading counts its cards and rows".
