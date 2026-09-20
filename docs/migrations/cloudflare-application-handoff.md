# Handoff: issue #349 on `worktree-cloudflare-migration-349`

PR [#354](https://github.com/rigomart/vita-os/pull/354) targets `main`.
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

- #351: import and validate production data. Translate Convex `tasks`/`text` and
  `next_action_change` to the canonical names.
- #352: cut over and retire Convex. Production deployment/data remain unchanged.

## Working locally

Run `bun install` in this worktree before verification. Run `bun run lint`,
`bun run build`, and `bun run test:run` from its root. Worker integration tests
require localhost listener access; they use isolated local databases.
Do not start dev servers or deploy as part of verification.
