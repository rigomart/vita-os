# Add a Note to a Thread

An Open Standalone Note's Note view offers two optional actions in its ⋯ `More actions` menu: **Add to thread…** opens a searchable picker of Open Threads (title and Area, as in the palette), and **New thread from note** opens the New thread dialog with a title suggested from the Note's first line. Adding takes the Note off the Dashboard at once and offers Undo and Open thread for five seconds; the Thread Note keeps the Note's creation time. A dated Note also adds a dated Task to the Thread, named by the Note's first line (leading Markdown markers removed, `Follow up` when nothing is left), carrying the Note's date and time, appended unfocused; an undated Note adds none, and no Activity Log entry is written (ADR 0032, amending ADR 0030). Until the add settles (the Undo window plus the request), the whole Thread takes no Task command: that Task's row reads `Adding…` and is `aria-busy`, every Task row's focus, text, date, remove and complete controls and `Add a task` are disabled, and its card has no complete button and a read-only date. Task commands made before the add still go out first. A row whose Thread would come back earlier says `Brings this thread back <Ddd Mon d>`. Starting a Thread from a dated Note gives it that dated Task and opens the new Thread's pane with the Note inside.

Status: dated Note into a Thread proven on 3815ae6 by `flows/dated-tasks.flow` at 1440×900 (the dated Task, the Thread Note and no Activity Log entry in D1); the pending Task in the Thread pane, then usable, then completed with one request (D1: no Tasks left, one Activity Log entry) proven by the same flow in "fix(tasks): make Note conversions coherent without waiting". The card's pending state is covered by automated tests only. Earlier proof describes the former Thread Follow-up behavior; current dates live on Tasks. Earlier proof: dfb3aaa (Dashboard and the since-removed Notes panel at 1440×900: dated Note into an undated Thread, Note into a Thread with an earlier date, Undo, New thread from note; Thread drawer at 1024×768 via the toast's Open thread). Re-driven on 446055e from the Dashboard's Notes filter at 1440×900: menu, picker, commit into a labeled Thread, the Note leaving the Notes board, and the Thread Note in the pane; an Archived Note opened from History offers neither action (ADR 0031). Not driven: the phone Note drawer at 390×844, a failed request's error toast (automated tests cover it).

## Sub-features

- `add-menu` shows `Add to thread…` and `New thread from note` only on an Open Standalone Note; never on a Thread Note or an Archived Note (one opened from the palette's History shows only Copy Markdown and Delete note). Both are disabled while the Note has unsaved changes.
- `add-picker` lists Open Threads as `option "<title>"`, with `Brings this thread back <date>` in the option's name when the Note's date is earlier than the Thread's or the Thread has none.
- `add-commit` hides the Note, moves the Thread to its new date column, shows `Note added to thread` with `Open thread` and `Undo`, and writes after the toast lapses: the Thread Note (`thread_notes`, original `created_at`), the deleted Note (`notes`), the Thread's dated Task in `threads.moves_json` (when the Note is dated) and `last_activity_at`, with no Activity Log entry.
- `add-undo` restores the Note and the Thread's date; nothing reaches D1.
- `add-open-thread` commits at once and opens the Thread's pane (drawer below 1280px).
- `new-thread-from-note` prefills `Thread title` from the first line without Markdown markers, defaults the Area to the Dashboard filter, and after `Thread created` opens `?thread=<slug>` with the Note as the only Thread Note and the Note's date as the Follow-up date.

## How to get to it (user POV)

- Open a Standalone Note from a Dashboard card, with or without the `Notes` filter, then choose `More actions`.

## Driving it with agent-browser

Preconditions: an isolated instance (`up`, `signin`). Create two Threads through New thread (one left undated, one dated through the pane's `Set follow-up date`), and dated Notes through New note → `Follow-up date` → a day button such as `Thursday, October 8th, 2026` → Add (click Add by snapshot ref). Use unique text.

- **Menu.** `find role button click --name "Open note: <body>"`, `find role button click --name "More actions"`, then `snapshot -i`: the menu lists Copy Markdown, Add to thread…, New thread from note, Delete note. Capture `add-menu`.
- **Picker.** `find role menuitem click --name "Add to thread…"`, then `snapshot | grep option`: the undated Thread reads `option "<title> Brings this thread back Thu Oct 8"`, a Thread dated earlier reads just its title. Capture `add-picker`.
- **Commit.** Click the option by ref, `wait --text "Note added to thread"`, and capture immediately: the card is gone and the Thread sits under its new day. `wait 7000`, then `verify d1 "SELECT tn.body, tn.created_at, t.moves_json, t.last_activity_content FROM thread_notes tn JOIN threads t ON t.id = tn.thread_id"` and `SELECT type, content, new_value FROM activity_log_entries`. `created_at` equals the Note's original value from `SELECT id, created_at FROM notes` taken before.
- **Earlier Thread date.** Repeat into the Thread dated earlier: no option line, D1 keeps its existing Tasks and appends the Note's dated Task, and the entry count does not change.
- **Undo.** Add another Note, then `snapshot -i | grep Undo` and click Undo by ref. `wait --text "<body>"` shows the card again. After `wait 7000`, D1 still has the Note in `notes`, no copy in `thread_notes`, and the Thread's `moves_json` and `revision` unchanged.
- **Open thread.** At `set viewport 1024 768`, add a Note and click the toast's `Open thread` by ref: the URL gains `?thread=<slug>` and `dialog "<title>"` lists the Note. Return to `1440 900`.
- **New thread from note.** Open a Note whose first line is `## Plan trip <ts>`, choose `New thread from note`: `textbox "Thread title"` holds `Plan trip <ts>`. Click Create, `wait --text "Thread created"`, then `wait --text "<a later line>"`: the pane shows the Note, a dated Task carries the Note's date. Reload; D1 shows a Task in `moves_json` with the Note's old `attention_date` and no Activity Log entry.

## Gotchas

- Notes dated a week or more out sit in the folded Later column; unfold it (`find role button click --name "Later"`) or choose the `Notes` filter link (`find role link click --name "Notes <count>" --exact`, the one after `Manage areas`).
- The Undo and Open thread buttons live in a toast; click them by snapshot ref.
- The write happens only after the five-second Undo window. D1 shows nothing until then; `Open thread` commits at once.
- The New thread dialog says `Thread created` on success; adding to an existing Thread has no separate server toast, so prove it after the window with D1 and a reload.
