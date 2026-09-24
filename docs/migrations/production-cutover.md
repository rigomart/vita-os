# Production cutover runbook (#352)

This runbook moves production Vita OS from Convex to the Cloudflare stack and,
after an observation period, retires Convex. It repeats the sequence rehearsed
in [cutover-rehearsal.md](cutover-rehearsal.md) with the production
substitutions filled in. The data commands come from
[data-cutover.md](data-cutover.md). Do not invent steps during the window. If a
step does not go as written, treat it as an abort condition.

## The production stack

| Piece        | Value |
| ------------ | ----- |
| Web Worker   | `vita-os-web` at `vita.rigos.dev` (serves the Convex build until the traffic switch) |
| API Worker   | `vita-os-api` at `vita-api.rigos.dev` |
| D1 database  | `vita-os-production` (binding `DB`) |
| Auth origins | `BETTER_AUTH_URL=https://vita-api.rigos.dev`, `BROWSER_ORIGIN=https://vita.rigos.dev` |
| Old backend  | the production Convex deployment, paused during and after the cutover |

`Deploy production` deploys all of it from whatever ref it runs on, in this
order: guards, D1 migrations, API, API smoke test, web, web smoke test. The API
smoke test must pass before the web deploy moves traffic. The workflow also
writes the `vita-os-web` version it replaces to the run summary and to the
`production-deploy-evidence` artifact.

## Approval gates

The owner approves each of these before it happens and records the approval on
#352:

| Gate | Approves |
| ---- | -------- |
| **G1** | The window, this runbook, and the abort conditions |
| **G2** | Pausing production Convex (the write freeze) |
| **G3** | Importing the snapshot into `vita-os-production` |
| **G4** | Merging the migration into `main` and switching traffic |
| **G5** | Resuming writes: Cloudflare becomes authoritative |
| **G6** | Retiring Convex, after the observation period |

## 1. Before the window (owner)

Run these from `apps/api` with a Cloudflare login that can create D1 databases
and Worker secrets. None of them affects production traffic.

1. **Create the database** and commit its ID to the migration branch:

   ```bash
   bunx wrangler d1 create vita-os-production
   ```

   Answer **no** when Wrangler offers to add the binding for you. Put the
   printed ID in `database_id` under `env.production` in
   `apps/api/wrangler.jsonc`, replacing the placeholder. Then check the guard:

   ```bash
   node scripts/assert-deploy-target.mjs production vita-os-api vita-api.rigos.dev
   ```

2. **Register the OAuth callbacks.** The production user signs in with GitHub
   and Google and has no password, so both providers are required.

   - GitHub: create a new OAuth app (GitHub allows one callback URL per app)
     with callback `https://vita-api.rigos.dev/api/auth/callback/github`.
   - Google: add the redirect URI
     `https://vita-api.rigos.dev/api/auth/callback/google`.

   Keep the Convex callbacks registered until retirement. The rollback needs
   them.

3. **Set the secrets.** Better Auth needs at least 32 characters. A partial
   provider pair fails at startup.

   ```bash
   openssl rand -base64 32 | bunx wrangler secret put BETTER_AUTH_SECRET --env production
   bunx wrangler secret put GITHUB_CLIENT_ID --env production
   bunx wrangler secret put GITHUB_CLIENT_SECRET --env production
   bunx wrangler secret put GOOGLE_CLIENT_ID --env production
   bunx wrangler secret put GOOGLE_CLIENT_SECRET --env production
   ```

   If `vita-os-api` does not exist yet, Wrangler offers to create it. Accept.
   The new Worker has no route until the first deploy, so it takes no traffic.

4. **Confirm the credentials.** The repository's `CLOUDFLARE_API_TOKEN` must be
   able to edit D1, Workers scripts, and Workers custom domains on the
   `rigos.dev` zone. It already does this for staging. Add yourself as a
   required reviewer on the `production` GitHub environment so the deploy waits
   for an approval.

5. **Qualify the branch on staging.** Run `Deploy staging` on
   `migration/cloudflare-cutover` after the D1 ID commit, and confirm it is
   green.

6. **Prepare a durable, private evidence directory.** The final snapshot is
   the rollback artifact and must outlive the observation period. Do not use
   `/tmp`, which macOS clears on reboot, and do not use the repository.

   ```bash
   export CUTOVER_DIR="$HOME/vita-os-cutover"
   mkdir -m 700 "$CUTOVER_DIR"
   ```

