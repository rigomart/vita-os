# Thread Notes

In a Thread's pane or drawer, `Write a note…` opens the Note view; Add stores a Thread Note, shown as a line under the Tasks panel, newest first. A Thread Note is never completed: its line has no commands, and its Note view offers Save and Delete, never Complete or Reopen.

## Entry points and variants

- The side pane (1280px and wider) and the drawer (below 1280px)

## Preconditions

- A signed-in throwaway user with an Open Thread (New thread).

## Checks

1. `Add` sends `POST /v1/threads/<thread id>/notes` and gets `201`; the line `button "Open note: <text>"` shows under `section[aria-label="Thread Notes"]` with today's date (`<Mon> <day>`).
2. Two Notes read newest first: the second captured is the first `li[data-note-id]`.
3. No `Complete`, `Reopen` or `Completed notes` anywhere in the section: `section[aria-label="Thread Notes"]` has no `button` whose name matches `/complete|reopen/i`, on hover and at rest.
4. Opening a line shows the Note view with `Save` once edited and `Delete note` under `More actions`; it has no `Complete` or `Reopen` button.
5. `Delete note` from the Note view removes the line, and after the Undo window:
   `SELECT count(*) FROM thread_notes WHERE thread_id = '<thread id>'` drops by one.

A Thread Note stored as `done` by an earlier build is listed with the rest; no UI path makes one any more, so `apps/api/test/thread-notes.integration.test.ts` proves it, not this file.

## Traps

- The editor is CodeMirror and loads after the dialog: wait for `[aria-label='Note body']` before `fill`.
- `Delete note` writes only after the five-second `Undo` offer: wait for `Undo` to be gone before the D1 check.
