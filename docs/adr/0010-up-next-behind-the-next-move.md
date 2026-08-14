# Up Next: known upcoming moves behind the singular Next Move

Some **Threads** are efforts whose steps are all known in advance (renew passport: photos → appointment → submit → wait → collect), but a Thread could hold only one **Next Move**, so the remaining steps lived in the user's head or a second app (#280). We are adding **Up Next** — an ordered list of plain-text upcoming moves a Thread holds behind its Next Move — with queue semantics: the Next Move is the front of the line, and completing or clearing it promotes the next move.

This amends ADR 0003's "**Next Move** is singular and replaces Action queue." The Next Move remains singular and remains the only move surfaced outside the Thread — the Dashboard, attention lanes, and Plan still derive from Next Move and Follow-up alone — so the protected property (a Thread surfaces one thing at a time) is preserved; what changes is that a Thread may now hold the rest of a known sequence. The original Action queue (#127) was removed (#150) because it saw little use in a then-unpolished app and was not worth its upkeep at the time — a pragmatic cut, not a proven failure of the concept. The need it served ("holds … so the user's brain does not have to") is real and in scope.

## Considered Options

- **Documented convention, no mechanics** — keep steps as Summary text and promote by hand. Rejected: this is the status quo that keeps a second app alive; the app gives no help when a step completes.
- **Visible step list with done states** — familiar checklist UX. Rejected: done states duplicate the Activity Log, the list grows instead of shrinking, and it is the checklist model ADR 0003 rejected.
- **Ordered queue behind the singular Next Move** — chosen.

## Consequences

- While Up Next is non-empty, the Next Move slot is always filled; completing or clearing the Next Move promotes the front of Up Next.
- Completed moves leave the list and live on only as Activity Log entries — no done states, so Up Next never becomes a checklist.
- Up Next moves carry no dates. A step that needs a date is a Follow-up or its own Thread.
- Resolving a Thread clears Up Next; the resolution entry names the discarded moves. Reopening does not restore them.
- Editing Up Next (add, edit, reorder, remove) writes no Activity Log entries; promotion rides the existing Next Move entries.
- Processing an Inbox Task gains a third destination: append to the Thread's Up Next.
