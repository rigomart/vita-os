# Moves

A signed-in user adds Moves to an open thread, focuses at most one, and completes them. Moves are peers listed in capture order. Focusing one tints its row in place. Completing a Move removes it and writes a `Move done` entry to the thread's activity log. Completing the Focused Move leaves the thread unfocused. A thread with Moves sits under `NO DATE` → `Ready to move` on the Dashboard, and its card can complete a Move too.

Status: proven on 640e3ba (thread pane at 1440px and drawer at 1024px: `move-add`, `move-focus`, `move-complete`, `move-persist`; Dashboard card: `move-complete-card`). Editing and removing a Move, and unfocusing, are not yet driven.

## Sub-features

- `move-add` adds a Move from the `Add a move` field at the foot of the list.
- `move-focus` focuses a Move with its `Focus this move` radio. Pressing the filled radio (`Unfocus this move`) unfocuses it.
- `move-complete` completes a Move with its `Complete move` button and logs `Move done` in the `Activity` tab.
- `move-complete-card` completes a Move from its thread's Dashboard card.
- `move-persist` keeps Moves and focus after a reload and in D1 (`threads.moves_json`, `threads.focused_move_id`, `activity_log_entries` with `type = 'move_completed'`).
- `move-edit` edits a Move's text by clicking it (not yet driven).
- `move-remove` removes a Move with `Remove move` without logging it (not yet driven).

## How to get to it (user POV)

- Open a thread (create one per [Create a thread](./create-thread.md), or click its title on the Dashboard). The `Thread attention` region under the header holds the Moves.
- On the Dashboard, a thread under `NO DATE` → `Ready to move` shows `Complete “<move>”` on its card.

## Driving it with agent-browser

Preconditions:

- Signed in, with a thread open in the pane at 1440×900 (`complementary "<title>"`).
- Pick unique Move text, for example `Verify move A 1727461234` and `Verify move B 1727461234`.

Every row has buttons with the same names (`Focus this move`, `Remove move`, `Complete move`), so `find role button --name` is ambiguous with two or more Moves. Scope to a row with XPath on the Move's text, which renders as a button:

```bash
bun run verify browser -- click 'xpath=//ul[@aria-label="Moves"]/li[.//button[normalize-space()="Verify move B 1727461234"]]//button[@aria-label="Focus this move"]'
```

- **Before shot.** Run `bun run verify shot moves-before`. The `Thread attention` region shows `MOVES`, `Add a follow-up…`, and `textbox "Add a move"`, and no `list "Moves"`.
- **Add.** Run `bun run verify browser -- find label "Add a move" fill "Verify move A 1727461234"`, then `bun run verify browser -- press Enter`. Repeat for Move B. `bun run verify browser -- snapshot -s 'section[aria-label="Thread attention"]'` shows `MOVES 2`, the hint `Focus one when you know it, or leave them all unfocused.`, and `list "Moves"` with one `listitem` per Move in capture order, each with `Focus this move`, a button named after the Move, `Remove move`, and `Complete move`.
- **Focus.** Click Move B's `Focus this move` with the XPath above. Its radio becomes `Unfocus this move` and its `li` gets `data-focused`.
- **Persist add and focus.** Run `bun run verify browser -- reload`, then `bun run verify browser -- wait --fn "[...document.querySelectorAll('ul[aria-label=\"Moves\"] > li[data-focused]')].some(li => li.textContent.includes('Verify move B 1727461234'))"`. It prints `true`. Run `bun run verify shot moves-focused`. Run `bun run verify d1 "SELECT title, moves_json, focused_move_id FROM threads WHERE title = '<thread title>'"`. `moves_json` lists both Moves as `{id, text}` in capture order, and `focused_move_id` is Move B's `id`.
- **Complete.** Click Move B's `Complete move` (same XPath, `@aria-label="Complete move"`). The row disappears. Run `bun run verify browser -- find role tab click --name "Activity" --exact`, then `bun run verify browser -- wait --text "Verify move B 1727461234"`. The activity log reads `Move done` / `Completed Verify move B 1727461234`, which the client refetches from the server after the command.
- **Persist complete.** Run `bun run verify browser -- reload`, then `bun run verify browser -- wait 'ul[aria-label="Moves"]'` before touching the pane. Run `bun run verify browser -- eval "[...document.querySelectorAll('ul[aria-label=\"Moves\"] > li')].map(li => li.textContent + (li.dataset.focused ? ' [focused]' : ''))"`. It lists only Move A, unfocused. Run `bun run verify d1 "SELECT t.moves_json, t.focused_move_id, l.type, l.content FROM threads t LEFT JOIN activity_log_entries l ON l.thread_id = t.id WHERE t.title = '<thread title>'"`. `moves_json` holds only Move A, `focused_move_id` is null, and the log row is `move_completed` with content `Completed "Verify move B 1727461234"`.
- **Proof.** `bun run verify shot moves-after` after the reload.
- **Drawer.** Run `bun run verify browser -- set viewport 1024 768`, `reload`, and `wait 'ul[aria-label="Moves"]'`. The pane is now `dialog "<title>"`. Add, focus, and complete with the same commands. Completing an unfocused Move leaves the focus where it was. Run `set viewport 1440 900` afterwards.
- **Dashboard card (`move-complete-card`).** Run `bun run verify open /`, then `bun run verify browser -- wait --text "Ready to move"`. The thread's card lists `link "<title>"`, `Set Follow-up`, and `Complete “<move>”` (curly quotes). Run `bun run verify browser -- find role button click --name "Complete “Verify move C 1727461234”" --exact`, reload, and read D1 as above. With its last Move completed the thread moves back to `NO DATE` → `Open`.

## Gotchas

- Move commands show no success toast. Only a failure toasts (`This Thread changed elsewhere. It has been refreshed.` or `Could not save that change. Please try again.`). The server confirmation is the reload plus `verify d1`, and for completion the `Move done` activity entry.
- Moves render optimistically and queue per thread: each command carries the revision the one before it brought back. Several quick actions are safe, but prove the end state after a reload.
- `Add a move` also commits on blur, and `Escape` clears the draft (from source, not yet driven).
- After a reload the pane renders after the Dashboard. Wait for `ul[aria-label="Moves"]` before clicking a tab, or `find role tab` fails with `No element found`.
- The accessibility snapshot shows neither `aria-pressed` nor the activity log's text. Read focus from the radio's name or `li[data-focused]`, and the log with `eval "document.querySelector('[aria-label=\"Activity log\"]').innerText"`.
- On the Dashboard card, `Complete “<move>”` names the Focused Move, even when it is not first in the list.
- A thread whose last Move is completed has `moves_json` null, not `[]`.
- At 1280px and up, `Remove move` is transparent until the row is hovered or focused. In the drawer it is always visible (from source).
