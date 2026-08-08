# PROTOTYPE — throwaway (issue #268)

Question: what structural layout should the Plan canvas use below `sm` (640px), where the
desktop grid's pinned furniture eats a ~390px viewport?

Variants render on the existing dashboard route (`/`), switchable via `?variant=` and the
floating DEV toolbar (shared harness: `@/components/dev/prototype-variants`). Only the
`sm:hidden` mobile branch of `DashboardOverview` is affected; desktop is untouched.
Resize the browser below 640px (or use device emulation at 390px) to see them.

## Round 1 verdict (2026-08-08)

**Direction chosen: B (agenda collapse)** — the user wants it pushed further toward a
mobile calendar app's schedule/agenda view. Variants `a` (transposed grid) and `c`
(one-lane pager) are retired: their files stay on this branch as the primary source, but
they are no longer wired into the switcher.

## Active variants

- `current` — the interim flat attention list + inbox preview from #269 (baseline).
- `b` — **Agenda collapse** (`variant-b-agenda.tsx`): area dimension leaves the grid and
  becomes a chip attribute (area icon pill + condition rail); one vertical day list with
  sticky day headers; area filter chips narrow; overdue pinned on top, no-date collapsed
  at the bottom; quiet-day runs collapse to expandable hairlines.
- `b2` — **Calendar schedule** (`variant-b2-calendar.tsx`): variant B restyled as a mobile
  calendar agenda — left date rail (weekday + day number, today circled), month separator
  bands, near empty days as slim droppable rows, starts scrolled to today with a floating
  "Today" jump pill.

## Retired variants (round 1, files kept)

- `variant-a-transposed.tsx` — transposed grid: time vertical, area columns horizontal.
- `variant-c-pager.tsx` — one-lane pager: one area at a time, swipe/tab between areas.

All drag/reschedule interactions are local-state only — nothing persists, no mutations are
called. Delete this folder (and the wiring in `dashboard-overview.tsx`) once a direction is
final; the full variant set lives on the throwaway branch per the prototype skill.
