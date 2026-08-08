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

Fanned out four calendar takes: `b2` schedule, `b3` week strip, `b4` month grid, `b5`
multi-day columns. The user ruled out `b5` by inspection.

## Round 3 (2026-08-08): three-lens analysis of b2/b3/b4

Three independent reviews (touch ergonomics, information density, path to production):
**b2 won** — first on touch mechanics (no droppables in sticky containers, no mid-drag
layout shift) and production cost, close second on density. `b3`'s strip drops are
mechanically defeated (dnd-kit auto-scroll band + sticky rect drift + a self-sync loop
that pages the strip backwards under the finger). `b4` fails the issue's width criterion
when expanded (57% chrome) and force-expands during every drag. Verified: all three share
a byte-identical agenda core with three small seams, so navigators remain additive later.

## Round 5 (2026-08-08): b2 consistency polish (in place)

User feedback on canon b2: occupied vs empty day rows used two different rail styles
(jarring) and today stacked four cues. Polished `variant-b2-calendar.tsx` in place: one
unified rail for every day (identical layout/typography; empty rows differ only in muting
and a hairline content column; uniform 40px row minimum), today = filled disc + faint row
wash only, and a file-wide sweep onto a 9/10/11/13px type scale, a 3-step muting ladder,
one structural hairline value, and gold as the single "drag in flight" tone. Note:
`b2b`/`b2c` forked before this polish and keep the old styling.

## Round 4 (2026-08-08): b2 is canon; styling/structure derivatives

`b2` stays as the canon reference. Three derivatives explore styling and light structure
while keeping its bones. `b3`/`b4`/`b5` retire from the switcher (files kept).

## Active variants

- `current` — the interim flat attention list + inbox preview from #269 (baseline).
- `b2` — **Calendar schedule** (`variant-b2-calendar.tsx`, canon): Google-Calendar-Schedule
  agenda — left date rail (weekday + day number, today circled), sticky month bands, near
  empty days as slim droppable rows, starts scrolled to today, floating "Today" pill.
- `b2a` — **Glanceable schedule** (`variant-b2a-glance.tsx`): b2 + the review fixes — tally
  line in the sticky band, condition-tinted worst-first filter chips, worst-first in-day
  ordering, post-drop follow-scroll, measured header inset, taller empty-row hit areas,
  drag-hover gap expansion.
- `b2b` — **Event blocks** (`variant-b2b-blocks.tsx`): chips restyled as solid
  condition-fill event blocks with an accent left edge (Google/Apple Calendar look);
  structure unchanged.
- `b2c` — **Week sections** (`variant-b2c-weeks.tsx`): days grouped under slim week headers
  ("This week" / "18–24 Aug" + load count); fully quiet weeks collapse to one line; week
  headers replace month bands.

## Retired variants (files kept, out of the switcher)

- `variant-a-transposed.tsx` — transposed grid: time vertical, area columns horizontal.
- `variant-b-agenda.tsx` — agenda collapse round-1 form; superseded by `b2`.
- `variant-c-pager.tsx` — one-lane pager: one area at a time, swipe/tab between areas.
- `variant-b3-weekstrip.tsx` — week-strip navigator; strip drops mechanically unreliable.
- `variant-b4-monthgrid.tsx` — month-grid navigator; chrome cost + mid-drag expansion.
- `variant-b5-multiday.tsx` — multi-day columns; ruled out by the user.

All drag/reschedule interactions are local-state only — nothing persists, no mutations are
called. Delete this folder (and the wiring in `dashboard-overview.tsx`) once a direction is
final; the full variant set lives on the throwaway branch per the prototype skill.
