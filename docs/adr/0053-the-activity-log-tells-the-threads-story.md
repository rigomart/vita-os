# The Activity Log tells the Thread's story

**Status:** Accepted. Amends [ADR 0016](./0016-thread-notes-and-automatic-activity-log.md) (capturing a Thread Note adds no Activity Log entry) and the Activity Rules in `CONTEXT.md`. Spec: issue #524. Delivered in slices: #525 (Notes), #526 (Tasks added and removed), #527 (Started, folding repeats).
**Date:** 2026-11-01

Coming back to a **Thread** after weeks, the **Activity Log** should say what happened. It records only Task completions, Area changes, Resolve and Reopen, so most of a Thread's story leaves no trace there: when it started, when a plan appeared or was dropped, and above all its **Thread Notes**, which are its records (ADR 0049). ADR 0016 kept Notes out of the log to keep prose out of a changelog. This keeps the prose out and lets the log know the Notes exist.

## Decision

The Activity Log stays its own tab beside Notes, and Notes keep their own space. The log gains the lines a story needs:

| Decision | Settled |
| --- | --- |
| Notes and the log | Separate tabs; the log is aware of Notes. |
| Note lines | Stored as Activity Log entries when a Thread Note is captured, including through Add to thread and New thread from note. |
| What a Note line shows | The Note's opening words as they read now; choosing the line opens the Note in the **Note view**. After the Note is deleted the line stays, without its words and with nothing to open. |
| Notes written before this ships | Backfilled, one line each at the Note's creation time. |
| A Note written while completing a Task | Read as part of that completion's line, not as a second line, backfilled ones included. |
| Task added and Task removed | Logged. Tasks added on the same day fold into one line. |
| Tasks added before this ships | Not backfilled: Tasks carry no creation time, so a date would be invented. |
| Started | Every Thread's story begins with a Started line at its creation date, existing Threads included. |
| Repeating completions | A stretch of completions of one repeating Task folds into one line. |
| Not logged | Editing a Task's text, setting or changing a date or Repeat, editing or deleting a Note. |

How the story reads (its order, how Note lines look beside the others) is settled in a design lab round after the slices.

## Notes in the log (#525)

A `note_added` entry is written in the same atomic batch as the Thread Note it names: on capture, and on Add to thread or New thread from note, where its time is when the Note joined the Thread. A completion written with a Note writes no `note_added` entry; its `move_completed` entry names the Note instead.

**No prose is stored in the log.** An entry names its Note by `thread_note_id`, a nullable column that is not a foreign key, because the entry outlives the Note. Its `content` is the fixed `Note added`. The contract's `ActivityLogEntry` gains `threadNoteId`. The client reads the Note's words from the Thread's Notes, which it already holds, so an edit or a deletion shows in the log at once. An entry whose Note is not among them reads `Note added` and opens nothing.

Migration `0010` rebuilds `activity_log_entries` for the new type in its `CHECK`, as `0005` did, and adds `thread_note_id`. Every entry is copied as stored. It then backfills: a `move_completed` entry with a Thread Note of the same owner, Thread and timestamp names that Note, since the two were written in one batch; every other Thread Note gets a `note_added` entry at its creation time. The API serving while `0010` runs names only the columns it knows, so it keeps working, and Notes it captures in that window get no line.

## Tasks in the log (#526)

Adding a Task writes a `task_added` entry, and removing one without completing it writes a `task_removed` entry. Each is written in the same atomic batch as the Task change. Both name the Task by its text, as a completion does: `content` reads `Added "<text>"` or `Removed "<text>"`, and the text is kept in `new_value` or `previous_value`. A Task has no Thread Note behind it, so the text is the only way to name it, and ADR 0016 only keeps Note prose out of the log. A later edit to the Task's text leaves its old lines as they were.

Adding a dated Standalone Note to a Thread, or starting a Thread from one, writes `task_added` for the Task the date adds, beside the Note's `note_added`. The Note stays the Thread's last activity, so the Thread's activity stamp keeps no summary. Resolving a Thread still names the Tasks it discards in its resolution entry and writes no `task_removed` for them.

**Folding is a reading.** Storage keeps one entry per Task. The client folds a day's `task_added` entries into one line, `Added 3 Tasks: a · b · c`, placed where the newest of them falls and naming the Tasks in the order they were added. A day is the reader's calendar day, the same one the log's day headings use. A single addition reads `Added <text>`.

Migration `0011` rebuilds `activity_log_entries` to add the two types to its `CHECK`, copying every entry and column as stored. It backfills nothing, because Tasks carry no creation time. The API serving while `0011` runs writes only types that are still allowed, so it keeps working.

## Considered Options

- **Derive Note lines when the log is read.** No migration, but a deleted Note would vanish from the story.
- **Merge Notes and the log into one list.** Tried before; the owner wants Notes in their own space.
- **Store the Note's opening words in the entry.** A line that never changes after an edit, and prose in the changelog, which ADR 0016 keeps out.
- **Log every date change.** It turns the story into a count of reschedules.

## Consequences

- A Thread's log grows with every Note. Lines fold only for Tasks added the same day and for repeating completions.
- A Note added to a Thread from a **Standalone Note** keeps its own creation time in the Notes tab; live, its log line is dated when it joined the Thread, while a backfilled one can only be dated by the Note's creation.
- A Note captured by the previous API during the deploy of `0010` has no line, and a completion with a Note written then does not carry it. Nothing is lost: the Note itself is kept.
- Matching backfilled completions by timestamp would link a Note captured on its own in the very millisecond of a completion in the same Thread. At personal scale that does not happen.
- An export carries `thread_note_id` on each Activity Log entry.
- Adding or removing a Task now moves the Thread's last-activity date, as every other entry does.
- A Thread's story starts with the Tasks added after `0011`. Tasks that were already open never get an "Added" line.
