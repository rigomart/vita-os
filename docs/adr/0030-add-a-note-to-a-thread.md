# Add a Note to a Thread

**Status:** Accepted
**Date:** 2026-10-02

A Standalone Note sometimes turns out to belong to a situation the user is already holding as a Thread, or to be the start of one. Until now the only path was to copy the body into a Thread Note and delete the Note, which lost its creation time and its Follow-up date. This amends ADR 0015, which removed processing, conversion, and attachment to a Thread.

## Decision

The Note view's ⋯ menu offers two actions on an Open Standalone Note, and only there: **Add to thread…** and **New thread from note**. Thread Notes and Done Notes never offer them, and both are unavailable while the Note has unsaved changes.

**Add to thread…** opens a searchable picker of Open Threads, each row reading as the palette's Threads group does: title and Area. Choosing one makes the Note a Thread Note on that Thread. The Note leaves Notes and the Dashboard at once, and a toast offers **Undo** and **Open thread** for five seconds, as deleting does (ADR 0025): the command waits out the offer, so an undone add never reaches the service, and Open thread commits at once. **New thread from note** opens the New thread dialog with a title suggested from the Note's first line, without its Markdown markers, and the Area the Dashboard is filtered to. Saving creates the Thread with the Note as its first Thread Note and opens its pane in place.

**The earlier Follow-up date wins.** When the Note has a date and the Thread has none, or the Note's date is earlier, the Thread takes the Note's date, time of day included (ADR 0027), even when it has already passed. That is an ordinary Follow-up change and writes the same Activity Log entry. Otherwise the Note's date is dropped. Nothing then comes back later than the person asked for: whichever of the two dates was sooner still resurfaces the content. The picker says so before the choice, on the row it affects: "Brings this thread back Thu Oct 8". A new Thread takes the Note's date.

**The Note is kept as it is.** The Thread Note has the Note's body and creation time, and its last-edited time, or the creation time when no edit time is known. It gets a new identity. Adding counts as capturing a Thread Note: the Thread's activity stamp moves, with no Activity Log entry beyond the Follow-up change.

`POST /v1/notes/:noteId/add-to-thread` and `POST /v1/notes/:noteId/new-thread` answer with the Thread and the Thread Note. Each is one D1 batch (ADR 0019, ADR 0020): the Thread write runs only while the Note is still open with the date the decision read, and, for an existing Thread, only at the revision it read; it stamps a change token. The copy into Thread Notes runs only from the Thread carrying that token, and the Note is deleted only when its copy exists. A missing, foreign, or Done Note, a missing, foreign, or Resolved Thread, or a lost race writes nothing; a lost race is decided again, up to the usual three attempts.

## Why this does not bring back processing

ADR 0001 made capture a queue to empty: every Inbox item was waiting to be consumed into a Project, and ADR 0015 removed that because a saved body is already useful. That stays true. A Note is complete as it is; adding it to a Thread is an optional action inside the opened Note, never suggested, never counted, and never shown as a state a Note is in. There is no "unfiled" view and no badge for it: the Notes badge keeps counting Open Notes and drops by one when a Note leaves.

## Naming

The action is **Add to thread**. **Move** is a glossary term — one useful action on a Thread — so a Note is never said to be moved, in the interface, in code, or in documentation. "Convert", "process", and "attach" stay out of the interface too: the first two are the language ADR 0015 retired, and the Note does not hang off the Thread; it becomes one of its Notes.

## Considered Options

- **Make a Note a Move**: Moves have no body, no dates, and no history of their own, so a Note would lose most of what makes it a Note. A Move worth writing down from a Note can be typed in the Thread.
- **The Note's date always replaces the Thread's**: would push a Thread back later than the person had asked whenever the Note was dated later.
- **Keep the Thread's date always**: would silently drop a sooner resurfacing point the person had chosen.
- **Suggest Threads for Notes, or count unfiled Notes**: turns capture back into a queue to process.

## Consequences

- Amends ADR 0015: attaching a Standalone Note to a Thread is in scope as this optional action; processing and conversion of other kinds stay out.
- Adding is one-way. A Thread Note does not become a Standalone Note again.
- An add is lost if the page closes during the Undo window: the Note survives, which errs toward keeping data as ADR 0025 does.
- `Feedback.undoable` takes an optional second action, which commits at once and then runs.
