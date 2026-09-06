# Standalone Notes replace Inbox Tasks

Issue #313 replaces the capture model in ADRs 0001 and 0003: a saved body is a valid standalone Note, whether information, a thought, or an action. Capture requires neither a title nor classification. Processing, conversion, and attachment to a Thread are removed from this version. Thread Activity Log entries stay outside the global Notes collection.

## Decision

Expose `notes.*` operations with a `body` field. Keep the existing physical `tasks` table and `text` column as private compatibility storage. The shared Note projection performs the migration on read, without copying or rewriting records. Existing IDs, `_creationTime`, `createdAt`, optional attention dates, completion state, and completion timestamps therefore survive exactly. No backfill or separate migration command is required.

New Notes record `createdAt` and `updatedAt`. Subsequent body, attention-date, and state edits update `updatedAt` without changing creation time. Legacy records with no known edit time leave it absent until their next edit; they do not acquire an invented historical timestamp.

## Alternatives

- Copying Tasks into a new Notes table would give storage the new name, but would replace IDs and Convex creation timestamps and require coordinating copies, retries, and client writes.
- Renaming only UI labels would preserve data but leave the Task API and processing model available. Instead, retire that API and its conversion implementation.

## Surface and ordering

- Rename the user-facing Inbox to Notes while retaining ADR 0012's summoned panel/drawer and existing in-place navigation. `/notes` is the new deep link; `/inbox` and the existing `inbox` search parameter remain compatible.
- Amend ADR 0005's fixed-height row for Notes: bodies wrap and use multiline editing. Thread rows retain their existing form.
- Order active Notes by past attention date, today, no date, then coming up. Within past/future dates sort earliest first; within today/no date sort newest creation first.
- Keep Done Notes in separate collapsed, paginated history ordered by completion time. A dedicated completion index orders across page boundaries.
- Use attention-date language rather than deadlines. Amend ADR 0014's Inbox synopsis to name Notes and use calendar-date annotations.
- Delete permanently removes either an active Note or a Done Note. All reads and writes remain scoped to the authenticated owner.

## Verification

`convex/notes.test.ts` exercises legacy records through the Notes API, including exact preservation and separation from Thread log notes. Authorization, query projection, pagination, attention ordering, capture, editing, date changes, and deletion are covered at the existing API and UI boundaries.
