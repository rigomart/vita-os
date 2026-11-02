# Activity Log

A Thread's `Activity` tab, beside `Notes`: one sentence per entry under day headings, newest first. Capturing a Thread Note adds a line `Note added: <the Note's first line>`, read from the Note as it is now; choosing the line opens the Note view. After the Note is deleted the line stays as `Note added`, with no words and no button. A Note written with `Complete with a note` gets no line of its own: the completion's line carries it under the sentence and opens it. Adding a Task adds a line `Added <task>`, and the Tasks added on one day share one line, `Added 3 Tasks: <a> · <b> · <c>`, in the order they were added. Removing a Task without completing it adds `Removed <task>`. Editing a Task's text, its date or its Repeat adds nothing, and lines already written keep the text the Task had then. The log ends with `Started` at the Thread's creation, or `Started from a note` for a Thread started from a Standalone Note: read from the Thread, never stored. Completions of one Task with no other line between them share one line, `Completed <task> 14 times`, under a heading naming the stretch's first and last days when it spans several; a completion written with a note stands on its own line.

## Entry points and variants

- The side pane (1280px and wider) and the drawer (1024 to 1279px)
- Where a Thread Note comes from: `Write a note…`, `Complete with a note` on a Task row, and a Standalone Note's `Add to thread…` or `New thread from note`
- Where a Task comes from: `Add a task`, or a dated Standalone Note's `Add to thread…` or `New thread from note`
- A log longer than one page (20 entries), read through `Show earlier`

## Preconditions

- A signed-in throwaway user with an Open Thread (New thread), open in its pane or drawer.

## Checks

1. Capture a Thread Note `Called the office <stamp>` (`POST /v1/threads/<id>/notes` → `201`). On the `Activity` tab the open panel (`eval "document.querySelector('[role=tabpanel]:not([hidden])').innerText"`) reads `Today | Note: | Note added: Called the office <stamp> | <h:mm AM/PM>`, where `Note:` is screen-reader text, and the line is `button "Note: Note added: Called the office <stamp>"`. Choosing it opens the Note view on that Note: `[aria-label='Note body']` reads `Called the office <stamp>`.
2. Edit the Note's first line in the Note view and Save (`PATCH /v1/thread-notes/<id>/body` → `200`): the line reads the new first line, also after a reload. The Thread still has exactly one entry for the Note, with no words stored:
   `SELECT type, content, previous_value, new_value, thread_note_id FROM activity_log_entries WHERE thread_id = '<thread id>'` → one row `note_added`, `Note added`, `null`, `null`, `<thread note id>`.
3. `Delete note` (from the line's Note view or the Notes tab), and wait out `Undo` (`DELETE /v1/thread-notes/<id>` → `200`): the line reads `Note: | Note added`, and the Activity log has no `button`. Deleted from the line's Note view, focus lands on the Activity `tabpanel`.
4. `Complete with a note` on a Task, note `Clerk confirmed <stamp>` (`POST …/tasks/<task id>/complete` → `200`): the panel shows one line `Task done: | Completed <task> | <time>` with `Clerk confirmed <stamp>` under it, and no `Note added` line for that Note. In D1 the `move_completed` row's `thread_note_id` is the new Thread Note's ID. Choosing the line opens that Note.
5. `Add to thread…` or `New thread from note` on a Standalone Note `<text>`: after the Undo offer (`POST /v1/notes/<id>/add-to-thread` → `200`, or `POST /v1/notes/<id>/new-thread` → `201`), that Thread's panel has `Note added: <text>` at the time it was added.

6. Add the Tasks `Send the form`, `Ask about the deadline` and `Book a slot` (`POST /v1/threads/<id>/tasks` → `200` each). The panel reads `Today | Tasks added: | Added 3 Tasks: Send the form · Ask about the deadline · Book a slot | <time>`, with one `li`, also after a reload. D1 has three `task_added` rows, `content` `Added "<task>"` and `new_value` `<task>`: the line folds only when it is read.
7. `Remove task` on `Book a slot` (`DELETE /v1/threads/<id>/tasks/<task id>` → `200`): a line `Task removed: | Removed Book a slot | <time>` appears above it.
8. Change `Send the form`'s date twice (`PUT …/tasks/<task id>/date` → `200`), then edit its text (`PATCH …/tasks/<task id>` → `200`): the panel is unchanged, and the user's `activity_log_entries` count is the same as before.
9. Resolve the Thread (`Thread actions`, `Resolve`, `Resolve thread`; `PATCH /v1/threads/<id>` → `200`). The pane closes; open the Thread again with `?thread=<slug>`. The panel reads `Resolved the Thread`, `Dropped 2 open Tasks` with both Tasks under it, then the lines from 6 and 7, and no new `Removed` line. D1 has one `state_change` row, `Resolved thread — discarded tasks: "<a>", "<b>"`, and no new `task_removed`.
10. `Add to thread…` on a Standalone Note with a date, into an Open Thread: after the Undo offer, that Thread's panel has `Note added: <text>`, and the Task the date adds, `<first line>`, is named in the day's `Added` line. `threads.last_activity_content` stays `null`.

11. Any Thread, including one created before this change: the last line is `Started: | Started | <time of the Thread's creation>`. No row in `activity_log_entries` stands for it.
12. `New thread from note` on a Standalone Note `<text>` (`POST /v1/notes/<id>/new-thread` → `201`): the new Thread's panel reads `Today | Note: | Note added: <text> | <time> | Started: | Started from a note | <time>`. In D1 that Thread's `note_added` row has `content` `Note added, starting the Thread`; a Note captured with `Write a note…` stores `Note added`.
13. A Task with `Every day`: `Complete task` 14 times (`POST …/complete` → `200` each). The panel reads `Task done: | Completed <task> 14 times | <time>` with one `li` for them, also after a reload, and D1 has 14 `move_completed` rows.
14. On a daily Task, `Complete task` 7 times, `Complete with a note` once, then 7 more: the panel reads `Completed <task> 7 times`, then `Completed <task> | <time>` with the note under it, then `Completed <task> 7 times`.
15. 24 completions of one daily Task: the first page reads `Completed <task> 20 times` and `Show earlier`, with no `Started`. `Show earlier` (`GET …/activity?limit=20&cursor=…` → `200`) turns it into `Completed <task> 24 times`, followed by `Added <task>` and `Started`.

