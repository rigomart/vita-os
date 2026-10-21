# No date as lines

**Status:** Accepted. Amends [ADR 0045](./0045-the-list-graded-by-attention.md) (No date kept its cards) and supersedes what was left of [ADR 0038](./0038-board-cards-as-sheets.md) (cards as sheets).
**Date:** 2026-10-20

ADR 0045 turned the list into ruled headings over lines and left No date with its cards. The Dashboard then held two designs side by side: lines on the left, bordered sheets on the right, each with its own type, spacing, markers and controls.

## Decision

**Every item in No date is a line, the list's line.** It has the same frame, marker, controls revealed on hover or focus, and hover fill. A **Thread**'s title leads, over its only **Task** or "N tasks" when it has several. A **Thread** with no **Tasks** is its title alone. The marker is the **Task**'s (the repeat glyph or a hollow dot) when the line names one, a list glyph when it counts several, and none on a plain **Open Thread**. A **Standalone Note** keeps the small dog-eared sheet and its first line.

**No date reads at one size**, the list's two-or-three-days-out look: nothing in it is late, and nothing is far off.

The controls are unchanged: Complete and Skip act on the **Task** the line names, and a date set on a line that names no single **Task** adds a **Task** named "Follow up".

## Consequences

- `BoardCard`, `BoardTag`, `ThreadAttentionCard`, `DashboardNote` and `DashboardItem` are gone; `DashboardLine` draws every item on the Dashboard.
- The **Area** shows on a line only when the list is wide enough, as on the list. In No date's column beside the list it never is, so No date no longer names a **Thread**'s **Area**. The filter still narrows by it.
- A **Note** in No date shows its first line, where its card showed two.
- The folded No date below `lg` keeps its file tab; only what it holds changed.
