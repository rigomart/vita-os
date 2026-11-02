# Activity Log

A Thread's `Activity` tab, beside `Notes`: one sentence per entry under day headings, newest first. Capturing a Thread Note adds a line `Note added: <the Note's first line>`, read from the Note as it is now; choosing the line opens the Note view. After the Note is deleted the line stays as `Note added`, with no words and no button. A Note written with `Complete with a note` gets no line of its own: the completion's line carries it under the sentence and opens it.

## Entry points and variants

- The side pane (1280px and wider) and the drawer (1024 to 1279px)
- Where a Thread Note comes from: `Write a note…`, `Complete with a note` on a Task row, and a Standalone Note's `Add to thread…` or `New thread from note`

## Preconditions

- A signed-in throwaway user with an Open Thread (New thread), open in its pane or drawer.

## Checks

1. Capture a Thread Note `Called the office <stamp>` (`POST /v1/threads/<id>/notes` → `201`). On the `Activity` tab the open panel (`eval "document.querySelector('[role=tabpanel]:not([hidden])').innerText"`) reads `Today | Note: | Note added: Called the office <stamp> | <h:mm AM/PM>`, where `Note:` is screen-reader text, and the line is `button "Note: Note added: Called the office <stamp>"`. Choosing it opens the Note view on that Note: `[aria-label='Note body']` reads `Called the office <stamp>`.
2. Edit the Note's first line in the Note view and Save (`PATCH /v1/thread-notes/<id>/body` → `200`): the line reads the new first line, also after a reload. The Thread still has exactly one entry for the Note, with no words stored:
   `SELECT type, content, previous_value, new_value, thread_note_id FROM activity_log_entries WHERE thread_id = '<thread id>'` → one row `note_added`, `Note added`, `null`, `null`, `<thread note id>`.
3. `Delete note` (from the line's Note view or the Notes tab), and wait out `Undo` (`DELETE /v1/thread-notes/<id>` → `200`): the line reads `Note: | Note added`, and the Activity log has no `button`. Deleted from the line's Note view, focus lands on the Activity `tabpanel`.
4. `Complete with a note` on a Task, note `Clerk confirmed <stamp>` (`POST …/tasks/<task id>/complete` → `200`): the panel shows one line `Task done: | Completed <task> | <time>` with `Clerk confirmed <stamp>` under it, and no `Note added` line for that Note. In D1 the `move_completed` row's `thread_note_id` is the new Thread Note's ID. Choosing the line opens that Note.
5. `Add to thread…` or `New thread from note` on a Standalone Note `<text>`: after the Undo offer (`POST /v1/notes/<id>/add-to-thread` → `200`, or `POST /v1/notes/<id>/new-thread` → `201`), that Thread's panel has `Note added: <text>` at the time it was added.

Notes written before migration `0010` are backfilled, one `Note added` line each at the Note's creation time, and a Note sharing a completion entry's timestamp is carried by that completion. No UI path writes a pre-`0010` row, so `apps/api/test/migrations.integration.test.ts` proves it; to see it on screen, create Notes on an instance before `0010` is applied, then run `bun run verify up` again on the branch that adds it.

## Traps

- Open the `Activity` tab only after the pane or drawer stops sliding; a click during the slide is lost.
- The tab highlight slides; a screenshot right after switching can show it still on `Notes`. Wait for `document.getAnimations().length === 0` first.
- The Note editor is CodeMirror: `fill` appends to the body instead of replacing it. Click it, press `Meta+a`, then `keyboard inserttext`.
- `Delete note` and `Add to thread` write only after the five-second `Undo` offer: wait for `Undo` to be gone before a reload or a D1 check.
