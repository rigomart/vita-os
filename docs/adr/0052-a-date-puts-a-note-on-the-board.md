# A date puts a Note on the board

**Status:** Accepted. Amends [ADR 0031](./0031-notes-on-the-dashboard-and-history.md) (every open Standalone Note on the Dashboard, counted under All) and [ADR 0037](./0037-one-list-under-the-sky.md) (No date's Notes run under All).
**Date:** 2026-10-31

Every open **Standalone Note** stood on the **Dashboard**: dated ones in the list, undated ones in the **Notes** run of **No date**. Many undated Notes are information kept to look up now and then: a router login, a car's tyre size, gift ideas, a clinic's hours. They never ask for anything, yet they sat beside what does, counted under **All**, forever. The board's question is "what is asking now?", and ADR 0050 already says a Note on the board "is there to be dealt with". A Note that holds only information can't be dealt with, so on All it is noise.

## Decision

**A date puts a Note on the board.** **All** shows a **Standalone Note** only when it has a **Follow-up date**. An undated Note is not on All: **No date** there reads **Ready to move** and **Open**, with no **Notes** run.

**The Notes filter shows every open Note.** It is unchanged: dated Notes in the list under their days, undated ones in No date's **Notes** run. It is where undated Notes are read.

**Counts follow.** **All** counts **Open Threads** and dated open Standalone Notes. **Notes** counts every open Standalone Note, so the filter row still shows that undated Notes exist.

**All's empty state says where they are.** When All has nothing to show but undated Notes are open, it reads "Nothing is asking for you." over "Undated notes are under Notes.", linking the filter. "Every Thread is resolved and every Note is completed" is kept for when nothing is open at all.

Nothing else changes. Setting a date on an undated Note puts it on All, and clearing it takes it off. Complete, Reopen, Add to thread, History and capture behave as before; capture still asks nothing, and `Note added` still confirms a save.

## Considered Options

The directions were tried in the design lab against its "Info notes" scenario; the prototype with every variant is commit `69450f4` on the branch that shipped this.

- **Off All** (chosen). The smallest change: one rule, derived from the date, with no new concept or state.
- **A new kind of Note** ("Reference" or "Info"), off the board and found in the palette. It needs a new stored state, a verb to move a Note there, and a place to list them. The owner asked why a plain Note wouldn't do, and it does: the date already says whether a Note is asking.
- **Notes shelf.** As Off All, but the Notes filter lays undated Notes out as readable cards under the list. It reads better for long information Notes, but it gives the Notes filter a layout of its own. Left for later if one-line rows prove too thin.
- **One line on All.** All keeps a single "N undated notes" line in No date that opens the Notes filter. The gentlest change, but it still puts things that never ask on All.
- **Complete info Notes at once** (no change). They would sit in History's Completed notes, which says they are finished and mixes them with Notes that were.

## Consequences

- An undated Note captured as a to-do, such as "buy batteries", leaves All as soon as it is saved. To keep it in view, give it a date (Today is one pick). This is the main risk: a quick capture is now only under Notes, and the only sign it exists on All is the Notes count.
- Existing undated Notes leave All when this ships. Nothing is stored differently and nothing is lost; they are all under Notes.
- No migration, no contract change, no API change; the rule lives in the Dashboard's filter model, so the web and desktop apps both follow it.
- The glossary in `CONTEXT.md` and `docs/product-direction.md` are updated in the same change.
