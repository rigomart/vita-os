# Cloudflare Target Architecture Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove issue 348's authenticated Thread read, bounded Activity Log pagination, and atomic Next Move completion through a real local Hono Worker, Better Auth, D1, an asynchronous application client, and a shared TanStack Query boundary.

**Architecture:** Add an isolated `apps/api` Worker with committed D1 migrations and operation-shaped storage, replace the public Convex-style client contract with an asynchronous contract while keeping the active Convex client private to `apps/web`, and begin `packages/application` as the shared React/TanStack Query boundary. Completion uses the existing core decision plus a revision-checked D1 batch; the current Convex application remains the active product path.

**Tech Stack:** Bun 1.3, TypeScript 7, Hono 4, Better Auth 1.6.25, Cloudflare Workers and D1, Wrangler 4, Cloudflare Vitest plugin 1, Vitest 4, React 19, TanStack Query 5

**Spec:** `docs/superpowers/specs/2026-09-19-cloudflare-target-architecture-proof-design.md`

## Global Constraints

- Preserve the domain language in `CONTEXT.md`, especially **Thread**, **Next Move**, **Up Next**, **Activity Log**, and **Activity Log Entry**.
- Keep the public application contract independent of Convex, Hono, D1, Better Auth, React, and generated database types.
- Keep the active `apps/web/src/main.tsx` composition on Convex; do not add a runtime backend switch, proof route, or required API environment variable.
- Do not modify a production Convex query, mutation, schema, deployment, or stored record.
- Use one explicit authenticated actor for every protected operation; missing and foreign-owned records must remain publicly indistinguishable.
- Preserve opaque text IDs, epoch-millisecond timestamps, optional-value distinctions, and all Thread fields named by issue 348.
- Run all Worker/D1 integration tests against the real local Workers runtime and D1 binding, not a JavaScript database fake.
- Do not run Vite dev, Wrangler dev, Convex dev, or Convex generation.
- Do not create remote Cloudflare resources, deploy, push, or merge as part of this plan.
- Use test-first development for behavior changes and run `bun run lint`, `bun run build`, and `bun run test:run` from the repository root before completion.

## Review Focus

- Two requests carrying the same expected Next Move and revision must advance the Thread once, create one Activity Log Entry, and yield one completed response plus one conflict, even when the promoted move has the same text; Task 4 pins this through real HTTP concurrency.
- A failure after the intended Thread update must roll back Next Move, Up Next, activity metadata, revision, operation token, and Activity Log together; Task 4 forces a real primary-key failure and checks every value.
- Missing and foreign-owned Threads must return byte-for-byte equivalent public not-found responses; Task 3 tests both detail and Activity Log routes.
- Tied Activity Log timestamps and malformed cursors must never duplicate, skip, or unbound entries; Task 3 tests the `(createdAt, id)` boundary and every invalid limit/cursor class.
- An unauthenticated request must be rejected before application storage is constructed or called; Task 2 tests the dependency boundary and the public Worker response.

---

### Task 1: Establish the asynchronous contract and isolate Convex compatibility

**Files:**

- Create: `packages/contracts/src/index.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/package.json`
- Create: `apps/web/src/application/convex/convex-application-client-compatibility.ts`
- Modify: `apps/web/src/application/application-client-context.tsx`
- Modify: `apps/web/src/application/convex/convex-live-resource.ts`
- Modify: `apps/web/src/application/convex/convex-application-client.ts`
- Modify: `apps/web/src/application/application-client-context.test.tsx`
- Modify: `apps/web/src/application/convex/convex-application-client.test.ts`
- Modify: `apps/web/src/test/render-with-providers.tsx`
- Modify: `apps/web/src/components/layout/app-shell.test.tsx`
- Modify: `apps/web/src/features/threads/use-complete-next-move.test.tsx`
- Modify: `apps/web/src/features/threads/thread-detail/thread-detail-view.test.tsx`

**Interfaces:**

- Produces: `ApplicationClient.getThreadDetail`, `getThreadActivityPage`, and `completeNextMove` as asynchronous framework-free operations.
- Produces: `ActivityLogPage = { entries; nextCursor? }`.
- Produces: a web-private `ConvexApplicationClient` retaining the current live-resource behavior until issue 349.
- Preserves: the active Convex gateway, optimistic updates, subscriptions, UI hooks, and `main.tsx` composition unchanged at runtime.

- [ ] **Step 1: Write the failing asynchronous contract test**

Add a real Vitest case whose fake client satisfies the intended public interface and records the expected completion intent:

