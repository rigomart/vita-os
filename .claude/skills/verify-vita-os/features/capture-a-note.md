# Capture a note

New note opens a Markdown editor; Add stores a Standalone Note and raises `Note added`. An undated Note stands under `Notes` in No date; one with a Follow-up date stands under the group for that day.

## Entry points and variants

- Header `New note` (1024px and wider); bottom `nav[aria-label=Actions]` below 1024px
- Without a date, and with a `Follow-up date` picked in the dialog

## Preconditions

- A signed-in throwaway user.

## Checks

1. Right after the dialog opens, focus is in the editor (`document.activeElement` is labelled `Note body`) and `Add` is disabled.
2. After typing, the editor's `innerText` is exactly the typed text and `Add` is enabled.
3. `Add` sends `POST /v1/notes` and gets `201`; `Note added` shows.
4. After a reload an undated Note is `button "Open note: <text>"` under the `Notes` run of No date (below 1024px, inside the folded No date once it is opened), and the filter row reads `Notes 1` for a user with one Note.
5. Picking tomorrow in `Follow-up date` makes the button read `<Mon> <day>` (`Oct 24`); after Add and a reload the Note is under the `Tomorrow` group, headed `Tomorrow <weekday>`.
6. Stored once, open, with the exact body and date:
   `SELECT body, state, attention_date FROM notes WHERE user_id = (SELECT id FROM user WHERE email = '<email>')` → undated `attention_date: null`; dated, local midnight of that day (`new Date(y, m, d + 1).getTime()` in the browser).

## Traps

- The editor is CodeMirror and loads after the dialog: wait for `[aria-label='Note body']` before `fill`.
- `Note added` can still be up from an earlier Note; the request status and the reload are the proof.
- Below 1024px `main section[aria-label=Notes]` also matches the hidden side copy of No date, so it finds the Note while the folded No date hides it. Read the groups on screen as in [Dashboard](dashboard.md).
