# Every Dashboard item a card, graded by attention

**Status:** Accepted. Amends [ADR 0045](./0045-the-list-graded-by-attention.md) (items are cards, not lines; the grading by distance stays) and [ADR 0046](./0046-no-date-as-lines.md) (No date's lines become cards). [ADR 0037](./0037-one-list-under-the-sky.md)'s one list under the sky and [ADR 0048](./0048-later-folds-at-the-foot-of-the-list.md)'s Later fold are unchanged.
**Date:** 2026-11-06

ADR 0045 drew every item as a line and dropped the headings' counts, because short lines could be counted at a glance. On a full board they cannot: ten Late lines and six for Today run past the first screen, each one or two lines tall, and nothing says how many there are until they have been read. The question the Dashboard answers, what is asking now, is answered by how much is asking before it is answered by what. Two cards under Late and three under Today say it before a title is read.

## Decision

**Every item on the Dashboard is a card**, two to a row from `sm` and one below it. The groups, their headings, their rules and their grading by distance are the list's, as ADR 0045 and ADR 0048 set them. Only the items change.

**A card is laid out as a card, not as a line in a box.** It leads with the marker and the **Task**'s words, up to two lines. The **Thread**'s title is on its own muted line under them, so a long **Task** never cuts it off. The last row holds the **Area** on the left and the date in the bottom corner. Complete sits in the top corner, revealed on hover or focus and always shown on a touch screen; the date control and the rest of the controls are the line's. Cards in a row share a height. A **Standalone Note**'s card shows its first line over "Note". In **No date** a **Thread**'s title leads, over its only **Task** or "N tasks", as on the line.

**The type steps down with distance, a step under the line's**, since a card is half as wide: Late and Today at 15px medium, Tomorrow at 14px, the days after at 13px, and the weeks and months, once **Later** is open, at 12px and faint until hovered.

**Lateness is still the only colour.** Late's heading stays in the attention colour, and Late's cards take a faint tint and ring of it. A neutral count is not a warning; a coloured one is the "overdue count" the thesis keeps out.

**Day headings carry no count.** The cards show it. **Later**'s folded line and **No date**'s heading keep their counts, as they ship, because what they count is folded or in a column of its own.

**Later folds at the foot as ADR 0048 has it**: its count, when the next comes due and the first two by name. Opened, its weeks and months are cards at the far size.

**No date's runs are cards in one column**, at one size, beside the list from `lg` and folded at the top of it below, as they ship.

The controls, the copies of a **Thread** ringing together (ADR 0044) and placement are unchanged.

## Why

The research behind this (external representations, offloading and reminding) agrees on a few things. A representation lowers the load when its shape can be read before its words. It does that when it uses a form people already know. And it only counts when it is trusted to be complete. Cards keep all three: a group's cards are counted by eye, the card is a familiar form, and nothing is hidden behind a click. They keep what ADR 0045 got right: one shape graded by distance, so the nearest reads loudest.

This is close to what ADR 0045 replaced, ADR 0037's cards two to a row. What differs: there are no file tabs or fills, so the groups don't each wear a box; the cards are graded, so far ones recede; Later is folded at the foot; and the card is laid out for its width instead of being a line set in a sheet. The cost ADR 0045 named still holds: a day with one item leaves half its row empty. It is accepted on purpose, since a lone half-width card is how one reads as one.

## Considered Options

The decision came out of a prototype in the design lab over the product's own data, filter, lines and controls. The prototype was removed when this shipped. Its commits are in the pull request that added this ADR (`git log` on this file finds it); every direction tried is kept in commit `8582be0`.

- **Round one** (`1fe8a39`, counts made neutral in `0dcb725`):
  - **Time treemap**, the whole board on one screen, a region per span led by its count, tiles sized by how near they are. Rejected: the screen is always full, so a light day with one late item looks as heavy as a busy one, and the far tiles shrink to names without controls.
  - **Cards for what is asking**, cards for Late and Today under a large count over the shipped lines. Superseded by cards for every item, which keeps one form.
  - **Piles**, a pile per span side by side, each a count over its first card. Rejected: a pile hides everything under its first card until clicked, and the columns repeat ADR 0017's reading across instead of down.
- **Round two** (`7007105`):
  - **Cards all the way down**, chosen.
  - **Desk and margin**, Late and Today as large cards on most of the page, everything else in one counted margin. Kept as the bolder alternative. It splits the reading into what is asking and the rest, a split ADR 0017's first round rejected.
  - **Mosaic**, the treemap with fixed tile sizes so its area is the load. Rejected: the week's and Later's tiles are names without controls, and it has no phone form.
  - **Skyline**, a column per day stacked from one ground line. Rejected: closest to a calendar view, which is Not Now, and its blocks have no controls.
- **Round three** (`2c8e468`, `8582be0`): the chosen direction on the shipped headings, type and folds, two to a row instead of three, Later folded, then a card layout instead of the line set in a box, and no count on day headings.

## Left open

- Whether a lone card should span its row. Every card keeps the same width.

## Consequences

- `DashboardLine` is `DashboardCard`, drawing every item on the Dashboard with a card frame of its own; its looks are `CardLook`. The controls (`BoardDate`, `BoardCompleteButton`) and the hooks behind them are unchanged. The loading skeleton draws placeholder cards, two to a row.
- A busy board's page is about as long as today's list: ten Late cards fill five rows. What changes is that the number is seen first.
- `CONTEXT.md`, in **Dashboard Structure**:
  - "Each group of the list is a heading on a rule across the list, led by the date's number when it names one day, over its items' lines. The nearer a group, the larger, bolder and darker its heading and lines read" becomes "Each group of the list is a heading on a rule across the list, led by the date's number when it names one day, over its items' cards, two to a row from `sm`. The nearer a group, the larger, bolder and darker its heading and cards read".
  - "**No date** draws the same lines at one size" becomes "**No date** draws the same cards in one column at one size".
  - The line paragraph ("On the list a line is one copy of its **Thread**…") describes a card: the marker and the **Task** in up to two lines, the **Thread**'s title on its own muted line, then the **Area** with the date in the bottom corner; Complete in the top corner, revealed on hover or focus and always shown on a touch screen; cards in a row share a height; Late's cards are tinted with the attention colour. "line" becomes "card" throughout it and in "can act on attention in place".
  - Add: "A day's heading carries no count; its cards show it. **Later** and **No date** keep their counts."
- `docs/product-direction.md`: "Every item is a line under its day's heading" becomes "Every item is a card under its day's heading, two to a row", and "A line completes the Task it displays" becomes "A card completes the Task it displays".
