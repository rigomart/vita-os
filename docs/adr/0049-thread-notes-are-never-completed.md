# Thread Notes are never completed

**Status:** Accepted. Amends [ADR 0031](./0031-notes-on-the-dashboard-and-history.md) (Thread Notes archive and unarchive, and the Thread's archived notes) and [ADR 0016](./0016-thread-notes-and-automatic-activity-log.md) (completing and reopening a Thread Note).
**Date:** 2026-10-27

ADR 0031 gave every **Note** one way to be put away, Archive, which [ADR 0050](./0050-notes-are-completed-not-archived.md) renamed Complete. For a **Standalone Note** the action means something: the Note leaves the **Dashboard**, where it was asking for attention, and goes to **History**. A **Thread Note** never asked for attention. It has no date, never appears on the Dashboard or in History, and completing one only moved it from the Thread's Notes into a folded "Completed notes" list a few lines lower in the same Thread. Thread Notes are records: what a call said, a decision, the note left when a **Task** was completed. A record is not finished; it stays true. The work in a Thread is its **Tasks**, and the Thread finishes when it is resolved.

## Decision

**A Thread Note has no Complete and no Reopen.** Its line in the Thread shows its marker, up to three lines of text and its creation date, with no commands. The **Note view** offers Save and Delete for a Thread Note, never Complete or Reopen. The Thread lists all of its Notes in one list, newest first, and the "Completed notes" fold is gone. Delete, with its Undo, is how a Thread Note leaves.

**Notes completed before this stay, in the one list.** A Thread Note stored as `done` is listed by its creation date with the others. Nothing is migrated: the read ignores the stored state.

**Standalone Notes are unchanged.** They are still completed, reopened and found in History, and a repeating one's Complete still moves it to its next date (ADR 0041).

## The contract and storage

The contract reads a Thread's Notes with `listThreadNotes`, every Note of the Thread, newest first. `getDoneThreadNotePage`, `markThreadNoteDone`, `markThreadNoteOpen` and `ThreadNotePage` are removed, and so are their routes, `GET /v1/threads/:threadId/notes/done` and `PATCH /v1/thread-notes/:threadNoteId/state`, with no compatibility aliases. A `ThreadNote` has no `state` or `completedAt`.

`thread_notes.state` and `completed_at` are retired in two deploys, because migrations run while the previous API still serves and that API reads and writes both.

1. **`0009`, with this change**, rebuilds `thread_notes` so `state` defaults to `'open'`, without the `CHECK` that kept SQLite from dropping it, and replaces the two indexes that named it with one on `(user_id, thread_id, created_at DESC, id DESC)`. Every stored value is kept. The Drizzle schema no longer declares either column, so the new code never names them: Drizzle names every column it declares in an `INSERT`. The previous API, serving while `0009` runs, still finds both.
2. **A later migration**, once this API is the one serving, drops both columns in place, as `0007` dropped `follow_up`. It is written by hand: the Drizzle snapshot already lacks the columns, so `migrations:generate` has nothing to emit.

Until then the schema check in `apps/api/migration/test_drizzle_schema.py` lists the two columns as retired, the one place D1 and the Drizzle schema may differ; the drop removes the entry.

## Considered Options

- **Hide the buttons, keep the API.** The cheapest change, but it leaves commands no screen uses and a `state` on every Thread Note that nothing should read.
- **Reopen every completed Thread Note in a migration.** Same result on screen, but it rewrites stored data and keeps the columns, so it is half of dropping them.
- **Keep a read-only "Completed notes" fold for Notes completed before this.** It keeps the fold, its paged read and its route for a state no one can enter any more.

## Consequences

- A long Thread's Notes only grow; nothing folds them away. At personal scale that is a list to scroll, and Delete remains.
- Something to do inside a Thread belongs in a **Task**. An undated **Standalone Note** added to a Thread becomes a Thread Note with no **Task** (ADR 0030), so a to-do written as a Note becomes a record there, and the person adds the Task.
- A Thread Note's export row no longer carries `state` or `completed_at`, so a Note completed before this change exports like any other. An import accepts only a file from its own migration, so an older export never meets the new shape.
- Until the drop ships, `thread_notes` holds two columns no code reads.
- `CONTEXT.md` says a Thread Note is a record that is never completed; **Open Note** and **Completed Note** now name Standalone Notes only.
