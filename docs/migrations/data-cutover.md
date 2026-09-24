# Convex data export, D1 import, and validation

Issue [#350](https://github.com/rigomart/vita-os/issues/350) supplies a repeatable
data path for the freeze-and-cutover migration. This procedure is for rehearsal
and eventual approved cutover. Do not run the production export or remote import
while developing the tooling. Issue #351 must exercise these commands in an
isolated environment before issue #352 changes production.

## Inputs and boundaries

- One Convex snapshot ZIP is the only source. The Convex export includes the
  application tables and the mounted Better Auth component. The importer refuses
  a snapshot without `_components/betterAuth/user/documents.jsonl`.
- The target is a **new, empty** D1 database with `apps/api/migrations` applied.
  The import SQL creates `migration_import_guard` and fails if any target data
  exists or if the script is replayed. If a transfer fails, discard that target
  and start with another empty database; never append or edit records manually.
- The importer is offline. It reads a snapshot and writes SQL; it has no Convex
  or Cloudflare credentials and cannot change either service.
- Snapshot ZIPs, generated SQL, and D1 SQL exports contain user data and may
  contain password hashes and provider tokens. Keep them outside the repository
  with restricted access, and retain the final production snapshot for rollback.
  The JSON validation report contains counts only and can be saved as evidence.

## Rehearsal commands

Run from the repository root. Use an isolated Convex deployment and a distinct
rehearsal D1 database for this section. Substitute that database's Wrangler
config and name in the last three commands; `vita-os-local` below is the local
development binding, not a production database.

```bash
mkdir -m 700 /private/tmp/vita-migration-rehearsal
bunx convex export --deployment <rehearsal-deployment> --path /private/tmp/vita-migration-rehearsal/snapshot.zip
python3 apps/api/migration/convex_to_d1.py prepare /private/tmp/vita-migration-rehearsal/snapshot.zip /private/tmp/vita-migration-rehearsal/import.sql
cd apps/api
bunx wrangler d1 migrations apply vita-os-local --local
bunx wrangler d1 execute vita-os-local --local --file /private/tmp/vita-migration-rehearsal/import.sql
bunx wrangler d1 export vita-os-local --local --output /private/tmp/vita-migration-rehearsal/d1.sql
cd ../..
python3 apps/api/migration/convex_to_d1.py validate /private/tmp/vita-migration-rehearsal/snapshot.zip /private/tmp/vita-migration-rehearsal/d1.sql --report /private/tmp/vita-migration-rehearsal/report.json
```

Wrangler's remote `--file` import is the Cloudflare-supported path for a SQL
dump. For the isolated remote rehearsal and approved production cutover, use the
same sequence with the exact environment-specific database name/config and
`--remote`; do not point the local example at an existing shared database.
The rehearsal runbook in #351 must record those exact values and commands.

The validator compares every imported field, including IDs, owners, references,
manual order, timestamps, note completion, Thread state and activity metadata,
and auth account links. It also checks counts, foreign keys, and absence of
sessions. It exits nonzero on the first mismatch. Save its concise `pass` report
with the snapshot identifier and D1 export identifier in the cutover record.

## Compatibility rules

- Convex `tasks.text` becomes `notes.body`; IDs, Attention Date (`when`),
  creation and update times, state, and completion time stay unchanged.
- `activityLogs.next_action_change` becomes
  `activity_log_entries.next_move_change`; old `status_change` becomes
  `state_change`.
- Leftover hand-written Activity Log entries (`note`, `reference`, `waiting`,
  `decision`) become open Thread Notes with the same ID, body, and creation
  time. This follows the existing Convex compatibility migration and keeps the
  public Activity Log automatic-only. If a Thread's last-activity content was
  copied from such a note, the importer clears that content as the Convex
  migration does. The report counts these conversions.
- Thread activity metadata is copied unchanged. Deleting a Thread Note keeps
  the stamp it set, in Convex and in D1, so `lastActivityAt` may be newer than
  every surviving entry. The importer only rejects a stamp older than a
  surviving Activity Log Entry or Thread Note, or saved content that matches no
  Activity Log Entry at that stamp.
- Better Auth `user`, `account`, and `verification` records retain IDs and
  durable fields, including credential hashes and provider relationships.
  An older component `user.userId` may identify the same user's application
  records; the importer maps it to the preserved Better Auth user ID and rejects
  ambiguous mappings. The Worker accepts optional GitHub and Google client ID
  and secret pairs; the rehearsal must configure each provider represented by
  migrated accounts and test its sign-in flow. A partial pair fails startup.
  `session` and `rateLimit` are intentionally discarded, requiring sign-in
  again. `jwks` is discarded too: it holds the key the Convex integration used
  to sign tokens for Convex, and the Worker has no JWT plugin. Nonempty
  component tables unsupported by the target Better Auth configuration fail
  preflight rather than disappear silently. Convex system tables (`_tables`)
  are skipped.
- `items`, `projects`, `projectLogs`, and `userSettings` are pre-Threads
  storage the Convex app no longer reads. Production never carried them
  forward: every current Thread, Note, and Activity Log Entry is newer than
  their newest row. They are discarded by decision and counted under
  `discarded_retired_rows`; the retained final Convex export still holds them.
  Any other unknown nonempty table fails preflight.
- Convex exports every number as a float (`1747000000000.0`). Whole values
  become integers; a fractional timestamp or order fails rather than rounding.
- Duplicate owner/slugs fail preflight because D1 requires uniqueness. Resolve
  the source data through a separately reviewed plan before cutover; this tool
  never rewrites production records to make them fit.

## Production sequence to finalize in #351

The isolated rehearsal of this sequence is in
[cutover-rehearsal.md](cutover-rehearsal.md).

1. Obtain explicit approval for the cutover window and confirm the rollback
   owner, old deployment revision, empty target D1 database, and secrets.
2. Stop all writes to the Convex-backed application at the deployment boundary.
   Verify that sign-in and mutation requests cannot write before exporting.
   The precise maintenance control and verification request must be rehearsed
   and entered in the #351 runbook.
3. Run **one** `bunx convex export --prod --path <private snapshot.zip>` after
   the freeze. Do not run preparatory Convex mutations or combine table exports
   taken at different times.
4. Run `prepare`, apply the canonical D1 schema, import into the empty D1
   database, export that database, and run `validate`. Preserve the source ZIP,
   import SQL, target export, and concise validation report.
5. Abort on any command failure, mismatch, unsupported auth data, duplicate
   slug, or missing record. Keep Convex authoritative; restore the previous
   application deployment and writes only under the approved rollback procedure.
6. Only after validation passes, deploy and smoke-test the replacement and seek
   the #352 approval for the traffic switch and resuming writes. Do not migrate
   active sessions.

The production-only substitutions, maintenance control, and rollback commands
are deliberately completed by the isolated rehearsal in #351; no production
resource is created or changed by this ticket.
