# Tasks

In a Thread's pane or drawer, `Add a task` adds a Task on Enter and stays ready for the next one. Each Task row can be dated, completed, completed with a note, or removed. A dated Task places its Thread on the Dashboard under that day; completing the last Task returns the Thread to `Open` and logs `Completed <Task>` in Activity.

## Entry points and variants

- Thread side pane (1280px and wider) and drawer (1024 to 1279px: `set viewport 1024 768`, open `/`, and New thread opens the new Thread in the drawer)
- A No date line on the Dashboard: its `Set date` dates that Thread's only Task
- Row commands: `Complete task`, `Set date` / `Change date`, `Complete with a note`, `Remove task`

## Preconditions

- A Thread created through New thread, open in its pane or drawer.

## Checks

1. Typing `Pay the fee <stamp>` in `Add a task` and pressing Enter sends `POST /v1/threads/<id>/tasks` → `200`; right after, focus is still on `Add a task` and its value is `""`. Same in the drawer (wait for `[data-vaul-drawer] [aria-label='Add a task']` and for the drawer's animations to end first).
2. The Task shows as `button "Pay the fee <stamp>"` in `region "Thread attention"`, and on the Dashboard the Thread is under `main section[aria-label='Ready to move']` in No date.
3. Picking tomorrow in the row's `Set date` sends `PUT …/tasks/<task id>/date` → `200`. The row then has a date button `Change date: Tomorrow`, and the picker button is renamed `Change date`. The Dashboard shows the Thread under `Tomorrow`, its line reading `Task: | Pay the fee <stamp> · <thread title>` (from the line's `li`).
4. The stored date is local midnight of tomorrow:
   `SELECT moves_json FROM threads WHERE user_id = (SELECT id FROM user WHERE email = '<email>')` → `"date":<new Date(y, m, d + 1).getTime()>`
5. `Complete task` sends `POST …/tasks/<task id>/complete` → `200`; the row is gone, focus lands on `Add a task`, and the Thread's Dashboard line moves from `Tomorrow` to `Open` in No date. (The pane's `Open` chip is the Thread's state and reads `Open` throughout.)
6. `find role tab click --name "Activity"`; the open tab panel (`eval "document.querySelector('[role=tabpanel]:not([hidden])').innerText"`, lines joined with ` | `) reads `Today | Task done: | Completed Pay the fee <stamp> | <h:mm AM/PM>`, where `Task done:` is screen-reader text. `moves_json` is `null` once the last Task is completed.
7. On the Dashboard, a No date line for a Thread with one undated Task: its `Set date` → tomorrow sends `PUT …/tasks/<that task id>/date` → `200`, and the line moves under `Tomorrow`.

## Traps

- On a row the picker stays open after a day is picked; `press Escape`, then `wait --fn "!document.querySelector('[data-when-picker]')"` before the next snapshot, or it prints the calendar sliding out.
- The `PUT …/date` line can show no status for a moment: read the request log again before reloading.