The server stamps each completion with the current time, so the UI cannot spread a stretch over several days. The design lab's `Long activity` scenario (`Biscuit's eye drops`) shows one: stretches under headings such as `Oct 18 – Oct 24`, either side of the evening with a note.

Tasks open before migration `0011` get no `Added` line: Tasks carry no creation time.

Notes written before migration `0010` are backfilled, one `Note added` line each at the Note's creation time, and a Note sharing a completion entry's timestamp is carried by that completion. No UI path writes a pre-`0010` row, so `apps/api/test/migrations.integration.test.ts` proves it; to see it on screen, create Notes on an instance before `0010` is applied, then run `bun run verify up` again on the branch that adds it.

## Traps

- Open the `Activity` tab only after the pane or drawer stops sliding; a click during the slide is lost.
- The tab highlight slides; a screenshot right after switching can show it still on `Notes`. Wait for `document.getAnimations().length === 0` first.
- The Note editor is CodeMirror: `fill` appends to the body instead of replacing it. Click it, press `Meta+a`, then `keyboard inserttext`.
- `Delete note` and `Add to thread` write only after the five-second `Undo` offer: wait for `Undo` to be gone before a reload or a D1 check.
- Completing a repeating Task many times in a loop can hang the agent-browser session: if a command times out, `agent-browser close`, open the app again (the sign-in survives) and check D1 for what was written.
- A Task's text box is a `textarea`, and `press Meta+a` does not select inside it under agent-browser, so `fill` and `inserttext` append. Clear it with `Backspace` presses, check `value` is `""`, then `keyboard inserttext`.
