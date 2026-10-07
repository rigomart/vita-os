# Plain application writes

**Status:** Accepted. Amends ADR 0022 and the conversion coordination introduced with ADR 0032.
**Date:** 2026-10-07

Issue #421 implements the fast-iteration phase of epic #419. Application-wide write batches, optimistic replay, Thread command queues, client revision checks, and conversion locks cost more to maintain than their present benefit. Stored data, ownership, authentication, and visible failures remain protected.

## Decision

Task commands name a Thread and Task and apply to current stored state. They do not carry a Thread revision. Editing the same Task from two devices uses last-write-wins. A missing Task or an operation no longer possible is refused visibly.

Complete carries the displayed occurrence date, or null for an undated Task; Skip carries its displayed date. The service checks that date again on every attempt. Competing completion or skip of that occurrence advances it once. Local-calendar inputs and stable completion Note IDs remain.

D1 retains its internal Thread revision. Because Tasks share one JSON column, a write conditional on that internal revision prevents unrelated Task changes from overwriting one another. After a race the operation re-reads and recomputes, up to the existing three-attempt policy used for Thread writes. Completion remains one atomic batch for the Task, Activity Log, optional Thread Note, and activity stamp. No receipt table or generation token is added. Public Thread responses no longer expose storage revisions.

Each TanStack mutation cancels affected reads, applies its optimistic change once, reconciles on success, restores its own affected records and fields on failure, and refetches when it settles. It does not wait for unrelated mutations. Controls disable while their action is pending; there is no command-signature registry or application-wide coordination.

Adding a Note to a Thread immediately hides its source during the existing five-second Undo offer. Undo restores it without issuing the command. The destination Thread Note and dated Task appear after successful save. Task commands on that Thread remain available during conversion. New thread from note likewise reconciles confirmed destination records.

## Alternatives

Keeping queues and revision propagation would preserve more predictable optimistic ordering but retain the coordination being removed. Publishing provisional conversion destinations would require protecting their not-yet-stored IDs. Both are rejected for this phase. Server conditional writes remain because removing them could lose unrelated stored Task changes.

## Consequences

- Two devices editing the same Task can overwrite each other. Refetch displays stored state.
- Out-of-order replies may briefly show an older optimistic result before refetch settles it.
- Converted destination records appear later, after Undo and the network request.
- A lost response may report failure even though completion landed; refetch reveals it, and a retry does not duplicate the occurrence or Note.
- Exhausting three storage attempts produces a visible failure.
- Date-only occurrence identity cannot distinguish a later deliberate reset to the identical old date. Further identity machinery is deferred unless observed use requires it.
- Previously loaded browser builds must refresh after the contract changes; version-based reload is delivered separately in #422.

The peer Task model, optional Focus, repeating calendar rules, Activity Log history, and conversion data preservation remain as decided in ADRs 0022, 0030, and 0032.
