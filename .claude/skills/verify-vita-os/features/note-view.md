# Note view

Thread and standalone Note cards are read-only previews that open one Note view. Its header switch chooses **Read** or **Write** over one draft: a saved Note opens on Read, a new one on Write, and Read renders unsaved text, so it is also the compose preview. Both modes keep a 340px floor. Markdown preserves single line breaks and supports headings, lists, task checkboxes, emphasis, code, safe links, quotes, dividers, and tables. Desktop uses a wider dialog; a phone uses a drawer, nested above the Notes drawer when opened there (ADR 0024, ADR 0025).

Status: proven on 6231a78 plus the Read/Write working-tree change (Dashboard dialog at 1440×900 in dark mode: compose, Read preview, Add, ticking a task in Read with D1 proof, unsaved dot, inline discard with Escape keeping the draft, Save from Read, Delete with Undo restoring and with the window lapsing to a D1 delete; nested Notes drawer at 390×844: compose, read, ⋯ menu, Delete and Undo; Thread pane at 1440×900: Thread Note read, Delete and Undo with D1 proof). Not re-driven in this change: Attention Date picking, Done/Reopen, swipe gestures, typing helpers, the Thread drawer at 1024×768.

## Sub-features

- `note-compose` opens New note from the dock or Write a note… on a Thread, on Write with the body focused. Only standalone Notes have an Attention Date. Add or Command/Control+Enter saves.
- `note-read` renders full Markdown. Preview links are inert; read links open safely in a new tab. Task items are checkboxes: ticking one on a saved Note with no unsaved edits saves it quietly; on a draft it edits the draft. Card previews draw the boxes without controls.
- `note-write` edits the same draft. Leaving Write never discards: Read shows the unsaved text, the Write tab shows a dot (named `Write , unsaved changes`), and the footer shows `Unsaved changes` and Save in either mode. Save returns to Read.
- `note-discard` asks only when closing a changed draft (Close, Escape, outside click, phone handle/header swipe). The question replaces the footer: `alertdialog "Discard unsaved changes?"` with Keep editing (focused) and Discard. Escape answers Keep editing.
- `note-actions` keeps the view open through Mark done/Reopen or Attention Date changes, even when the last Dashboard card disappears. The ⋯ `More actions` menu has Copy Markdown and Delete note.
- `note-delete` deletes without asking, closes the view, hides the card at once, and shows `Note deleted` with Undo for five seconds. Undo restores the card and nothing reaches the service; otherwise the delete commits when the toast closes.
- `note-phone` nests above Notes, keeps header/footer visible while scrolling the document, and preserves the parent drawer when the Note view closes. Menus and toasts stay tappable over a drawer.
- `note-plain` keeps a persisted plain multiline body's line breaks.

## How to get to it (user POV)

- On a Thread, choose Write a note… to compose; choose a saved Note card to read it.
- Choose New note in the dock to capture a standalone Note.
- Choose a Note card on the Dashboard or in Notes to open the Note view over the current page.

## Driving it with agent-browser

Preconditions: launch and sign in using the verification CLI. Use a unique Thread title and Note body. The consultation example should contain a heading, lists including `- [ ]` and `- [x]`, a quote, and bold text.