7. **Prepare the sign-in notice.** Convex sessions are not migrated, so
   everyone signs in again after the cutover. Production has one user, the
   owner. If more accounts exist when the window opens, tell each of them
   before G2.

**G1:** approve the window, this runbook, and the abort conditions below.

## 2. The window

Keep one terminal at the repository root with `CUTOVER_DIR` exported. Record
each step's time and output on #352 as you go.

1. **Record the rollback target.** Write down the version `vita-os-web` serves
   now. That is the Convex build.

   ```bash
   cd apps/web
   bunx wrangler deployments status --name vita-os-web --json | tee "$CUTOVER_DIR/pre-cutover-web.json"
   cd ../..
   ```

   Tag the last Convex revision of `main` so it stays deployable:

   ```bash
   git fetch origin
   git tag convex-final origin/main
   git push origin convex-final
   ```

2. **G2, freeze.** Pause production Convex from its dashboard (Settings → Pause
   deployment). Confirm the pause:

   ```bash
   cd apps/web
   bunx convex run --prod areas:list '{}'   # must fail with "paused"
   ```

   The Convex app is unavailable from here until rollback or retirement.

3. **Export once.**

   ```bash
   bunx convex export --prod --path "$CUTOVER_DIR/snapshot.zip"
   cd ../..
   ```

   Do not export again. Copy `snapshot.zip` to encrypted backup storage now.

4. **Prepare.**

   ```bash
   python3 apps/api/migration/convex_to_d1.py prepare "$CUTOVER_DIR/snapshot.zip" "$CUTOVER_DIR/import.sql"
   ```

5. **G3, import.** Apply the schema and import into the empty database.
   Nothing may sign in first, because the import guard accepts only an empty
   database. The API Worker has no route yet, so nothing can.

   ```bash
   cd apps/api
   bunx wrangler d1 migrations apply vita-os-production --remote --env production
   bunx wrangler d1 execute vita-os-production --remote --env production --file "$CUTOVER_DIR/import.sql"
   ```

6. **Export the target and validate.**

   ```bash
   bunx wrangler d1 export vita-os-production --remote --env production --output "$CUTOVER_DIR/d1.sql"
   cd ../..
   python3 apps/api/migration/convex_to_d1.py validate "$CUTOVER_DIR/snapshot.zip" "$CUTOVER_DIR/d1.sql" --report "$CUTOVER_DIR/report.json"
   ```

   The report must say `pass`. The read-only snapshot from #351 held 1 user
   (GitHub and Google), 4 Areas, 9 Threads, 3 Notes, 5 Thread Notes, and 46
   Activity Log Entries. Newer counts are expected if the owner has written
   since. Retired tables are counted under `discarded_retired_rows`.

7. **Check the replay guard.** Run the `execute` command from step 5 again. It
   must fail with `table migration_import_guard already exists`.

8. **Save the validation evidence on #352** before traffic moves: the snapshot
   file name and size, the D1 database ID, and `report.json`, which holds
   counts only.

9. **G4, merge and switch traffic.** Merge the open
   `migration/cloudflare-cutover` → `main` pull request. The merge also runs
   `Deploy staging` from `main`, which is now the Cloudflare build. Then deploy
   production from `main`:

   ```bash
   gh workflow run deploy-production.yml --ref main
   gh run watch
   ```

   Approve the `production` environment when it asks. The `Deploy production
   web Worker` step is the traffic switch. Confirm that the run summary's
   rollback target matches `pre-cutover-web.json`, and save the run URL and
   its `production-deploy-evidence` artifact.

10. **Smoke suite (owner, in a browser).** Sign in at `https://vita.rigos.dev`.
    Writes made here are smoke writes. A rollback discards them.

    - [ ] Sign in with GitHub, sign out, and sign in with Google. Both land on
          the migrated user's data.
    - [ ] The Dashboard shows the expected Now, This week, Later, Ready to
          move, Open, and Notes content.
    - [ ] Area navigation opens each Area with its Threads.
    - [ ] Opening a Thread shows its Summary, Next Move, Up Next, Follow-up,
          Thread Notes, and Activity Log.
    - [ ] Completing a Next Move promotes Up Next, records one Activity Log
          Entry, and updates every view in the current tab.
    - [ ] Standalone Notes: capture, edit, complete, reopen, delete.
    - [ ] Thread Notes: capture, edit, complete, reopen, delete, load more.
    - [ ] A Thread URL with an unknown ID shows not-found.
    - [ ] With the network offline in DevTools, a mutation rolls back and shows
          its failure. After reconnecting, the view refreshes. Focusing the tab
          also refreshes it. DevTools shows no interval polling.
    - [ ] Signing out returns to `/sign-in`. Afterwards,
          `https://vita-api.rigos.dev/v1/areas` returns 401.

    Delete or undo the smoke writes you do not want to keep.

