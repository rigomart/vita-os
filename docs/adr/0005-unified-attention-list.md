# Unified attention list

The **Inbox**, the **Dashboard Overview** thread column and the **Area** thread inventory all answer the same question — what needs attention — but had drifted into three row layouts, three date vocabularies and three section-heading patterns. They will share one list built from a single row: a fixed left date rail whose shape encodes the attention state, a single 40px line of content, and no section headings. It lives in `features/attention-list/` and each surface supplies only its ordering.

## Considered Options

- **Keep three implementations**: preserves each surface's local habits, but attention signals stayed inconsistent across them (late colour, date position, section labels) and every visual change had to land three times.
- **Aligned gutter, date as a right-hand column**: strong alignment, but the date stopped leading the row, and the date is the signal that says whether something needs acting on.
- **One dense line with no rail**: the density was right, but without the rail nothing distinguished late from merely scheduled at a glance.
- **Stateful date rail**: the rail is tinted for overdue, filled for due today, plain for scheduled later, and a dashed ring when unscheduled; selected after comparing all variants on the real Inbox, Dashboard and Area routes.

## Consequences

- No visible group headings on any of the three lists. The attention groups survive as ordering only, expressed through row position and the rail.
- The **Dashboard** no longer collapses plain **Open Threads**; they sit inline at the end of the run.
- The **Dashboard** puts dated **Upcoming Follow-ups** before undated **Threads with Next Moves**, reversing the previous group order, so the rail's dates stay in sequence.
- The **Area** loses its "Follow-up schedule" and "No Follow-up" split in favour of one list under a Threads header.
- **Task** rows drop the relative created-at timestamp; the rail is the only temporal signal on a row.
- Lateness uses `condition-attention` everywhere rather than `destructive`.
- **Done Tasks** stay in a collapsed disclosure. Completion is a different concern from attention.
