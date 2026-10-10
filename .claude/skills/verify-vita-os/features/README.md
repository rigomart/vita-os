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

- Prefer `bun run verify run <flow-file>` over step-by-step driving for anything longer than a few steps. Flows live in `../flows/` (`tasks`, `dashboard-tasks`, `dated-tasks`, `repeating-tasks`, `complete-with-note`, `resolve-reopen`, `thread-drawer`, `thread-edit-tasks`) and are built from the command blocks in these files; see Flows in `../SKILL.md` for the format. Add or update a flow when a feature file's recipe changes.
- Never `press Enter` to commit an edit of an existing Task's text (agent-browser 0.38.1 floods the browser with keydown events); use `press Tab` or a click. `press Enter` in `Add a task` is fine and is the capture path flows must keep proving.
- Time-limit verification. If the same step fails twice, stop that item and report it `INCONCLUSIVE` with the failing command and its output.

## Scripted feature coverage

Run each new flow below from a fresh instance: `bun run verify up`, `bun run verify signin`, then `bun run verify run .claude/skills/verify-vita-os/flows/<name>.flow`. Each flow checks visible behavior and persisted writes with read-only D1 queries. These flows supplement the existing Task and Thread flows listed above.

| Flow | Feature maps and scope |
| --- | --- |
| [notes](../flows/notes.flow) | [Capture a note](./capture-note.md), [Note view](./note-view.md): header capture, live preview while typing, saved edits in place, Delete with Undo and persisted deletion. |
| [notes-dashboard](../flows/notes-dashboard.flow) | [Notes on the Dashboard](./notes-on-the-dashboard.md): Notes filter, archive, archived body search in History, and unarchive. |
| [thread-notes](../flows/thread-notes.flow) | [Thread Notes](./thread-notes.md): desktop capture, edit, archive, unarchive, and deletion. |
| [add-to-thread](../flows/add-to-thread.flow) | [Add a Note to a Thread](./add-to-thread.md): undated add to an existing Thread and New thread from note. Dated conversion stays in `dated-tasks.flow`. |
| [areas](../flows/areas.flow) | [Manage areas](./manage-areas.md): create, rename, icon, reorder, and delete while Threads survive without the label. |
| [history](../flows/history.flow) | [Resolved Threads](./resolved-threads.md): palette browsing and search, opening and reopening in the pane and drawer. |
| [sign-in](../flows/sign-in.flow) | [Sign in](./sign-in.md): menu sign-out, the signed-out gate, and sign-in through the real form. |

## Proof and skip reporting

- Capture the action and the resulting state: `bun run verify shot <feature>-before` and `bun run verify shot <feature>-after`.
- Mutation proof needs the server confirmation (toast), a reload showing the change, and a read-only second view via `bun run verify d1 "SELECT ..."`. Vita renders mutations optimistically, so the UI alone before a reload proves nothing.
- Report the feature ID and entry point with every artifact.
- An unreachable entry point is reported with the attempted command and the unmet precondition. Do not report it as verified through a different path.

## Feature entry contract

Each feature file has an H1 title, a one-paragraph description of the user-visible behavior, a `Status` line (`proven on <short sha>` or `mapped from source, not yet driven`; a partial proof names what was driven, e.g. `proven on <sha> (dock entry point). The command palette entry point is not yet driven.`), then exactly four H2 sections in order: `Sub-features`, `How to get to it (user POV)`, `Driving it with agent-browser`, `Gotchas`.

## Features

- [Sign in](./sign-in.md) covers the email and password form, the session check, and the signed-out redirect.
- [Capture a note](./capture-note.md) covers the header button, the Q shortcut, and the command palette, plus persistence.
- [Note view](./note-view.md) covers the live-preview editor, task checkboxes, inline discard, Delete with Undo, previews, and nested phone drawers.
- [Thread Notes](./thread-notes.md) covers capture, editing, archiving and its history, unarchiving, and persisted deletion inside a Thread.
- [Add a Note to a Thread](./add-to-thread.md) covers Add to thread… with its date preview, Undo and Open thread, and New thread from note.
- [Create a thread](./create-thread.md) covers the New thread dialog and the thread pane it opens.
- [Resolved Threads](./resolved-threads.md) covers the Resolved threads group of the palette's History chip, its search and resolution ordering, opening in place, and Reopen in the pane and drawer.
- [Notes on the Dashboard](./notes-on-the-dashboard.md) covers the Dashboard's Notes filter and its URL, the old Notes addresses, Archive and Unarchive, and finding Archived Notes in History by searching their bodies.
- [Tasks](./tasks.md) covers adding, focusing, and completing a Task in the thread pane, the drawer, and the Dashboard card, dated Tasks, repeating Tasks (Repeat, Skip, Late), and completing a Task with a note.
- [Dashboard board](./dashboard-board.md) covers the one dated list on file tabs, No date beside it or folded above it, the shared Thread and Note card, the filter overflow, and the phone layout.
- [Follow-up dates](./follow-up-dates.md) covers the Follow-up date on standalone Notes and their Dashboard placement. A Thread comes back at its soonest dated Task, covered in [Tasks](./tasks.md).
- [Manage areas](./manage-areas.md) covers adding an area and seeing it in the Filter the board row.
- [Phone installation and sharing](./phone-installation.md) covers manifest/icons, shared Note capture through sign-in, retry, and persistence.

- [Reload an outdated tab](./version-reload.md) covers API/web version mismatch, web readiness, pending saves, and preserved stored results.
