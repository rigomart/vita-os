# Notes are completed, not archived

**Status:** Accepted. Records the change shipped in #511. Amends [ADR 0031](./0031-notes-on-the-dashboard-and-history.md) (Archive, Unarchive and "Archived notes" for Notes) and [ADR 0041](./0041-monthly-repeats-and-repeating-notes.md) (Archive beside a repeating Note's Complete, and Archive ending its Repeat).
**Date:** 2026-10-27

ADR 0031 had Notes archived, not completed, on the grounds that a fact or a thought is never finished, only put away. ADR 0041 then gave a repeating **Standalone Note** a Complete that moves it to its next date, beside an Archive that ended the rhythm. In use the board read two verbs for one gesture: a line for a **Task** said Complete, a line for a Note said Archive, and a repeating Note said both. A Standalone Note on the **Dashboard** is there to be dealt with, and dealing with it is what a **Task**'s Complete already names. #511 made the change in the interface without recording it here; this ADR does.

## Decision

**A Standalone Note is completed and reopened.** Archive, Archived and Unarchive become Complete, Completed and Reopen everywhere a Note shows them: a Dashboard line, the **Note view** and its header chip ("Completed Oct 3"), and **History**, whose second group is **Completed notes**. Completing still changes nothing about the Note but where it is shown, and Reopen puts it back where its **Follow-up date** puts it. A **Thread Note** is never completed ([ADR 0049](./0049-thread-notes-are-never-completed.md)).

**A repeating Note has one Complete.** It moves the Note to its next occurrence, as a repeating **Task**'s does. To finish a repeating Note for good, the person stops its **Repeat** in the date picker, then completes it. There is no second button.

**Threads keep Resolve.** ADR 0031's reason for two words still holds, now between Complete and Resolve: completing a Note changes only where it is shown, while resolving a **Thread** clears its **Tasks**, takes a resolution note and writes an **Activity Log** entry.

**Nothing stored or sent changes.** D1 keeps `state = 'done'` and `completed_at`, and the contract keeps `markNoteDone`, `markNoteOpen` and `getDoneNotePage`.

## Considered Options

- **Keep Archive.** ADR 0031's reasoning, but it left the board with two verbs for the one thing a person does to a line, and a repeating Note with both.
- **A second "Complete for good" button on a repeating Note.** Ends the rhythm in one step, at the cost of two Completes on one line. Stopping the Repeat first was chosen to match a repeating Task, whose Complete also only moves it to its next occurrence.

## Consequences

- Ending a repeating Note takes two steps, stop its Repeat and then Complete, where Archive took one.
- ADR 0041's open question, whether Complete on a Note needs a word of its own, is settled: it uses the **Task**'s word.
- Code names still say archive: `useArchiveNote`, `useUnarchiveNote`, `useArchivedNotes`, `onToggleArchived` and the Note view's `archived`. They are now at odds with `CONTEXT.md`, which lists "archive" and "unarchive" as former words for a Note. A rename is a separate, mechanical change.
