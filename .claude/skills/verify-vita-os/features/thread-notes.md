# Thread Notes

A signed-in user writes a Note inside a Thread, edits it in the shared Note view, archives or unarchives it, and deletes it. Thread Notes have no independent Follow-up date. Archived Thread Notes stay in their Thread under `Archived notes`, never in the palette's History (ADR 0031).

Status: proven in #391 (84ce18f): create, edit, delete, reload, and D1 persistence; Archive and Unarchive re-driven in #394 (bb54a79) at 1440×900.

## Sub-features

- `thread-note-create` captures a body from Write a note….
- `thread-note-edit` saves a changed body edited in place in the Note view.
- `thread-note-archive` moves a Note to `Archived notes`; opening it reads its paginated history.
- `thread-note-unarchive` returns an Archived Note to the open list.
- `thread-note-delete` removes a Note after the Undo period expires.

## How to get to it (user POV)

Open a Thread on the Dashboard and select Notes. Choose Write a note… to capture, or select an existing Note preview to open its Note view. `Archived notes` expands the history.

## Driving it with agent-browser

Use an isolated instance and a Thread created through the real New thread dialog. These commands were driven with `--instance effect`; substitute unique text on later runs.

1. Choose `find role button click --name "Write a note…" --exact`, then `find label "Note body" fill "Effect Thread Note verification 2026-10-02"`. Capture a before screenshot, choose `find role button click --name Add --exact`, and `wait --text "Note added"`. Reload and `see button "Open note: Effect Thread Note verification 2026-10-02"`.
2. Select `find role button click --name "Open note: Effect Thread Note verification 2026-10-02" --exact`, click into `Note body`, press `Meta+a` and `keyboard type` the new text (`fill` inserts at the caret instead of replacing), choose Save, and `wait --text "Note saved"`.
3. In the Note view choose `find role button click --name "Archive" --exact` (or the card's `Archive note`) and `wait --text "Note archived"`. Close and reload, then select `find role button click --name "Archived notes 1" --exact`. Its visible text has no separating space, so use the button's accessible name instead of `wait --text`. Capture the history: the Note is listed there, so it was archived, not deleted (D1 stores Archived as `state = 'done'`).
4. Choose `find role button click --name "Unarchive note" --exact` (or open the Note and choose `Unarchive`), `wait --text "Note unarchived"`, and reload. The Note returns to the open list.
5. Open the Note, choose More actions → Delete note, and `wait --text "Note deleted"`. Wait with `gone button "Undo"` before reloading. Capture the empty list and confirm `verify d1 "SELECT body, state FROM thread_notes"` returns no row for the deleted Note.

Evidence from this run is in `.verify/evidence/effect/2026-10-02T23-44-52-650Z/`, including `effect-thread-note-before`, `effect-thread-note-after`, `effect-thread-note-done`, and `effect-thread-note-removed`.

**Repeatable flow.** `bun run verify run .claude/skills/verify-vita-os/flows/thread-notes.flow` was proven on b2bd91a at 1440×900: capture, edit, archive, expand Archived notes, unarchive, and delete after the Undo offer, with reloads and before/after screenshots. Evidence: `.verify/evidence/threadnotes426/2026-10-07T06-05-09-586Z/`. Re-run on 4bfe1d4 after the flows moved to `see`/`gone` checks: each write is proven by a reload and `see`/`gone`, and D1 checks that the deleted row is gone. This flow does not cover archived pagination, drawer, or phone paths.

## Gotchas

- Delete is delayed during the Undo period. Reloading before that period ends cancels the queued deletion; an optimistic empty list does not prove removal.
- The Note preview is `Open note: <plain-text body>`. Reacquire controls after reload.
- The shared Note view exposes Archive, and Unarchive on an Archived Note; the card's toggle is `Archive note` or `Unarchive note`.
- Desktop API paths were driven here. Drawer and phone layouts were not re-driven.
