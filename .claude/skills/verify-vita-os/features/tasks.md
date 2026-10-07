# Tasks

A signed-in user adds Tasks to an open thread, focuses at most one, dates them, and completes them. Tasks are peers; undated ones are listed in capture order. Focusing one tints its row in place. Completing a Task removes it and writes a `Task done` entry to the thread's activity log. Completing the Focused Task leaves the thread unfocused. A Task may carry a date, with an optional time, set from its row's calendar button or from the Dashboard card (ADR 0032): a thread is placed by its soonest dated Task, in `Now`, `This week` or `Later`. A thread whose Tasks are all undated sits under `No date` → `Ready to move`, and its card can complete a Task too. Setting a date writes no Activity Log entry. In Thread detail a Task can also be completed with a note: `Complete with a note` beside `Complete task` opens a note line under the row, and completing from it captures the text as one Thread Note in the same command. Dashboard cards complete in one click with no note.

Status: completing with a note proven on a7c756f (`flows/complete-with-note.flow`: a one-off Task in the 1440×900 side pane, a repeating Task in the 1024×768 drawer with Escape closing only the note line, and a card still completing in one click; one Thread Note and one `move_completed` each in D1). The `unavailable` path (answer lost after the service committed) is covered by application tests, not driven. Repeating Tasks proven on 48f807c (`flows/repeating-tasks.flow`: the row picker's Repeat section at 1440×900 and in the 1024×768 drawer, Daily with a time, complete and skip from the row and from the card, weekly moving the date, one Late card for a missed run). Dated Tasks proven on 3815ae6 (`flows/dated-tasks.flow` at 1440×900: date with time from a row, placement and the card's lead, reschedule from the card token, two Tasks on one day reading `2 tasks today`, a card with no single Task adding a `Follow up` Task, Thread detail order with the `No date` divider, a dated Note added to a Thread). Earlier proof: 7fef45b (thread pane at 1440px and drawer at 1024px: `task-add`, `task-focus`, `task-complete`, `task-persist`; Dashboard card: `task-complete-card`). Editing and removing a Task, and unfocusing, are not yet driven.

## Sub-features

- `task-add` adds a Task from the `Add a task` field at the foot of the list.
- `task-focus` focuses a Task with its `Focus this task` radio. Pressing the filled radio (`Unfocus this task`) unfocuses it.
- `task-complete` completes a Task with its `Complete task` button and logs `Task done` in the `Activity` tab.
- `task-complete-card` completes a Task from its thread's Dashboard card.
- `task-date` sets, changes and clears a Task's date from its row's calendar button (`Set date`, `Change date: <date>`, `Clear date`); dated rows show the date token and list first, soonest first, above a quiet `No date` divider and the undated Tasks. Stored as `date` inside `threads.moves_json` entries.
- `task-date-card` sets or changes the date of the Task the card shows from the card's `Set date` / `Change date` control; on a card with no single Task (no Tasks, or several undated with none focused) a date adds a Task named `Follow up` with it.
- `task-slot` leads a time-column card with the dated Task that placed the thread (even beside a focused one); two dated Tasks on the same day read `2 tasks today` and pick neither.
- `task-repeat` sets, changes and clears a dated Task's Repeat in its date picker: the `group "Repeat"` under the time holds `Never`, `Daily`, `Every N days` (with `Fewer days` / `More days`) and `Weekly` (one toggle per weekday, named `Sunday`…`Saturday`), disabled until the Task has a day, plus a one-line summary (`Every day at 9 PM, from Tue, Oct 6.`; weekly says `The date moves to <day>, the first chosen day.`). The choice is saved when the picker closes (`Done`, Escape, outside click) or before a newly picked day. A row's picker stays open after a day is picked; a card's closes. Stored as `repeat` (`{kind: "days", every}` or `{kind: "weekly", weekdays}`) inside the `threads.moves_json` entry. No Activity Log entry.
- `task-repeat-glyph` marks a repeating Task with a repeat glyph before its text: on a row `img "Repeats daily"` (or `Repeats every 3 days`, `Repeats weekly on Mon, Thu`), on a card an svg with `data-slot="repeat-glyph"` and the slot's screen-reader text `Task, repeats daily:`.
- `task-skip` moves a repeating Task to its next occurrence without an Activity Log entry: the row's `Skip task` button, or the card's `Skip “<task>” to its next date`. One-off Tasks have neither.
- `task-complete-repeating` completes a repeating Task: it stays, moves to its next occurrence (missed ones collapse to the first not before today), and writes one `move_completed`. A missed run is one card under `Now` → `Late`.
- `task-complete-note` completes a Task with a note from Thread detail only: the row's `Complete with a note` button (`aria-expanded`) opens `group "Complete “<task>” with a note"` under the row, with `textbox "Note"` (focused), `Cancel` and `Complete`. Enter completes, Shift+Enter is a new line, Escape or `Cancel` closes it and drops the text. A one-off Task is removed and a repeating one moves to its next occurrence; the text becomes one open `thread_notes` row and the log gets one `move_completed`. The Note stamps last activity (`threads.last_activity_content` is null). If the service cannot be reached the line comes back with the text and `Couldn’t reach Vita OS. Your note is kept here; complete again to try once more.`
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

