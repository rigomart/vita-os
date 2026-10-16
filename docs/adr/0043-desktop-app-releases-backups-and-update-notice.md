# Desktop app: releases, backups and an update notice

**Status:** Accepted. Amends [ADR 0042](./0042-local-desktop-app-on-shared-operations.md) (it makes one network call, keeps backups, and has a release workflow).
**Date:** 2026-10-16

The desktop app (ADR 0042) renders the same product as the web app, but a person using it misses what the web gets from its server. The web is always the latest build, its data sits in D1 with Cloudflare's own recovery, its failures land in server logs, and the browser supplies menus, right-click and window handling. On desktop, each of these is the app's job, and it does none of them yet: a build is installed by hand from the owner's own Mac, the data is one file protected only by the pre-migration copy, main's console output goes nowhere once packaged, and the menus are Electron's defaults.

Code signing, notarization and installing updates without the person are deferred until the owner decides the app is ready for public use. Each needs a paid Apple Developer account.

## Decision

**The desktop app behaves as a Mac app.** Its menus carry the product's actions (New Note, New Thread, Search, Download My Data), right-click gives spelling suggestions and Cut, Copy and Paste, the window reopens where it was, its background and native controls follow the product's theme, and it has its own icon and version in About. Developer tools appear only in an unpackaged build.

**Menu actions reach the product through the host.** A host may hand the shell a source of commands (`new-note`, `new-thread`, `search`), and the shell runs its own action for each, as it does for a shortcut. The web passes none.

**Its data is backed up automatically.** Once a day while the app runs, and at launch when the newest backup is older than that, main writes a consistent copy of the database with SQLite's `VACUUM INTO` to a `backups` folder beside it and keeps the newest ten. Back Up Now and Show Backups in Finder are in the File menu. Restoring is by hand (quit, replace `vita.db` with a copy) and the README says how. At launch the app checks the file with `PRAGMA quick_check` before migrating it; a damaged file opens nothing and the error names the newest backup.

**Download my data works on desktop.** It saves the same file the web downloads, through a save dialog, from the menu and the product's own menu item.

**Main keeps a log.** Main's output, the window's warnings and errors, and crashes go to `~/Library/Logs/Vita OS/main.log`, kept below a few megabytes by rolling over once. Help → Show Logs opens it. A crashed window says so and offers to reload. Nothing is uploaded.

**Releases are built by a workflow.** The desktop app has its own version in `apps/desktop/package.json`. Pushing a tag `desktop-v<version>` that matches it builds the app on a macOS runner and publishes a GitHub Release with the `.dmg`. It is ad-hoc signed, as ADR 0042's builds are.

**The app checks for a newer release, and says so.** This is its one network call: GitHub's releases API for this repository. A packaged app checks after launch and once a day; when a newer `desktop-v` release exists, it says so once per version and offers to open its page. Installing stays by hand, as now. Check for Updates… in the app menu asks at any time, and Check for Updates Automatically turns the daily check off. A failed automatic check is logged, not shown; a failed manual check is shown.

**Release builds are hardened.** The packaged app cannot be run as plain Node or take `NODE_OPTIONS`, loads only its own archive and checks that archive's integrity (Electron fuses), and its pages run under a Content Security Policy that allows only the app's own files.

## Consequences

- ADR 0042's "makes no network calls" now has one exception, which the person can turn off. The renderer still makes none.
- Backups live on the same disk as the data. They protect against a bad write, a bad migration or a mistake, not a lost computer; the computer's own backups still cover that.
- Without signing, macOS asks the person to confirm every newly downloaded build (README, "Install on macOS").
- The node inspector fuse stays on, because Playwright drives the packaged app through it.

## Out of scope

- Code signing, notarization and installing an update in place (needs an Apple Developer account). The update notice is the step before them.
- Restoring a backup from inside the app, and export to or sync with the cloud.
- Notifications, a menu-bar icon, quick capture from anywhere, open at login, and links into the app from outside.
- Windows and Linux builds, and an Intel build.
