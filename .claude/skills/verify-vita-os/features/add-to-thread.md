# Add a Note to a Thread

An Open Standalone Note's Note view offers two optional actions in its ⋯ `More actions` menu: **Add to thread…** opens a searchable picker of Open Threads (title and Area, as in the palette), and **New thread from note** opens the New thread dialog with a title suggested from the Note's first line. Adding takes the Note off the Dashboard at once and offers Undo and Open thread for five seconds; the Thread Note keeps the Note's creation time. A dated Note also adds a dated Task to the Thread, named by the Note's first line (leading Markdown markers removed, `Follow up` when nothing is left), carrying the Note's date and time, appended unfocused, and carrying the Note's Repeat when it has one (ADR 0041); an undated Note adds none, and no Activity Log entry is written (ADR 0032, amending ADR 0030). The source hides during Undo; the destination Thread Note and dated Task appear after confirmation. Ordinary Task commands on that Thread remain available. A row whose Thread would come back earlier says `Brings this thread back <Ddd Mon d>`. Starting a Thread from a dated Note gives it that dated Task and opens the new Thread's pane with the Note inside.

Status: proven in #462 by `add-to-thread.spec.ts` (undated Add to thread… after the Undo offer lapses, New thread from note), `dated-tasks.spec.ts` (a dated Note added to a Thread, a Task added during the Undo window) and `repeating-notes.spec.ts` (a repeating Note's Task keeps its Repeat) at 1440×900. Not driven: Undo restoring the source, the phone Note drawer at 390×844, a failed request's error toast (application tests cover it), and the toast's Open thread in the drawer.

## Sub-features

- `add-menu` shows `Add to thread…` and `New thread from note` only on an Open Standalone Note; never on a Thread Note or an Archived Note (one opened from the palette's History shows only Copy Markdown and Delete note). Both are disabled while the Note has unsaved changes.
- `add-picker` lists Open Threads as `option "<title>"`, with `Brings this thread back <date>` in the option's name when the Note's date is earlier than the Thread's or the Thread has none.
- `add-commit` hides the Note and shows `Note added to thread` with `Open thread` and `Undo`, and after the toast lapses saves and publishes the destination: the Thread Note (`thread_notes`, original `created_at`), the deleted Note (`notes`), the Thread's dated Task in `threads.moves_json` (when the Note is dated) and `last_activity_at`, with no Activity Log entry.
- `add-undo` restores the source Note; the destination Thread and its Tasks stayed unchanged, and nothing reaches D1.
- `add-open-thread` commits at once and opens the Thread's pane (drawer below 1280px).
- `new-thread-from-note` prefills `Thread title` from the first line without Markdown markers, defaults the Area to the Dashboard filter, and after `Thread created` opens `?thread=<slug>` with the Note as the only Thread Note and one dated Task, named by the Note's first line and carrying the Note's date.

## How to get to it (user POV)

- Open a Standalone Note from a Dashboard card, with or without the `Notes` filter, then choose `More actions`.

## Driving it

Spec: `apps/e2e/tests/add-to-thread.spec.ts`: undated add through the picker after the Undo offer expires, and New thread from note with its suggested title. Each write is proven by a reload, and D1 proves the move itself: the standalone Note row is gone, the Thread has one Thread Note, and no Activity Log entry was written. Dated conversion is in `dated-tasks.spec.ts`. `dated-tasks.spec.ts` also adds a Task to the destination Thread during the Undo window. Undo and the toast's Open thread are not in a spec: Undo was inconclusive in two automation attempts under the old tooling. Neither spec covers other Task commands during conversion, menu restrictions, search, original creation-time equality, Area defaults, failed requests, the drawer, or the phone.

Set up through the UI: two Threads from `createThread` (one left undated, one dated by adding a Task and dating it from its row's calendar button), and dated Notes through New note → `Follow-up date` → a day button such as `Thursday, October 8th, 2026` → `Add` (scoped to the dialog). Use `stamp` in every text.

- **Menu.** Click `button "Open note: <body>"`, then `button "More actions"`: the menu lists `menuitem`s Copy Markdown, Add to thread…, New thread from note, Delete note. `shot("add-menu")`.
- **Picker.** Click `menuitem "Add to thread…"`. The undated Thread reads `option "<title> Brings this thread back Thu Oct 8"`; a Thread dated earlier reads just its title. `shot("add-picker")`.
- **Commit.** Click the option, expect `getByText("Note added to thread")`, and `shot` at once: the source card is gone and the destination is unchanged during Undo. Wait for the toast's `Undo` to be hidden, then confirm the dated destination Task with `SELECT tn.body, tn.created_at, t.moves_json, t.last_activity_content FROM thread_notes tn JOIN threads t ON t.id = tn.thread_id WHERE t.user_id = '${account.id}'` and `SELECT type, content, new_value FROM activity_log_entries WHERE user_id = '${account.id}'`. `created_at` equals the Note's original value from `SELECT id, created_at FROM notes WHERE user_id = '${account.id}'`, read before.
- **Earlier Thread date.** Repeat into the Thread dated earlier: no `Brings this thread back` in the option, D1 keeps its existing Tasks and appends the Note's dated Task, and the entry count does not change.
- **Undo.** Add another Note, then click the toast's `button "Undo"`: `getByText(body)` shows the card again. Once the toast is gone, D1 still has the Note in `notes`, no copy in `thread_notes`, and the Thread's `moves_json` and `revision` unchanged.
- **Open thread.** At 1024×768, add a Note and click the toast's `button "Open thread"`: the URL gains `?thread=<slug>` and `dialog "<title>"` lists the Note.
- **New thread from note.** Open a Note whose first line is `## Plan trip <stamp>` and choose `New thread from note`: `textbox "Thread title"` has the value `Plan trip <stamp>`. Click `Create`, expect `Thread created`, then a later line of the Note: the pane shows the Note, and a dated Task carries the Note's date. Reload; D1 shows a Task in `moves_json` with the Note's old `attention_date` and no Activity Log entry.

## Gotchas

- Notes dated a week or more out are one-line rows (`button "Open note: <preview>"`) under `In 1 week` and later groups, with no card controls; open one there, or choose the `Notes` filter link (`getByRole("link", { name: "Notes <count>", exact: true })`, the one after the Areas and before `Edit areas`).
- The Undo and Open thread buttons live in a toast, which leaves after five seconds; click them right after it shows.
- The write happens only after the five-second Undo window. D1 shows nothing until then; `Open thread` commits at once.
- The New thread dialog says `Thread created` on success; adding to an existing Thread has no separate server toast, so prove it after the window with a reload and an assertion.
