# Create a thread

A signed-in user creates a thread with a title and an optional area. After the server confirms, a `Thread created` toast shows and the thread opens in place at `?thread=<slug>`, with a pane for its summary, Tasks, notes, and activity log. Adding and completing Tasks is its own feature, [Tasks](./tasks.md).

Status: proven in #382 (c55a9eb) from the dock with an area, Enter to submit, and the command palette (`thread-open`, `thread-create`, `thread-area`, `thread-persist`).

## Sub-features

- `thread-open` opens the `New thread` dialog from the header (the bottom bar below `lg`) or the command palette.
- `thread-create` saves a title and opens the thread pane.
- `thread-area` assigns an area from the dialog's area picker, creating the area there if none exists.
- `thread-persist` keeps the thread after a reload.

## How to get to it (user POV)

- Choose `New thread` in the header (`banner "Vita OS"`) from `lg`, or in the bottom `navigation "Actions"` below it. An open Thread pane covers the header's button at 1280px and up: close it first, or use the palette.
- Open the command palette with `ControlOrMeta+k`, then choose `New thread` under `Create`: `page.getByRole("option", { name: "New thread" })`.

## Driving it

No spec of its own: `createThread(page, title)` in `apps/e2e/src/app.ts` drives the dialog at the start of every Thread spec. Use `stamp` in the title and the area name.

- **Open dialog.** `page.getByRole("button", { name: "New thread", exact: true }).click()`. A framed `dialog "New thread"` (the same surface as `New note`) shows a borderless `textbox "Thread title"` (placeholder `What's going on?`), a `Close` button, an area picker `button "Add area"`, and a disabled `Create`. `Create` enables once the title has text. There is no `Cancel`; `Close` and `Escape` are the exits.
- **Create.** `page.getByLabel("Thread title").fill(title)`, `shot("thread-before")`, then click `button "Create"` (`exact: true`) or press Enter in the title, and expect `page.getByText("Thread created")`. The URL becomes `/?thread=<title-slug>-<8 hex>`. The pane is `complementary "<title>"` with a `Thread controls` group (`Thread actions`, `Close thread`), a `Thread header` banner (`Add area`, `Open`, a button named after the title, `Add a summary…`), the `Thread attention` region (`MOVES` label, `Set follow-up date` button, `Add a task` textbox), and `Notes` and `Activity` tabs.
- **Area (optional, `thread-area`).** Before `Create`, click `button "Add area"`, then `dialog.getByRole("combobox").fill(area)`. With no areas the `listbox "Suggestions"` says `Type a name to create an area.`; after typing it offers `option "Create “<area>”"` (curly quotes). Click it with `exact: true`. The picker button becomes `Area: <area>`, and after `Create` the pane header shows `button "Area: <area>"`.
- **Persist.** `page.reload()`, then `getByRole("complementary", { name: title })` is visible and the URL keeps `?thread=<slug>`. With an area, its header has `button "Area: <area>"`; without one, `button "Add area"`. `shot("thread-after")`.

## Gotchas

- The thread renders optimistically before the server answers. Prove it with the toast plus a reload.
- There is no visible `Thread summary` element on a new thread. `Thread summary` is only the accessible name of the summary editor, which opens after clicking `Add a summary…`.
- `threads.area_id` is nullable since migration `0004_area_labels.sql`. A thread without an area has `area_id` null.
- Choosing `Create “…”` in the area picker writes the `areas` row right away, before `Create` is clicked. Cancelling the dialog afterwards leaves the area behind.
- The area picker's combobox has no accessible name. Reach it with `dialog.getByRole("combobox")`, which works because the dialog has only one.
- Pressing `Escape` with the area picker open closes the picker, not the dialog.
- On the Dashboard the new thread's row under `No date` → `Open` is `link "<title>"` and, once it has a Task, `Set date`. `getByText(title)` after a reload can match that row before the pane renders, so the pane proof is `getByRole("complementary", { name: title })`.
