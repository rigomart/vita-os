# Features

What to prove about each user-visible feature of the Vita OS web app. Prove a change by driving its new behavior and rerunning the checks of every feature it touched. A change that alters a feature's behavior updates its file in the same change; a new feature gets a file and a row.

| Feature | Behavior | Not covered |
| --- | --- | --- |
| [Sign in](sign-in.md) | Sign-up and sign-in land on the Dashboard; signed out, product routes go to `/sign-in`; Sign out ends the session. | Phone width; the sign-in form's empty-field validation |
| [Create a thread](create-a-thread.md) | New thread stores an Open Thread and opens it in the side pane or drawer. | With an Area (new or existing); the palette's New thread; the bottom bar below 1024px; Area defaulting to the Dashboard filter |
| [Capture a note](capture-a-note.md) | New note stores a Standalone Note, undated under `Notes` or under its Follow-up date's day. | `Q` shortcut; the palette; the bottom bar below 1024px; a time or Repeat on the Follow-up date |
| [Tasks](tasks.md) | Add, date and complete Tasks in the pane, the drawer and a Dashboard line; Activity logs completion. | Edit, Remove, Complete with a note, Skip, Repeat, a time; completing from a Dashboard line; the drawer below 1024px |
| [Dashboard](dashboard.md) | Dated Threads and Notes grouped by when they come due beside No date's runs; the filter row's counts and Notes filter. | Late, Today, weekdays and Later; Area filters and `1..9`/`0`; keyboard movement through the list; below 1024px (No date folded); several dated Tasks of one Thread ringing together |
| Note view | One live-preview Markdown editor per Note: edit in place, discard prompt, Delete with Undo, Archive. | No checks yet |
| Thread Notes | Notes inside a Thread: capture, edit, Archive, Unarchive, delete. | No checks yet |
| Add a Note to a Thread | An open Standalone Note moves into a Thread after a five-second Undo; a dated Note becomes a dated Task. | No checks yet |
| Repeat and Skip | A repeating Task or Note moves to its next occurrence on Complete; Skip passes one. | No checks yet |
| Resolved Threads and History | The palette's History lists Resolved Threads and Archived notes; Reopen returns a Thread to open work. | No checks yet |
| Activity Log | A Thread's Activity tab: one sentence per entry under day headings, newest first. | No checks yet (only `Completed <Task>` is checked, in Tasks) |
| Manage areas | Add, rename, re-icon, reorder and delete Areas; a deleted Area's Threads stay open without it. | No checks yet |
| Command palette | `Search, Command K` finds Threads and Notes, runs New thread and New note, and opens History. | No checks yet |
| Download my data | The account menu's `Download my data` exports the user's data. | No checks yet |
| Appearance | The account menu's `Appearance` switches the theme. | No checks yet |
| Phone installation and sharing | The manifest makes Vita OS installable; text shared to `/share-target` becomes a Standalone Note, through sign-in if needed. | No checks yet |
| Reload an outdated tab | When the API's version differs from the tab's build, the tab waits for pending writes and the matching build, then reloads. | No checks yet |
| Desktop app | The Electron app (`apps/desktop`): local SQLite, no sign-in. | Not a web surface; this skill does not cover it |
