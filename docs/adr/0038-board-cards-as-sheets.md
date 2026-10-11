# The board's cards as sheets

**Status:** Accepted. Amends [ADR 0037](./0037-one-list-under-the-sky.md) and replaces the margin rule of [ADR 0017](./0017-dashboard-time-columns.md)'s amendment.
**Date:** 2026-10-10

On the one list of ADR 0037, a **Thread** and a **Standalone Note** wore the same card: a frameless row, filled only on hover. A Note was told apart by its regular weight and a short margin rule at its left edge, the mark ADR 0017's amendment chose. On the file tabs' fills the rule was too faint to notice, and the frameless rows floated on the fill without an edge of their own. When a Note sat beside a Thread, it ended halfway down the Thread's height.

## Decision

**Every card is a sheet.** A card has a border and the card surface, so it stands on its group's fill like a sheet in a folder. The cards keep their three rows: the headline, what is next, and the footer. Hover darkens the edge instead of filling the card. A late card carries a faint warm tint, which it still drops on Late's fill. Cards stand 6px apart, in the list and in **No date**.

**A Note's sheet is dog-eared.** Its top right corner is folded over. The Note keeps its regular weight and carries no tag, since on the board a pill still means an **Area**. Colour stays with time: nothing about the kind of item is drawn in hue.

**A card fills its row.** Two cards side by side end together, and the footer is held to the bottom of each, so a Note's controls sit on the same line as a Thread's.

## Why

The file tabs made the board a set of folders, and sheets carry the image through to the items in them. The folded corner tells a Note from a Thread at a glance, without a label or a colour, and the two still read as one family.

## Considered Options

The decision came out of a prototype in the design lab, over the product's own card behaviour, models and scenarios. The prototype was removed once this shipped, so it would not drift from the product it copies. It is commit `f3c85a1` in the pull request that added this ADR (`git log` on this file finds it). Each direction kept the Thread's three rows:

- **Kind gutter**: a spool or a sticky note in a glyph column at the left. It was clear, but the spool read as an hourglass at 14px.
- **Eyebrow**: a top line naming a Thread's Area or the word Note, with the date at its right. It was the most explicit, but it left a Thread with no Area and no date an empty first line.
- **Sheets in the folder**: chosen.
- **Kept and loose**: a Thread as a solid sheet, a Note as a dashed outline. It was the strongest contrast, and noisy wherever Notes gather.
- **Threaded**: a line drawn from a Thread's title to its task, and a Note on a flat slip. The line was too short to read on most cards.

## Consequences

- The margin rule is gone, and the `ruled` card with it.
- On Today's fill the card surface matches the fill in light mode, so only the border sets a card apart there.
- In **No date** the sheets keep the old cards' width, so their edge stands slightly outside the run's heading, while their text lines up with it.
- The far groups' one-line rows are unchanged: a solid dot for a Thread, an outlined one for a Note.
