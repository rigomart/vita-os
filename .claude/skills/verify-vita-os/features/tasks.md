# Tasks

A signed-in user adds Tasks to an open thread, focuses at most one, dates them, and completes them. Tasks are peers, listed in one list in capture order, dated or not (ADR 0039). Focusing one tints its row in place. Completing a Task removes it and writes a `Task done` entry to the thread's activity log. Completing the Focused Task leaves the thread unfocused. A Task may carry a date, with an optional time, set from its row's date or calendar command, or from the Dashboard card (ADR 0032): a thread is placed by its soonest dated Task, under its day, week or month on the Dashboard's list. A thread whose Tasks are all undated sits under `No date` → `Ready to move`, and its card can complete a Task too. Setting a date writes no Activity Log entry. In Thread detail a Task can also be completed with a note: `Complete with a note` among the row's commands opens a note line under the row, and completing from it captures the text as one Thread Note in the same command. Dashboard cards complete in one click with no note.

Status: proven on 4bac4d4 plus the change that added ADR 0039, with `tasks`, `dashboard-tasks`, `dated-tasks`, `repeating-tasks`, `complete-with-note`, `thread-drawer`, and `thread-edit-tasks` flows. Covers the desktop pane, 1024×768 drawer, Dashboard completion, Repeat/Skip, completion with a note, and independent edits. The dated flow uses the already-open destination pane during source-only conversion Undo, captures an unrelated Task, and verifies that only the converted Task is completed. Failure recovery is covered by application tests, not driven. Unfocusing, editing (Tab commit) and removing are driven by `tasks`. The row layout (two-line text, the command bar on hover with tooltips, the growing editor, the drawer's always-visible bar) was driven once by hand; that flow was not kept.

## Sub-features

- `task-add` adds a Task from the `Add a task` field at the foot of the list.
- `task-focus` focuses a Task with its `Focus this task` command, a toggle (`aria-pressed`). Pressing it again (`Unfocus this task`) unfocuses it.
- `task-complete` completes a Task with its `Complete task` button and logs `Task done` in the `Activity` tab.
- `task-complete-card` completes a Task from its thread's Dashboard card.
- `task-date` sets, changes and clears a Task's date from its row: the date token under the text (`Change date: <when>`) or the calendar command (`Set date` / `Change date`), then `Clear date`. `<when>` is `Today`, `Tomorrow`, `Yesterday`, a short weekday up to six days out (`Tue`), else `Oct 22`, with ` · 9 PM` when timed. A date never moves the row; there is no `No date` divider. Stored as `date` inside `threads.moves_json` entries.
- `task-date-card` sets or changes the date of the Task the card shows from the card's `Set date` / `Change date` control; on a card with no single Task (no Tasks, or several undated with none focused) a date adds a Task named `Follow up` with it.
- `task-slot` leads a card on the dated list with the dated Task that placed the thread (even beside a focused one); two dated Tasks on the same day read `2 tasks today` and pick neither.
- `task-repeat` sets, changes and clears a dated Task's Repeat in its date picker: its `Repeat, <rhythm>` row (`Repeat, Never`, `Repeat, Daily`, `Repeat, Mon, Thu`), disabled until the Task has a day, opens presets saved in one click: `Doesn't repeat`, `Every day`, `Every weekday`, `Every <the date's weekday>`, `Every 2 weeks`, each naming the day it moves the date to when it does (`Every weekday, from Mon`). `Custom…` opens the `group "Custom repeat"`: `Every N days` (with `Fewer days` / `More days`) or `Weekly` (one toggle per weekday, named `Sunday`…`Saturday`), a one-line summary (`Every day at 9 PM, from Tue, Oct 6.`; weekly says `The date moves to <day>, the first chosen day.`), and `Save repeat`. Every choice saves as it is made (ADR 0040). A row's picker stays open on its menu after any choice; a card's closes. Stored as `repeat` (`{kind: "days", every}` or `{kind: "weekly", weekdays}`) inside the `threads.moves_json` entry. No Activity Log entry.
- `task-repeat-glyph` marks a repeating Task with a repeat glyph: on a row inside its date token, `img "Repeats daily"` (or `Repeats every 3 days`, `Repeats weekly on Mon, Thu`), on a card before its text, an svg with `data-slot="repeat-glyph"` and the slot's screen-reader text `Task, repeats daily:`.
- `task-skip` moves a repeating Task to its next occurrence without an Activity Log entry: the row's `Skip task` button, or the card's `Skip “<task>” to its next date`. One-off Tasks have neither.
- `task-complete-repeating` completes a repeating Task: it stays, moves to its next occurrence (missed ones collapse to the first not before today), and writes one `move_completed`. A missed run is one card under `Now` → `Late`.
- `task-complete-note` completes a Task with a note from Thread detail only: the row's `Complete with a note` button (`aria-expanded`) opens `group "Complete “<task>” with a note"` under the row, with `textbox "Note"` (focused), `Cancel` and `Complete`. Enter completes, Shift+Enter is a new line, Escape anywhere in the line (the field or its buttons) or `Cancel` closes it and drops the text; a blank line completes plainly. While a complete or skip of the Task is on its way, its `Complete with a note` button is disabled. A one-off Task is removed and a repeating one moves to its next occurrence; the text becomes one open `thread_notes` row and the log gets one `move_completed`. The Note stamps last activity (`threads.last_activity_content` is null). Each attempt mints a fresh Note ID, and once sent the text leaves the line: reopening it starts empty. On any failure both changes roll back and the Thread's open Notes are read again. If this attempt's Note is there it counts as completed, quietly, and the Notes list shows it. Otherwise an error toast, which outlives the Thread pane, carries the reason (`Couldn’t reach Vita OS. The task was not completed and your note was not saved.`, `… Your note was not saved.` after a refusal, or `Couldn’t confirm whether the task was completed and your note saved. …` when the Notes cannot be read), the text as its description, and a `Copy note` action; the person pastes it to try again. The toast stays until `Copy note` succeeds or it is closed; if copying fails it stays and reads `Couldn’t copy the note. Select its text below to copy it.` The lookup only reads the Notes; the Notes list itself refreshes once every overlapping command has settled.
- `task-persist` keeps Tasks and focus after a reload; a completion writes one `move_completed` Activity Log entry.
- `task-edit` edits a Task's text by clicking it: the text shows up to two lines (`line-clamp-2`), and editing opens a `textarea` named `Task` that grows to show all of it. Enter or blur saves, a line break becomes a space, Escape puts the text back. Commit with `press Tab` in flows.
- `task-remove` removes a Task with `Remove task` without logging it.

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
- **Add.** Run `bun run verify browser -- find label "Add a task" fill "Verify task A 1727461234"`, then `bun run verify browser -- press Enter`. Repeat for Task B. `bun run verify browser -- snapshot -s 'section[aria-label="Thread attention"]'` shows `TASKS 2` and `list "Tasks"` with one `listitem` per Task in capture order, each with `Complete task`, a button named after the Task, and a `toolbar "Task commands"` holding `Skip task` (repeating only), `Set date` / `Change date`, `Focus this task`, `Complete with a note` and `Remove task`, each named by a tooltip.
- **Focus.** Click Task B's `Focus this task` with the XPath above. Its command becomes `Unfocus this task` and its `li` gets `data-focused`.
- **Persist add and focus.** Run `bun run verify browser -- reload`, then `bun run verify see button "Unfocus this task"`. Only the focused row offers it; `snapshot -i -s '[data-slot=thread-detail-pane]'` shows it in Task B's row, with Task A above in capture order. Run `bun run verify shot tasks-focused`.
- **Complete.** Click Task B's `Complete task` (same XPath, `@aria-label="Complete task"`). The row disappears. Run `bun run verify browser -- find role tab click --name "Activity" --exact`, then `bun run verify browser -- wait --text "Verify task B 1727461234"`. The activity log reads `Task done` / `Completed Verify task B 1727461234`, which the client refetches from the server after the command.
- **Persist complete.** Run `bun run verify browser -- reload`, then `see button "Verify task A 1727461234"` before touching the pane, `gone button "Verify task B 1727461234"`, and `gone button "Unfocus this task"`: only Task A is left, unfocused. The Activity tab still reads `Completed Verify task B 1727461234` after the reload.
- **Proof.** `bun run verify shot tasks-after` after the reload.
- **Drawer.** Run `bun run verify browser -- set viewport 1024 768`, `reload`, and `see dialog "<title>"`. Add, focus, and complete with the same commands. Completing an unfocused Task leaves the focus where it was. Run `set viewport 1440 900` afterwards.
- **Dashboard card (`task-complete-card`).** Run `bun run verify open /`, then `bun run verify browser -- wait --text "Ready to move"`. The thread's card lists `link "<title>"`, `Set date`, and `Complete “<task>”` (curly quotes). Run `bun run verify browser -- find role button click --name "Complete “Verify task C 1727461234”" --exact`, reload, and `gone button "Complete “Verify task C 1727461234”"`. With its last Task completed the thread tasks back to `No date` → `Open`.

- **Dated Tasks.** Run `bun run verify run .claude/skills/verify-vita-os/flows/dated-tasks.flow`. It sets a date with a time on a Task row, follows the thread to its day's heading on the list, reschedules from the card token, puts two Tasks on today, dates a card with no single Task, and adds a dated Note to a thread, asserting each in the DOM and in D1.

- **Repeating Tasks.** Run `bun run verify run .claude/skills/verify-vita-os/flows/repeating-tasks.flow`. It sets Every day at 9 PM from a row's picker, completes it (tomorrow, one `move_completed`), skips it (no new entry), switches to a custom Weekly two days later (the date moves there), dates a second Task three days back through the picker with Every day (one `Late` card), skips and completes it from the card, and sets a custom Every 3 days in the drawer, asserting each after a reload and in D1.

- **Complete with a note.** Run `bun run verify run .claude/skills/verify-vita-os/flows/complete-with-note.flow`. It completes a one-off Task with a note in the side pane (the row leaves, the Note shows under `Notes`), a daily Task with a note in the drawer (it moves to tomorrow) after checking that Escape closes the note line and not the drawer, and a Dashboard card in one click (no note line, no Thread Note), asserting each after a reload and in D1.

## Gotchas

- A row's date picker stays open after a day is picked. Close it with `Done` or `press Escape` before clicking another row; a `Thread created` toast can cover `Done` at the bottom right.
- The weekday toggles are named by full weekday; pick them with `eval` on `[role=group][aria-label=Repeat] button[aria-label="<Weekday>"]` when the day is computed from today.
- The picker accepts past days, so a missed repeating Task is set up through the UI, never by writing D1.
- A web app built before #404 completes a repeating Task without a `timeZone`; the API answers 400 `validation` / `Invalid time zone`.

- Pick the day first, then the time: `Other time`, `keyboard type "330p"`, Enter (3:30 PM). Escape closes the picker alone, in the pane and in the drawer, where a popup opened from the drawer renders inside it so its fields take focus. The calendar is behind `Pick a date…`. Day cells are `td[data-day]` (today has `data-today`, the picked day `data-selected`), (the `button`s inside carry `M/D/YYYY`). `flows/dated-tasks.flow` picks `td[data-day='<ISO date>'] button` for today plus N days, clicking `Go to the Next Month` first when that day is not in the month shown, so it runs on any date.
- `Set date` exists twice while a thread is open: once on the pane's rows and once on the card behind it. Scope by XPath (`//ul[@aria-label="Tasks"]/li[...]` for rows, `//li[.//a[normalize-space()="<title>"]]` for the card).
- `starts-with(@aria-label, "Change date")` matches both the date token and the calendar command on a dated row; use `Change date:` for the token.
- Task commands show no success toast. Only a failure toasts (`This Thread changed elsewhere. It has been refreshed.` or `Could not save that change. Please try again.`). The server confirmation is the reload, and for completion the `Task done` activity entry.
- Tasks render optimistically and settle independently. Controls disable while their own action is pending. Complete and Skip carry the displayed occurrence date; commands apply to current stored state. Prove the end state after a reload.
- `Add a task` also commits on blur, and `Escape` clears the draft (from source, not yet driven).
- After a reload the pane renders after the Dashboard. Wait for `ul[aria-label="Tasks"]` before clicking a tab, or `find role tab` fails with `No element found`.
- The accessibility snapshot shows neither `aria-pressed` nor the activity log's text. Read focus from the Focus command's name or `li[data-focused]`, and the log with `eval "document.querySelector('[aria-label=\"Activity log\"]').innerText"`.
- On the Dashboard card, `Complete “<task>”` names the Focused Task, even when it is not first in the list.
- A thread whose last Task is completed has `moves_json` null, not `[]`.
- The note line's textarea takes `fill '[data-slot=completion-note] textarea' "<text>"` and `press Enter`: Enter there is its capture path and closes the line at once, so it does not flood. At 1024 wide the `Thread created` toast covers the drawer's picker `Done` until it leaves; wait for `li.cn-toast` to go.
- At 1280px and up, the `Task commands` toolbar is transparent until the row is hovered or focused, in room kept for it. In the drawer it is always visible.
- Closing a row's date picker returns focus to its trigger, which opens that command's tooltip; hovering another command then shows two tooltips briefly.
