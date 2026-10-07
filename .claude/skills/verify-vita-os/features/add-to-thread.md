# Add a Note to a Thread

An Open Standalone Note's Note view offers two optional actions in its ⋯ `More actions` menu: **Add to thread…** opens a searchable picker of Open Threads (title and Area, as in the palette), and **New thread from note** opens the New thread dialog with a title suggested from the Note's first line. Adding takes the Note off the Dashboard at once and offers Undo and Open thread for five seconds; the Thread Note keeps the Note's creation time. A dated Note also adds a dated Task to the Thread, named by the Note's first line (leading Markdown markers removed, `Follow up` when nothing is left), carrying the Note's date and time, appended unfocused; an undated Note adds none, and no Activity Log entry is written (ADR 0032, amending ADR 0030). The source hides during Undo; the destination Thread Note and dated Task appear after confirmation. Ordinary Task commands on that Thread remain available. A row whose Thread would come back earlier says `Brings this thread back <Ddd Mon d>`. Starting a Thread from a dated Note gives it that dated Task and opens the new Thread's pane with the Note inside.

Status: proven on 0a01284 at 1440×900 with `add-to-thread` and the deliberately updated `dated-tasks` flow: undated commit, New thread from note, source-only Undo window with unrelated Task capture, confirmed dated destination, and persisted completion leaving the unrelated Task. A separate real Undo run restores the source and creates no Thread Note after seven seconds and reload. Earlier archived-Note eligibility proof remains on 446055e. Not driven: the phone Note drawer at 390×844, a failed request error toast (automated tests cover it), and the toast Open thread shortcut in the drawer.

## Sub-features

- `add-menu` shows `Add to thread…` and `New thread from note` only on an Open Standalone Note; never on a Thread Note or an Archived Note (one opened from the palette's History shows only Copy Markdown and Delete note). Both are disabled while the Note has unsaved changes.
- `add-picker` lists Open Threads as `option "<title>"`, with `Brings this thread back <date>` in the option's name when the Note's date is earlier than the Thread's or the Thread has none.
- `add-commit` hides the Note and shows `Note added to thread` with `Open thread` and `Undo`, and after the toast lapses saves and publishes the destination: the Thread Note (`thread_notes`, original `created_at`), the deleted Note (`notes`), the Thread's dated Task in `threads.moves_json` (when the Note is dated) and `last_activity_at`, with no Activity Log entry.
- `add-undo` restores the source Note; the destination Thread and its Tasks stayed unchanged, and nothing reaches D1.
- `add-open-thread` commits at once and opens the Thread's pane (drawer below 1280px).
- `new-thread-from-note` prefills `Thread title` from the first line without Markdown markers, defaults the Area to the Dashboard filter, and after `Thread created` opens `?thread=<slug>` with the Note as the only Thread Note and one dated Task, named by the Note's first line and carrying the Note's date.

## How to get to it (user POV)

- Open a Standalone Note from a Dashboard card, with or without the `Notes` filter, then choose `More actions`.

## Driving it with agent-browser

Preconditions: an isolated instance (`up`, `signin`). Create two Threads through New thread (one left undated, one dated by adding a Task and dating it from the Task row's calendar button), and dated Notes through New note → `Follow-up date` → a day button such as `Thursday, October 8th, 2026` → Add (click Add by snapshot ref). Use unique text.

- **Menu.** `find role button click --name "Open note: <body>"`, `find role button click --name "More actions"`, then `snapshot -i`: the menu lists Copy Markdown, Add to thread…, New thread from note, Delete note. Capture `add-menu`.
- **Picker.** `find role menuitem click --name "Add to thread…"`, then `snapshot | grep option`: the undated Thread reads `option "<title> Brings this thread back Thu Oct 8"`, a Thread dated earlier reads just its title. Capture `add-picker`.
- **Commit.** Click the option by ref, `wait --text "Note added to thread"`, and capture immediately: the source card is gone and the destination is unchanged during Undo. `wait 7000`, then confirm the dated destination Task and its day column with `verify d1 "SELECT tn.body, tn.created_at, t.moves_json, t.last_activity_content FROM thread_notes tn JOIN threads t ON t.id = tn.thread_id"` and `SELECT type, content, new_value FROM activity_log_entries`. `created_at` equals the Note's original value from `SELECT id, created_at FROM notes` taken before.
- **Earlier Thread date.** Repeat into the Thread dated earlier: no option line, D1 keeps its existing Tasks and appends the Note's dated Task, and the entry count does not change.
- **Undo.** Add another Note, then `snapshot -i | grep Undo` and click Undo by ref. `wait --text "<body>"` shows the card again. After `wait 7000`, D1 still has the Note in `notes`, no copy in `thread_notes`, and the Thread's `moves_json` and `revision` unchanged.
- **Open thread.** At `set viewport 1024 768`, add a Note and click the toast's `Open thread` by ref: the URL gains `?thread=<slug>` and `dialog "<title>"` lists the Note. Return to `1440 900`.
- **New thread from note.** Open a Note whose first line is `## Plan trip <ts>`, choose `New thread from note`: `textbox "Thread title"` holds `Plan trip <ts>`. Click Create, `wait --text "Thread created"`, then `wait --text "<a later line>"`: the pane shows the Note, a dated Task carries the Note's date. Reload; D1 shows a Task in `moves_json` with the Note's old `attention_date` and no Activity Log entry.

**Repeatable flow.** `bun run verify run .claude/skills/verify-vita-os/flows/add-to-thread.flow` was proven on b2bd91a at 1440×900: undated add through the picker after the Undo offer expires, and New thread from note with its suggested title, with reloads, D1 assertions after every write, and before/after screenshots. Evidence: `.verify/evidence/addthread426/2026-10-07T06-20-13-558Z/`. Undo and the toast's Open thread action are excluded from this recipe after Undo was inconclusive in two baseline automation attempts. This flow also does not cover dated conversion, Task commands during conversion, menu restrictions, search, original creation-time equality, Area defaults, failed requests, drawer, or phone paths; dated conversion remains in `dated-tasks.flow`.

## Gotchas

- Notes dated a week or more out sit in the folded Later column; unfold it (`find role button click --name "Later"`) or choose the `Notes` filter link (`find role link click --name "Notes <count>" --exact`, the one after `Manage areas`).
- The Undo and Open thread buttons live in a toast; click them by snapshot ref.
- The write happens only after the five-second Undo window. D1 shows nothing until then; `Open thread` commits at once.
- The New thread dialog says `Thread created` on success; adding to an existing Thread has no separate server toast, so prove it after the window with D1 and a reload.
