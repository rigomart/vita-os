# Resolved Threads

The palette starts with open work. Its Resolved chip switches to all resolved Threads, newest resolution first, without typing. Search filters that history by title or Area. Clicking the chip again returns to open work and clears the query. Selecting a result opens the existing Thread pane, where Thread actions → Reopen returns it to open work without restoring discarded Moves, focus, or a Follow-up date.

Status: proven on c03470d plus the resolved chip change, at 1440×900 and 1024×768 (`resolved-chip`, `resolved-search`, `resolved-order`, `resolved-open`, `resolved-reopen`). Evidence is under `.verify/evidence/resolved-chip/2026-10-02T04-28-49-117Z/`.

## Sub-features

- `resolved-chip`: default open work, empty history, switching to all history and back, clearing the query, and keyboard activation without accidentally selecting a Thread.
- `resolved-search`: title matching stays within history; unmatched search shows no results, including the hidden identifier prefix `resolved`.
- `resolved-order`: newer resolution precedes older resolution; reopening refreshes history.
- `resolved-open`: keyboard selection in the side pane and click selection in the drawer open the existing Thread surface over the Dashboard.
- `resolved-reopen`: Reopen persists after reload and D1 confirms cleared Moves and focus. The prior run in `.verify/evidence/resolved-palette/2026-10-02T02-57-20-325Z/` also proved discarded Follow-up dates do not return.
- Area search and filter preservation are covered by automated tests. Area-filter and Notes-surface entry points were not driven in these runs.

## How to get to it (user POV)

Open the palette with Command K or the dock's Jump anywhere button, then click Resolved. Browse all resolved Threads or search their titles and Areas. Select a Thread, then choose Thread actions → Reopen. Click the chip again to return to open work. Opening the palette afresh starts with open work.

## Driving it with agent-browser

Preconditions: run `bun run verify up --instance resolved-chip --api-port 18787 --web-port 15173`, then `bun run verify signin --instance resolved-chip`. Use this instance on every command. Choose fresh titles on subsequent runs. All browser arguments below run as `bun run verify browser --instance resolved-chip -- <arguments>`, and screenshots as `bun run verify shot <label> --instance resolved-chip`.

1. Open with `press Meta+k`, capture `palette-default-empty`, then `find role button click --name Resolved --exact`. Confirm `wait --text "No resolved threads yet."`, capture `palette-history-empty`, and dismiss with `press Escape`.
2. Create `Chip history older c03470d`: `find role button click --name "New thread" --exact`, `find label "Thread title" fill "Chip history older c03470d"`, `find role button click --name Create --exact`, and `wait --text "Thread created"`. Resolve with `find role button click --name "Thread actions" --exact`, `find role menuitem click --name Resolve --exact`, capture `resolve-older-before`, then `find role button click --name "Resolve thread" --exact` and `wait --text "Thread resolved"`. Resolution closes the pane.
3. Create `Chip history newer c03470d` the same way. Add a Move with `find label "Add a move" fill "Discarded chip move"`, `press Enter`, then `find role button click --name "Focus this move" --exact`. Reload, `wait --text "Discarded chip move"`, capture `newer-attention-before`, and read `bun run verify d1 "SELECT title, state, moves_json, focused_move_id, follow_up FROM threads" --instance resolved-chip` to confirm saved attention. Resolve as above.
4. Create `Chip history open c03470d` and leave it open. Close with `find role button click --name "Close thread" --exact`. Open with `press Meta+k`, capture `palette-default`, then `find role combobox fill "Chip history"` and capture `palette-open-search`: only open work matches. Click Resolved and capture `palette-resolved`: the search is empty, with newer then older history, and no actions or open Threads.
5. `find role combobox fill older`, capture `palette-history-search`, then `find role combobox fill resolved` and `wait --text "No results found."`; capture `palette-history-unmatched`. Click Resolved and capture `palette-return`: the normal palette has an empty query.
6. Repeat Resolved → query `resolved` → Resolved to return. Run `press Tab`, then `press Enter` to activate the chip. Capture `palette-keyboard-resolved`: newest history is selected and the palette stays open. Run `press Enter` again and capture `resolved-pane`: `complementary "Chip history newer c03470d"`, with Resolved and no attention controls. Reopen via Thread actions → Reopen, confirm `wait --text "Thread reopened"`, reload, and `wait 'input[aria-label="Add a move"]'`. Capture `reopened-pane` and read D1 as above: open, with null Moves, focus, and Follow-up date.
7. Close the pane, `set viewport 1024 768`, then `find role button click --name "Jump anywhere, Command K" --exact`; capture `drawer-palette-default`. Click Resolved, capture `drawer-palette-resolved`, search `older`, and capture `drawer-history-search`. Select with `find role option click --name "Chip history older c03470d" --exact` and capture `resolved-drawer`: `dialog "Chip history older c03470d"`. Reopen, confirm the toast, reload, wait for the Move input, and capture `reopened-drawer`. Confirm persisted open state with D1.
8. Close the drawer, open with `press Meta+k`, and capture `palette-after-reopen`: both reopened Threads now appear under open work. Click Resolved, `wait --text "No resolved threads yet."`, and capture `history-after-reopen`. Clean up with `bun run verify down --purge --instance resolved-chip`.

## Gotchas

- Wait for the Move input by selector after reload; its accessible label is not visible text, so `wait --text "Add a move"` times out.
- Switching palette modes replaces the command list and input to reset selection. Reacquire browser refs after each switch.
- Resolved history starts fetching only when the chip is selected. An empty history shows its own message; an unmatched search shows No results found.
- Resolution order uses the latest owned `state_change` Activity Log entry whose `new_value` is `resolved`, not Thread creation time or later activity. Legacy Threads without this entry appear last; API tests cover this case.
