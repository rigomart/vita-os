# Capture a note

A signed-in user captures a standalone note from the header's `New note` (the bottom bar's `Note` below `lg`), the `Q` shortcut, or the command palette. After the server confirms, a `Note added` toast shows, the note appears under `No date` → `Notes` on the Dashboard, and it survives a reload.

Status: proven in #462 by `notes.spec.ts` (header New note, live preview while typing, persistence after reload). Not driven: the Q shortcut and the command palette entry points.

## Sub-features

- `note-open` opens the `New note` dialog from each entry point.
- `note-add` saves a body and confirms with the `Note added` toast.
- `note-persist` keeps the note after a reload; D1 keeps its Markdown source as typed (`notes.body`, `state = 'open'`).
- `note-attention` saves an optional `Follow-up date` with the note.
- `note-archive` archives a saved note with `Archive note` (see [Notes on the Dashboard](./notes-on-the-dashboard.md)).

## How to get to it (user POV)

- Choose `New note` in the header (`banner "Vita OS"`) from `lg`, or `Note` in the bottom `navigation "Actions"` below it. Both are `button "New note"`.
- Press `Q` while focus is outside a text field.
- Open the command palette with `Meta+k`, then choose `New note` under `Create`.

## Driving it

Spec: `apps/e2e/tests/notes.spec.ts` captures from the header's `New note` at 1440×900, checks that bold renders in the editor while typing, and checks the saved body after a reload and in D1. Other entry points and date picking are outside it. Use `stamp` in the body.

- **Open dialog.** `page.getByRole("button", { name: "New note", exact: true }).click()`. `dialog "New note"` shows `textbox "Note body"`, `button "Follow-up date"`, and a disabled `button "Add"`.
- **Enter body.** `getByRole("textbox", { name: "Note body" }).fill(body)`. `Add` becomes enabled. Run `shot("note-before")`: the dialog with the text in the field.
- **Save.** Inside `sent(page, /\/notes$/, …)`, click the dialog's `Add` (`exact: true`) or press `ControlOrMeta+Enter`. `page.getByText("Note added")` shows and the dialog closes. `shot("note-toast")` right away if the toast is the point.
- **Persist.** `page.reload()`, then `getByRole("button", { name: `Open note: ${body}` })` is visible, on a card that also has `Set follow-up date` and `Archive note`. For a body with Markdown, `SELECT body, state FROM notes WHERE user_id = '${account.id}'` shows the stored source, which the card renders. `shot("note-after")`.
- **Other entry points.** `page.keyboard.press("q")` with focus outside a text field, or `ControlOrMeta+k` then `getByRole("option", { name: "New note" })`.

## Gotchas

- The note shows up with a pending client id before the server answers. Only the `Note added` toast plus a reload proves it saved.
- Saved bodies are read-only previews. Click their `Open note: …` button to read or edit in the [Note view](./note-view.md).
- `Q` types a `q` when a text field has focus. Press `Escape` or click empty space first.
- `ControlOrMeta+Enter` inside `Note body` also submits.
