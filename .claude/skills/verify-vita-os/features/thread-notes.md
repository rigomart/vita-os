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

## Driving it

Spec: `apps/e2e/tests/thread-notes.spec.ts` at 1440×900: capture, edit, archive, expand Archived notes, unarchive, and delete after the Undo offer, each write proven by a reload, and D1 checking that the deleted row is gone. It does not cover archived pagination, the drawer, or the phone.

Start from a Thread made with `createThread`, and scope to its pane (`page.getByRole("complementary", { name: title })`).

1. **Capture.** Click `button "Write a note…"` (`exact: true`), fill `textbox "Note body"`, `shot`, then click `Add` (`exact: true`) inside `sent` and expect `getByText("Note added")`. After `page.reload()`, `button "Open note: <body>"` is there.
2. **Edit.** Click `button "Open note: <body>"`, `fill` `Note body` with the new text (it replaces the body), click `Save`, and expect `getByText("Note saved")`.
3. **Archive.** In the Note view click `button "Archive"` (`exact: true`), or the card's `Archive note`, and expect `getByText("Note archived")`. Close and reload, then click `button "Archived notes 1"` (`exact: true`). Its visible text has no separating space, so match the accessible name, not `getByText`. The Note is listed there, so it was archived, not deleted (D1 stores Archived as `state = 'done'`).
4. **Unarchive.** Click `button "Unarchive note"` (or open the Note and click `Unarchive`), expect `getByText("Note unarchived")`, and reload. The Note returns to the open list.
5. **Delete.** Open the Note, click `button "More actions"` → `menuitem "Delete note"`, and expect `getByText("Note deleted")`. Wait for `button "Undo"` to be hidden before reloading. `shot` the empty list, and `SELECT body, state FROM thread_notes WHERE user_id = '${account.id}'` returns no row for the deleted Note.

## Gotchas

- Delete is delayed during the Undo period. Reloading before that period ends cancels the queued deletion; an optimistic empty list does not prove removal.
- The Note preview is `Open note: <plain-text body>`.
- The shared Note view exposes Archive, and Unarchive on an Archived Note; the card's toggle is `Archive note` or `Unarchive note`.
- Desktop API paths were driven here. Drawer and phone layouts were not re-driven.
