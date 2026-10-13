# Vita OS verification map

This directory is the maintained source for verifying Vita OS's user-facing behavior. Read this index before driving the app, then use the matching feature file as the recipe and its spec as the working example.

How to run specs, which user and data a test starts with, how to drive, and what counts as proof are in [`../SKILL.md`](../SKILL.md). This directory holds what is specific to each feature.

## Spec coverage

Run a spec with `bun run test:e2e tests/<name>.spec.ts`. Each spec file runs as one user, whose data its tests share in order ([Users and test data](../SKILL.md#users-and-test-data)). Each checks visible behavior after reloads and persisted writes with read-only D1 queries. Its header comment says what it proves. Run the specs covering your change; add or update a test when a feature file's recipe changes.

| Spec | Feature maps and scope |
| --- | --- |
| [notes](../../../../apps/e2e/tests/notes.spec.ts) | [Capture a note](./capture-note.md), [Note view](./note-view.md): header capture, live preview while typing, saved edits in place, Delete with Undo and persisted deletion. |
| [notes-dashboard](../../../../apps/e2e/tests/notes-dashboard.spec.ts) | [Notes on the Dashboard](./notes-on-the-dashboard.md): Notes filter, archive, archived body search in History, and unarchive. |
| [repeating-notes](../../../../apps/e2e/tests/repeating-notes.spec.ts) | [Follow-up dates](./follow-up-dates.md), [Notes on the Dashboard](./notes-on-the-dashboard.md): a monthly Repeat on a Note card, Complete (no Activity Log entry), one Late item, the Note view's Complete, Archive to History and Unarchive keeping the Repeat, Clear, Add to thread carrying the Repeat, and the card at 1024×768. |
| [dashboard-filter-counts](../../../../apps/e2e/tests/dashboard-filter-counts.spec.ts) | [Dashboard board](./dashboard-board.md): All counts dated and undated Standalone Notes plus Threads; Area and Notes counts stay separate, on desktop and phone. |
| [thread-notes](../../../../apps/e2e/tests/thread-notes.spec.ts) | [Thread Notes](./thread-notes.md): desktop capture, edit, archive, unarchive, and deletion. |
| [add-to-thread](../../../../apps/e2e/tests/add-to-thread.spec.ts) | [Add a Note to a Thread](./add-to-thread.md): undated add to an existing Thread and New thread from note. Dated conversion stays in `dated-tasks.spec.ts`. |
| [areas](../../../../apps/e2e/tests/areas.spec.ts) | [Manage areas](./manage-areas.md): create, rename, icon, reorder, and delete while Threads survive without the label. |
| [history](../../../../apps/e2e/tests/history.spec.ts) | [Resolved Threads](./resolved-threads.md): palette browsing and search, opening and reopening in the pane and drawer. |
| [resolve-reopen](../../../../apps/e2e/tests/resolve-reopen.spec.ts) | [Resolved Threads](./resolved-threads.md), [Tasks](./tasks.md): resolving a Thread with open Tasks, the resolution entry naming them, and Reopen without them. |
| [sign-in](../../../../apps/e2e/tests/sign-in.spec.ts) | [Sign in](./sign-in.md): menu sign-out, the signed-out gate, and sign-in through the real form. |
| [tasks](../../../../apps/e2e/tests/tasks.spec.ts) | [Tasks](./tasks.md): add, focus, unfocus, edit, remove, and complete in the Thread pane, and the Activity Log. |
| [dashboard-tasks](../../../../apps/e2e/tests/dashboard-tasks.spec.ts) | [Tasks](./tasks.md), [Dashboard board](./dashboard-board.md): the card's Task slot (one Task, several unfocused, one focused) and completing from the card. |
| [dated-tasks](../../../../apps/e2e/tests/dated-tasks.spec.ts) | [Tasks](./tasks.md), [Dashboard board](./dashboard-board.md): a date with a time from a Task row, placement and the card's lead, rescheduling from the card, two Tasks on one day, a card with no single Task, and a dated Note added to a Thread. |
| [repeating-tasks](../../../../apps/e2e/tests/repeating-tasks.spec.ts) | [Tasks](./tasks.md): daily, weekly, Every N days (drawer), and monthly Repeats, Complete and Skip from the row and the card, and Late. |
| [complete-with-note](../../../../apps/e2e/tests/complete-with-note.spec.ts) | [Tasks](./tasks.md): Complete with a note in the side pane and the drawer, and a Dashboard card completing in one click. |
| [thread-drawer](../../../../apps/e2e/tests/thread-drawer.spec.ts) | [Tasks](./tasks.md): Thread detail as a drawer at 1024×768: Tasks, focus, completion, Activity, reload, close. |
| [thread-edit-tasks](../../../../apps/e2e/tests/thread-edit-tasks.spec.ts) | [Tasks](./tasks.md): renaming a Thread right beside Task commands, in both orders, without a conflict. |

## Feature entry contract

Each feature file has an H1 title, a one-paragraph description of the user-visible behavior, a one-line `Status` (`proven on <short sha>` or `in #<PR>`, by which spec or by hand, then `Not driven:` and what was skipped; or `mapped from source, not yet driven`), then exactly four H2 sections in order: `Sub-features`, `How to get to it (user POV)`, `Driving it` (Playwright locators and the spec that drives it), `Gotchas`. `Status` says what is true now: replace it on every proof instead of appending to it. Evidence paths and earlier proofs belong in the PR description, since `.verify/evidence/` exists only on the machine that made it.

## Keeping the map current

The feature map is only as good as its last update, and you are the one who updates it. After driving the app, before you report:

- **The feature has no file here.** Explore its entry points with a scratch spec (print `ariaSnapshot()` of the surface), find the table it writes in `apps/api/migrations`, and prove it once by the standards in `../SKILL.md`. Then write `<feature>.md` in the entry contract, using the locators that just worked, add a line to the index below, and move the spec to `apps/e2e/tests/`. Commit it with the change that introduced or altered the feature.
- **A documented step no longer matches the app.** Decide which side is wrong. If the app regressed, report the regression and leave the file and the spec alone. If the feature changed on purpose, fix the file and the spec in the same change and say so in your report.
- **The file says `mapped from source, not yet driven`.** Correct every handle against the page while you drive it, then set `Status: proven on <short sha>`.
- **You proved a feature that already has a `Status`.** Replace the line; never append to it. It names the latest proof and what it did not drive. Earlier proofs and evidence paths go in the PR description.
- **Never mark a step proven that you did not run.** A sub-feature you skipped stays listed, and your report says it was skipped.

## Features

- [Sign in](./sign-in.md) covers the email and password form, the session check, and the signed-out redirect.
- [Capture a note](./capture-note.md) covers the header button, the Q shortcut, and the command palette, plus persistence.
- [Note view](./note-view.md) covers the live-preview editor, task checkboxes, inline discard, Delete with Undo, previews, and nested phone drawers.
- [Thread Notes](./thread-notes.md) covers capture, editing, archiving and its history, unarchiving, and persisted deletion inside a Thread.
- [Add a Note to a Thread](./add-to-thread.md) covers Add to thread… with its date preview, Undo and Open thread, and New thread from note.
- [Create a thread](./create-thread.md) covers the New thread dialog and the thread pane it opens.
- [Resolved Threads](./resolved-threads.md) covers the Resolved threads group of the palette's History chip, its search and resolution ordering, opening in place, and Reopen in the pane and drawer.
- [Notes on the Dashboard](./notes-on-the-dashboard.md) covers the Dashboard's Notes filter and its URL, the old Notes addresses, Archive and Unarchive, and finding Archived Notes in History by searching their bodies.
- [Tasks](./tasks.md) covers adding, focusing, and completing a Task in the thread pane, the drawer, and the Dashboard card, dated Tasks, repeating Tasks (Repeat including monthly, Skip, Late), and completing a Task with a note.
- [Activity Log](./activity-log.md) covers a Thread's Activity tab: full-sentence entries on one rail, wrapping, a resolution's note and dropped Tasks, day headings, and Show earlier.
- [Dashboard board](./dashboard-board.md) covers the one dated list on file tabs, No date beside it or folded above it, the shared Thread and Note card, the filter overflow, and the phone layout.
- [Follow-up dates](./follow-up-dates.md) covers the Follow-up date on standalone Notes, their Repeat and Complete, and their Dashboard placement. A Thread comes back at its soonest dated Task, covered in [Tasks](./tasks.md).
- [Manage areas](./manage-areas.md) covers adding an area and seeing it in the Filter the board row.
- [Phone installation and sharing](./phone-installation.md) covers manifest/icons, shared Note capture through sign-in, retry, and persistence.
- [Reload an outdated tab](./version-reload.md) covers API/web version mismatch, web readiness, pending saves, and preserved stored results.
