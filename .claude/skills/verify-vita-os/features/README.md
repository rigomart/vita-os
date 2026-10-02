# Vita OS verification map

This directory is the maintained source for verifying Vita OS's user-facing behavior. Read this index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- `bun run verify up` reported `"ok": true` for your instance, and `bun run verify doctor` reports every check `true`.
- `bun run verify signin` reported `signedInAs` equal to the instance's throwaway email, unless the feature file says to start signed out.
- The instance's D1 starts empty apart from that user. Run `bun run verify down --purge`, then `bun run verify up`, to restore it.
- Never drive an instance this verification run did not start.

## Driving conventions

- Run browser actions as `bun run verify browser -- <agent-browser args>`.
- Prefer ARIA roles and accessible names (`find role button click --name "Add" --exact`, `find label "Note body" fill ...`) over CSS selectors or refs from an old snapshot.
- Use unique text for anything you create (append a timestamp) so a check cannot match leftovers. Generate the timestamp in a separate command (`date +%s`) and paste the literal text into later commands. Inline `$(...)` inside a `bun run verify` command can be refused by command guards.
- Wait on the specific end state (`wait --text`, `wait --fn`, `wait '<selector>'`). Never use `wait --load networkidle` or bare sleeps as proof.

## Proof and skip reporting

- Capture the action and the resulting state: `bun run verify shot <feature>-before` and `bun run verify shot <feature>-after`.
- Mutation proof needs the server confirmation (toast), a reload showing the change, and a read-only second view via `bun run verify d1 "SELECT ..."`. Vita renders mutations optimistically, so the UI alone before a reload proves nothing.
- Report the feature ID and entry point with every artifact.
- An unreachable entry point is reported with the attempted command and the unmet precondition. Do not report it as verified through a different path.

## Feature entry contract

Each feature file has an H1 title, a one-paragraph description of the user-visible behavior, a `Status` line (`proven on <short sha>` or `mapped from source, not yet driven`; a partial proof names what was driven, e.g. `proven on <sha> (dock entry point). The command palette entry point is not yet driven.`), then exactly four H2 sections in order: `Sub-features`, `How to get to it (user POV)`, `Driving it with agent-browser`, `Gotchas`.

## Features

- [Sign in](./sign-in.md) covers the email and password form, the session check, and the signed-out redirect.
- [Capture a note](./capture-note.md) covers the dock button, the Q shortcut, and the command palette, plus persistence.
- [Note view](./note-view.md) covers Read/Write over one draft, task checkboxes, inline discard, Delete with Undo, previews, and nested phone drawers.
- [Create a thread](./create-thread.md) covers the New thread dialog and the thread pane it opens.
- [Moves](./moves.md) covers adding, focusing, and completing a Move in the thread pane, the drawer, and the Dashboard card.
- [Dashboard board](./dashboard-board.md) covers the dated lanes, the No date tray, the shared Thread and Note card, and the stacked layouts.
- [Follow-up dates](./follow-up-dates.md) covers the shared date controls on Threads and standalone Notes, their Dashboard placement, and resolve/reopen behavior.
- [Manage areas](./manage-areas.md) covers adding an area and seeing it in the Filter by area row.
- [Phone installation and sharing](./phone-installation.md) covers manifest/icons, shared Note capture through sign-in, retry, and persistence.
