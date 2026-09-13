# Thread Application Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route Thread detail loading, Activity Log pagination, and Next Move completion through an injected transport-independent application client while Convex remains the authoritative reactive backend.

**Architecture:** Add framework-free contracts and core packages, then implement their narrow live-query and completion interfaces in a transitional Convex adapter. React consumes those interfaces through `useSyncExternalStore`; the existing Convex mutation remains the atomic server transaction and shares the core completion decision with optimistic updates.

**Tech Stack:** TypeScript 7, React 19, Convex 1.42, Vitest 4, Turborepo, Bun

**Spec:** `docs/superpowers/specs/2026-09-11-thread-application-boundary-design.md`

## Global Constraints

- Preserve the domain language in `CONTEXT.md`, especially **Thread**, **Next Move**, **Up Next**, and **Activity Log**.
- Keep public contracts independent of React, Convex, Hono, Cloudflare, Better Auth, and generated database types.
- Keep Convex persistence, live subscriptions, pagination, ownership enforcement, and transaction guarantees.
- Do not add Hono, D1, data migration, a generic CRUD abstraction, or unrelated operation migrations.
- Do not start Vite, Convex development, or Convex generation.
- Run `bun run lint`, `bun run build`, and `bun run test:run` from the repository root before completion.

---

### Task 1: Shared contracts and completion rule

**Files:**

- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/tsconfig.build.json`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/tsconfig.build.json`
- Create: `packages/core/src/complete-next-move.test.ts`
- Create: `packages/core/src/complete-next-move.ts`
- Create: `packages/core/src/index.ts`

**Interfaces:**

- Produces: `ApplicationClient`, `LiveResource<T>`, `PaginatedLiveResource<T>`, `QueryState<T>`, `OperationResult<T>`, `Thread`, `ThreadDetail`, `ActivityLogPage`, and related public values from `@vita-os/contracts`.
- Produces: `decideNextMoveCompletion(state: NextMoveCompletionState): NextMoveCompletionDecision` and `CompleteNextMoveStore` from `@vita-os/core`.

- [x] **Step 1: Write a failing core rule test**

```ts
it("promotes the front Up Next move and describes one atomic change", () => {
  expect(
    decideNextMoveCompletion({
      nextMove: "Call clinic",
      upNext: ["Book appointment", "Collect results"],
    }),
  ).toEqual({
    status: "apply",
    patch: {
      nextMove: "Book appointment",
      upNext: ["Collect results"],
    },
    activity: {
      type: "next_action_change",
      content:
        'Completed "Call clinic" — next move set to "Book appointment"',
      previousValue: "Call clinic",
      newValue: "Book appointment",
    },
  });
});
```

Also cover clearing the final move and returning `{ status: "unchanged" }` when no Next Move exists. Each expected value is a hand-written literal.

- [x] **Step 2: Run the test and verify RED**

Run: `bunx vitest run packages/core/src/complete-next-move.test.ts`

Expected: FAIL because `@vita-os/core` and `decideNextMoveCompletion` do not exist.

- [x] **Step 3: Add the package contracts and minimal completion decision**

```ts
export function decideNextMoveCompletion(
  state: NextMoveCompletionState,
): NextMoveCompletionDecision {
  if (!state.nextMove) return { status: "unchanged" };

  const [promoted, ...remaining] = state.upNext ?? [];
  return {
    status: "apply",
    patch: {
      nextMove: promoted,
      upNext: remaining.length > 0 ? remaining : undefined,
    },
    activity: {
      type: "next_action_change",
      content: promoted
        ? `Completed "${state.nextMove}" — next move set to "${promoted}"`
        : `Completed "${state.nextMove}" — next move cleared`,
      previousValue: state.nextMove,
      newValue: promoted,
    },
  };
}
```

Define the focused store as one atomic method accepting `actorId`, `threadId`, and the decision function. Do not expose separate get, patch, or insert methods.

