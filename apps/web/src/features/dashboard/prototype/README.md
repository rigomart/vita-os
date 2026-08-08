# PROTOTYPE — throwaway (issue #268)

Question: what structural layout should the Plan canvas use below `sm` (640px), where the
desktop grid's pinned furniture eats a ~390px viewport?

Four variants on the existing dashboard route (`/`), switchable via `?variant=` and the
floating DEV toolbar (shared harness: `@/components/dev/prototype-variants`). Only the
`sm:hidden` mobile branch of `DashboardOverview` is affected; desktop is untouched.
Resize the browser below 640px (or use device emulation at 390px) to see them.

- `current` — the interim flat attention list + inbox preview that shipped with #269 (baseline).
- `a` — **Transposed grid** (`variant-a-transposed.tsx`): time runs vertically down a slim
  pinned day gutter; areas become ~160px columns scrolling horizontally; empty days compress
  to tick rows; overdue/no-date are row bands, not pinned side bays. Preserves 2D drag.
- `b` — **Agenda collapse** (`variant-b-agenda.tsx`): the area dimension leaves the grid and
  becomes a chip attribute (area icon pill + condition rail); one vertical day list; area
  filter chips narrow it; overdue pinned on top, no-date collapsed at the bottom.
- `c` — **One-lane pager** (`variant-c-pager.tsx`): one area lane at a time, full width, time
  vertical inside it; compact area strip switches lanes. Cross-area moves out of scope.

All drag/reschedule interactions are local-state only — nothing persists, no mutations are
called. Delete this folder (and the wiring in `dashboard-overview.tsx`) once a direction is
chosen; the full variant set lives on the throwaway branch per the prototype skill.
