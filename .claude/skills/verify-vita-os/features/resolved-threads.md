# Resolved Threads

The palette starts with open work. Its History chip (named Resolved before ADR 0031) switches to history: a `Resolved threads` group with all resolved Threads, newest resolution first, without typing, then an `Archived notes` group covered in [Notes on the Dashboard](./notes-on-the-dashboard.md). Search filters that history by title or Area. Clicking the chip again returns to open work and clears the query. Selecting a result opens the existing Thread pane, where Thread actions → Reopen returns it to open work without restoring discarded Tasks, focus, or a Follow-up date.

Status: proven on b2bd91a (#418) by `history.flow` at 1440×900 and 1024×768: empty history, newest first, title search, no match, search cleared on mode switch, and Reopen from the pane and the drawer. `resolve-reopen.flow` covers discarded Tasks. Not driven: keyboard chip activation, Area search, and the full step-by-step recipe below since the History rename.

## Sub-features

- `resolved-chip`: default open work, empty history, switching to all history and back, clearing the query, and keyboard activation without accidentally selecting a Thread.
- `resolved-search`: title matching stays within history; unmatched search shows no results, including the hidden identifier prefix `resolved`.
- `resolved-order`: newer resolution precedes older resolution; reopening refreshes history.
- `resolved-open`: keyboard selection in the side pane and click selection in the drawer open the existing Thread surface over the Dashboard.
- `resolved-reopen`: Reopen persists after reload, and the reloaded Thread shows no Tasks and no focus. The prior run in `.verify/evidence/resolved-palette/2026-10-02T02-57-20-325Z/` also proved discarded Follow-up dates do not return.
- Area search and filter preservation are covered by automated tests. The Area-filter entry point was not driven; the Notes filter was (see Status).

## How to get to it (user POV)

Open the palette with Command K or the header's `Search, Command K` field (the bottom bar's below `lg`), then click History. Browse all resolved Threads or search their titles and Areas. Select a Thread, then choose Thread actions → Reopen. Click the chip again to return to open work. Opening the palette afresh starts with open work.

## Driving it

Spec: `apps/e2e/tests/history.spec.ts`, at 1440×900 and 1024×768. It reloads after the resolutions (History lists both, newest first) and after each reopening (the Thread offers `Add a task` again). The steps below drive the rest by hand, in a scratch spec; use `stamp` in every title.

1. `ControlOrMeta+k`, `shot("palette-default-empty")`, then click `button "History"` (`exact: true`). Expect `No resolved threads or archived notes yet.`, `shot("palette-history-empty")`, and press Escape.
2. Create `Chip history older <stamp>` with `createThread`. Resolve it: `button "Thread actions"` (`exact: true`) → `menuitem "Resolve"` (`exact: true`), `shot("resolve-older-before")`, then `button "Resolve thread"` (`exact: true`) and expect `Thread resolved`. Resolution closes the pane.
3. Create `Chip history newer <stamp>` the same way. `addTask(pane, "Discarded chip task")`, then click its `Focus this task`. Reload, expect the Task, `shot("newer-attention-before")`, and expect `button "Unfocus this task"`: the focus was saved. Resolve as above.
4. Create `Chip history open <stamp>` and leave it open. Close it with `button "Close thread"`. `ControlOrMeta+k`, `shot("palette-default")`, then `page.getByRole("combobox").fill("Chip history")` and `shot("palette-open-search")`: only open work matches. Click History and `shot("palette-resolved")`: the search is empty, with newer then older history under `Resolved threads`, and no actions or open Threads.
5. Fill `older`, `shot("palette-history-search")`, then fill `resolved` and expect `No results found.`; `shot("palette-history-unmatched")`. Click History and `shot("palette-return")`: the normal palette has an empty query.
6. Repeat History → query `resolved` → History to return. Press Enter, then Enter again to activate the chip. `shot("palette-keyboard-resolved")`: newest history is selected and the palette stays open. Press Enter again and `shot("resolved-pane")`: `complementary "Chip history newer <stamp>"`, with Resolved and no attention controls. Reopen through Thread actions → Reopen, expect `Thread reopened`, reload, and expect `textbox "Add a task"`. `shot("reopened-pane")`, then the `Discarded chip task` button is hidden: open, with no Tasks and no focus.
7. Close the pane, set 1024×768, then click `button "Search, Command K"` (`exact: true`); `shot("drawer-palette-default")`. Click History, `shot("drawer-palette-resolved")`, search `older`, and `shot("drawer-history-search")`. Click `option "Chip history older <stamp>"` (`exact: true`) and `shot("resolved-drawer")`: `dialog "Chip history older <stamp>"`. Reopen, expect the toast, reload, wait for the Task input, and `shot("reopened-drawer")`. Confirm the open state in D1 (`SELECT state FROM threads WHERE user_id = '${account.id}'`).
8. Close the drawer, `ControlOrMeta+k`, and `shot("palette-after-reopen")`: both reopened Threads now appear under open work. Click History, expect `No resolved threads or archived notes yet.`, and `shot("history-after-reopen")`.

## Gotchas

- After a reload, wait for the Task input with `getByRole("textbox", { name: "Add a task" })`; its label is not visible text, so `getByText("Add a task")` times out.
- Switching palette modes replaces the command list and input to reset selection.
- History starts fetching only when the chip is selected. An empty history shows its own message; an unmatched search shows No results found.
- Resolution order uses the latest owned `state_change` Activity Log entry whose `new_value` is `resolved`, not Thread creation time or later activity. Legacy Threads without this entry appear last; API tests cover this case.