```ts
it("models the Thread proof as asynchronous application operations", async () => {
  const client = {
    getThreadDetail: async () => ({
      ok: false,
      error: { code: "not_found", message: "Thread not found.", retryable: false },
    }),
    getThreadActivityPage: async () => ({
      ok: true,
      value: { entries: [], nextCursor: "cursor-2" },
    }),
    completeNextMove: async (input) => ({
      ok: true,
      value: input.expectedNextMove === null
        ? { status: "unchanged" }
        : { status: "completed" },
    }),
  } satisfies ApplicationClient;

  await expect(
    client.completeNextMove({
      threadId: "thread-1" as ThreadId,
      expectedNextMove: "Call clinic",
      expectedRevision: 0,
    }),
  ).resolves.toEqual({ ok: true, value: { status: "completed" } });
});
```

- [ ] **Step 2: Run the contract test and typecheck to verify RED**

Run:

```bash
bun --cwd packages/contracts run test:run -- src/index.test.ts
bun --cwd packages/contracts run typecheck
```

Expected: FAIL because the package has no test script and `ApplicationClient` still requires `watchThreadDetail`, `watchThreadActivity`, the old pagination shape, and a whole `Thread` mutation input.

- [ ] **Step 3: Define the public asynchronous contract**

Replace only the transport-facing types in `packages/contracts/src/index.ts`:

```ts
export interface ActivityLogPage {
  entries: ActivityLogEntry[];
  nextCursor?: string;
}

export interface ApplicationClient {
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

Remove `QueryState`, `ActivityLogPagination`, `LiveResource`, and `PaginatedLiveResource` from the public package. Add `vitest: "4.1.7"` plus `test` and `test:run` scripts to `packages/contracts/package.json`; do not add runtime dependencies.

- [ ] **Step 4: Add the private Convex compatibility interface**

Create the web-private compatibility types:

```ts
export type ConvexQueryState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "not_found" }
  | { status: "error"; error: ApplicationError };

export interface ConvexActivityLogPage {
  entries: ActivityLogEntry[];
  pagination: "can_load_more" | "loading_more" | "exhausted";
}

export interface ConvexLiveResource<T> {
  getSnapshot: () => T;
  subscribe: (listener: () => void) => () => void;
}

export interface ConvexPaginatedLiveResource<T>
  extends ConvexLiveResource<T> {
  loadMore: () => void;
}

