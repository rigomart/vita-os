# Attention-first Dashboard

The **Dashboard** replaces the **Plan** timeline with one flat, global run of every **Open Thread** in canonical attention order: overdue **Follow-ups**, upcoming **Follow-ups**, **Threads** with a **Next Move**, then plain **Open Threads**. A **Follow-up** appears as a compact row annotation rather than a coordinate, and the **Inbox** reports in through a small read-only synopsis of dated **Open Tasks** plus the total open count. The **Area Condition** strip remains above the run and becomes the **Area Quick Panel** trigger. The same surface is used at every screen size.

This enforces the product thesis: Vita OS restores continuity of awareness; it does not ask the user to maintain a calendar or planning canvas. The **Plan** and its drag-to-reschedule interaction are retired rather than kept as a secondary view because the row order and annotations already answer the useful Follow-up question, while the timeline reintroduced scheduling semantics and hid undated slow loops at its edges.

## Considered Options

- **Keep Plan**: preserves direct manipulation and weeks-ahead shape, but makes time the primary axis, hardens soft dates, and invites planning work during a short orientation loop.
- **Flat run with a horizon ribbon**: the strongest prototype direction. The flat run is chosen; the ribbon is not, because it repeats row dates and retains a miniature calendar without proving a separate awareness need.
- **Flat run with a vertical time gutter**: keeps attention order but requires the reader to correlate rows with a large nonlinear scale. Rejected as too elaborate for a one-to-two-minute scan.
- **Temporal bands**: makes Now / This week / Later / No date the page structure. Rejected because time again owns the first reading and undated Threads become a remainder bucket.
- **Condition-grouped Areas**: clearly answers whether each Area is okay, but duplicates the Condition strip, fragments the global attention order, and approaches the Area inventory already governed by ADR 0009.
- **Flat global run without a standing horizon** (chosen): the Condition strip answers “is each Area okay?”, position answers “what deserves attention next?”, row annotations answer “when should this resurface?”, and neutral quiet-age text helps notice continuity without creating another status.

## Consequences

- ADR 0005 remains the source of the attention order and date-state language, but its “one shared row implementation” consequence is amended for the Dashboard. The Inbox and Area inventory keep the interactive shared row; the Dashboard owns a read-only compact row whose entire surface summons the Thread in place.
- Every **Open Thread** appears in the Dashboard run on every screen size. Plain Open Threads are not capped or hidden behind disclosure.
- **Follow-up** is read-only on the Dashboard. Setting, clearing, and rescheduling it happens in Thread detail; removing drag also removes the maintenance invitation that conflicted with the orientation loop.
- A Thread with Activity Log movement at least seven days ago may show neutral `quiet Nd` context. Quiet age never changes order, color, opacity, Condition, or attention group; missing activity says nothing. “Stale Thread” does not enter the domain model.
- The Inbox synopsis shows at most three dated Open Tasks in When order and counts every remaining Open Task. It summons the existing Inbox surface and never becomes a second task-management surface.
- The **Area Condition** strip now summons the Area Quick Panel. ADR 0013 is amended: the strip replaces the removed Plan lane header as the Dashboard’s single Area-response surface, while the persistent top-bar Area strip remains pure navigation.
- The Plan implementation and its drag-and-drop dependency are removed. There is no dormant secondary schedule or prototype selector in the production route.
- ADRs are renumbered into one sequence: Up Next remains 0010, Top-bar Area strip becomes 0011, summoned Inbox becomes 0012, Area Quick Panel becomes 0013, and this decision is 0014.
