# Capture a note

A signed-in user captures a standalone note from the header's `New note` (the bottom bar's `Note` below `lg`), the `Q` shortcut, or the command palette. After the server confirms, a `Note added` toast shows, the note appears under `No date` → `Notes` on the Dashboard, and it survives a reload.

Status: proven on 1d2885d by an independent cold run (dock entry point, body only).

## Sub-features

- `note-open` opens the `New note` dialog from each entry point.
- `note-add` saves a body and confirms with the `Note added` toast.
- `note-persist` keeps the note after a reload and in D1 (`notes.body`, `state = 'open'`).
- `note-attention` saves an optional `Follow-up date` with the note.
- `note-archive` archives a saved note with `Archive note` (see [Notes on the Dashboard](./notes-on-the-dashboard.md)).

## How to get to it (user POV)

- Choose `New note` in the header (`header[aria-label="Vita OS"]`) from `lg`, or `Note` in the bottom `navigation "Actions"` below it. Both are `button "New note"`.
- Press `Q` while focus is outside a text field.
- Open the command palette with `Meta+k`, then choose `New note` under `Create`.

## Driving it with agent-browser

Repeatable dock-capture smoke: run `bun run verify run .claude/skills/verify-vita-os/flows/notes.flow` after `up` and `signin` on a fresh instance. Proven on c8cc3f5 plus the live-preview editor change at 1440×900; it captures a body, checks that its bold renders in the editor while typing, and checks the saved body in D1 and after reload. Other capture entry points and date picking are outside this flow.

Preconditions:

- Signed in (`bun run verify signin`) on the Dashboard (`bun run verify open /`).
- Pick unique text, for example `verify note 1727461234`.

- **Open dialog.** Run `bun run verify browser -- find role button click --name "New note" --exact`. A dialog with heading `New note`, textbox `Note body`, button `Follow-up date`, and a disabled `Add` button appears.
- **Enter body.** Run `bun run verify browser -- find label "Note body" fill "verify note 1727461234"`. `Add` becomes enabled.
- **Before shot.** With the body filled and before clicking `Add`, run `bun run verify shot note-before`. The snapshot shows `dialog "New note"` with the text in the field.
- **Save.** Run `bun run verify browser -- find role button click --name "Add" --exact`, then `bun run verify browser -- wait --text "Note added"`, then `bun run verify shot note-toast`. The wait prints `Note added`, the PNG shows the toast, and the dialog closes. The toast may be missing from `note-toast.aria.txt`. The wait output is the proof.
- **Persist in UI.** Run `bun run verify browser -- reload`, then `bun run verify browser -- wait --text "verify note 1727461234"`. It prints the saved Note text.
- **Persist in D1.** Run `bun run verify d1 "SELECT body, state FROM notes"`. A row has the note's body and `state` `open`.
- **Proof.** Run `bun run verify shot note-after` after the reload. The after snapshot lists `button "Open note: verify note 1727461234"` on a card that also has `Set follow-up date` and `Archive note`.

## Gotchas

- The note shows up with a pending client id before the server answers. Only the `Note added` toast plus a reload or `verify d1` proves it saved.
- Saved bodies are read-only previews. Click their `Open note: …` button to read or edit in the [Note view](./note-view.md).
- `Q` types a `q` when a text field has focus. Press `Escape` or click empty space first.
- `Meta+Enter` inside `Note body` also submits.
