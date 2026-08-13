# Area attention lanes

The **Area** thread inventory moves from one flat attention-ordered list to visible, collapsible **attention lanes** — **Due now**, **Upcoming**, **Next moves**, **Open** — introduced by a quiet census line ("3 due now · 2 upcoming · …") that carries the **New Thread** action. This supersedes the "no visible group headings" consequence of ADR 0005 **for the Area surface only**; the Inbox and Dashboard keep their flat lists, and the shared `attention-list` row (date rail, 40px line, hover actions) is unchanged inside the lanes.

The decision came out of a design prototype: five structurally different Area views (editorial ledger, grouped lanes, two-pane register, focus hero + queue, card mosaic) compared in place on the real route, then three refinements of the lane direction (minimal chrome, maximal due-now escalation, collapsible workbench). The full variant set is preserved on the `worktree-areas-view-prototype` branch as the primary source.

## Considered Options

- **Keep the flat list** (ADR 0005 status quo): consistent with Inbox/Dashboard, but on an Area with many Threads the transition points between attention groups are invisible — the inventory's shape can only be recovered by reading every rail.
- **Sticky triage strip over flat sections**: a count band with anchors; rejected as chrome that shouts louder than the content and duplicates what a one-line census can say.
- **Maximal due-now escalation**: an elevated accent panel for the due-now group; effective but spends the page's entire energy budget on one group and fights the cream-and-gold calm.
- **Collapsible lanes with a census line** (chosen): weighty lane headings (heading type, icon, count chip) that double as disclosure triggers, the due-now heading toned with `condition-attention`, and one 11px census line stating the inventory's shape. Grouping earns its place by also being the interaction surface.

## Consequences

- The **Area** inventory shows four labeled lanes in the canonical attention order; **Due now** merges **Overdue** and due-today **Follow-ups**. Empty lanes are omitted entirely.
- Every lane starts expanded on every visit; collapsing is a user action, session-local and never persisted. A collapsed lane keeps its count, and a lane that empties out resets to expanded. The full inventory therefore remains the default view (the "always lists every Thread" rule stands).
- The census line replaces the "Threads" section header and hosts the **New Thread** button; the header's count pill is gone.
- The Area page drops its gold top rule (`border-brand-gold-strong`); the lane structure now carries the page's identity.
- ADR 0005 remains in force for the **Inbox** and **Dashboard**, and its date-rail states are unchanged inside the lanes — the rail still distinguishes overdue / due today / scheduled / unscheduled per row.
