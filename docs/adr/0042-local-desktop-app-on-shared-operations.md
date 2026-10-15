# Local desktop app on shared operations

**Status:** Accepted. Amends [ADR 0020](./0020-api-layering-operations-and-one-round-trip-storage.md) (the storage seam it left out now exists) and [ADR 0036](./0036-drizzle-d1-storage.md) (Wrangler is no longer the only migration runner).
**Date:** 2026-10-14

Issue [#468](https://github.com/rigomart/vita-os/issues/468) adds a second host for the product: an Electron app that keeps its data in a SQLite file on the person's computer. It works offline, needs no account, and keeps personal records off a server. It is also the base for a later, optional cloud option on desktop; that option is not part of this decision.

`packages/application` already needs only an `ApplicationClient`, a `Viewer` and a `SessionGate` from its host. What was missing was a way to run the API's operations against a database on the computer. ADR 0020 named that gap: "Add an interface when a second storage target exists — for example a local database behind a desktop host." This is that trigger.

## Decision

**Vita OS runs locally on desktop, with no account.** The desktop app (`apps/desktop`) renders the same product. Its data lives in a SQLite file in the app's user-data folder. It makes no network calls and has no sign-in.

**Operations and storage move out of `apps/api` into `@vita-os/operations`** (`packages/operations`). The feature operations, storage, row adapters, errors, the Drizzle schema and the platform pieces they need go with it, and they still call `@vita-os/core` for every rule. `apps/api` keeps HTTP, Better Auth, CORS, guards, the Worker entry and `apps/api/migrations`. One copy of every write's guards and atomicity runs on both targets, and the `ApplicationClient` contract suite (`@vita-os/contracts/testing`) runs against each.

**The operations take a small database seam, not a repository interface.** The request scope stops carrying the raw D1 binding. It carries what storage needs from a database:

- a Drizzle SQLite database;
- an atomic `batch`;
- the number of rows a statement changed (`meta.changes` on D1, `rowsAffected` on libsql);
- recognition of a unique-constraint failure.

The seam is designed from what the operations need, as ADR 0020 asked, and it is not shaped by the tables. A storage function still makes one round trip: one statement or one batch.

In code it is one interface in `@vita-os/operations`, and each host adapts its own driver to it: the Worker in `apps/api`, desktop in `@vita-os/local`. The package itself holds no driver code.

```ts
interface Database {
  drizzle: SQLiteDatabase; // Drizzle's async SQLite database, with `batch`
  changes(result: unknown): number;
  isUniqueViolation(error: unknown, columns: string): boolean;
}

interface RequestScope {
  db: Database;
  clock: Clock;
  actorId: string;
}
```

**Targets.** The Worker passes a Drizzle D1 database. Desktop passes `@libsql/client` through Drizzle's libsql driver. `@vita-os/local` (`packages/local`) holds the libsql implementation of the seam, the migration runner, and the local `ApplicationClient`, which calls the operations in-process with the system clock.

**One migration history.** The desktop runner applies the files in `apps/api/migrations` in order and records what it applied. Before it runs pending migrations it copies the database file next to itself. It refuses to open a database holding a migration it does not know, because a newer app wrote it. Wrangler still migrates D1; it is no longer the only runner. ADR 0036's rule against Drizzle's migrator replaying the baseline stands: the runner is our own and applies the committed SQL.

**One fixed local owner.** Every table is owner-scoped, so desktop uses one fixed owner ID and storage stays unchanged. Ownership checks still run on every statement.

**Sign out is hidden.** `signOut` becomes optional in `ViewerAccess`. With no session there is nothing to end, and the menu item is not shown.

**Import is one way.** The web app downloads all of a person's data as one file. The desktop app imports that file into an empty desktop database, and refuses any other database without changing it. Nothing on either side is overwritten or merged. The file travels by hand: desktop needs no cloud sign-in, cookies or CORS. IDs, slugs, timestamps, revisions, Activity Logs and archived Notes (stored as `done`) are kept as stored, so desktop shows the same history as the web.

**macOS first, unsigned.** The first build is for the owner's Mac.

## Why libsql

Drizzle 0.45.3 gives its libsql driver the same `batch` as D1, so the shared atomic writes carry over unchanged. `better-sqlite3` has no `batch`, so every atomic write would need a second form. Drizzle 0.45.3 has no `node:sqlite` driver.

## Rejected shapes

- **A third `ApplicationClient` that re-implements the operations on SQLite**, as the lab's in-memory client does. Cheaper at first, but every write's guards would live twice and could drift.
- **A desktop wrapper around the web app.** Not local; it still needs the network and an account.
- **Local-first with sync now.** The app assumes the server holds the truth (revision compare-and-swap, refused conflicts), and cross-device freshness (#342) is parked. Too large for a first desktop version.
- **`better-sqlite3`** and **`node:sqlite`**, for the reasons above.
- **A generic repository interface.** ADR 0020 rejected it and the reasons hold: it would repeat the operations it serves. The seam is the database, not the tables.

## Consequences

- A rule change is made once. A business rule written in `apps/api` or `apps/desktop` instead of core or the operations is a bug.
- The seam is where the two targets can differ. Atomic batch rollback, competing writes and ownership are tested on real D1 and on a real libsql file.
- Migration `0004` rebuilds tables under `PRAGMA defer_foreign_keys`. The local runner's tests must show it behaves the same on libsql, or a historical Thread's Activity Log could be lost on upgrade.
- Pending migrations on desktop are protected only by the pre-migration copy and the computer's own backups. A failing migration must leave the original data and its copy intact and report the failure.
- `apps/api/migrations` now serves two runners. A migration must stay valid for the API still serving during deployment, and for a desktop database on an older schema.

## Out of scope

- Sync, and any cloud option on desktop. It gets its own ADR (conflict handling, IDs, an outbox).
- Moving data from desktop to the cloud, and merging an import into a desktop database that already has data.
- A user-facing backup or export on desktop.
- Windows and Linux builds, code signing, notarization, auto-update, release workflows.
- Several local profiles.