- [x] **Step 4: Run the core test and package typechecks and verify GREEN**

Run: `bunx vitest run packages/core/src/complete-next-move.test.ts`

Run: `bunx turbo run typecheck --filter=@vita-os/contracts --filter=@vita-os/core`

Expected: all tests and both typechecks pass.

- [x] **Step 5: Commit the shared boundary**

```bash
git add packages/contracts packages/core package.json bun.lock
git commit -m "feat(core): define Thread completion boundary"
```

### Task 2: Convex mutation uses the core decision atomically

**Files:**

- Modify: `apps/web/convex/lib/threadChanges.ts`
- Modify: `apps/web/convex/lib/threadChanges.test.ts`
- Modify: `apps/web/convex/threads.ts`
- Modify: `apps/web/convex/upNext.test.ts`
- Modify: `apps/web/convex/authorization.test.ts`

**Interfaces:**

- Consumes: `decideNextMoveCompletion` and `CompleteNextMoveOutput`.
- Produces: `completeNextMove(ctx, args): Promise<CompleteNextMoveOutput>` while preserving the public `api.threads.completeNextMoveMutation` transaction.

- [x] **Step 1: Add failing mutation outcome and failure-safety assertions**

```ts
expect(
  await owner.mutation(api.threads.completeNextMoveMutation, {
    id: owned.threadId,
  }),
).toEqual({ status: "completed" });
```

Add a no-Next-Move case expecting `{ status: "unchanged" }` with no new log or metadata change. Strengthen the foreign-user test to reread the owner's Thread and Activity Log after rejection and prove both remain unchanged.

- [x] **Step 2: Run the two Convex files and verify RED**

Run: `bun run --cwd apps/web test:run convex/upNext.test.ts convex/authorization.test.ts`

Expected: FAIL because the mutation currently returns `null`/`undefined` instead of an explicit outcome.

- [x] **Step 3: Replace the Convex-local decision with the shared rule**

```ts
const decision = decideNextMoveCompletion({
  nextMove: args.thread.nextMove,
  upNext: args.thread.upNext,
});
if (decision.status === "unchanged") return { status: "unchanged" };

await ctx.db.patch(args.thread._id, decision.patch);
await recordActivity(ctx, {
  userId: args.userId,
  threadId: args.thread._id,
  entry: decision.activity,
  createdAt: Date.now(),
});
return { status: "completed" };
```

Keep `requireOwned` before `completeNextMove`, and return its outcome from the public mutation.

- [x] **Step 4: Run the focused Convex tests and web typecheck and verify GREEN**

Run: `bun run --cwd apps/web test:run convex/upNext.test.ts convex/authorization.test.ts convex/lib/threadChanges.test.ts`

Run: `bunx turbo run typecheck --filter=@vita-os/web`

Expected: tests and typechecking pass.

- [x] **Step 5: Commit the server migration**

```bash
git add apps/web/convex packages/core
git commit -m "refactor(convex): share Next Move completion rule"
```

### Task 3: Transitional Convex application client

**Files:**

- Create: `apps/web/src/application/convex/convex-application-client.test.ts`
- Create: `apps/web/src/application/convex/convex-application-client.ts`
- Create: `apps/web/src/application/convex/convex-live-resource.ts`
- Modify: `apps/web/src/features/threads/optimistic.ts`
- Modify: `apps/web/src/features/threads/optimistic.test.ts`

**Interfaces:**

- Consumes: `ApplicationClient` contracts, `decideNextMoveCompletion`, the generated Convex API, and the existing optimistic cache helpers.
- Produces: `createConvexApplicationClient(convex): ApplicationClient`.

- [x] **Step 1: Write failing adapter resource tests**

Use a boundary fake that mirrors the complete Convex watch shape. Assert real resource behavior:

