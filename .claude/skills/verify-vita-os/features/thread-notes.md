# Thread Notes

A signed-in user writes a Note inside a Thread, edits it in the shared Note view, marks it done or open, and deletes it. Thread Notes have no independent Follow-up date.

Status: proven on 84ce18f plus the Effect v4 API working-tree migration (desktop create, edit, complete, reopen, delete, completed-page read, reload and D1 persistence).

## Sub-features

- `thread-note-create` captures a body from Write a note….
- `thread-note-edit` saves a changed body through Write.
- `thread-note-done` moves a Note to Completed; opening Completed reads its paginated history.
- `thread-note-open` returns a completed Note to the open list.
- `thread-note-delete` removes a Note after the Undo period expires.

## How to get to it (user POV)

Open a Thread on the Dashboard and select Notes. Choose Write a note… to capture, or select an existing Note preview to open its Read/Write view. Completed expands the history.

## Driving it with agent-browser

Use an isolated instance and a Thread created through the real New thread dialog. These commands were driven with `--instance effect`; substitute unique text on later runs.

1. Choose `find role button click --name "Write a note…" --exact`, then `find label "Note body" fill "Effect Thread Note verification 2026-10-02"`. Capture a before screenshot, choose `find role button click --name Add --exact`, and `wait --text "Note added"`. Reload and confirm the body in `verify d1 "SELECT body, state FROM thread_notes"`.
2. Select `find role button click --name "Open note: Effect Thread Note verification 2026-10-02" --exact`, choose `find role tab click --name Write --exact`, fill Note body with new text, choose Save, and `wait --text "Note saved"`.
3. In the Note view choose `find role button click --name "Mark done" --exact` and `wait --text "Note completed"`. Close and reload, then select `find role button click --name "Completed 1" --exact`. Its visible text has no separating space, so use the button's accessible name instead of `wait --text "Completed 1"`. Capture the history and confirm `state = 'done'` in D1.
4. Choose `find role button click --name "Mark note open" --exact`, `wait --text "Note reopened"`, and reload. The Note returns to the open list.
5. Open the Note, choose More actions → Delete note, and `wait --text "Note deleted"`. Wait with `wait --fn 'document.body.innerText.includes("Undo") === false'` before reloading. Capture the empty list and confirm `verify d1 "SELECT body, state FROM thread_notes"` returns no row for the deleted Note.

Evidence from this run is in `.verify/evidence/effect/2026-10-02T23-44-52-650Z/`, including `effect-thread-note-before`, `effect-thread-note-after`, `effect-thread-note-done`, and `effect-thread-note-removed`.

## Gotchas

- Delete is delayed during the Undo period. Reloading before that period ends cancels the queued deletion; an optimistic empty list does not prove removal.
- The Note preview is `Open note: <plain-text body>`. Reacquire controls after reload.
- The shared Note view exposes Mark done; the completed list exposes Mark note open.
- Desktop API paths were driven here. Drawer and phone layouts were not re-driven for this API-only migration.
