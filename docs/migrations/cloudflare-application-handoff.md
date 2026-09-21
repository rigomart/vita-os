# Handoff: issue #349 on `worktree-cloudflare-migration-349`

PR [#354](https://github.com/rigomart/vita-os/pull/354) targets `main` but is
not ready to merge there. Pushing to `main` deploys staging, and this branch
cannot boot in staging: nothing sets `VITE_API_BASE_URL`, so Vite inlines it as
`undefined` and `requireEnv` throws before the app renders. The smoke test
would not catch it — it checks HTTP 200 and asset fetches, never running JS.
There is no deployed `apps/api` to point it at either.

Keep the branch unmerged and deploy it with the `Deploy staging` workflow's
manual trigger ([#359](https://github.com/rigomart/vita-os/pull/359)) instead,
which is what #351 stands the environment up for. Merge at cutover (#352), as
[#347](https://github.com/rigomart/vita-os/issues/347) describes.

The architecture is documented in [cloudflare-application.md](cloudflare-application.md).

## Completed in the follow-up

- The shared application owns its code-based product route tree. The web host
  adds authentication routes and supplies session gating; route generation is gone.
- Real-router tests cover Dashboard/Area mounting, host gating, Thread deep links,
  search-param precedence, closing a Thread, and legacy Inbox/Notes redirects.
- Account transitions create a fresh query cache, preventing a previous account's
  cached data from appearing in the next account.
- Area edits update embedded Area details in Thread views. Done Note and Thread
  Note pages update optimistically for edits, removal, and reopening.
- Overlapping mutations preserve one another's pending/successful changes when
  one fails, and refetch after all pending commands settle.
- Slug collision retries recognize D1's composite uniqueness errors. Conditional
  writes handle competing Area deletion and Thread moves without orphan log entries
  or unexpected foreign-key failures.
- Better Auth initializes only inside requests that need it, avoiding background
  initialization from preflight/rejected requests leaking into other Worker contexts.

## Remaining follow-up issues

They run in order; each blocks the next.

- #350: build and validate the production data migration. Translate Convex
  `tasks`/`text` and `next_action_change` to the canonical names.
- #351: rehearse the cutover in an isolated environment — the Worker, database,
  secrets and origins this branch still has nowhere to run against.
- #352: cut over and retire Convex. Production deployment/data remain unchanged.

## Working locally

Run `bun install` in this worktree before verification. Run `bun run lint`,
`bun run build`, and `bun run test:run` from its root. Worker integration tests
require localhost listener access; they use isolated local databases.
Do not start dev servers or deploy as part of verification.