```ts
const resource = applicationClient.watchThreadDetail({ slug: "book-checkup" });
const unsubscribe = resource.subscribe(onChange);
fakeConvex.publishDetail({ thread, area });

expect(resource.getSnapshot()).toEqual({
  status: "ready",
  data: { thread, area },
});

unsubscribe();
fakeConvex.publishDetail(null);
expect(onChange).toHaveBeenCalledTimes(1);
```

Add separate tests for loading, not found, query failure, Activity Log pagination translation and `loadMore`, successful/unchanged completion, mutation error mapping, and the mutation's observable optimistic effect on the existing Thread caches.

- [x] **Step 2: Run the adapter test and verify RED**

Run: `bun run --cwd apps/web test:run src/application/convex/convex-application-client.test.ts`

Expected: FAIL because `createConvexApplicationClient` does not exist.

- [x] **Step 3: Implement live resources and the Convex adapter**

```ts
export function createConvexApplicationClient(
  convex: ConvexApplicationClientPort,
): ApplicationClient {
  return {
    watchThreadDetail: ({ slug }) =>
      createConvexLiveResource(
        () => convex.watchQuery(api.threads.detailBySlug, { slug }),
        mapThreadDetail,
      ),
    watchThreadActivity: ({ threadId, initialPageSize }) =>
      createConvexPaginatedResource(
        () =>
          convex.watchPaginatedQuery(
            api.activityLogs.listByThread,
            { threadId: threadId as Id<"threads"> },
            { initialNumItems: initialPageSize, id: nextPaginationId() },
          ),
        mapActivityLogPage,
      ),
    completeNextMove: (input) => completeWithOptimism(convex, input),
  };
}
```

The live-resource implementation caches each translated snapshot until Convex signals a change. Its first subscriber starts the watch and its last unsubscribe releases it. `localQueryResult()` exceptions become `{ status: "error" }`.

Use `decideNextMoveCompletion` inside `completeNextMove`'s Convex optimistic update and reuse the existing helpers that patch `threads.list`, `threads.detailBySlug`, and `areas.detailBySlug`.

- [x] **Step 4: Run adapter and optimistic tests and web typecheck and verify GREEN**

Run: `bun run --cwd apps/web test:run src/application/convex/convex-application-client.test.ts src/features/threads/optimistic.test.ts`

Run: `bunx turbo run typecheck --filter=@vita-os/web`

Expected: tests and typechecking pass.

- [x] **Step 5: Commit the Convex adapter**

```bash
git add apps/web/src/application apps/web/src/features/threads/optimistic.ts apps/web/src/features/threads/optimistic.test.ts
git commit -m "feat(web): adapt Convex to application client"
```

### Task 4: Inject the client and migrate the Thread flow

**Files:**

- Create: `apps/web/src/application/application-client-context.test.tsx`
- Create: `apps/web/src/application/application-client-context.tsx`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/test/render-with-providers.tsx`
- Modify: `apps/web/src/features/threads/thread-detail/thread-detail-view.test.tsx`
- Modify: `apps/web/src/features/threads/thread-detail/thread-detail-view.tsx`
- Modify: `apps/web/src/features/threads/components/thread-log-section.tsx`
- Modify: `apps/web/src/features/threads/components/thread-log.tsx`
- Modify: `apps/web/src/features/threads/use-complete-next-move.ts`

**Interfaces:**

- Consumes: injected `ApplicationClient` and its live resources.
- Produces: `ApplicationClientProvider`, `useThreadDetail`, `useThreadActivity`, and `useApplicationClient` for transport-neutral React consumers.

- [x] **Step 1: Write failing React-boundary and migrated-flow tests**

```tsx
const detail = createMutableResource<QueryState<ThreadDetail>>({
  status: "loading",
});
const client = createFakeApplicationClient({ detail });

render(<ThreadDetailView {...props} />, { applicationClient: client });
expect(screen.getByLabelText("Loading thread details")).toBeVisible();

