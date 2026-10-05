# Create a thread

A signed-in user creates a thread with a title and an optional area. After the server confirms, a `Thread created` toast shows and the thread opens in place at `?thread=<slug>`, with a pane for its summary, Tasks, follow-up, notes, and activity log. Adding and completing Tasks is its own feature, [Tasks](./tasks.md).

Status: proven on a6805f5 plus the framed New thread dialog change (dock entry point with an area, Enter to submit, and the command palette entry point: `thread-open`, `thread-create`, `thread-area`, `thread-persist`).

## Sub-features

- `thread-open` opens the `New thread` dialog from the dock or the command palette.
- `thread-create` saves a title and opens the thread pane.
- `thread-area` assigns an area from the dialog's area picker, creating the area there if none exists.
- `thread-persist` keeps the thread after a reload and in D1 (`threads`).

## How to get to it (user POV)

- Choose `New thread` in the dock (`nav[aria-label="Primary"]`).
- Open the command palette with `Meta+k`, then choose `New thread` under `Create`: `bun run verify browser -- press Meta+k`, then `bun run verify browser -- find role option click --name "New thread"`.

## Driving it with agent-browser

Preconditions:

- Signed in on the Dashboard.
- Pick a unique title, for example `Verify thread 1727461234`, and for `thread-area` a unique area name, for example `Verify area 1727461234`.

- **Open dialog.** Run `bun run verify browser -- find role button click --name "New thread" --exact`. A framed `dialog "New thread"` (the same surface as `New note`) shows a borderless `Thread title` textbox (placeholder `What's going on?`), a `Close` button, an area picker button `Add area`, and a disabled `Create` button. `Create` enables once the title has text. There is no `Cancel`; `Close` and `Escape` are the exits.
- **Enter title.** Run `bun run verify browser -- find label "Thread title" fill "Verify thread 1727461234"`, then `bun run verify shot thread-before`.
- **Create.** Run `bun run verify browser -- find role button click --name "Create" --exact` (or `find label "Thread title" click` then `press Enter`), then `bun run verify browser -- wait --text "Thread created"`, then `bun run verify shot thread-toast`. The wait prints `Thread created`. The URL becomes `/?thread=<title-slug>-<8 hex>` (for example `?thread=verify-thread-1727461234-59d3f6b0`). The pane is `complementary "<title>"` with a `Thread controls` group (`Thread actions`, `Close thread`), a `Thread header` banner (`Add area`, `Open`, a button named after the title, `Add a summary…`), the `Thread attention` region (`MOVES` label, `Set follow-up date` button, `Add a task` textbox), and `Notes` and `Activity` tabs.
- **Area (optional, `thread-area`).** Before clicking `Create`: run `bun run verify browser -- find role button click --name "Add area" --exact`, then `bun run verify browser -- find role combobox fill "Verify area 1727461234"`. With no areas the listbox `Suggestions` says `Type a name to create an area.`; after typing it offers `option "Create “Verify area 1727461234”"` (curly quotes). Run `bun run verify browser -- find role option click --name "Create “Verify area 1727461234”" --exact`. The picker button becomes `Area: Verify area 1727461234`. Then create as above. The pane header shows `button "Area: Verify area 1727461234"`.
- **Persist.** Run `bun run verify browser -- reload`, then `bun run verify browser -- wait --text "Verify thread 1727461234"`. The URL keeps `?thread=<slug>` and the pane reopens. Run `bun run verify d1 "SELECT t.title, t.slug, t.state, a.name AS area FROM threads t LEFT JOIN areas a ON a.id = t.area_id"`. A row has the title, the slug from the URL, `state` `open`, and `area` null or the chosen area name.
- **Proof.** `bun run verify shot thread-after` after the reload. The after snapshot lists `complementary "<title>"` with `Close thread` and `textbox "Add a task"`, and for `thread-area` `button "Area: <area>"` in its header.

## Gotchas

- The thread renders optimistically before the server answers. Prove it with the toast plus a reload or `verify d1`.
- There is no visible `Thread summary` element on a new thread. `Thread summary` is only the accessible name of the summary editor, which opens after clicking `Add a summary…`.
- `threads.area_id` is nullable since migration `0004_area_labels.sql`. A thread without an area has `area_id` null.
- Choosing `Create “…”` in the area picker writes the `areas` row right away, before `Create` is clicked. Cancelling the dialog afterwards leaves the area behind.
- The area picker's combobox has no accessible name. Reach it with `find role combobox`, which works because the dialog has only one.
- Pressing `Escape` with the area picker open closes the picker, not the dialog.
- On the Dashboard the new thread's row under `No date` → `Open` is `link "<title>"` and `Set follow-up date`. `wait --text "<title>"` after a reload can match that row before the pane renders, so the pane proof is `complementary "<title>"` in the after snapshot.