- **Before shot.** Run `bun run verify shot tasks-before`. The `Thread attention` region shows `TASKS` and `textbox "Add a task"`, and no `list "Tasks"`.
- **Add.** Run `bun run verify browser -- find label "Add a task" fill "Verify task A 1727461234"`, then `bun run verify browser -- press Enter`. Repeat for Task B. `bun run verify browser -- snapshot -s 'section[aria-label="Thread attention"]'` shows `TASKS 2`, the hint `Focus one when you know it, or leave them all unfocused.`, and `list "Tasks"` with one `listitem` per Task in capture order, each with `Focus this task`, a button named after the Task, `Remove task`, and `Complete task`.
- **Focus.** Click Task B's `Focus this task` with the XPath above. Its radio becomes `Unfocus this task` and its `li` gets `data-focused`.
- **Persist add and focus.** Run `bun run verify browser -- reload`, then `bun run verify browser -- wait --fn "[...document.querySelectorAll('ul[aria-label=\"Tasks\"] > li[data-focused]')].some(li => li.textContent.includes('Verify task B 1727461234'))"`. It prints `true`. Run `bun run verify shot tasks-focused`. Run `bun run verify d1 "SELECT title, moves_json, focused_move_id FROM threads WHERE title = '<thread title>'"`. `moves_json` lists both Tasks as `{id, text}` in capture order, and `focused_move_id` is Task B's `id`.
- **Complete.** Click Task B's `Complete task` (same XPath, `@aria-label="Complete task"`). The row disappears. Run `bun run verify browser -- find role tab click --name "Activity" --exact`, then `bun run verify browser -- wait --text "Verify task B 1727461234"`. The activity log reads `Task done` / `Completed Verify task B 1727461234`, which the client refetches from the server after the command.
- **Persist complete.** Run `bun run verify browser -- reload`, then `bun run verify browser -- wait 'ul[aria-label="Tasks"]'` before touching the pane. Run `bun run verify browser -- eval "[...document.querySelectorAll('ul[aria-label=\"Tasks\"] > li')].map(li => li.textContent + (li.dataset.focused ? ' [focused]' : ''))"`. It lists only Task A, unfocused. Run `bun run verify d1 "SELECT t.moves_json, t.focused_move_id, l.type, l.content FROM threads t LEFT JOIN activity_log_entries l ON l.thread_id = t.id WHERE t.title = '<thread title>'"`. `moves_json` holds only Task A, `focused_move_id` is null, and the log row is `move_completed` with content `Completed "Verify task B 1727461234"`.
- **Proof.** `bun run verify shot tasks-after` after the reload.
- **Drawer.** Run `bun run verify browser -- set viewport 1024 768`, `reload`, and `wait 'ul[aria-label="Tasks"]'`. The pane is now `dialog "<title>"`. Add, focus, and complete with the same commands. Completing an unfocused Task leaves the focus where it was. Run `set viewport 1440 900` afterwards.
- **Dashboard card (`task-complete-card`).** Run `bun run verify open /`, then `bun run verify browser -- wait --text "Ready to move"`. The thread's card lists `link "<title>"`, `Set date`, and `Complete “<task>”` (curly quotes). Run `bun run verify browser -- find role button click --name "Complete “Verify task C 1727461234”" --exact`, reload, and read D1 as above. With its last Task completed the thread tasks back to `No date` → `Open`.