export interface ConvexApplicationClient {
  watchThreadDetail(input: {
    slug: string;
  }): ConvexLiveResource<ConvexQueryState<ThreadDetail>>;
  watchThreadActivity(input: {
    threadId: ThreadId;
    initialPageSize: number;
  }): ConvexPaginatedLiveResource<ConvexQueryState<ConvexActivityLogPage>>;
  completeNextMove(input: {
    threadId: ThreadId;
    thread: Thread;
  }): Promise<OperationResult<CompleteNextMoveOutput>>;
}
```

Switch only imports and annotations in the existing web context, Convex adapter, resource helper, test renderer, and named tests. Preserve their expected values and runtime code. Do not edit `apps/web/src/main.tsx` or `apps/web/src/lib/auth-client.ts`.

- [ ] **Step 5: Run contract and Convex compatibility tests to verify GREEN**

Run:

```bash
bun --cwd packages/contracts run test:run -- src/index.test.ts
bun --cwd packages/contracts run typecheck
bun --cwd apps/web run test:run -- src/application/application-client-context.test.tsx src/application/convex/convex-application-client.test.ts src/features/threads/use-complete-next-move.test.tsx src/components/layout/app-shell.test.tsx src/features/threads/thread-detail/thread-detail-view.test.tsx
bun --cwd apps/web run typecheck
```

Expected: all commands pass and the current live Convex behavior remains byte-for-byte equivalent through its private types.

- [ ] **Step 6: Commit the contract boundary**

```bash
git add packages/contracts apps/web/src/application apps/web/src/test/render-with-providers.tsx apps/web/src/components/layout/app-shell.test.tsx apps/web/src/features/threads/use-complete-next-move.test.tsx apps/web/src/features/threads/thread-detail/thread-detail-view.test.tsx
git commit -m "refactor(application): define asynchronous client contract"
```

---

### Task 2: Create the Worker, D1 schema, Better Auth, and actor gate

**Files:**

- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/wrangler.jsonc`
- Create: `apps/api/worker-configuration.d.ts`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/migrations/0001_auth.sql`
- Create: `apps/api/migrations/0002_vita.sql`
- Create: `apps/api/src/env.ts`
- Create: `apps/api/src/auth.ts`
- Create: `apps/api/src/errors.ts`
- Create: `apps/api/src/authenticated-actor.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/worker.ts`
- Create: `apps/api/test/apply-migrations.ts`
- Create: `apps/api/test/auth.integration.test.ts`
- Modify: `bun.lock`

**Interfaces:**

- Produces: `createAuth(env)` backed directly by `env.DB`.
- Produces: `createApp(env, dependencies?)` with Better Auth mounted at `/api/auth/*` and protected `/v1/*` routes receiving only `{ actorId }`.
- Produces: stable JSON application-error responses.
- Produces: repeatable Better Auth and canonical Vita OS D1 migrations.
- Consumes: no production Convex module or configuration.

- [ ] **Step 1: Add configuration-only workspace scaffolding**

Create `@vita-os/api` with runtime dependencies `@vita-os/contracts`, `@vita-os/core`, `better-auth@1.6.25`, and `hono@^4.12.18`; add development dependencies `@cloudflare/vitest-plugin@^1.0.0`, `typescript`, `vitest@4.1.7`, and `wrangler@4.131.0`. Use these scripts:

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json --noEmit && wrangler deploy --dry-run --outdir dist",
    "dev": "wrangler dev",
    "lint": "oxlint --fix --deny-warnings . && oxfmt --write .",
    "lint:check": "oxlint --deny-warnings . && oxfmt --check .",
    "test": "vitest",
    "test:run": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

Configure an ES-module Worker at `src/worker.ts`, compatibility date `2026-09-19`, `nodejs_compat`, a local/test `DB` binding, and `migrations_dir: "migrations"`. Use an all-zero local-only database ID and do not create a remote D1 database.

Run `bun install` from the repository root after adding the workspace dependencies.

- [ ] **Step 2: Commit the exact database schema**

Generate the Better Auth 1.6.25 SQLite schema once from the locked `createAuth` options, review it, and commit the resulting `user`, `session`, `account`, and `verification` DDL as `0001_auth.sql`. It must include the unique email, session token, and account provider indexes required by Better Auth; do not run schema generation at Worker startup.

Create `0002_vita.sql` with the canonical proof tables and indexes:

```sql
CREATE TABLE areas (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  standard TEXT,
  condition TEXT NOT NULL CHECK (condition IN ('healthy', 'needs_attention', 'critical')),
  icon TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, slug)
);

CREATE TABLE threads (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  area_id TEXT NOT NULL REFERENCES areas(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  summary TEXT,
  sort_order INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('open', 'resolved')),
  next_move TEXT,
  up_next_json TEXT CHECK (up_next_json IS NULL OR json_valid(up_next_json)),
  follow_up INTEGER,
  last_activity_at INTEGER,
  last_activity_content TEXT,
  created_at INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  last_completion_token TEXT,
  UNIQUE (user_id, slug)
);

CREATE TABLE activity_log_entries (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('area_move', 'next_action_change', 'state_change', 'follow_up_change')),
  content TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX activity_log_entries_by_owner_thread_time
  ON activity_log_entries (user_id, thread_id, created_at DESC, id DESC);
```

The application must additionally reject a parsed empty or non-string Up Next array as unexpected stored data.

- [ ] **Step 3: Write the failing authentication and actor-gate tests**

Use `readD1Migrations` in `vitest.config.ts`, expose them as `TEST_MIGRATIONS`, and apply them to `env.DB` from the setup file with `applyD1Migrations`.

Add one real Worker test that signs up through `POST /api/auth/sign-up/email`, captures the session cookie, and confirms that `/api/auth/get-session` returns the created user. Add a dependency-boundary test like:

```ts
it("rejects an unauthenticated application request before creating storage", async () => {
  const createStore = vi.fn();
  const response = await createApp(testEnv, { createStore }).request(
    "/v1/threads/private-thread",
  );

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({
    error: {
      code: "unauthorized",
      message: "Authentication required.",
      retryable: false,
    },
  });
  expect(createStore).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: Run the authentication tests to verify RED**

Run:

```bash
bun --cwd apps/api run test:run -- test/auth.integration.test.ts
```

Expected: FAIL because the Worker, Better Auth composition, actor middleware, and stable error response do not exist.

- [ ] **Step 5: Implement auth, error mapping, CORS, and the actor gate**

Create Better Auth per environment:

```ts
export function createAuth(env: Env) {
  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.BROWSER_ORIGIN],
    emailAndPassword: { enabled: true, requireEmailVerification: false },
  });
}
```

Register exact-origin credentialed CORS before `app.all("/api/auth/*", ...)`. The protected middleware must call `auth.api.getSession({ headers: c.req.raw.headers })`, return the stable 401 when absent, and place only `{ actorId: session.user.id }` into Hono context. Construct the application store only after that middleware succeeds.

- [ ] **Step 6: Run auth tests and package checks to verify GREEN**

Run:

```bash
bun --cwd apps/api run test:run -- test/auth.integration.test.ts
bun --cwd apps/api run typecheck
bun --cwd apps/api run build
```

Expected: sign-up/session and the pre-storage unauthorized gate pass; the Worker bundles in dry-run mode without deploying.

- [ ] **Step 7: Commit the Worker foundation**

```bash
git add apps/api bun.lock
git commit -m "feat(api): add authenticated D1 worker foundation"
```

---

### Task 3: Implement owned Thread detail and stable Activity Log pagination

**Files:**

- Create: `apps/api/src/activity-cursor.ts`
- Create: `apps/api/src/d1-thread-store.ts`
- Create: `apps/api/test/thread-reads.integration.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/errors.ts`

**Interfaces:**

- Produces: `D1ThreadStore.getThreadDetail({ actorId, slug })`.
- Produces: `D1ThreadStore.getThreadActivityPage({ actorId, threadId, limit, cursor? })`.
- Produces: a versioned base64url cursor for `(createdAt, id)`.
- Consumes: the Task 2 D1 schema and stable error envelope.

- [ ] **Step 1: Write failing owned-detail tests**

Seed two Better Auth user IDs, Areas, and Threads directly through `env.DB`. Through `exports.default.fetch`, assert that the owner receives this complete contract shape:

```ts
expect(await response.json()).toEqual({
  thread: {
    _id: "thread-owner",
    title: "Book checkup",
    slug: "book-checkup",
    summary: "Choose a clinic",
    areaId: "area-owner",
    order: 3,
    state: "open",
    nextMove: "Call clinic",
    upNext: ["Book appointment", "Collect results"],
    followUp: 1_800_000_000_000,
    lastActivityAt: 1_700_000_000_000,
    lastActivityContent: "Captured next move",
    createdAt: 1_600_000_000_000,
  },
  area: {
    _id: "area-owner",
    name: "Family Health",
    slug: "family-health",
    standard: "Appointments are current",
    condition: "needs_attention",
    icon: "HeartPulse",
    order: 2,
    createdAt: 1_500_000_000_000,
  },
});
```

Request both an absent slug and the other actor's slug and assert identical status, headers relevant to the API, and JSON body.

- [ ] **Step 2: Run detail tests to verify RED**

Run:

```bash
bun --cwd apps/api run test:run -- test/thread-reads.integration.test.ts -t "Thread detail"
```

Expected: FAIL with 404 route responses because the detail route and store query are missing.

- [ ] **Step 3: Implement the ownership-constrained detail read**

Use one join that includes the actor on both rows:

```sql
SELECT
  t.id, t.title, t.slug, t.summary, t.area_id, t.sort_order, t.state,
  t.next_move, t.up_next_json, t.follow_up, t.last_activity_at,
  t.last_activity_content, t.created_at,
  a.id AS area_result_id, a.name AS area_name, a.slug AS area_slug,
  a.standard AS area_standard, a.condition AS area_condition,
  a.icon AS area_icon, a.sort_order AS area_sort_order,
  a.created_at AS area_created_at
FROM threads t
JOIN areas a ON a.id = t.area_id AND a.user_id = ?
WHERE t.user_id = ? AND t.slug = ?
LIMIT 1;
```

Map SQL `NULL` to absent optional properties and parse Up Next as a non-empty string array. Treat malformed stored JSON, an empty array, or a non-string item as `unexpected`.

- [ ] **Step 4: Write failing bounded-pagination tests**

Seed at least five entries with two tied timestamps plus entries for another Thread and actor. Assert:

- absent `limit` defaults to 20;
- `limit=2` returns two entries and `nextCursor`;
- the next page uses that cursor without duplicates or gaps;
- the last page omits `nextCursor`;
- another actor receives the same 404 as a missing Thread;
- `0`, `-1`, `1.5`, `51`, non-numeric limits, malformed base64, invalid JSON, unsafe timestamps, and cursor version `2` return the stable validation error.

Derive expected entry IDs by hand, for example `log-z` before `log-a` when both share the same timestamp and IDs sort descending.

- [ ] **Step 5: Run pagination tests to verify RED**

Run:

```bash
bun --cwd apps/api run test:run -- test/thread-reads.integration.test.ts -t "Activity Log"
```

Expected: FAIL because the cursor codec, validation, query, and route do not exist.

- [ ] **Step 6: Implement the cursor codec and bounded query**

Encode exactly `{ v: 1, createdAt, id }` as base64url JSON. Decode by validating the object keys, version, safe integer timestamp, and non-empty string ID.

After proving Thread ownership, query `limit + 1` rows with:

```sql
WHERE user_id = ? AND thread_id = ?
  AND (
    ? IS NULL
    OR created_at < ?
    OR (created_at = ? AND id < ?)
  )
ORDER BY created_at DESC, id DESC
LIMIT ?;
```

Return at most `limit` entries and derive the next cursor from the last returned row only when the extra row exists.

- [ ] **Step 7: Run read tests and package checks to verify GREEN**

Run:

```bash
bun --cwd apps/api run test:run -- test/thread-reads.integration.test.ts
bun --cwd apps/api run typecheck
```

Expected: all detail, ownership, pagination, tie-order, bound, and malformed-input cases pass.

- [ ] **Step 8: Commit the read slice**

```bash
git add apps/api/src apps/api/test/thread-reads.integration.test.ts
git commit -m "feat(api): read owned Threads and Activity Logs"
```

---

### Task 4: Prove atomic Next Move completion, rollback, and concurrency

**Files:**

- Modify: `packages/core/src/complete-next-move.ts`
- Modify: `packages/core/src/complete-next-move.test.ts`
- Modify: `apps/api/src/d1-thread-store.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/test/complete-next-move.integration.test.ts`

**Interfaces:**

- Extends: the focused core store input with optional `expectedNextMove` and `expectedRevision`; the active Convex caller omits both and keeps its transactional behavior.
- Produces: `D1ThreadStore.completeNextMove({ actorId, threadId, expectedNextMove, expectedRevision })`.
- Produces: POST `/v1/threads/:threadId/complete-next-move` with `{ expectedNextMove: string | null, expectedRevision: number }`.
- Preserves: `decideNextMoveCompletion` as the single completion rule.

- [ ] **Step 1: Write the failing expected-intent core boundary test**

Add a focused forwarding test:

```ts
it("passes the caller's expected Next Move and revision to atomic storage", async () => {
  const completeAtomically = vi.fn().mockResolvedValue({ status: "completed" });

  await completeNextMove(
    { completeAtomically },
    {
      actorId: "user-1",
      threadId: "thread-1" as ThreadId,
      expectedNextMove: "Call clinic",
      expectedRevision: 0,
    },
  );

  expect(completeAtomically).toHaveBeenCalledWith(
    {
      actorId: "user-1",
      threadId: "thread-1",
      expectedNextMove: "Call clinic",
      expectedRevision: 0,
    },
    decideNextMoveCompletion,
  );
});
```

Define `expectedNextMove?: string | null` and `expectedRevision?: number` so the existing Convex call site can omit both without changing production behavior; the D1 entry point requires a concrete string or `null` and a nonnegative safe-integer revision.

- [ ] **Step 2: Run the core test to verify RED**

Run:

```bash
bun --cwd packages/core run test:run -- src/complete-next-move.test.ts
```

Expected: FAIL because the focused operation currently drops the expected Next Move and revision.

- [ ] **Step 3: Extend only the focused store input and verify core GREEN**

Add the optional field to both inputs forwarded by `completeNextMove`; do not change `decideNextMoveCompletion` or the existing Convex store implementation.

Run:

```bash
bun --cwd packages/core run test:run -- src/complete-next-move.test.ts
bun --cwd apps/web run test:run -- convex/upNext.test.ts convex/authorization.test.ts
```

Expected: core and existing Convex completion behavior pass unchanged.

- [ ] **Step 4: Write failing completion and no-op HTTP tests**

Through the authenticated public route, cover:

- clearing the final Next Move;
- promoting the first of several Up Next moves;
- storing the remaining Up Next array or SQL `NULL` when empty;
- writing exactly one `next_action_change` Activity Log Entry with the core-generated content;
- stamping `last_activity_at` and `last_activity_content` with the same values;
- incrementing `revision` once;
- preserving all values and writing no log when both stored and expected Next Move are absent;
- returning the same 404 for missing and foreign-owned Threads;
- returning 409 conflict when the stored Next Move or revision differs from the expected values;
- rejecting a missing, non-integer, negative, or unsafe expected revision.

- [ ] **Step 5: Run focused completion tests to verify RED**

Run:

```bash
bun --cwd apps/api run test:run -- test/complete-next-move.integration.test.ts -t "completion outcome"
```

Expected: FAIL because the route and atomic D1 operation do not exist.

- [ ] **Step 6: Implement the revision-checked two-statement batch**

Inject `now`, `newActivityLogId`, and `newOperationToken` into the store; production defaults are `Date.now` and `crypto.randomUUID`.

After the owned read, compare stored and expected Next Move and revision before calling the core decision. Bind the update revision predicate to the client-supplied expected revision, not the revision freshly read from storage. Use these prepared statements in one `env.DB.batch()` call:

```sql
UPDATE threads
SET next_move = ?,
    up_next_json = ?,
    last_activity_at = ?,
    last_activity_content = ?,
    revision = revision + 1,
    last_completion_token = ?
WHERE id = ?
  AND user_id = ?
  AND revision = ?
  AND next_move IS ?;
```

```sql
INSERT INTO activity_log_entries (
  id, user_id, thread_id, type, content,
  previous_value, new_value, created_at
)
SELECT ?, user_id, id, ?, ?, ?, ?, ?
FROM threads
WHERE id = ?
  AND user_id = ?
  AND last_completion_token = ?;
```

Require update and insert `meta.changes` to both equal one. Zero updated rows is `conflict`; a thrown batch or any other successful count is `unexpected`.

- [ ] **Step 7: Write the failing forced-rollback test**

Seed a pre-existing Activity Log Entry with the deterministic ID returned by `newActivityLogId`. Capture the entire Thread row and count its logs, invoke completion, and assert the public response is an unexpected failure and the post-request values equal the original for:

```ts
[
  "next_move",
  "up_next_json",
  "last_activity_at",
  "last_activity_content",
  "revision",
  "last_completion_token",
]
```

Also assert that no additional Activity Log Entry exists. This must fail naturally on D1's primary-key constraint; do not add a failure flag or test route.

- [ ] **Step 8: Run the rollback test and verify GREEN only after real D1 rollback**

Run:

```bash
bun --cwd apps/api run test:run -- test/complete-next-move.integration.test.ts -t "rolls back"
```

Expected before implementation completion: FAIL with changed Thread state or missing route. Expected after the batch is correct: PASS with every captured field unchanged.

- [ ] **Step 9: Write and pass the competing-request test**

Send two authenticated `Promise.all` POST requests with the same Thread ID, `expectedNextMove: "Call clinic"`, and `expectedRevision: 0`; seed Up Next as `["Call clinic", "Collect results"]`. Assert literal sorted statuses `[200, 409]`, response outcomes `completed` and `conflict`, revision `1`, Next Move still `"Call clinic"`, remaining Up Next `["Collect results"]`, and exactly one new Activity Log Entry.

Run:

```bash
bun --cwd apps/api run test:run -- test/complete-next-move.integration.test.ts -t "competing"
```

Expected: PASS without an in-process lock, retry, delay, or mocked database.

- [ ] **Step 10: Run the full completion slice and commit**

Run:

```bash
bun --cwd apps/api run test:run -- test/complete-next-move.integration.test.ts
bun --cwd packages/core run test:run
bun --cwd apps/web run test:run -- convex/upNext.test.ts convex/authorization.test.ts
```

Then commit:

```bash
git add packages/core apps/api/src apps/api/test/complete-next-move.integration.test.ts
git commit -m "feat(api): complete Next Moves atomically in D1"
```

---

### Task 5: Add the browser-owned HTTP and cloud-auth factories

**Files:**

- Create: `apps/web/src/application/http/http-application-client.ts`
- Create: `apps/web/src/application/http/http-application-client.test.ts`
- Create: `apps/web/src/application/http/browser-auth-client.ts`
- Create: `apps/web/src/application/http/browser-auth-client.test.ts`
- Create: `apps/api/test/http-client.integration.test.ts`

**Interfaces:**

- Produces: `createHttpApplicationClient({ apiBaseUrl, fetchImpl? }): ApplicationClient`.
- Produces: `createBrowserAuthClient(apiBaseUrl)` using plain Better Auth without Convex plugins.
- Consumes: Task 1's async contract and Tasks 2–4's stable HTTP routes.
- Preserves: the current Convex auth client and `main.tsx` composition.

- [ ] **Step 1: Write failing HTTP adapter tests**

With an injected fake fetch, test exact URL encoding, query parameters, request bodies, `credentials: "include"`, valid response decoding, and stable status mapping:

```ts
expect(requests).toContainEqual([
  "https://api.test/v1/threads/thread%2Fwith%2Fslashes/complete-next-move",
  expect.objectContaining({
    method: "POST",
    credentials: "include",
    body: JSON.stringify({ expectedNextMove: null, expectedRevision: 0 }),
  }),
]);
```

Cover 400→validation, 401→unauthorized, 404→not_found, 409→conflict, 502/503/504 and rejected fetch→retryable unavailable, and malformed success/error JSON→unexpected. Decode successful Thread, Area, Activity Log, and completion values without unchecked `as` casts.

- [ ] **Step 2: Run HTTP tests to verify RED**

Run:

```bash
bun --cwd apps/web run test:run -- src/application/http/http-application-client.test.ts
```

Expected: FAIL because the HTTP adapter module does not exist.

- [ ] **Step 3: Implement the validating HTTP adapter**

Normalize the API base URL once, encode every path segment, use `URLSearchParams` for `limit` and cursor, and centralize JSON/error decoding. Return `OperationResult` for expected failures rather than throwing. Do not import Convex, Hono route types, database row types, or Better Auth server types.

- [ ] **Step 4: Write and implement the plain Better Auth browser factory**

Test and implement:

```ts
export function createBrowserAuthClient(apiBaseUrl: string) {
  return createAuthClient({ baseURL: apiBaseUrl });
}
```

Do not import `convexClient`, `crossDomainClient`, or the existing `apps/web/src/lib/auth-client.ts`; do not wire this factory into `main.tsx`.

- [ ] **Step 5: Exercise the actual HTTP client against the real Worker**

In the Worker-runtime test, inject a fetch function that delegates to `exports.default.fetch`, attach the Better Auth session cookie, and use the real HTTP client to read detail, page Activity Log entries, complete a Next Move, and observe not-found and conflict errors. This test may import the host-owned factory by explicit relative path, but production `apps/api` code must not depend on `apps/web`.

Run:

```bash
bun --cwd apps/api run test:run -- test/http-client.integration.test.ts
bun --cwd apps/web run test:run -- src/application/http/http-application-client.test.ts src/application/http/browser-auth-client.test.ts
```

Expected: the same client implementation passes both isolated decoder tests and the real Worker/D1 path.

- [ ] **Step 6: Commit the browser host factories**

```bash
git add apps/web/src/application/http apps/api/test/http-client.integration.test.ts
git commit -m "feat(web): add Cloudflare application client factories"
```

---

### Task 6: Build the shared TanStack Query Thread boundary

**Files:**

- Create: `packages/application/package.json`
- Create: `packages/application/tsconfig.json`
- Create: `packages/application/tsconfig.build.json`
- Create: `packages/application/vitest.config.ts`
- Create: `packages/application/src/index.ts`
- Create: `packages/application/src/application-client-provider.tsx`
- Create: `packages/application/src/application-client-provider.test.tsx`
- Create: `packages/application/src/test/setup.ts`
- Create: `packages/application/src/test/fake-application-client.ts`
- Create: `packages/application/src/thread/query-keys.ts`
- Create: `packages/application/src/thread/query-keys.test.ts`
- Create: `packages/application/src/thread/use-thread-detail.ts`
- Create: `packages/application/src/thread/use-thread-detail.test.tsx`
- Create: `packages/application/src/thread/use-thread-activity.ts`
- Create: `packages/application/src/thread/use-thread-activity.test.tsx`
- Create: `packages/application/src/thread/use-complete-next-move.ts`
- Create: `packages/application/src/thread/use-complete-next-move.test.tsx`
- Modify: `bun.lock`

**Interfaces:**

- Produces: `ApplicationClientProvider` and `useApplicationClient` for an already-authenticated async client.
- Produces: `threadQueryKeys`, `useThreadDetail`, `useThreadActivity`, and `useCompleteNextMove`.
- Consumes: the Task 1 contract and existing `decideNextMoveCompletion`.
- Owns: TanStack Query cache, stale refresh, infinite-page accumulation, optimistic Thread state, rollback, reconciliation, and invalidation.

- [ ] **Step 1: Add configuration-only package scaffolding**

Create `@vita-os/application` with runtime dependencies `@tanstack/react-query: "5.90.19"`, `@vita-os/contracts`, `@vita-os/core`, and React. Add the same Testing Library, JSDOM, TypeScript, and Vitest development dependencies already used by `apps/web`. Configure JSDOM tests and React JSX; exclude test files from declaration builds.

Run `bun install` from the repository root.

- [ ] **Step 2: Write the failing provider, key, and detail tests**

Test that the provider supplies the exact injected client, throws `ApplicationClientProvider is missing.` without a provider, isolates an injected `QueryClient`, and uses these keys:

```ts
export const threadQueryKeys = {
  all: ["thread"] as const,
  detail: (slug: string) => ["thread", "detail", slug] as const,
  activity: (threadId: ThreadId) =>
    ["thread", "activity", threadId] as const,
  activityPage: (threadId: ThreadId, limit: number) =>
    ["thread", "activity", threadId, limit] as const,
};
```

Use a deferred fake client to prove loading then ready detail, typed not-found and unavailable errors, and cached `ThreadDetail` under the exact key.

- [ ] **Step 3: Run the first shared React tests to verify RED**

Run:

```bash
bun --cwd packages/application run test:run -- src/application-client-provider.test.tsx src/thread/query-keys.test.ts src/thread/use-thread-detail.test.tsx
```

Expected: FAIL because the package and hooks do not exist.

- [ ] **Step 4: Implement the provider, keys, and detail hook**

Create one `QueryClient` per provider when none is injected. Leave stale time at its normal stale-by-default behavior, retain refetch on mount/focus/reconnect, configure no interval, and set mutation retry false. `useThreadDetail` unwraps successful `OperationResult` and throws the unchanged `ApplicationError` on failure.

- [ ] **Step 5: Write the failing infinite Activity Log tests**

Assert that the first call omits the cursor, page one exposes its entries and next cursor, `fetchNextPage` sends that exact opaque cursor, pages flatten in response order, different limits use different cache keys, and exhaustion makes `hasNextPage` false.

- [ ] **Step 6: Run Activity Log tests to verify RED, then implement and verify GREEN**

Run before implementation:

```bash
bun --cwd packages/application run test:run -- src/thread/use-thread-activity.test.tsx
```

Implement `useInfiniteQuery` with `initialPageParam: undefined` and `getNextPageParam: (page) => page.nextCursor`, then rerun the same command and expect PASS.

- [ ] **Step 7: Write the failing optimistic completion tests**

Seed a real `QueryClient` with Thread detail and at least two accumulated Activity Log pages. With a deferred fake mutation, assert:

- pending completion immediately promotes the front Up Next move in detail;
- the Activity Log cache is byte-for-byte unchanged while pending;
- success invalidates and refetches authoritative detail and Activity Log data;
- unavailable failure restores the exact pre-mutation detail and all pages before reconciliation;
- conflict follows the same restore-then-refetch path and exposes the typed conflict error;
- mutation retry remains disabled.

The hook signature is:

```ts
useCompleteNextMove({
  threadId,
  slug,
}): UseMutationResult<
  CompleteNextMoveOutput,
  ApplicationError,
  { expectedNextMove: string | null; expectedRevision: number }
>
```

- [ ] **Step 8: Run completion tests to verify RED, then implement and verify GREEN**

Run before implementation:

```bash
bun --cwd packages/application run test:run -- src/thread/use-complete-next-move.test.tsx
```

In `onMutate`, cancel the exact detail key and the Activity Log prefix, snapshot both, and apply `decideNextMoveCompletion` only when cached Next Move and revision match the supplied expected values. In `onError`, restore every snapshot. In `onSettled`, invalidate detail and Activity Log queries. Never synthesize an Activity Log ID or timestamp.

Rerun:

```bash
bun --cwd packages/application run test:run
bun --cwd packages/application run typecheck
```

Expected: all shared React tests pass against real TanStack Query behavior without mocking its internals.

- [ ] **Step 9: Commit the shared application boundary**

```bash
git add packages/application bun.lock
git commit -m "feat(application): add TanStack Query Thread boundary"
```

---

### Task 7: Record the D1 decision and run the complete verification gate

**Files:**

- Create on D1 pass: `docs/adr/0019-d1-cloud-storage.md`
- Modify if evidence requires clarification: `docs/superpowers/specs/2026-09-19-cloudflare-target-architecture-proof-design.md`

**Interfaces:**

- Consumes: all focused test evidence from Tasks 1–6.
- Produces: an accepted D1 ADR only if every issue 348 invariant passes.
- Produces on failure instead: a precise issue 348 failure report and no D1 ADR; issue 349 remains blocked.

- [ ] **Step 1: Run the focused go/no-go proof from clean package entry points**

Run:

```bash
bun --cwd apps/api run test:run
bun --cwd packages/contracts run test:run
bun --cwd packages/core run test:run
bun --cwd packages/application run test:run
bun --cwd apps/web run test:run -- src/application/convex/convex-application-client.test.ts src/application/http/http-application-client.test.ts src/application/http/browser-auth-client.test.ts convex/upNext.test.ts convex/authorization.test.ts
```

Expected: zero failures. Specifically confirm the output includes the named forced-rollback and competing-request tests; do not infer them from a package exit code alone.

- [ ] **Step 2: Write the ADR only if D1 passes**

Create ADR 0019 with status `Accepted` and these decisions stated concretely:

- D1 is accepted for the migration proof behind an operation-shaped store.
- Completion uses an owned read, the shared core decision, and a client-revision/expected-move compare-and-swap plus conditional log insert in one D1 batch.
- The rollback test forced a real Activity Log primary-key failure and observed no Thread, Up Next, metadata, revision, token, or log change.
- The concurrency test sent two competing public HTTP requests with the same expected revision and observed one completion, one conflict, one promotion, and one Activity Log Entry even when the promoted move repeated the same text.
- D1 still has no interactive transactions; future multi-record operations require their own operation-specific proof or the Postgres fallback.

If either proof fails, do not create the ADR. Record the exact command, failing assertion, and violated invariant on issue 348, then stop implementation before issue 349.

- [ ] **Step 3: Run the repository-required verification**

Run from the repository root in this order:

```bash
bun run lint
bun run build
bun run test:run
```

Expected: all commands exit zero with no warnings or failed tests. Because `bun run lint` writes formatting and import ordering, inspect `git diff --stat` afterward and rerun any focused test whose source changed materially.

- [ ] **Step 4: Check every issue 348 acceptance criterion against evidence**

Use the issue body as a checklist. For each item, point to a committed file and a passing test or build result. Confirm especially that `apps/web/src/main.tsx`, `apps/web/src/lib/auth-client.ts`, and `apps/web/convex/` have no behavioral change and that no backend-selection flag exists.

- [ ] **Step 5: Commit the evidence record**

```bash
git add docs/adr/0019-d1-cloud-storage.md
git commit -m "docs(architecture): accept D1 for cloud storage"
```

Do not run this commit step when D1 fails; preserve the tested code and report the blocker instead.
