# Tasks

A signed-in user adds Tasks to an open thread, focuses at most one, and completes them. Tasks are peers listed in capture order. Focusing one tints its row in place. Completing a Task removes it and writes a `Task done` entry to the thread's activity log. Completing the Focused Task leaves the thread unfocused. A thread with Tasks sits under `No date` → `Ready to move` on the Dashboard, and its card can complete a Task too.

Status: proven on 640e3ba (thread pane at 1440px and drawer at 1024px: `task-add`, `task-focus`, `task-complete`, `task-persist`; Dashboard card: `task-complete-card`). Editing and removing a Task, and unfocusing, are not yet driven.

## Sub-features

- `task-add` adds a Task from the `Add a task` field at the foot of the list.
- `task-focus` focuses a Task with its `Focus this task` radio. Pressing the filled radio (`Unfocus this task`) unfocuses it.
- `task-complete` completes a Task with its `Complete task` button and logs `Task done` in the `Activity` tab.
- `task-complete-card` completes a Task from its thread's Dashboard card.
- `task-persist` keeps Tasks and focus after a reload and in D1 (`threads.moves_json`, `threads.focused_move_id`, `activity_log_entries` with `type = 'move_completed'`).
- `task-edit` edits a Task's text by clicking it (not yet driven).
- `task-remove` removes a Task with `Remove task` without logging it (not yet driven).

## How to get to it (user POV)

- Open a thread (create one per [Create a thread](./create-thread.md), or click its title on the Dashboard). The `Thread attention` region under the header holds the Tasks.
- On the Dashboard, a thread under `No date` → `Ready to move` shows `Complete “<task>”` on its card.

## Driving it with agent-browser

Preconditions:

- Signed in, with a thread open in the pane at 1440×900 (`complementary "<title>"`).
- Pick unique Task text, for example `Verify task A 1727461234` and `Verify task B 1727461234`.

Every row has buttons with the same names (`Focus this task`, `Remove task`, `Complete task`), so `find role button --name` is ambiguous with two or more Tasks. Scope to a row with XPath on the Task's text, which renders as a button:

```bash
bun run verify browser -- click 'xpath=//ul[@aria-label="Tasks"]/li[.//button[normalize-space()="Verify task B 1727461234"]]//button[@aria-label="Focus this task"]'
```

- **Before shot.** Run `bun run verify shot tasks-before`. The `Thread attention` region shows `TASKS`, `Set follow-up date`, and `textbox "Add a task"`, and no `list "Tasks"`.
- **Add.** Run `bun run verify browser -- find label "Add a task" fill "Verify task A 1727461234"`, then `bun run verify browser -- press Enter`. Repeat for Task B. `bun run verify browser -- snapshot -s 'section[aria-label="Thread attention"]'` shows `TASKS 2`, the hint `Focus one when you know it, or leave them all unfocused.`, and `list "Tasks"` with one `listitem` per Task in capture order, each with `Focus this task`, a button named after the Task, `Remove task`, and `Complete task`.
- **Focus.** Click Task B's `Focus this task` with the XPath above. Its radio becomes `Unfocus this task` and its `li` gets `data-focused`.
- **Persist add and focus.** Run `bun run verify browser -- reload`, then `bun run verify browser -- wait --fn "[...document.querySelectorAll('ul[aria-label=\"Tasks\"] > li[data-focused]')].some(li => li.textContent.includes('Verify task B 1727461234'))"`. It prints `true`. Run `bun run verify shot tasks-focused`. Run `bun run verify d1 "SELECT title, moves_json, focused_move_id FROM threads WHERE title = '<thread title>'"`. `moves_json` lists both Tasks as `{id, text}` in capture order, and `focused_move_id` is Task B's `id`.
- **Complete.** Click Task B's `Complete task` (same XPath, `@aria-label="Complete task"`). The row disappears. Run `bun run verify browser -- find role tab click --name "Activity" --exact`, then `bun run verify browser -- wait --text "Verify task B 1727461234"`. The activity log reads `Task done` / `Completed Verify task B 1727461234`, which the client refetches from the server after the command.
- **Persist complete.** Run `bun run verify browser -- reload`, then `bun run verify browser -- wait 'ul[aria-label="Tasks"]'` before touching the pane. Run `bun run verify browser -- eval "[...document.querySelectorAll('ul[aria-label=\"Tasks\"] > li')].map(li => li.textContent + (li.dataset.focused ? ' [focused]' : ''))"`. It lists only Task A, unfocused. Run `bun run verify d1 "SELECT t.moves_json, t.focused_move_id, l.type, l.content FROM threads t LEFT JOIN activity_log_entries l ON l.thread_id = t.id WHERE t.title = '<thread title>'"`. `moves_json` holds only Task A, `focused_move_id` is null, and the log row is `move_completed` with content `Completed "Verify task B 1727461234"`.
- **Proof.** `bun run verify shot tasks-after` after the reload.
- **Drawer.** Run `bun run verify browser -- set viewport 1024 768`, `reload`, and `wait 'ul[aria-label="Tasks"]'`. The pane is now `dialog "<title>"`. Add, focus, and complete with the same commands. Completing an unfocused Task leaves the focus where it was. Run `set viewport 1440 900` afterwards.
- **Dashboard card (`task-complete-card`).** Run `bun run verify open /`, then `bun run verify browser -- wait --text "Ready to move"`. The thread's card lists `link "<title>"`, `Set follow-up date`, and `Complete “<task>”` (curly quotes). Run `bun run verify browser -- find role button click --name "Complete “Verify task C 1727461234”" --exact`, reload, and read D1 as above. With its last Task completed the thread tasks back to `No date` → `Open`.

## Gotchas

- Task commands show no success toast. Only a failure toasts (`This Thread changed elsewhere. It has been refreshed.` or `Could not save that change. Please try again.`). The server confirmation is the reload plus `verify d1`, and for completion the `Task done` activity entry.
- Tasks render optimistically and queue per thread: each command carries the revision the one before it brought back. Several quick actions are safe, but prove the end state after a reload.
- `Add a task` also commits on blur, and `Escape` clears the draft (from source, not yet driven).
- After a reload the pane renders after the Dashboard. Wait for `ul[aria-label="Tasks"]` before clicking a tab, or `find role tab` fails with `No element found`.
- The accessibility snapshot shows neither `aria-pressed` nor the activity log's text. Read focus from the radio's name or `li[data-focused]`, and the log with `eval "document.querySelector('[aria-label=\"Activity log\"]').innerText"`.
- On the Dashboard card, `Complete “<task>”` names the Focused Task, even when it is not first in the list.
- A thread whose last Task is completed has `moves_json` null, not `[]`.
- At 1280px and up, `Remove task` is transparent until the row is hovered or focused. In the drawer it is always visible (from source).
