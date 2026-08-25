# PROTOTYPE — attention-first dashboard (issue #309)

Throwaway variants answering: **what does the Dashboard look like when
attention ranking owns position and time is a perceivable channel — but never
the layout grid?** Compared in daily use against the current Plan; the 1–2
minute orientation loop decides.

Four variants of the desktop Dashboard, switchable via `?variant=` on `/`
(floating dev-only pill, ← / → to cycle). The current Plan canvas stays
mounted as the `plan` baseline for side-by-side comparison. The compact
(mobile) Dashboard is untouched.

| Key | File | Direction |
| --- | --- | --- |
| `plan` | — (existing `PlanCanvas`) | Baseline: current day-timeline canvas |
| `a` | `variant-a-ribbon.tsx` | Flat attention run + horizon ribbon: forward time as a compressed read-only silhouette on top |
| `a2` | `variant-a2-gutter.tsx` | Same flat run; forward time as a vertical gutter beside the list, leader lines to each dated row |
| `b` | `variant-b-bands.tsx` | Temporal bands (Now / This week / Later / No date) with attention order inside — the contrast direction |
| `c` | `variant-c-areas.tsx` | Condition-grouped: Areas worst-first as the structure, threads in attention order within |

Shared rules (all variants): position = attention engine only; time appears as
annotation, silhouette, or weight — never day columns; read-only (no drag, no
mutations); staleness (`lastActivityAt`) renders as visual fade; undated open
Threads are first-class rows of the main surface.

Shared data contract: `attention-contract.ts`. Switcher: the dormant shared
`@/components/dev/prototype-variants` (`PrototypeVariants`).

**To delete this round**: remove this folder, the `variant` key in
`routes/_authenticated/route.tsx` `validateSearch`, and the prototype mount in
`components/dashboard-overview.tsx`. Record the verdict in ADR 0013.
