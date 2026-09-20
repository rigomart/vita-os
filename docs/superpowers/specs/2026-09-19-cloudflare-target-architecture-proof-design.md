# Cloudflare Target Architecture Proof Design

**Issue:** [#348](https://github.com/rigomart/vita-os/issues/348)

**Parent:** [#347](https://github.com/rigomart/vita-os/issues/347)

**Status:** Approved for specification on 2026-09-19

## Context

Vita OS currently runs its authenticated application data through Convex. The
first migration step is not a partial production rollout. It is an isolated,
production-shaped proof of the intended Cloudflare architecture: a Hono Worker,
Better Auth, D1, a plain asynchronous application client, and a shared React
boundary using TanStack Query.

The proof covers one complete Thread workflow because it crosses the highest-risk
parts of the replacement. An authenticated owner must be able to open a Thread,
page through its Activity Log, and complete its Next Move. Completion can promote
the first Up Next move, changes multiple stored values, and records automatic
history. It therefore tests whether D1 can preserve Vita OS behavior under
failure and competing requests rather than merely demonstrating that D1 can
store rows.

The existing `@vita-os/contracts` and `@vita-os/core` packages already provide a
transport-independent Thread model and the Next Move completion decision. The
current public client still models Convex-style live resources. Issue 348 replaces
that public compatibility layer with the asynchronous contract required by the
target architecture while leaving the running Convex composition as the active
web path until the complete migration is ready.

## Goals

- Run a separate Hono Worker locally with a real D1 binding and committed,
  repeatable migrations.
- Store Better Auth records in D1 and exercise authentication through Better
  Auth's public HTTP routes.
- Resolve an explicit authenticated actor before every protected application
  read or write.
- Read an owned Thread and its Area through the asynchronous application client.
- Page an owned Thread's Activity Log in stable, bounded order.
- Complete a Next Move with the existing core rule while keeping the Thread, Up
  Next, Activity Log, and activity metadata atomic.
- Characterize rollback and competing-request behavior with real Worker/D1
  integration tests.
- Begin the shared React application boundary with TanStack Query-owned loading,
  optimistic state, reconciliation, and rollback.
- Produce enough evidence to accept D1 or stop dependent migration work and use
  the planned managed-Postgres fallback.

## Non-goals

- Deploying the proof or creating production Cloudflare resources.
- Switching the current web application from Convex to HTTP at runtime.
- Adding a Convex-versus-HTTP feature flag or mixed production mode.
- Migrating any Area, Thread, Standalone Note, Thread Note, Dashboard, or
  navigation workflow beyond the Thread proof.
- Importing production data or preserving active Convex sessions.
- Extracting the complete authenticated React application; issue 349 completes
  that work after the storage decision.
- Adding cross-tab, cross-device, polling, Server-Sent Event, or WebSocket
  updates.
- Building a generic repository, CRUD framework, or prematurely shared database
  package.
- Modifying a production Convex query, mutation, deployment, or stored record.

## Chosen approach

Use a revision-checked compare-and-swap followed by a conditional Activity Log
insert in one atomic D1 batch. The operation reads the owned Thread, applies the
existing plain-TypeScript completion decision, and prepares all resulting values.
The batch updates the Thread only when its owner, revision, and expected Next Move
still match, then inserts the Activity Log Entry only when that update stamped the
same unique operation token.

D1 guarantees that a batch runs sequentially as one transaction and rolls the
batch back when a statement fails. The compare-and-swap closes the gap between
the read and the later batch: if another request changed the Thread after the
read, the stale update changes no row and writes no log.

A database trigger was rejected because it would duplicate the completion rule
in SQL and make core behavior harder to test and reuse. Moving directly to
Postgres was rejected because issue 348 is the explicit D1 go/no-go gate. Managed
Postgres remains the fallback if the real proof cannot satisfy the acceptance
criteria cleanly.

## Package and application boundaries

```text
apps/api
  Hono routes, Better Auth composition, D1 storage, migrations
      -> @vita-os/contracts, @vita-os/core

packages/contracts
  plain models, inputs, outputs, errors, asynchronous ApplicationClient
      -> no runtime framework

packages/core
  Next Move completion decision and focused operation boundary
      -> @vita-os/contracts

packages/application
  shared React provider, TanStack Query keys and Thread proof hooks
      -> @vita-os/contracts, @vita-os/core, React, TanStack Query

apps/web
  Better Auth browser client and HTTP ApplicationClient construction
      -> @vita-os/contracts, Better Auth browser client
```

`apps/api` is a separate Worker rather than another route inside the asset
Worker. Its secrets, Better Auth configuration, and D1 binding remain outside
the browser build.

`packages/application` starts with only the Thread proof. It is the destination
for the authenticated product experience, but issue 348 does not move unrelated
screens or routes into it.

The active `apps/web/src/main.tsx` composition continues to use Convex. The old
live-resource client types become private compatibility types inside `apps/web`
so that `@vita-os/contracts` has one canonical asynchronous `ApplicationClient`.
No proof route or runtime backend selector is added to the product.

## Asynchronous application contract

The public client exposes three named Vita OS operations:

```ts
interface ApplicationClient {
  getThreadDetail(input: {
    slug: string;
  }): Promise<OperationResult<ThreadDetail>>;

  getThreadActivityPage(input: {
    threadId: ThreadId;
    limit: number;
    cursor?: string;
  }): Promise<OperationResult<ActivityLogPage>>;

  completeNextMove(input: {
    threadId: ThreadId;
    expectedNextMove: string | null;
    expectedRevision: number;
  }): Promise<OperationResult<CompleteNextMoveOutput>>;
}
```

`ActivityLogPage` contains the current page of entries and an optional opaque
`nextCursor`. Loading and accumulated-page state belong to TanStack Query, not
the transport contract.

`CompleteNextMoveOutput` remains either `completed` or `unchanged`. A stale
expected Next Move or revision is an `ApplicationError` with code `conflict`; it
is not silently retried. Supplying the intended Next Move and the revision read
with it prevents a repeated request from completing a promoted move whose text
matches the completed move.

The contract retains opaque string IDs, epoch-millisecond timestamps, and the
existing Thread and Area fields required by the current interface. It imports no
Convex, Hono, D1, Better Auth, React, or generated database types.

The HTTP adapter sends credentials with every request, validates response shapes,
and translates HTTP failures into the stable application errors:
`unauthorized`, `not_found`, `validation`, `conflict`, `unavailable`, and
`unexpected`.

## Worker routes and authentication

Better Auth is created from the Worker's environment and D1 binding and mounted
at `/api/auth/*`. The proof enables email-and-password authentication so tests
can create two independent accounts entirely through public HTTP routes. Future
social-provider configuration remains a browser-host and deployment concern.

The application routes are:

- `GET /v1/threads/:slug`
- `GET /v1/threads/:threadId/activity?limit=<n>&cursor=<opaque>`
- `POST /v1/threads/:threadId/complete-next-move`

Protected middleware calls Better Auth's public session API with the request
headers. It either stores `{ actorId: session.user.id }` in the Hono context or
returns the stable unauthorized response before constructing or calling an
application store. Unit coverage verifies that an unauthenticated request never
invokes storage; real Worker coverage verifies the public 401 response.

Handlers pass the explicit actor to focused storage operations. They never pass
Better Auth session objects into core or storage. Missing records and records
owned by another actor produce the same status, body, and safe message.

The Worker accepts credentialed requests only from its configured browser origin.
Tests use the Worker's public Better Auth sign-up and sign-in endpoints, retain
the returned session cookie, and use that cookie for protected requests.

## Canonical D1 schema

Committed SQL migrations create Better Auth's generated tables plus the minimum
canonical Vita OS tables needed by the proof:

- `areas`: opaque text ID, owner ID, name, slug, Standard, Condition, Area Icon,
  manual order, and creation timestamp.
- `threads`: opaque text ID, owner ID, Area ID, title, slug, Summary, manual
  order, lifecycle state, Next Move, JSON-encoded Up Next, Follow-up, activity
  metadata, creation timestamp, integer revision, and internal last completion
  token. D1 Thread detail exposes its revision through the optional framework-
  free `Thread.revision` property so completion callers can perform a compare-
  and-swap.
- `activity_log_entries`: opaque text ID, owner ID, Thread ID, entry type,
  content, previous and new values, and creation timestamp.

Nullable SQL columns map to absent optional contract properties. Up Next is
either SQL `NULL` or a valid, non-empty JSON array of strings; an empty list is
never stored. Foreign keys are enabled for local and deployed execution.

Ownership-aware indexes support `(user_id, slug)` Thread lookup and
`(user_id, thread_id, created_at DESC, id DESC)` Activity Log pagination. IDs and
timestamps are never rewritten at the application boundary.

## Thread detail and Activity Log reads

Thread detail selects the Thread and its Area in one ownership-constrained join.
The join includes the actor on both records so an inconsistent cross-owner
relationship cannot leak an Area. It returns every field required by the
existing `ThreadDetail` contract.

Activity Log access first establishes that the actor owns the Thread, then reads
only entries matching both actor and Thread. The limit defaults to 20 and is
bounded to 50. Invalid, zero, negative, fractional, or excessive values return a
validation error rather than causing an unbounded query.

Entries are ordered by `(created_at DESC, id DESC)`. The cursor encodes that pair
as an opaque, versioned value. A later page uses a strict tuple boundary, so tied
timestamps neither duplicate nor skip an entry. Malformed or unsupported cursor
versions return a validation error. The server reads `limit + 1` rows to decide
whether to return `nextCursor`.

## Atomic Next Move completion

The request body contains `expectedNextMove: string | null` and a nonnegative
safe-integer `expectedRevision` read from Thread detail.

1. Storage loads the Thread using both `actorId` and `threadId`, including its
   internal revision.
2. A missing or foreign-owned Thread returns the same not-found result.
3. If the stored Next Move or revision differs from the client-supplied expected
   value, the operation returns `conflict` without writing. If both Next Moves
   are absent and the revision matches, it returns `unchanged`.
4. `@vita-os/core` computes the Thread patch and Activity Log Entry from the
   stored Next Move and Up Next values.
5. The operation creates a collision-resistant Activity Log ID, a unique
   operation token, and one timestamp.
6. One D1 batch conditionally updates the owned Thread by ID, the client-
   supplied revision, and expected Next Move. It applies the new Next Move and
   Up Next, stamps activity metadata, increments the revision, and saves the
   operation token.
7. The next batch statement inserts the Activity Log Entry with `INSERT ...
   SELECT` only from the Thread row carrying that operation token.
8. A result of one updated Thread and one inserted log returns `completed`. Zero
   updated rows returns `conflict`. Any other result is unexpected.

If the Activity Log insert fails, D1 rolls back the earlier Thread update,
including Up Next, activity metadata, revision, and operation token. Time and ID
generation are injected dependencies of the D1 operation so integration tests
can force a real primary-key collision without adding a test-only production
method or branch.

Two requests carrying the same expected Next Move and expected revision have
defined semantics. One wins the conditional update and returns `completed`; the
other observes the changed revision before its batch or a zero-row conditional
update and returns `conflict`. This remains true when the promoted Next Move
has the same text as the completed move. The Thread advances once and exactly
one Activity Log Entry is created. Mutations are never automatically retried
because a later retry could target a different promoted move.

## Shared React behavior

`packages/application` exports an application-client provider plus hooks for
Thread detail, infinite Activity Log pagination, and Next Move completion. The
provider accepts an already-authenticated `ApplicationClient`; it does not know
about Better Auth, cookies, Hono, or D1.

TanStack Query owns query keys, cached server state, accumulated pages, and normal
stale-data behavior. Queries fetch when observed and refetch stale data on mount,
window focus, and reconnect. No interval polling is configured.

Before completion, the mutation cancels relevant Thread queries and saves their
exact cached values. It applies `decideNextMoveCompletion` to the cached Thread
and optimistically changes Next Move and Up Next in the initiating view. The
Activity Log remains server-authoritative rather than inventing an optimistic ID
or timestamp.

On success, the hooks reconcile by invalidating Thread detail and Activity Log
queries. On any failure, including `conflict`, they restore the saved snapshots
and refetch authoritative state. A conflict is treated as stale data, not as a
request for user-managed conflict resolution. The hooks expose the existing
application error so the host can preserve ordinary failure feedback where
appropriate.

The browser host owns the Better Auth browser client, API base URL, credentialed
fetch implementation, and HTTP `ApplicationClient` construction. Issue 348 proves
that composition through tests but does not install it into the active Convex
root.

## Testing and D1 decision evidence

All behavior is developed test-first. Focused tests use the highest stable public
seam available.

### Core and contracts

- Keep the existing table-driven completion-rule coverage for clearing,
  promotion, Activity Log content, and no-op behavior.
- Add compile-time and runtime contract coverage for async inputs, pages,
  results, and stable error translation without inspecting framework internals.

### Real Worker and D1 integration

Cloudflare's Worker Vitest integration runs the Worker in the Workers runtime
with an isolated real local D1 binding. Tests apply the committed migrations and
exercise the exported Worker through HTTP.

- Sign up and sign in through Better Auth's public routes and use the returned
  cookie for protected calls.
- Prove unauthenticated requests return 401 before application storage is used.
- Prove an owner receives complete Thread and Area data, including the D1
  revision used for completion.
- Prove missing and foreign-owned Threads return identical public not-found
  responses.
- Prove bounded Activity Log pages, exhaustion, tied-timestamp ordering, another
  Thread's exclusion, and malformed cursor handling.
- Prove final-move clearing, Up Next promotion, exact Activity Log content,
  activity metadata, and the no-Next-Move no-op.
- Force a duplicate Activity Log ID so the insert fails, then assert that every
  intended Thread and log change rolled back.
- Send two completion requests concurrently with the same intended move and
  revision, including a repeated promoted move value, then assert one completed
  result, one conflict, one promotion, and one new log.

### HTTP client and shared React

- Exercise the public HTTP client against the real Worker for authentication,
  detail, pagination, completion, and every stable error mapping.
- Exercise shared React hooks with an injected fake client for loading, ready,
  not-found, failure, page accumulation, optimistic promotion, confirmed
  reconciliation, rollback, conflict reconciliation, and query invalidation.
- Assert cache behavior and visible hook results rather than TanStack Query call
  counts or private implementation details.

### Repository gate

From the repository root, run:

```bash
bun run lint
bun run build
bun run test:run
```

## Go/no-go result

D1 passes only when the real local Worker tests demonstrate all required reads,
auth behavior, rollback, and competing-request semantics without a hidden
application lock, test-only storage behavior, or weakened domain rule.

If D1 passes, add an ADR recording:

- the revision-checked batch design;
- the exact forced-failure and concurrency tests;
- the observed outcomes;
- why the evidence is sufficient for this migration; and
- the limits of the decision, including the absence of interactive
  transactions.

If D1 fails, keep the contracts, Hono routes, core operation, React boundary, and
tests. Record the precise failed invariant on issue 348, do not add the D1 ADR,
and stop issue 349 until the storage implementation is replaced by managed
Postgres behind the same boundaries.