act(() => detail.publish({ status: "ready", data: threadDetail }));
expect(
  screen.getByRole("dialog", { name: "Sister's front teeth" }),
).toBeVisible();
```

Cover not found, thrown query errors reaching the error boundary, slug-change unsubscribe, unmount cleanup, Activity Log loading/load-more states, and completion through the fake client's public method. Remove mocks of Convex detail, Activity Log, and completion APIs from the migrated-flow tests; retain mocks only for explicitly unmigrated controls.

- [x] **Step 2: Run the React tests and verify RED**

Run: `bun run --cwd apps/web test:run src/application/application-client-context.test.tsx src/features/threads/thread-detail/thread-detail-view.test.tsx`

Expected: FAIL because the provider and transport-neutral hooks do not exist.

- [x] **Step 3: Implement the provider/hooks and inject the adapter**

```tsx
export function useThreadDetail(slug: string): QueryState<ThreadDetail> {
  const client = useApplicationClient();
  const resource = useMemo(
    () => client.watchThreadDetail({ slug }),
    [client, slug],
  );
  return useSyncExternalStore(
    resource.subscribe,
    resource.getSnapshot,
    resource.getSnapshot,
  );
}
```

Create the adapter once beside the existing `ConvexReactClient` and place `ApplicationClientProvider` inside the authenticated Convex provider stack. Update the shared test renderer to accept an explicit fake client.

Map the explicit detail states to the current skeleton/not-found/error behavior. Map public Activity Log pagination state to the existing `ActivityLog` props. Make `useCompleteNextMove` call the injected client and throw the returned `ApplicationError` on `{ ok: false }` so the guarded action keeps its current toast path.

- [x] **Step 4: Run the focused React tests and web typecheck and verify GREEN**

Run: `bun run --cwd apps/web test:run src/application/application-client-context.test.tsx src/features/threads/thread-detail/thread-detail-view.test.tsx src/features/threads/components/thread-log.test.tsx`

Run: `bunx turbo run typecheck --filter=@vita-os/web`

Expected: tests and typechecking pass.

- [x] **Step 5: Commit the injected UI flow**

```bash
git add apps/web/src/application apps/web/src/main.tsx apps/web/src/test apps/web/src/features/threads
git commit -m "refactor(web): inject Thread application client"
```

### Task 5: Migration record, full verification, and review

**Files:**

- Create: `docs/migrations/thread-application-boundary.md`
- Modify: any files required to resolve review findings within issue 325 scope.

**Interfaces:**

- Consumes: the completed shared boundary and issue 325 acceptance criteria.
- Produces: an explicit list of remaining Convex dependencies and HTTP-adapter follow-on work.

- [x] **Step 1: Record the demonstrated flow and remaining dependencies**

Document that the migrated flow is `ThreadDetailView -> ApplicationClient -> Convex`, and list the still-direct Convex integrations: unrelated Thread edits/lifecycle, Thread Notes, Areas, Dashboard, Notes, auth, and application bootstrap. State that HTTP must provide a realtime strategy, transaction-backed `CompleteNextMoveStore`, authorization/error mapping, pagination, and equivalent optimistic reconciliation.

- [x] **Step 2: Run focused regression tests**

Run: `bun run --cwd apps/web test:run convex/upNext.test.ts convex/authorization.test.ts convex/lib/threadChanges.test.ts src/application src/features/threads src/features/dashboard src/features/areas`

Expected: all selected tests pass without warnings.

- [x] **Step 3: Run repository verification**

Run: `bun run lint`

Run: `bun run build`

Run: `bun run test:run`

Expected: every command exits zero; the full suite reports zero failed tests.

- [x] **Step 4: Review against standards and spec**

Use `/code-review` with fixed point `origin/main`. Run Standards and Spec review axes in parallel. Resolve every confirmed hard violation or issue-325 requirement gap, then rerun the relevant focused test and all three repository verification commands.

- [x] **Step 5: Commit the final reviewed implementation**

```bash
git add docs/migrations apps/web packages package.json bun.lock
git commit -m "feat(threads): decouple Next Move completion"
```
