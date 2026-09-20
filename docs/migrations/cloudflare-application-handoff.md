# Handoff: issue #349 on `worktree-cloudflare-migration-349`

State as of the last commit on this branch. Everything described as done is
committed and pushed; `bun run lint`, `bun run build`, and `bun run test:run`
all pass from the repo root.

## What is done

The whole replacement runs on Cloudflare: contract, rules, Hono/D1 API, the
shared React application, and the browser host. `docs/migrations/cloudflare-application.md`
describes the architecture; this file is only the state of the work.

- **`packages/contracts`** — 30 operations, one per workflow, no framework types.
- **`packages/core`** — the rules ported out of Convex: slugs, Area names, Up Next,
  Thread changes and the Activity Log they earn, attention grouping, record IDs.
- **`apps/api`** — canonical D1 schema (`areas`, `threads`, `activity_log_entries`,
  `notes`, `thread_notes`), workflow-named stores, routes one module per record
  kind, Better Auth. 119 tests drive the real Worker and a real local database
  through the public HTTP client.
- **`packages/application`** — Vita OS as an application: every authenticated
  screen, the reads and commands behind them, the TanStack Query cache, the
  invalidation rules, and the optimistic behavior. 325 tests against an injected
  fake client.
- **`apps/web`** — a host: Better Auth in the browser, `VITE_API_BASE_URL`, the
  HTTP client, and the route files that mount the shared screens. 213 tests
  (including the Convex reference suite, which still passes untouched).

Verified beyond the test suites: the Worker boots under `wrangler dev` against
local D1 and serves a full round trip — sign up, create an Area, open a Thread,
line up Up Next, complete the Next Move (promotion + Activity Log), refuse the
repeated click as a conflict, capture a Note, and show another account none of it.

## What is left

### 1. The shared application does not own its route definitions

The one acceptance criterion not fully met. The package owns the screens, the
navigation contract (`readProductSearch`, `ProductSearch`) and all product
behavior; the route *files* are still `apps/web/src/routes/**`, because the host's
build generates the route tree from them and registers its types.

Two ways forward, and the choice is a real design decision rather than a
mechanical move:

- **A code-based route tree in the package**, which the host mounts. TanStack
  Router types resolve through the route objects (`route.useSearch()`), so this
  works without the host's `Register`; it means dropping the file-based route
  plugin and rewriting ~11 route files plus the four `from: "/_authenticated"`
  call sites.
- **Navigation injected by the host**, so the shared application never imports a
  router. Better for a desktop host with no URLs, but it touches every screen
  that navigates (37 files import `@tanstack/react-router`).

Ask the user which they want before starting; the first keeps the web app's URLs
exactly as they are, the second is the cleaner boundary.

### 2. Draft PR

A draft PR from this branch into `migration/convex-to-cloudflare` is open (that
branch has the same tree as `main` — the proof was squash-merged). If it is
missing, open it with `gh pr create --draft --base migration/convex-to-cloudflare`.

### 3. Not this issue

Issue #351 (import and validate production data) and #352 (cut over, retire
Convex) follow. The importer must translate two things the canonical schema
renamed: the physical `tasks`/`text` storage, and the `next_action_change` entry
type, which is stored here as `next_move_change`.

## Things worth knowing before you touch this

- **Run the API Worker locally** with `cp apps/api/.dev.vars.example apps/api/.dev.vars`,
  `bun run --filter=@vita-os/api migrate:local`, then
  `bunx turbo run dev --filter=@vita-os/api`. Kill any stray `wrangler dev`
  before running `bunx vitest` in `apps/api` — a live dev Worker makes the suite
  hang rather than fail.
- **The package imports itself by path, never by name.** `@vita-os/application`
  inside `packages/application` is a cycle; the linter will not catch it.
- **A test that renders a real screen gets the quiet fake client by default**
  (`createQuietApplicationClient`): reads answer empty, commands refuse. Reads now
  rise to an error boundary, so a screen with an unconfigured read would otherwise
  tear the test tree down.
- **Convex stays as the behavioral reference** and must keep passing. It shares
  `decideNextMoveCompletion` with the new stack, so a change to that rule's shape
  reaches `apps/web/convex/lib/threadChanges.ts`.
- **The web app's UI still says `when`** for the Attention Date in its own props
  and component names. The contract, the API and the shared hooks say
  `attentionDate`; `notes/use-update-note-when.ts` is the seam between them.
  Renaming the UI's vocabulary is a follow-up, not part of #349.
