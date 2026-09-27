# Create a thread

A signed-in user creates a thread with a title and an optional area. After the server confirms, a `Thread created` toast shows and the thread opens in place at `?thread=<slug>`, with a pane for its summary, next move, Up Next list, notes, and activity log.

Status: mapped from source, not yet driven.

## Sub-features

- `thread-open` opens the `New thread` dialog from the dock or the command palette.
- `thread-create` saves a title and opens the thread pane.
- `thread-area` assigns an area from the dialog's area picker.
- `thread-persist` keeps the thread after a reload and in D1 (`threads`).

## How to get to it (user POV)

- Choose `New thread` in the dock.
- Open the command palette with `Meta+k`, then choose `New thread` under `Create`.

## Driving it with agent-browser

Preconditions:

- Signed in on the Dashboard.
- Pick a unique title, for example `Verify thread 1727461234`.

- **Open dialog.** Run `bun run verify browser -- find role button click --name "New thread" --exact`. A dialog titled `New thread` shows a `Title` field (placeholder `e.g. Renew passport, File Q4 taxes`), an area picker, and `Cancel` and `Create thread` buttons.
- **Create.** Run `bun run verify browser -- find label "Title" fill "Verify thread 1727461234"`, then `bun run verify browser -- find role button click --name "Create thread" --exact`, then `bun run verify browser -- wait --text "Thread created"`. The URL gains `?thread=<slug>` and the pane shows `Close thread`, `Thread actions`, and `Thread summary`.
- **Persist.** Run `bun run verify browser -- reload` and confirm the pane still shows the title. Run `bun run verify d1 "SELECT title, slug FROM threads"`.
- **Proof.** `bun run verify shot thread-after` after the reload.

## Gotchas

- Not yet driven. Verify each handle against a fresh `snapshot -i` and update this file and its `Status` line when it is proven.
- The thread renders optimistically before the server answers. Prove it with the toast plus a reload or `verify d1`.
- The column names in `SELECT title, slug FROM threads` come from source. Check `apps/api/migrations` if the query fails.