- **Dated Tasks.** Run `bun run verify run .claude/skills/verify-vita-os/flows/dated-tasks.flow`. It sets a date with a time on a Task row, follows the thread to its This week heading, reschedules from the card token, puts two Tasks on today, dates a card with no single Task, and adds a dated Note to a thread, asserting each in the DOM and in D1.

- **Repeating Tasks.** Run `bun run verify run .claude/skills/verify-vita-os/flows/repeating-tasks.flow`. It sets Daily at 9 PM from a row's picker, completes it (tomorrow, one `move_completed`), skips it (no new entry), switches to Weekly two days later (the date moves there), dates a second Task three days back through the picker with Daily (one `Late` card), skips and completes it from the card, and sets Every 3 days in the drawer, asserting each after a reload and in D1.

- **Complete with a note.** Run `bun run verify run .claude/skills/verify-vita-os/flows/complete-with-note.flow`. It completes a one-off Task with a note in the side pane (the row leaves, the Note shows under `Notes`), a daily Task with a note in the drawer (it moves to tomorrow) after checking that Escape closes the note line and not the drawer, and a Dashboard card in one click (no note line, no Thread Note), asserting each after a reload and in D1.

## Gotchas

- A row's date picker stays open after a day is picked. Close it with `Done` or `press Escape` before clicking another row; a `Thread created` toast can cover `Done` at the bottom right.
- The weekday toggles are named by full weekday; pick them with `eval` on `[role=group][aria-label=Repeat] button[aria-label="<Weekday>"]` when the day is computed from today.
- The picker accepts past days, so a missed repeating Task is set up through the UI, never by writing D1.
- A web app built before #404 completes a repeating Task without a `timeZone`; the API answers 400 `validation` / `Invalid time zone`.

- Chrome's time input ignores `fill` and `keyboard type`: click `Add time`, `press 3`, `press 3`, `press 0`, `press p` (3:30 PM), then click a day. Day cells are `td[data-day]` (today has `data-today`, the picked day `data-selected`), (the `button`s inside carry `M/D/YYYY`). `flows/dated-tasks.flow` picks `td[data-day='<ISO date>'] button` for today plus N days, clicking `Go to the Next Month` first when that day is not in the month shown, so it runs on any date.
- `Set date` exists twice while a thread is open: once on the pane's rows and once on the card behind it. Scope by XPath (`//ul[@aria-label="Tasks"]/li[...]` for rows, `//li[.//a[normalize-space()="<title>"]]` for the card).
- The `No date` divider is drawn in capitals, so read it with `innerText.toLowerCase()`.
- Task commands show no success toast. Only a failure toasts (`This Thread changed elsewhere. It has been refreshed.` or `Could not save that change. Please try again.`). The server confirmation is the reload plus `verify d1`, and for completion the `Task done` activity entry.
- Tasks render optimistically and queue per thread: each command carries the revision the one before it brought back. Several quick actions are safe, but prove the end state after a reload.
- `Add a task` also commits on blur, and `Escape` clears the draft (from source, not yet driven).
- After a reload the pane renders after the Dashboard. Wait for `ul[aria-label="Tasks"]` before clicking a tab, or `find role tab` fails with `No element found`.
- The accessibility snapshot shows neither `aria-pressed` nor the activity log's text. Read focus from the radio's name or `li[data-focused]`, and the log with `eval "document.querySelector('[aria-label=\"Activity log\"]').innerText"`.
- On the Dashboard card, `Complete “<task>”` names the Focused Task, even when it is not first in the list.
- A thread whose last Task is completed has `moves_json` null, not `[]`.
- The note line's textarea takes `fill '[data-slot=completion-note] textarea' "<text>"` and `press Enter`: Enter there is its capture path and closes the line at once, so it does not flood. At 1024 wide the `Thread created` toast covers the drawer's picker `Done` until it leaves; wait for `li.cn-toast` to go.
- At 1280px and up, `Remove task` is transparent until the row is hovered or focused. In the drawer it is always visible (from source).
