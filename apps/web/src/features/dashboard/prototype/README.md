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

## Round 2 (2026-08-08): calendar-app flavors

The calendar feel of `b2` stuck; this round fans out multiple calendar-app takes on the
same agenda bones. Plain `b` retires from the switcher (file kept).

## Active variants

- `current` — the interim flat attention list + inbox preview from #269 (baseline).
- `b2` — **Calendar schedule** (`variant-b2-calendar.tsx`): Google-Calendar-Schedule-style
  agenda — left date rail (weekday + day number, today circled), sticky month bands, near
  empty days as slim droppable rows, starts scrolled to today, floating "Today" pill.
- `b3` — **Week strip** (`variant-b3-weekstrip.tsx`): pinned swipeable week navigator with
  per-day condition dots over a synced agenda; strip days accept drops for long-distance
  reschedules (Outlook style).
- `b4` — **Month grid** (`variant-b4-monthgrid.tsx`): collapsible mini month-grid navigator
  with condition dots; tap a date to jump the agenda; grid cells accept drops
  (Apple Calendar / Fantastical style).
- `b5` — **Multi-day columns** (`variant-b5-multiday.tsx`): swipeable day-column view with
  chips stacked per day, drag across columns to reschedule; waiting/no-date as horizontal
  trays (Google Calendar 3-day view, day-granular).

## Retired variants (files kept, out of the switcher)

- `variant-a-transposed.tsx` — transposed grid: time vertical, area columns horizontal.
- `variant-b-agenda.tsx` — agenda collapse round-1 form; superseded by `b2`.
- `variant-c-pager.tsx` — one-lane pager: one area at a time, swipe/tab between areas.

All drag/reschedule interactions are local-state only — nothing persists, no mutations are
called. Delete this folder (and the wiring in `dashboard-overview.tsx`) once a direction is
final; the full variant set lives on the throwaway branch per the prototype skill.
