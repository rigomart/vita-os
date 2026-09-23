# The Cloudflare-Backed Vita OS

Issue [#349](https://github.com/rigomart/vita-os/issues/349) completes the
replacement the [proof](../superpowers/specs/2026-09-19-cloudflare-target-architecture-proof-design.md)
validated: every Vita OS workflow now runs through an asynchronous application
client, a Hono Worker, Better Auth, and D1.

Convex is still in the repository, and still runs production. Nothing in the
browser imports it any more.

## Where things live

```text
packages/contracts     plain models, inputs, outputs, errors, ApplicationClient
packages/core          the domain rules, framework-free
packages/application   Vita OS as an application: routes, screens, cache, commands
apps/api               Hono routes, Better Auth, canonical D1 storage
apps/web               the browser host: auth, configuration, HTTP client, session gate
apps/web/convex        the behavioral reference, until cutover retires it
```

The shared application imports no Convex, Hono, database, Cloudflare, or Better
Auth type. The web host is what remains once the product is taken out of it:
Better Auth in the browser, `VITE_API_BASE_URL`, the HTTP implementation of the
contract, the session gate, and its sign-in/sign-up routes. It mounts the shared
product route tree. A desktop host can mount that tree against a local client,
a `Viewer` of its own, and its own session gate.

## The application boundary

`ApplicationClient` names thirty operations, one per workflow, and says nothing
about transport. Reads return values; commands return the record they wrote, so
the application can reconcile with the service's own answer rather than trusting
its optimistic guess.

Every `Thread` carries the `revision` it was read at. That is what makes
completing a Next Move safe to repeat from any surface: the expectation travels
with the command, and a click made against a Thread that has since moved on comes
back as a conflict instead of completing the move that was promoted into its
place.

## Storage

`apps/api/migrations` holds the canonical schema: `areas`, `threads`,
`activity_log_entries`, `notes`, and `thread_notes`, under those names. Convex's
physical `tasks` table and its `text` column do not survive; the importer will
translate them at cutover. IDs are opaque text, so Convex-generated IDs stay
valid and new records get application-generated ones.

Two deliberate differences from Convex are worth naming. Slugs are unique per
owner, and a create or rename re-mints a colliding one a few times before giving
up — Convex allowed duplicates and resolved reads to the oldest match, which made
a slug an ambiguous address. And record IDs are time-ordered text rather than
random: reads order by timestamp and break ties on the ID, so entries written by
one change come back in the order they were written, which Convex got from its own
insertion order.

The Activity Log's Next Move entry is stored as `next_move_change`. Convex stores
`next_action_change` for the same thing; that deployment keeps its own value, so
the importer translates it at cutover.

Storage is reached through capabilities named after workflows — there is no
generic repository. A Thread change decides its patch and its Activity Log
entries in `packages/core`, then writes them in one D1 batch: the update is
conditional on the revision the decision was made against and stamps a change
token, and each entry is inserted only from the row carrying that token. A lost
race therefore writes neither the patch nor an orphan entry. An ordinary edit
re-reads and re-decides rather than failing; only a caller that supplied its own
expectation is told about the conflict.

## Reads and writes in the browser

TanStack Query owns the cache. Reads fetch when observed and refresh stale data
on mount, focus, and reconnect; nothing polls, and nothing is delivered across
tabs. One mutation machine gives every command the same shape: cancel the reads
it touches, remember exactly what they held, show the change, fold in the
service's answer, and discard only the failed command on failure. Overlapping commands share a
base snapshot and replay their remaining changes, so one failure cannot undo
another pending or successful command. Refetch waits until those commands settle.
The browser creates a fresh cache when the authenticated account changes.
Affected reads
are chosen from what the cache actually holds, so a command against one Thread
leaves another Thread's rail alone.

## Running it locally

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
bun run --filter=@vita-os/api migrate:local   # applies migrations to local D1
bunx turbo run dev --filter=@vita-os/api      # the Worker, on :8787
```

Then point the browser host at it in `apps/web/.env.local`:

```bash
VITE_API_BASE_URL=http://localhost:8787
```

## What is tested where

- `packages/core` — the rules, directly: promotion, clearing, resolution, the
  Activity Log each change earns.
- `packages/application` — React behavior against an injected fake client:
  loading, not-found, page accumulation, optimistic change, reconciliation,
  rollback, and invalidation.
- `apps/api` — the whole cloud surface through the public HTTP client against a
  real local Worker and database, including ownership, bounded pagination,
  forced-failure rollback, and competing completions.
- `apps/web/convex` — kept as the behavioral reference until cutover.

## Shared routing

`packages/application/src/routes/product-route-tree.tsx` owns the Dashboard,
Area, Thread deep links, and legacy `/inbox` and `/notes` redirects. Product
search parameters preserve in-place Thread and Notes surfaces. The host mounts
`authenticatedRouteTree` under `productRootRoute` and adds its authentication
routes, then registers the complete router's types. No generated route tree or
file-based route plugin is needed.

`SessionGateProvider` supplies the host's session gate. It wraps the product
before any authenticated screen or read mounts; Better Auth stays in the browser.
Screen hooks refer to route IDs without importing the route composition module,
which avoids circular dependencies between routes and screens.

## Still ahead

- Import production data and validate it ([#350](https://github.com/rigomart/vita-os/issues/350)).
  The importer translates Convex's `tasks`/`text` storage and its
  `next_action_change` entry type into the canonical names.
- Cut over and retire Convex ([#352](https://github.com/rigomart/vita-os/issues/352)),
  which removes `apps/web/convex`, the Convex dependencies, and the Convex
  deployment variables from `README.md`.
