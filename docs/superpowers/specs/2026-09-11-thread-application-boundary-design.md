# Thread Application Boundary Design

**Issue:** [#325](https://github.com/rigomart/vita-os/issues/325)

**Status:** Approved for implementation on 2026-09-11

## Context

Thread detail currently reaches through the React application boundary into Convex. The detail pane subscribes to `threads.detailBySlug`, the Activity Log uses `activityLogs.listByThread`, and Next Move completion calls `threads.completeNextMoveMutation`. These consumers import generated Convex references and projected database types. The completion rule also lives in a Convex-specific module, while the optimistic client path maintains a second copy of the promotion rule.

Issue 325 establishes the first transport-independent application slice without replacing Convex. The slice must preserve the current Thread pane, pagination, live updates, ownership checks, atomic writes, optimistic updates, and all user-visible behavior. It is a proving ground for the later HTTP/Hono adapter described by issue 322, not the Hono or database migration itself.

## Goals

- Give React a transport-independent `ApplicationClient` for loading Thread detail, reading its Activity Log, and completing its Next Move.
- Express public inputs, outputs, failures, loading, and not-found states without importing Convex, React, Hono, or database-generated types.
- Keep Convex-specific query references, generated IDs, subscription mechanics, pagination, and optimistic cache work inside a transitional adapter.
- Move the Next Move completion decision into plain TypeScript shared core code.
- Keep ownership enforcement and all completion writes inside one server-side transaction.
- Demonstrate that opening and closing a Thread starts and cleans up subscriptions, and that another connected client receives confirmed updates.
- Record the remaining Convex dependencies and the work required for an HTTP implementation.

## Non-goals

- Hono routes, Cloudflare API deployment, D1 or Postgres selection, or data migration.
- Replacing Better Auth, Convex subscriptions, or the existing Convex deployment.
- Moving the full React application into a shared package.
- Migrating unrelated Thread mutations, Areas, Thread Notes, Dashboard reads, or the rest of the application client.
- Renaming stored IDs, changing document ownership, or changing visible behavior.
- Creating a generic repository, generic CRUD client, or reusable database framework.

## Chosen approach

The public client exposes transport-neutral live resources. A live resource has a current snapshot and a `subscribe` method that returns its cleanup function. The paginated Activity Log resource additionally exposes `loadMore`. React adapts these resources with `useSyncExternalStore`; the contracts themselves do not mention React.

The transitional Convex adapter implements those resources with the existing `ConvexReactClient`. It uses the same client instance as the existing providers, so migrated subscriptions and mutations share Convex's connection and cache with unmigrated screens. This preserves live updates and allows the completion mutation to optimistically patch both the migrated Thread detail and older Dashboard and Area query results.

Two alternatives were rejected:

- Putting React hooks on `ApplicationClient` would make the public boundary depend on React and would make a future non-React caller awkward.
- Replacing subscriptions with one-shot reads plus manual refresh would regress cross-tab updates, cleanup semantics, and the existing Activity Log experience.

## Package boundaries

```text
apps/web
  React integration -> @vita-os/contracts
  Convex adapter    -> @vita-os/contracts, @vita-os/core, Convex
  Convex functions  -> @vita-os/core, Convex

packages/contracts  -> no runtime framework
packages/core       -> @vita-os/contracts only
```

`@vita-os/contracts` owns the public application vocabulary. `@vita-os/core` owns the completion decision and its focused atomic storage boundary. `apps/web` remains the composition root for now: it creates the Convex client, creates the application client adapter, and injects both.

## Public contracts

The contracts package defines plain TypeScript values for the subset the flow needs:

- `ThreadId` and `AreaId` are opaque strings. Their values are preserved byte-for-byte, but callers cannot rely on a Convex `Id` type or parse storage meaning from them.
- `Thread` contains the existing projected Thread fields needed by the detail pane, including `nextMove`, ordered `upNext`, activity metadata, and ownership references.
- `AreaSummary` contains the Area identity, slug, name, icon, and Condition used by the pane.
- `ActivityLogEntry` contains only the automatic entry kinds visible in the Activity Log. The legacy stored `note` kind is not part of the public contract because the current query already hides it.
- Existing `_id` field names remain in this first slice to avoid a broad UI rewrite, but their public type is an opaque string rather than a Convex-generated ID. A later migration may normalize wire names independently of storage IDs.

Every query snapshot is a discriminated union:

```ts
type QueryState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "not_found" }
  | { status: "error"; error: ApplicationError };
```

`ApplicationError` has a stable code (`unauthorized`, `not_found`, `validation`, `conflict`, `unavailable`, or `unexpected`), a safe message, and whether retrying may help. An absent or foreign-owned Thread maps to the same `not_found` representation so the boundary does not reveal ownership.

Mutation results are explicit rather than relying on transport exceptions:

```ts
type OperationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ApplicationError };

type CompleteNextMoveOutput =
  | { status: "completed" }
  | { status: "unchanged" };
```

The client surface is intentionally limited to three operations:

```ts
interface ApplicationClient {
  watchThreadDetail(
    input: { slug: string },
  ): LiveResource<QueryState<ThreadDetail>>;

  watchThreadActivity(
    input: { threadId: ThreadId; initialPageSize: number },
  ): PaginatedLiveResource<QueryState<ActivityLogPage>>;

  completeNextMove(
    input: { threadId: ThreadId; thread: Thread },
  ): Promise<OperationResult<CompleteNextMoveOutput>>;
}
```

The Thread value on `completeNextMove` supplies the current Area and optimistic attention state. It is not trusted by the server; it exists only so the transitional adapter can patch every relevant local cache immediately. Authorization and the completion decision use the server's stored Thread.

`ActivityLogPage` contains the accumulated entries and pagination state: `can_load_more`, `loading_more`, or `exhausted`. `loadMore` is a no-op unless the state is `can_load_more`. Snapshots retain object identity until their data changes, as required by `useSyncExternalStore`.

## Shared core completion rule

Core receives only the state required to complete a Next Move:

```ts
interface NextMoveCompletionState {
  nextMove?: string;
  upNext?: readonly string[];
}
```

The pure `decideNextMoveCompletion` function returns either `unchanged` when no Next Move exists, or an `apply` decision containing:

- the Thread patch that clears the Next Move or promotes the front of Up Next;
- the remaining Up Next list, omitted when empty;
- the automatic Activity Log entry with its previous and new values.

This single function is used by both the Convex mutation and the optimistic adapter. Optimism may apply the predicted Thread patch, but only the server writes the Activity Log because its timestamp and transaction outcome are authoritative.

Core also defines one focused storage capability for the eventual server operation:

```ts
interface CompleteNextMoveStore {
  completeAtomically(
    input: { actorId: string; threadId: ThreadId },
    decide: typeof decideNextMoveCompletion,
  ): Promise<CompleteNextMoveOutput>;
}
```

The store must load the Thread owned by `actorId`, run the decision, and—when applicable—apply the Thread patch, insert the Activity Log entry, and update `lastActivityAt` and `lastActivityContent` within one transaction. The focused callback keeps the rule in core while preventing callers from splitting the read and writes across separate storage calls. No other CRUD methods are introduced.

For this slice, the Convex mutation handler provides that capability over its mutation context. Convex already treats the handler as one transaction. `requireOwned` remains the server-side ownership check, and any thrown write failure rolls back the Thread patch, Activity Log insert, and activity metadata together.

## Convex adapter

The browser adapter is the only migrated client-side module that imports generated API references, Convex IDs, or Convex cache types.

- Thread detail uses `watchQuery(api.threads.detailBySlug, ...)` and maps `undefined` to loading, `null` or a missing Area to not found, and a projected result to contract values.
- Activity Log uses Convex's paginated watch facility so the existing page accumulation and live-query behavior remain intact. The adapter translates Convex pagination statuses to the public pagination states.
- Each resource starts work only when subscribed. The returned cleanup function releases its Convex watch; changing the Thread slug or closing the pane therefore releases the old subscription.
- Query exceptions and mutation failures are translated to `ApplicationError` without leaking Convex error objects.
- Next Move completion calls the existing public Convex mutation with an optimistic update. The update uses `decideNextMoveCompletion` and patches `threads.list`, every matching `threads.detailBySlug`, and the owning `areas.detailBySlug` cache. These are the same views patched today.
- Convex automatically removes the optimistic layer after confirmation and rolls it back on failure. Confirmed subscriptions then provide the authoritative Thread and Activity Log values to this tab and other connected tabs.

The adapter's use of Convex's paginated watch API is deliberately isolated because that API is marked internal by Convex. If it changes before the HTTP migration, only this transitional adapter changes; neither contracts nor React consumers do.

## React integration and migrated UI

An `ApplicationClientProvider` and hooks live in the existing web application for this slice. The provider accepts an `ApplicationClient`. `useThreadDetail`, `useThreadActivity`, and `useApplicationClient` consume the transport-neutral resources and never import Convex.

The migrated consumers are:

- `ThreadDetailView` for Thread and Area loading, including loading and not-found presentation;
- `ActivityLogSection` for paginated Activity Log loading;
- `useCompleteNextMove` for completion and typed failure handling.

The existing guarded action still owns pending UI and toast behavior. The hook converts an unsuccessful `OperationResult` into the existing rejected action path, so visible error behavior does not change.

Unrelated Thread controls remain on their existing Convex hooks. Where those controls receive contract-shaped Thread data, their existing integration module performs the narrow string-to-Convex-ID cast. The casts do not enter the public contract or the migrated consumers.

## Loading, failure, and reconciliation behavior

- Before the first subscription value, the Thread pane renders its existing skeleton.
- A missing Thread, foreign-owned Thread, or Thread whose Area disappeared renders the existing not-found view.
- Subscription failures flow to the existing route error boundary through the React integration.
- Activity Log initial loading renders its existing skeleton. Loading earlier entries keeps current entries visible and disables the load button.
- Completing a Next Move updates its slot and every affected old cache immediately.
- If the mutation fails, Convex rolls back the optimistic layer and the existing error toast appears.
- On success, the server transaction supplies the confirmed Thread state and new Activity Log entry. A second connected client sees both through its subscriptions without refreshing.
- Completing when no Next Move exists returns `unchanged`, writes nothing, and leaves all caches unchanged.

## Testing strategy and agreed seams

Tests observe behavior only through the approved public seams:

1. **Core rule:** table-driven tests cover clearing the final Next Move, promoting one or several Up Next moves, generating the exact Activity Log entry, and doing nothing when no Next Move exists.
2. **Public Convex mutation:** integration tests call `api.threads.completeNextMoveMutation` as an owner, another signed-in user, and an unauthenticated user. They verify the Thread patch, queue promotion, Activity Log entry, metadata, no-op behavior, and rollback when a write fails.
3. **Application client:** adapter tests exercise public resource snapshots and callbacks, pagination translation, unsubscribe cleanup, error mapping, optimistic updates across existing caches, confirmation, and rollback.
4. **React boundary:** Thread detail tests inject a fake `ApplicationClient`. They verify loading, ready, not-found, failure, completion, Activity Log pagination, resource replacement when the slug changes, and cleanup on close/unmount without mocking Convex hooks for migrated operations.
5. **Regression coverage:** existing Dashboard, Area inventory, Thread detail, Activity Log, authorization, and Up Next tests continue to pass.

The final verification is `bun run lint`, `bun run build`, and `bun run test:run` from the repository root, as required by `AGENTS.md` and issue 325.

## Documentation and follow-on work

The implementation will add a migration note listing every remaining direct Convex dependency in the Thread flow. The next HTTP/Hono slice must:

- implement the same `ApplicationClient` contracts over HTTP plus an explicit realtime strategy;
- implement `CompleteNextMoveStore.completeAtomically` with a real database transaction;
- preserve the same opaque IDs or provide a deliberate mapping during migration;
- reproduce authorization, optimistic reconciliation, pagination, and cross-client update tests;
- migrate additional operations incrementally before extracting the full shared React application.

No claim about D1 suitability will be made from this Convex-only slice. That decision requires the later transactional Hono/database proof described by issue 322.