- **Compose and preview.** Run `bun run verify browser -- find role button click --name "New note" --exact`, then `find label "Note body" fill "<Markdown>"`. The `tab "Write"` is selected. Capture `compose-write`. Run `find role tab click --name "Read"`: the heading, real checkboxes, and quote render at the same dialog height. Capture `compose-read-preview`. Take `snapshot -i` and click Add by its ref (`click @eN`), then `wait --text "Note added"`.
- **Read and tick.** Run `find role button click --name "Open note: <leading text>"`. The view shows Read/Write, `More actions`, `Close`, Attention date, Mark done, and `Added <date>`. Capture `saved-read`. Run `find role checkbox click --name "<task text>"`, then `bun run verify d1 "SELECT instr(body, '- [x] <task text>') AS ticked FROM notes"`: a non-zero value proves the quiet save.
- **Write, discard, save.** Run `find role tab click --name "Write"`, `snapshot -i`, and `type @eN " extra text"` into `textbox "Note body"`. The tab becomes `Write , unsaved changes` and Save appears. Press Escape and `wait --text "Discard unsaved changes?"`; capture `edit-discard-inline`. Press Escape again: the question closes and the draft stays. Click the Read tab (the unsaved text renders; capture `read-unsaved-preview`), click Save, and `wait --text "Note saved"`.
- **Delete and Undo.** Run `find role button click --name "More actions"`, then `find role menuitem click --name "Delete note"`, then `wait --text "Note deleted"`. The view closes and the card is gone. Take `snapshot -i` and click the toast's Undo by ref. `wait --text "<leading text>"` shows the card again; after `wait 7000`, `verify d1 "SELECT count(*) AS n FROM notes"` still counts it.
- **Delete commits.** Delete again and do nothing. After `wait 8000`, the D1 count drops by one.
- **Thread Notes.** Create a Thread per [Create a thread](./create-thread.md), choose `Write a note…`, fill Note body, and Add by ref. Open the card: the header shows the Thread title after a marker and there is no Attention date. Capture `thread-note-read`. Delete and Undo as above; prove with `SELECT count(*) AS n FROM thread_notes`.
- **Nested phone drawer.** At `set viewport 390 844`, compose a Note (Add by ref), then `find role button click --name "Notes" --exact`, `wait 1000`, and open the card. After `wait 1200`, capture `phone-nested-read`; the drawer handle sits above the header, clear of the switch. Open `More actions` (capture `phone-nested-menu`), choose Delete note, then click Undo by ref. The card returns and D1 keeps it.
- **Persistence.** Reload, wait for the preview text, reopen the card, and wait for the changed line. Run `bun run verify d1 "SELECT body, state FROM thread_notes"` for a Thread Note and `SELECT body, state, attention_date FROM notes` for standalone Notes.
- **Last Dashboard Note.** In an empty verification instance create one Note, open it, and click Mark done. After `Note completed`, the empty Dashboard is behind a still-open Note view with Reopen.
- **Phone swipe.** With a changed draft, drag the drawer handle down with `mouse move`, `mouse down left`, and `mouse up left`. The footer asks `Discard unsaved changes?`; Keep editing leaves the draft and the drawer in place.
- **Typing helpers.** In Write, fill Note body with `- first`, click the textarea, press End and Enter, then Tab: the value becomes `- first\n  - `. Control+B then Control+I on a selected word produces `**_word_**`.
- **Plain body.** Save `Called the clinic\nWaiting for a reply`, reload, and reopen. The rendered body has one `br`; D1 retains the newline.

## Gotchas

- Click Add and the toast's Undo by snapshot ref. `find role button click --name "Add"` can hit an `Add` button behind the backdrop, which counts as an outside click and opens the discard question. `find … --name "Undo"` reported Done without undoing on the phone; the ref click works.
- `type` without a target types into nothing after a tab click. Target the textbox ref.
- Dialogs and drawers animate. Wait for a nested drawer to settle before clicking footer controls; an early pointer can hit the moving backdrop.
- Date commands are quiet and asynchronous. Wait until the next control is enabled before using it; clicking during pending state performs no action.
- On a phone the No date tray starts collapsed, so an undated Note's card is not on the Dashboard. Open it from Notes.
- A preview can occur twice when Notes is above the Dashboard. Use a fresh snapshot or scope to the Notes surface.
- Only mutation confirmation plus a reload and D1 proves persistence; previews update optimistically. A delete reaches D1 only after the five-second Undo window.
- Normal development setup includes four sample Thread Notes: three in Dentist follow-up (one completed) and one in Quarterly review prep. Verification instances are separate and do not inherit this sample data.
