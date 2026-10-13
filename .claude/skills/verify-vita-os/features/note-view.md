# Note view

Thread and standalone Note cards are read-only previews that open one Note view. Its body is one live-preview Markdown editor (CodeMirror): formatting renders as you type and syntax shows only on the caret's line, so there is no Read/Write switch. A saved Note opens with no caret, fully rendered; a new one opens with the caret in the body. The body keeps a 340px floor. Markdown preserves single line breaks and supports headings, lists, task checkboxes, emphasis, code, safe links, quotes, dividers, and tables. Desktop uses a wider dialog; a phone uses a drawer, nested above a Thread drawer when opened there (ADR 0024, ADR 0025, ADR 0038). An Archived Note opened from the palette's History uses the same view (ADR 0031).

Status: live-preview editor proven in #442 (c230374) at 1440×900 (Dashboard dialog in dark and light, Thread pane) and 390×844 (phone drawer), and by `notes.flow`; Archive and Unarchive proven in #394 (bb54a79). An open repeating Note's `Complete · back <Mmm d>` button beside Archive was proven on c85a32e plus the uncommitted #458 working tree by `repeating-notes.flow` and by hand at 1440×900. Not driven: a link's open icon, Tab nesting, Control+B and Control+I, Follow-up date picking, swipe gestures, the Thread drawer at 1024×768, and the nested phone drawer recipe below.

## Sub-features

- `note-compose` opens New note from the header (the bottom bar below `lg`) or Write a note… on a Thread, with the body focused. Only standalone Notes have an Follow-up date. Add or Command/Control+Enter saves.
- `note-open` opens the view from anywhere on a Dashboard or Thread card except its controls, and from an Archived note in the palette's History. Proven on the Dashboard and the since-removed Notes panel cards with a real mouse: the card's `boundingBox()`, then `page.mouse.move`, `page.mouse.down()`, `page.mouse.up()` on empty footer space; `Set follow-up date` and `Archive note` keep their own clicks.
- `note-read` renders the full Markdown in the editor while it has no caret. Card preview links are inert; editor links show an icon that opens http, https and mailto links in a new tab. Task items are checkboxes: ticking one on a saved Note with no unsaved edits saves it quietly; on a draft it edits the draft. Card previews draw the boxes without controls.
- `note-write` edits in place: clicking a line reveals its syntax. A change shows `Unsaved changes` and Save in the footer; Save keeps the caret where it was. Enter continues lists, Tab nests a list item.
- `note-discard` asks only when closing a changed draft (Close, Escape, outside click, phone handle/header swipe). The question replaces the footer: `alertdialog "Discard unsaved changes?"` with Keep editing (focused) and Discard. Escape answers Keep editing.
- `note-actions` keeps the view open through Archive/Unarchive or Follow-up date changes, even when the last Dashboard card disappears. An Open repeating Standalone Note shows `Complete · back <Mmm d>` between its date and Archive: it moves the date to the next occurrence and the view stays open with the next label; the date button holds `img "Repeats monthly on the 5th"`. Archived, it shows only `Unarchive`. An Archived Note's header reads `Archived <date>` (`Archived` alone on a phone). The ⋯ `More actions` menu has Copy Markdown and Delete note; an Open Standalone Note's menu also has Add to thread… and New thread from note (see [Add a Note to a Thread](./add-to-thread.md)).
- `note-delete` deletes without asking, closes the view, hides the card at once, and shows `Note deleted` with Undo for five seconds. Undo restores the card and nothing reaches the service; otherwise the delete commits when the toast closes.
- `note-phone` nests above a parent drawer, keeps header/footer visible while scrolling the document, and preserves the parent drawer when the Note view closes. Menus and toasts stay tappable over a drawer.
- `note-plain` keeps a persisted plain multiline body's line breaks.

## How to get to it (user POV)

- On a Thread, choose Write a note… to compose; choose a saved Note card to read it.
- Choose New note in the header, or Note in the bottom bar on a phone, to capture a standalone Note.
- Choose a Note card on the Dashboard or in Notes to open the Note view over the current page.

## Driving it

Spec: `apps/e2e/tests/notes.spec.ts` at 1440×900: bold rendering while composing, a saved Note opening rendered, an in-place edit kept through the discard question, Save, Delete with Undo, and committed deletion. Each saved write is proven by a reload; D1 checks the stored Markdown source and the committed deletion. Checkboxes, Thread Notes, and phone drawers are outside it.

Use `stamp` in the Thread title and Note body. The consultation example should contain a heading, lists including `- [ ]` and `- [x]`, a quote, and bold text. `body` below is `page.getByRole("textbox", { name: "Note body" })`.

