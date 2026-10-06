# Resolved Threads

The palette starts with open work. Its History chip (named Resolved before ADR 0031) switches to history: a `Resolved threads` group with all resolved Threads, newest resolution first, without typing, then an `Archived notes` group covered in [Notes on the Dashboard](./notes-on-the-dashboard.md). Search filters that history by title or Area. Clicking the chip again returns to open work and clears the query. Selecting a result opens the existing Thread pane, where Thread actions → Reopen returns it to open work without restoring discarded Tasks, focus, or a Follow-up date.

Status: proven on c03470d plus the resolved chip change, at 1440×900 and 1024×768 (`resolved-chip`, `resolved-search`, `resolved-order`, `resolved-open`, `resolved-reopen`). Evidence is under `.verify/evidence/resolved-chip/2026-10-02T04-28-49-117Z/`. Re-driven on 446055e after the rename: the History chip lists `Resolved threads` beside `Archived notes` at 1440×900, a search for `passport` matches in both groups, and choosing a Resolved Thread at 1024×768 opens `dialog "<title>"` with the Dashboard's `?show=notes` filter kept. The step-by-step recipe below was written for the Resolved chip; its names are updated but its full sequence was not re-run.

## Sub-features

- `resolved-chip`: default open work, empty history, switching to all history and back, clearing the query, and keyboard activation without accidentally selecting a Thread.
- `resolved-search`: title matching stays within history; unmatched search shows no results, including the hidden identifier prefix `resolved`.
- `resolved-order`: newer resolution precedes older resolution; reopening refreshes history.
- `resolved-open`: keyboard selection in the side pane and click selection in the drawer open the existing Thread surface over the Dashboard.
- `resolved-reopen`: Reopen persists after reload and D1 confirms cleared Tasks and focus. The prior run in `.verify/evidence/resolved-palette/2026-10-02T02-57-20-325Z/` also proved discarded Follow-up dates do not return.
- Area search and filter preservation are covered by automated tests. The Area-filter entry point was not driven; the Notes filter was (see Status).

## How to get to it (user POV)

Open the palette with Command K or the dock's Jump anywhere button, then click History. Browse all resolved Threads or search their titles and Areas. Select a Thread, then choose Thread actions → Reopen. Click the chip again to return to open work. Opening the palette afresh starts with open work.

## Driving it with agent-browser

Preconditions: run `bun run verify up --instance resolved-chip --api-port 18787 --web-port 15173`, then `bun run verify signin --instance resolved-chip`. Use this instance on every command. Choose fresh titles on subsequent runs. All browser arguments below run as `bun run verify browser --instance resolved-chip -- <arguments>`, and screenshots as `bun run verify shot <label> --instance resolved-chip`.

1. Open with `press Meta+k`, capture `palette-default-empty`, then `find role button click --name History --exact`. Confirm `wait --text "No resolved threads or archived notes yet."`, capture `palette-history-empty`, and dismiss with `press Escape`.
2. Create `Chip history older c03470d`: `find role button click --name "New thread" --exact`, `find label "Thread title" fill "Chip history older c03470d"`, `find role button click --name Create --exact`, and `wait --text "Thread created"`. Resolve with `find role button click --name "Thread actions" --exact`, `find role menuitem click --name Resolve --exact`, capture `resolve-older-before`, then `find role button click --name "Resolve thread" --exact` and `wait --text "Thread resolved"`. Resolution closes the pane.
3. Create `Chip history newer c03470d` the same way. Add a Task with `find label "Add a task" fill "Discarded chip task"`, `press Enter`, then `find role button click --name "Focus this task" --exact`. Reload, `wait --text "Discarded chip task"`, capture `newer-attention-before`, and read `bun run verify d1 "SELECT title, state, moves_json, focused_move_id, follow_up FROM threads" --instance resolved-chip` to confirm saved attention. Resolve as above.
4. Create `Chip history open c03470d` and leave it open. Close with `find role button click --name "Close thread" --exact`. Open with `press Meta+k`, capture `palette-default`, then `find role combobox fill "Chip history"` and capture `palette-open-search`: only open work matches. Click History and capture `palette-resolved`: the search is empty, with newer then older history under `Resolved threads`, and no actions or open Threads.
5. `find role combobox fill older`, capture `palette-history-search`, then `find role combobox fill resolved` and `wait --text "No results found."`; capture `palette-history-unmatched`. Click History and capture `palette-return`: the normal palette has an empty query.
6. Repeat History → query `resolved` → History to return. Run `press Enter`, then `press Enter` to activate the chip. Capture `palette-keyboard-resolved`: newest history is selected and the palette stays open. Run `press Enter` again and capture `resolved-pane`: `complementary "Chip history newer c03470d"`, with Resolved and no attention controls. Reopen via Thread actions → Reopen, confirm `wait --text "Thread reopened"`, reload, and `wait 'input[aria-label="Add a task"]'`. Capture `reopened-pane` and read D1 as above: open, with null Tasks, focus, and Follow-up date.
7. Close the pane, `set viewport 1024 768`, then `find role button click --name "Jump anywhere, Command K" --exact`; capture `drawer-palette-default`. Click History, capture `drawer-palette-resolved`, search `older`, and capture `drawer-history-search`. Select with `find role option click --name "Chip history older c03470d" --exact` and capture `resolved-drawer`: `dialog "Chip history older c03470d"`. Reopen, confirm the toast, reload, wait for the Task input, and capture `reopened-drawer`. Confirm persisted open state with D1.
8. Close the drawer, open with `press Meta+k`, and capture `palette-after-reopen`: both reopened Threads now appear under open work. Click History, `wait --text "No resolved threads or archived notes yet."`, and capture `history-after-reopen`. Clean up with `bun run verify down --purge --instance resolved-chip`.

## Gotchas

- Wait for the Task input by selector after reload; its accessible label is not visible text, so `wait --text "Add a task"` times out.
- Switching palette modes replaces the command list and input to reset selection. Reacquire browser refs after each switch.
- History starts fetching only when the chip is selected. An empty history shows its own message; an unmatched search shows No results found.
- Resolution order uses the latest owned `state_change` Activity Log entry whose `new_value` is `resolved`, not Thread creation time or later activity. Legacy Threads without this entry appear last; API tests cover this case.