11. **G5, resume writes.** If every check passed, Cloudflare is authoritative.
    Record the approval and the time on #352. From here, rolling back to
    Convex loses every write made on D1, so fix forward instead (see
    [After G5](#after-g5)).

## Abort conditions

Abort, and roll back as below, on any of these before G5:

- A command in the window fails, or its output differs from this runbook.
- The pause cannot be confirmed.
- `prepare` or `validate` rejects the snapshot: unsupported auth data, a
  duplicate slug, a missing record, or any mismatch.
- The replay guard does not reject the second import.
- `Deploy production` fails at any step.
- A smoke-suite check fails, including a sign-in with either provider.
- The window runs past the time agreed at G1.

Never edit imported rows by hand and never re-export to patch a partial
import.

## Rollback (before G5)

1. **If `vita-os-web` was deployed**, restore the recorded Convex version:

   ```bash
   cd apps/web
   bunx wrangler rollback <version-id from pre-cutover-web.json> --name vita-os-web --message "Abort cutover: <reason>" --yes
   ```

   The rehearsal took 3s to run and about 10s to serve. Confirm that
   `https://vita.rigos.dev` loads the Convex sign-in. The custom domain stays
   attached, because routes are not part of a version.

2. **Unpause production Convex** from its dashboard. Sign in and confirm the
   pre-freeze data is there and a write succeeds. Convex is authoritative
   again.

3. **Leave the API Worker and D1 alone.** With the web restored, they receive
   no browser traffic. Before any retry, delete `vita-os-production`, create a
   new empty database, commit its ID, and start again from section 1.

4. **If `main` was merged**, revert the merge on `main` so the next push to
   `main` does not deploy the Cloudflare build to staging by surprise, and so
   `main` matches production. The `convex-final` tag also marks that revision.

5. Record the cause and timings on #352.

## After G5

- **Cloudflare regressions** roll back between Cloudflare versions:
  `bunx wrangler versions list --name vita-os-web` (or `vita-os-api`), then
  `wrangler rollback`. A web rollback never touches D1. For an API rollback,
  check the D1 migrations first. The older API must still accept the schema.
- **Going back to Convex** after G5 means accepting the loss of D1 writes or
  replaying them by hand. That needs its own approval. It is not a routine
  rollback.

## 3. Observation period

The owner sets the length at G1. The proposal is 14 days. Until G6:

- Keep production Convex **paused, not deleted**, along with its environment
  variables and OAuth callbacks.
- Keep `snapshot.zip`, `import.sql`, `d1.sql`, and `report.json` in private
  storage, and the `convex-final` tag in the repository.
- Keep `pre-cutover-web.json`. Wrangler keeps the recent versions of
  `vita-os-web`, so the Convex build stays one command away.
- Watch the Workers' logs and errors in the Cloudflare dashboard
  (observability is on for both), or run `bunx wrangler tail vita-os-api`.
- Do not merge the Convex retirement.

## 4. Retirement (after G6)

**G6:** the owner explicitly approves retiring Convex on #352.

Remove, in one pull request against `main`:

- `apps/web/convex` and its generated types, tests, and README
- the `convex`, `@convex-dev/better-auth`, `convex-helpers`, and `convex-test`
  dependencies, and anything only they need
- the `@convex` path alias in Vite, TypeScript, and `AGENTS.md`
- the `convex` scripts in the root and web `package.json`, the `convex` turbo
  task, the Convex half of the web `typecheck` script, and
  `VITE_CONVEX_URL`/`VITE_CONVEX_SITE_URL` from `turbo.json` and `verify.yml`
- the Convex sections of `README.md`, and the `VITE_CONVEX_*` repository
  variables once no workflow reads them

Keep `docs/migrations/`, `docs/adr/`, and the importer in
`apps/api/migration`. They are the historical record, and the importer's
validator is how the retained snapshot can be checked again. Then:

1. `bun run lint`, `bun run build`, and `bun run test:run` pass.
2. Merge, run `Deploy production` from `main`, and repeat the section 2
   smoke suite on `https://vita.rigos.dev`.
3. Only then, and as a separate owner decision, remove the old Convex OAuth
   callbacks and the Convex deployment. Keep the final snapshot either way.
