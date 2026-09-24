# Cutover rehearsal runbook (#351)

This runbook stands up the isolated staging stack from
`migration/cloudflare-cutover`, moves a representative Convex snapshot into it,
and exercises the smoke suite and rollback that the production cutover (#352)
will repeat. The data commands come from [data-cutover.md](data-cutover.md).

Nothing here touches production. The production Worker `vita-os-web`, the
hostname `vita.rigos.dev`, and the production Convex deployment stay as they
are.

## The staging stack

| Piece        | Value                                       |
| ------------ | ------------------------------------------- |
| Web Worker   | `vita-os-web-staging` at `vita-staging.rigos.dev` |
| API Worker   | `vita-os-api-staging` at `vita-api-staging.rigos.dev` |
| D1 database  | `vita-os-staging` (binding `DB`)            |
| Auth origins | `BETTER_AUTH_URL=https://vita-api-staging.rigos.dev`, `BROWSER_ORIGIN=https://vita-staging.rigos.dev` |

Both hostnames are under `rigos.dev`, so a browser treats the web → API request
as same-site and sends Better Auth's `SameSite=Lax` session cookie. Two
`*.workers.dev` hostnames would be cross-site and every `/v1` request would
return 401. Production follows the same shape: `vita.rigos.dev` for the web and
a sibling API hostname, such as `vita-api.rigos.dev`, which #352 configures.

The `Deploy staging` workflow, run by hand on the migration branch, deploys all
of it. It refuses to run until the staging D1 ID is committed, applies D1
migrations before deploying the API, and smoke-tests both Workers.

While the rehearsal runs, do not push to `main`. A push deploys `main`'s
Convex-backed build over `vita-os-web-staging`. If that happens, run `Deploy
staging` from the migration branch again.

## 1. One-time setup (human)

Run these from `apps/api` with a Cloudflare login that can create D1 databases
and Worker secrets.

1. Create the database and commit its ID to the migration branch:

   ```bash
   bunx wrangler d1 create vita-os-staging
   ```

   Answer **no** when Wrangler offers to add the binding for you. It adds a
   second top-level binding, which can point local development at the remote
   database. Instead, put the printed ID in `database_id` under `env.staging` in
   `apps/api/wrangler.jsonc`. The `vita-os-staging` ID
   `52374eda-17ed-4e85-ad3e-b9034d71b780` is already there.

2. Set the API secret. Better Auth needs at least 32 characters:

   ```bash
   openssl rand -base64 32 | bunx wrangler secret put BETTER_AUTH_SECRET --env staging
   ```

3. For each social provider that has migrated accounts, register the staging
   callback and set both halves of the pair. A partial pair fails at startup.

   - GitHub callback: `https://vita-api-staging.rigos.dev/api/auth/callback/github`
   - Google redirect URI: `https://vita-api-staging.rigos.dev/api/auth/callback/google`

   ```bash
   bunx wrangler secret put GITHUB_CLIENT_ID --env staging
   bunx wrangler secret put GITHUB_CLIENT_SECRET --env staging
   bunx wrangler secret put GOOGLE_CLIENT_ID --env staging
   bunx wrangler secret put GOOGLE_CLIENT_SECRET --env staging
   ```

4. Confirm that the repository's `CLOUDFLARE_API_TOKEN` can edit D1 as well as
   Workers scripts, and can manage Workers custom domains on the `rigos.dev`
   zone. D1 is new to this workflow.

5. Choose the rehearsal source: a non-production Convex deployment that holds
   representative data. It needs several users, a social account if one is used
   in production, completed Notes, resolved Threads, Up Next lists, and legacy
   Activity Log entries. Record its deployment name.

## 2. Freeze, export, import, validate

Import into the empty database before the stack is used. The import guard
rejects any target that already holds a user or a record, including one created
by a test sign-in. Run from the repository root and keep every artifact in the
private directory.

```bash
mkdir -m 700 /private/tmp/vita-rehearsal
```

1. **Freeze.** Pause the rehearsal Convex deployment from its dashboard
   (Settings → Pause deployment). This is the maintenance control #352 uses
   against production. The rehearsal showed that a paused deployment refuses
   every function (`Cannot run functions while this deployment is paused`),
   so nothing can write, while `convex export` still succeeds. It also refuses
   reads and Convex sign-in, so the old app is unavailable for the whole
   freeze. Confirm the pause with any function call:

   ```bash
   cd apps/web && bunx convex run areas:list '{}'   # must fail with "paused"
   ```

2. **Export once.**

   ```bash
   bunx convex export --deployment <rehearsal-deployment> --path /private/tmp/vita-rehearsal/snapshot.zip
   ```

3. **Prepare.**

   ```bash
   python3 apps/api/migration/convex_to_d1.py prepare /private/tmp/vita-rehearsal/snapshot.zip /private/tmp/vita-rehearsal/import.sql
   ```

4. **Apply the schema and import.**

   ```bash
   cd apps/api
   bunx wrangler d1 migrations apply vita-os-staging --remote --env staging
   bunx wrangler d1 execute vita-os-staging --remote --env staging --file /private/tmp/vita-rehearsal/import.sql
   ```

5. **Export the target and validate.**

   ```bash
   bunx wrangler d1 export vita-os-staging --remote --env staging --output /private/tmp/vita-rehearsal/d1.sql
   cd ../..
   python3 apps/api/migration/convex_to_d1.py validate /private/tmp/vita-rehearsal/snapshot.zip /private/tmp/vita-rehearsal/d1.sql --report /private/tmp/vita-rehearsal/report.json
   ```

6. **Check the replay guard.** Run the `execute` command from step 4 a second
   time. It must fail with `table migration_import_guard already exists`.

Abort on any failed command or validator mismatch. To retry, delete and
recreate `vita-os-staging`, commit the new ID, and start again from step 3.
Never edit imported rows by hand.

## 3. Deploy

```bash
gh workflow run deploy-staging.yml --ref migration/cloudflare-cutover
gh run watch
```

Save the run URL and its `staging-deploy-evidence` artifact.

## 4. Smoke suite (human, in a browser)

Sign in at `https://vita-staging.rigos.dev` as a migrated user. Use each
migrated sign-in method: password, GitHub, and Google.

- [ ] The Dashboard shows the expected Now, This week, Later, Ready to move,
      Open, and Notes content.
- [ ] Area navigation, Area creation and editing (Condition, Standard, Area
      Icon), ordering, and deletion rules work.
- [ ] Thread creation, detail, Summary, Area reassignment, Follow-up, resolving,
      and reopening work.
- [ ] Completing a Next Move promotes Up Next, records one Activity Log Entry,
      and updates every view in the current tab.
- [ ] Standalone Notes and Thread Notes: capture, editing, completing,
      reopening, Attention Date, loading more, and deletion work.
- [ ] Loading, empty, not-found, and validation states show as before.
- [ ] A second migrated user sees only their own data. Opening the first user's
      Thread URL shows not-found.
- [ ] With the network offline in DevTools, a mutation rolls back and shows its
      failure. After reconnecting, the view refreshes. Focusing the tab also
      refreshes it. DevTools shows no interval polling.
- [ ] Signing out returns to `/sign-in`. Afterwards,
      `https://vita-api-staging.rigos.dev/v1/areas` returns 401.

## 5. Rollback rehearsal

1. Find the version to return to, then roll back to it:

   ```bash
   cd apps/web
   bunx wrangler versions list --name vita-os-web-staging
   bunx wrangler rollback <previous-version-id> --name vita-os-web-staging --message "<reason>" --yes
   ```

2. Unpause the rehearsal Convex deployment. Confirm that the restored app reads
   and writes against Convex, and that Convex still holds the pre-freeze data.
   That data stays authoritative until #352 declares otherwise.

3. Roll forward with the same command and the replacement's version ID, or
   redeploy with `Deploy staging`, and confirm that it serves again.

In the rehearsal, rolling back took 3s for the command and 10s until the site
served the previous bundle. Rolling forward took 2s and 4s. The custom domain
stays attached across rollbacks, because routes are not part of a version.

Staging rolled back only between replacement versions. Its older version was
`main`'s Convex build, which targets production Convex, and rolling back to it
would have put a production client on a staging hostname.

**In production** a rollback restores the pre-cutover web version on
`vita-os-web` and then unpauses production Convex. Record that version's ID
before deploying the replacement. Rolling back the web Worker does not touch
the API Worker or D1. They can stay deployed and simply receive no traffic.
Once writes have resumed on D1, rolling back to Convex loses those writes, so
take the rollback decision before resuming writes.

## Evidence to save on #351

- Snapshot identifier, D1 database ID, and `report.json`
- Deploy run URL and the `staging-deploy-evidence` artifact
- Results of the smoke checklist, the replay-guard failure, and rollback timings
- Freeze method, and whether export works while paused

## Production-only substitutions (for #352)

| Rehearsal                                  | Production                                |
| ------------------------------------------ | ----------------------------------------- |
| `convex export --deployment <rehearsal>`    | `convex export --prod`                    |
| `vita-os-staging`, `--env staging`          | a new, empty production D1 and `--env production` (to be added) |
| `vita-staging.rigos.dev`, `vita-api-staging.rigos.dev` | `vita.rigos.dev` and the production API hostname |
| `Deploy staging`                            | `Deploy production`, after its build switches from `VITE_CONVEX_*` to `VITE_API_BASE_URL` |