- **Compose.** Click `button "New note"` (`exact: true`), click `body`, then `page.keyboard.type("# Clinic visit")`, press Enter, type `- [ ] Book bloods`, press Enter (the list continues), type `Ask about **dosage**`. The heading and checkboxes render while typing; `**` shows only on the caret's line. `shot("compose-live")`. Press `ControlOrMeta+Enter` inside `sent`, then expect `Note added`.
- **Open and tick.** Click `button "Open note: <leading text>"`. The view shows `More actions`, `Close`, Follow-up date, Archive, and `Added <date>`, and every line is rendered. `shot("saved-open")`. The task boxes are unnamed checkboxes inside `body`: click `body.getByRole("checkbox").first()`, then `SELECT body FROM notes WHERE user_id = '${account.id}'` shows `- [x]`. No Save appears.
- **Edit, discard, save.** Click into a line (`page.locator(".cm-line").nth(2)`), press End, type ` and timing`. The footer shows `Unsaved changes` and Save. Press Escape and expect `getByText("Discard unsaved changes?")`; `shot("edit-discard-inline")`. Press Escape again: the question closes and the draft stays. Click Save and expect `Note saved`.
- **Replace the text.** `body.fill(text)` replaces the whole body; `page.keyboard.type` after a click types at the caret.
- **Delete and Undo.** Click `button "More actions"`, then `menuitem "Delete note"`, and expect `Note deleted`. The view closes and the card is gone. Click the toast's `button "Undo"`: the card is back. Wait out the five-second window (`expect(undo).toBeHidden({ timeout: 10_000 })`), reload, and expect `button "Open note: <leading text>"`: Undo lasted.
- **Delete commits.** Delete again and do nothing. Once the toast is gone, the D1 count drops by one.
- **Thread Notes.** Create a Thread with `createThread`, click `Write a note…`, fill `Note body`, and click `Add` scoped to the composer. Open the card: the header shows the Thread title after a marker and there is no Follow-up date. `shot("thread-note-read")`. Delete and Undo as above; prove with `SELECT count(*) AS n FROM thread_notes WHERE user_id = '${account.id}'`.
- **Nested phone drawer.** (Not re-driven since the Notes drawer was removed; open a Thread Note from the Thread drawer instead.) At 390×844, open a Thread whose drawer lists a Thread Note, `settled` the drawer, and open the card. Once the nested drawer has settled, `shot("phone-nested-read")`; the drawer handle sits above the header. Open `More actions` (`shot("phone-nested-menu")`), choose Delete note, then click Undo. The card returns and D1 keeps it.
- **Persistence.** Reload, wait for the preview text, reopen the card, and wait for the changed line. For a body whose Markdown matters, `SELECT body FROM notes` (or `thread_notes`) scoped to `account.id` shows the stored source.
- **Last Dashboard Note.** As a user with no other Note, create one Note, open it, and click Archive. After `Note archived`, the empty Dashboard is behind a still-open Note view with Unarchive.
- **Phone swipe.** With a changed draft, drag the drawer handle down with `page.mouse.move`, `page.mouse.down()`, and `page.mouse.up()`. The footer asks `Discard unsaved changes?`; Keep editing leaves the draft and the drawer in place.
- **Typing helpers.** Type `- first`, press Enter, then Tab: the text becomes `- first\n  - `. Control+B (Command+B on a Mac) then Control+I on a selected word produces `**_word_**`. Not driven since the editor change.
- **Plain body.** Save `Called the clinic\nWaiting for a reply`, reload, and reopen. The rendered body has one `br`; D1 retains the newline.

## Gotchas

- Scope `Add` to its dialog or composer. An `Add` button behind the backdrop counts as an outside click and opens the discard question.
- `page.keyboard.type` with no focused editor types into nothing. Click into `Note body` first.
- Dialogs and drawers animate. Wait for a nested drawer to settle before clicking footer controls; an early pointer can hit the moving backdrop.
- Date commands are quiet and asynchronous. Wait until the next control is enabled before using it; clicking during pending state performs no action.
- On a phone `No date` leads the list folded to one line, so an undated Note's card is hidden until you unfold it (`page.getByRole("region", { name: "No date" }).getByRole("button", { expanded: false })`).
- Only mutation confirmation plus a reload proves persistence; previews update optimistically. A delete reaches D1 only after the five-second Undo window.
- Normal development setup includes four sample Thread Notes: three in Dentist follow-up (one archived) and one in Quarterly review prep. Verification instances are separate and do not inherit this sample data.
