# Note view

Thread and standalone Note cards are read-only previews that open one Note view for reading, editing, completion, and deletion. Markdown preserves single line breaks and supports headings, lists, emphasis, code, safe links, quotes, dividers, and tables. Checkbox markers remain text. Desktop uses a wider dialog; a phone uses a drawer, nested above the Notes drawer when opened there.

Status: proven on c55a9eb plus the Note view working-tree change (Thread pane at 1440×900, Thread drawer at 1024×768, Dashboard and Notes panel, nested Notes drawer at 390×844; compose, read, edit, keyboard save, typing helpers, discard, Attention Date, Done/Reopen, deletion, last Dashboard Note, clean/dirty swipe, and persisted plain multiline text).

## Sub-features

- `note-compose` opens New note from the dock or Write a note… on a Thread. Only standalone Notes have an Attention Date.
- `note-read` opens full Markdown from a preview button. Preview links are inert; read links open safely in a new tab. Thread and Notes previews are bounded; Dashboard previews are two lines of plain text.
- `note-edit` switches to Note body with Edit. Save or Command/Control+Enter persists changes. Escape and Cancel return to read, with confirmation when changed.
- `note-discard` protects changed bodies and compose dates on close, outside click, Escape, and phone handle/header swipe. Keep editing preserves the draft and drawer geometry.
- `note-actions` keeps the view open through Done/Reopen or Attention Date changes, even when the last Dashboard card disappears. Delete requires confirmation.
- `note-phone` nests above Notes, keeps header/footer visible while scrolling the document, and preserves the parent drawer when the Note view closes.
- `note-plain` keeps a persisted plain multiline body's line breaks.

## How to get to it (user POV)

- On a Thread, choose Write a note… to compose; choose a saved Note card to read it.
- Choose New note in the dock to capture a standalone Note.
- Choose a Note card on the Dashboard or in Notes to open the Note view over the current page.

## Driving it with agent-browser

Preconditions: launch and sign in using the verification CLI. Use a unique Thread title and Note body. The consultation example should contain a heading, medication table, lists including `- [ ]`, a quote, and a link.

- **Thread capture.** Create a Thread per [Create a thread](./create-thread.md). Run `bun run verify browser -- find role button click --name "Write a note…" --exact`, then `find label "Note body" fill "<Markdown>"`. Run `bun run verify shot thread-note-compose-before`, click Add, and `wait --text "Note added"`. Capture `thread-note-preview-after`.
- **Read.** Run `find role button click --name "Open note: <leading text>"`, then `bun run verify shot thread-note-read`. The table has four rows for the consultation example, the task marker is `[ ]` text, and the read link has `_blank` and `noopener noreferrer`.
- **Edit/discard.** Click Edit, fill Note body with a changed draft, press Escape, and `wait --text "Discard changes?"`. Capture `thread-note-discard`. Click Discard: read mode remains open with the saved text. Edit again, change a line, and press `Meta+Enter` or `Control+Enter`; `wait --text "Note saved"` confirms the command.
- **Persistence.** Reload, wait for the preview text, reopen the card, and wait for the changed line. Capture `thread-note-saved-reload`. Run `bun run verify d1 "SELECT body, state FROM thread_notes"` for a Thread Note and `SELECT body, state, attention_date FROM notes` for standalone Notes.
- **Standalone entry points.** Capture the consultation through New note. Open its Dashboard button and repeat read/edit/save. Close it, open Notes, capture `notes-panel-before`, and choose the card there (a fresh snapshot distinguishes it from the Dashboard copy). Read/edit/save leaves Notes open. Choose Set attention date, select a calendar day, and wait for the date command to settle before choosing Done. Wait for `Note completed`; Reopen waits for `Note reopened`. Reload and confirm in D1.
- **Last Dashboard Note.** In an empty verification instance create one Note, open it, and click Done. After `Note completed`, the empty Dashboard is behind a still-open Note view with Reopen. Capture `last-note-done-view`. Reopen restores its card; reload plus D1 confirms its open state.
- **Thread drawer.** At `set viewport 1024 768`, reload the Thread address, wait for its Note, and open the preview. Capture `thread-note-tablet-read`.
- **Nested phone drawer.** Open Notes at `set viewport 390 844`, reload, and open the Note. Wait for the opening animation to settle: `wait --fn 'document.querySelectorAll("[data-slot=drawer-content]").length===2 && [...document.querySelectorAll("[data-slot=drawer-content]")].at(-1).getBoundingClientRect().bottom<=window.innerHeight+1'`. Capture `phone-nested-read-stable`. Scroll the document with `scroll down 1200 --selector '[data-slot="drawer-content"] .overscroll-contain'`; capture `phone-read-scrolled-footer`.
- **Phone Escape.** Edit without a change, press Escape, and confirm read mode remains above Notes. Change a draft, press Escape, then Discard: read mode remains. Capture `phone-clean-escape-read` and `phone-dirty-escape-read`.
- **Phone swipe.** With a changed edit, inspect the drawer geometry to locate its handle. In the driven 390×844 edit layout, drag from `(195,365)` through `(195,520)` to `(195,720)` using `mouse move`, `mouse down left`, and `mouse up left`. Wait for Discard changes?, then Keep editing. The draft survives, the Note ends at viewport bottom, and its transform remains unchanged. Capture `phone-guarded-swipe-keep`. Repeat and choose Discard: only the parent Notes drawer remains. Capture `phone-swipe-discard-to-notes`.
- **Clean swipe.** Open a saved Note on the phone Dashboard and drag its handle down. The Note drawer closes without a discard prompt. Capture `clean-swipe-before` and `clean-swipe-after`; locate the current handle before dragging because the drawer height follows the content.
- **Delete.** Choose Delete note, wait for Delete note?, and press Escape: the confirmation closes and the Note view stays open. Capture `phone-delete-escape-retains-note`. Open the confirmation again and choose Delete. Wait for Note deleted, reload, and confirm the Note is absent in D1. Thread deletion follows the same flow.
- **Typing helpers.** Edit, fill Note body with `- first`, click the textarea, press End and Enter, then Tab: the value becomes `- first\n  - `. Shift+Tab followed by Enter ends the empty list item. To check selection wrapping, fill `word`, click the textarea, press Home then Shift+End, and confirm its selection covers all four characters. Control+B then Control+I produces `**_word_**`. Capture `typing-helpers`, then Escape and Discard.
- **Plain body.** Save `Called the clinic\nWaiting for a reply`, reload, and reopen. Inspect the rendered body for one `br` and capture `plain-note-line-breaks`; D1 retains the newline in the body string.

## Gotchas

- Dialogs and drawers animate. Wait for a nested drawer to settle before clicking footer controls; an early pointer can hit the moving backdrop.
- Date commands are quiet and asynchronous. Wait until the subsequent Done/Edit control is enabled before using it; clicking during pending state performs no action.
- Saved bodies are buttons/text, not Edit note body textboxes. The only editor is Note body after Edit.
- A preview can occur twice when Notes is above the Dashboard. Use a fresh snapshot or scope to the Notes surface.
- Dirty phone swipes start on the handle or non-interactive header. The scrollable document stays available for scrolling and text selection.
- Only mutation confirmation plus a reload and D1 proves persistence; previews update optimistically.
- Normal development setup includes four sample Thread Notes: three in Dentist follow-up (one completed) and one in Quarterly review prep. `bun run setup` can add them to an existing dev account without resetting it; Threads with any open or completed Notes are skipped. Verification instances are separate and do not inherit this sample data.
