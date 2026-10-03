# Notes on the Dashboard, History in the palette, and archived Notes

**Status:** Accepted
**Date:** 2026-10-02

Since ADR 0017 the **Dashboard** shows every open **Standalone Note**, dated ones in their column and undated ones in the margin's **Notes** run. The summoned **Notes** panel (ADR 0012, renamed by ADR 0015) was therefore a second list of the same things, with its own ordering, its own badge, and its own way back to finished Notes. And "Done" was the wrong word for most Notes: a fact or a thought is not completed, it is put away.

This supersedes ADR 0012. It amends ADR 0015 (the **Notes** collection, its ordering and badge, and Done Notes), ADR 0021 (the filter row), ADR 0029 (the palette's **Resolved** chip), and ADR 0018 (the top-right cluster no longer holds **Notes**).

## Decision

**The Notes panel is gone.** There is no Notes button, badge, popover, or drawer. Notes live on the Dashboard; capture is unchanged (the dock's New note, `Q`, the palette's New note, and shared-note capture, which lands on the Dashboard).

**The filter row gains Notes.** It reads `All · each Area with its Open Thread count · No area`, then **Notes** with its open Standalone Note count, set apart from the Areas by the Manage areas button and a rule. Notes is muted when no Note is open, like an empty Area, and its count replaces the badge. Choosing it shows only open Standalone Notes, laid out by the board's usual rules: dated ones in Now, This week, and Later under their headings, undated ones in the margin's Notes run, no Threads. The empty board says "No Note is asking for you." On a phone the folded dropdown lists Notes after a separator. `1..9` and `0` keep their meaning and replace the Notes filter; Notes gets no key of its own.

**Notes has its own URL parameter.** The filter is `?show=notes`, never `?area=`: an Area named "Notes" has a slug starting `notes`, and a shared parameter could one day collide with it. The two parameters are mutually exclusive: choosing either clears the other, and should a URL carry both, Notes wins. An unknown `show` value falls back to All. The filter survives the in-place Thread pane and the Note view, as the Area filter does. A Thread captured under the Notes filter starts with no Area, because Notes is not an Area. `/notes`, `/inbox`, and the old `?inbox=true` redirect to the Dashboard filtered to Notes, keeping an open Thread. No address ever opened a single Note, so none needs keeping.

**The palette's Resolved chip becomes History.** History holds two groups: **Resolved threads**, exactly as ADR 0029 lists them, and **Archived notes**. Only Standalone Notes appear; a Thread Note stays inside its Thread. With an empty search, Archived notes shows one bounded page, most recently archived first. A search reaches every Archived Note: `GET /v1/notes/done` takes an optional `q`, and a Note matches when its body contains every word of it, in any order and case. Each word is one owner-scoped `LIKE` with `%`, `_`, and the escape character escaped, in one D1 statement that keeps the existing keyset paging. A search is bounded to 200 characters and 8 words; the client sends at most that and debounces typing. Each row shows a one-line plain-text preview and the archived date. Choosing one opens the Note view over the current page, where it can be read, unarchived, or deleted. It offers no Add to thread actions: ADR 0030 limits them to Open Standalone Notes. The chip still toggles the mode, switching still clears the search, and opening the palette afresh still starts with open work.

**Notes are archived; Threads are resolved.** For Standalone Notes and Thread Notes, Archive and Unarchive replace Mark done and Reopen everywhere: the Note view's button, the board card's rail, a Thread Note card's toggle, "Archived Oct 3" in the view's header, an "Archived notes" history section in a Thread, and the toasts and labels that go with them. Unarchiving returns a Standalone Note to the Dashboard where its Follow-up date puts it. Thread copy (Resolve, Reopen, Resolved) does not change.

## Why Notes archive and Threads resolve

The difference is what each action does, not how the word sounds. Archiving a Note changes nothing about it: its body, dates, and Follow-up date stay as they were, it only leaves the board, and Unarchive puts it back exactly as it was. That is putting something away. Resolving a Thread is a decision with consequences: it clears the Thread's Moves, its focus, and its Follow-up date, takes an optional resolution note, and writes an Activity Log entry, and Reopen restores none of it. Calling both "archive" would hide that a Thread loses its Moves; calling both "resolve" or "done" would claim a Note was a task that got finished. Most Notes are information or thoughts, which are never finished, only no longer needed in view.

## Stored values and the wire contract

Nothing stored or sent changes its name. D1 keeps `state = 'done'` and `completed_at`; an Archived Note is a Note whose stored state is `done`, and its archived date is `completed_at`. The API paths, payloads, and the contract's methods (`markNoteDone`, `markNoteOpen`, `getDoneNotePage`, and the Thread Note equivalents) keep their names. The only contract change is additive: `getDoneNotePage` takes an optional `query`, sent as `q`. Inside the application, names were changed where that was cheap and local: `useArchiveNote`, `useUnarchiveNote`, `useArchivedNotes`, and the Thread Note equivalents, `onToggleArchived` on the Note view. Query keys keep `done`, matching the endpoint they cache.

## Considered Options

- **Keep the panel and add the filter.** Two lists of the same Notes, one ordered by the Notes-collection rule and one by the board's, would disagree about where a Note is.
- **Notes as an option of `?area=`.** One parameter would be simpler, but an Area slug and a reserved word would share one namespace forever.
- **Archived Notes as a second page in the panel, or as a Dashboard section.** History is reached rarely and by searching; the palette already does that for Resolved Threads, and the board stays open work only.
- **Search only the loaded page.** Archived Notes grow without limit, so a client-side filter would silently miss older ones.
- **"Archive" for Threads too, or "Done" for Notes.** See above: the actions differ, so the words do.

## Consequences

- ADR 0012 is superseded: there is no summoned Notes surface. ADR 0006's palette "Go to: Notes" now selects the Notes filter, and ADR 0023's note that the Notes panel clears the Thread rail no longer applies.
- ADR 0015's Notes collection, its open-first ordering (past, today, undated, coming up), its collapsed Done history, and the navigation badge are retired along with the code that implemented them. Its storage, paging by completion time, and owner scoping stand.
- ADR 0021's filter row gains Notes, and any Area filter still hides Notes. `?area=` keeps its meaning.
- ADR 0029's chip is renamed History and gains Archived notes; its Resolved Thread rules are unchanged.
- `GET /v1/notes/open-count` and `countOpenNotes` stay in the API and the contract, unused by the application, so older clients keep working.
- SQLite's `LIKE` ignores case only for ASCII letters, so a search for "é" does not find "É". The client's narrowing of what is already on screen ignores case fully; the service decides what is found.
