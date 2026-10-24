# Tasks

In a Thread's pane or drawer, `Add a task` adds a Task on Enter and stays ready for the next one. Each Task row can be dated, completed, completed with a note, or removed. A dated Task places its Thread on the Dashboard under that day; completing the last Task returns the Thread to `Open` and logs `Completed <Task>` in Activity.

## Entry points and variants

- Thread side pane (1280px and wider) and drawer (1024 to 1279px)
- A No date line on the Dashboard: its `Set date` dates that Thread's only Task
- Row commands: `Complete task`, `Set date` / `Change date`, `Complete with a note`, `Remove task`

## Preconditions

- A Thread created through New thread, open in its pane or drawer (at 1024 to 1279px New thread opens the new Thread in the drawer).

## Checks

1. Typing `Pay the fee <stamp>` in `Add a task` and pressing Enter sends `POST /v1/threads/<id>/tasks` → `200`; right after, focus is still on `Add a task` and its value is `""`. Same in the drawer.
2. The Task shows as `button "Pay the fee <stamp>"` in `region "Thread attention"`, and on the Dashboard the Thread is under `Ready to move` in No date (read the groups as in [Dashboard](dashboard.md)).
3. The row's `Set date` opens the picker: `get count "[data-when-picker]"` is `1`. Beside the calendar it reads `No date`, with a `Time` field, `9 AM` `12 PM` `3 PM` `6 PM` and the Repeat words `Daily` `Weekdays` `Weekly` `Biweekly` `Monthly` `Custom`, all disabled while the Task has no date. Picking tomorrow (`Saturday, October 24th, 2026` when today is `Today, Friday, October 23rd, 2026`) sends `PUT …/tasks/<task id>/date` → `200`, and the picker stays open: it reads `Sat, Oct 24` with `Clear date`, the day is renamed `Saturday, October 24th, 2026, selected`, and the time and Repeat controls are enabled. The row gains a date button `Change date: Tomorrow`, and the picker's own button is renamed `Change date`. Escape closes only the picker (count `0`, pane still open) and leaves focus on `Change date`. The Dashboard shows the Thread under `Tomorrow`, its line reading `Task: | Pay the fee <stamp> · <thread title>` (from the line's `li`).
4. The stored date is local midnight of tomorrow:
   `SELECT moves_json FROM threads WHERE user_id = (SELECT id FROM user WHERE email = '<email>')` → `"date":<new Date(y, m, d + 1).getTime()>`
5. `Complete task` sends `POST …/tasks/<task id>/complete` → `200`; the row is gone, focus lands on `Add a task`, and the Thread's Dashboard line moves from `Tomorrow` to `Open` in No date. (The pane's `Open` chip is the Thread's state and reads `Open` throughout.)
6. On the `Activity` tab, the open tab panel (`eval "document.querySelector('[role=tabpanel]:not([hidden])').innerText"`, lines joined with ` | `) reads `Today | Task done: | Completed Pay the fee <stamp> | <h:mm AM/PM>`, where `Task done:` is screen-reader text. `moves_json` is `null` once the last Task is completed.
7. On the Dashboard, a No date line for a Thread with one undated Task: its `Set date` opens the picker (`get count "[data-when-picker]"` is `1`), and picking tomorrow sends `PUT …/tasks/<that task id>/date` → `200` and closes the picker by itself (count `0`). The line moves under `Tomorrow`, reading `Task: | <task> · <thread title>`, and its button is renamed `Change date`.

## Traps

- The drawer slides in, and `Add a task` is in it before it stops: wait for `[data-vaul-drawer] [aria-label='Add a task']` and for `getAnimations().length === 0` on `[data-vaul-drawer]` before typing in it.
- `[data-when-picker]` is in the page only while the picker is open, so a wait for it to go passes at once if it never opened. Confirm it first (`get count "[data-when-picker]"` is `1`), then `press Escape` and `wait --fn "!document.querySelector('[data-when-picker]')"`; it leaves about 0.1 s after Escape as a popover and 0.5 s as a phone drawer. On a Dashboard line a picked day closes it within 0.1 s, before any wait starts: read the count instead.
- Below 768px the picker is a drawer of its own, so `[data-vaul-drawer]` matches it as well as the Thread's drawer, and `querySelector('[data-vaul-drawer]')` returns the Thread's. It shows the When as its title (`Sat, Oct 24`), the calendar, rows `Time None` and `Repeat Never` that open in place, and `Clear date`.
- The `PUT …/date` line can show no status for a moment: read the request log again before reloading.
- The Activity panel can be empty right after its tab opens (seen once): wait for `--text "Completed <task>"` before reading it.
