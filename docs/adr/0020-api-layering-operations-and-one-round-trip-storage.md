# API layering: operations and one-round-trip storage

**Status:** Accepted. Amended by [ADR 0035](./0035-hono-valibot-result-api.md) for the API runtime, layers, and operation execution.
Amended by [ADR 0036](./0036-drizzle-d1-storage.md) for typed D1 queries and schema generation; the storage safety rules remain.
**Date:** 2026-09-26

The Effect descriptions below record the earlier runtime decision. ADR 0035 replaces those runtime details while retaining the feature layering, one-round-trip storage, guarded operations, ownership, and atomic batches.

Issue #367 reorganizes `apps/api` around features instead of technologies. The Cloudflare migration (#349) proved D1's safety guarantees but left each operation written out four times — `ApplicationClient`, a `VitaStore` interface, a Hono route, the web HTTP client — and let "stores" absorb input checks, core decisions, retry loops, and SQL at once. Failures reached the response by four routes.

## Decision

`packages/core` is the domain. Each feature under `apps/api/src/features/<feature>/` has operations, which are its use cases, and storage, which is its adapter to D1. HTTP is the adapter that calls operations. Code shared by every feature lives under `apps/api/src/platform/`.

**A storage function makes exactly one D1 round trip: one statement or one `db.batch`.** It is built from the request scope (`threadStorage(scope)`), so the owner is never passed by a caller, and every statement still names `user_id`. It returns domain values or `null` and never decides an error. Atomic multi-record writes stay inside a single batch — a Thread change and the Activity Log it earns, a Thread Note and its Thread's activity stamp, a Thread and everything that belongs to it.

**Anything that needs more than one round trip is an operation**, a function returning `Effect<Value, OperationFailure, RequestContext>`. The authenticated request supplies `RequestContext`; creating an operation does not run it. Native D1 promises and throwing domain rules enter Effect through shared typed boundaries. ADR 0019 records that D1 has no interactive transactions, so a read followed by a write is not safe by default. The rule makes every such sequence visible: it can only be written in an operation, and the operation's later writes must be guarded by a condition on what it read. A Thread change is conditional on its revision, Move completion on the expected move and revision, an Area rename on the name it was decided against, and a Thread create or move on the destination Area still existing. Operations also hold core decisions, slug and revision retries, and each specific failure.

**Failures take one path.** Core keeps throwing `ValidationError` and `ConflictError`. Operations fail with tagged failures from `platform/failures.ts` — `NotFound`, `InvalidInput`, `RefusedByState`, `ChangeConflict`, and `Unexpected`, which keeps its cause — and know nothing of HTTP. `attempt` turns a throwing core rule into `InvalidInput` or `RefusedByState`; `database` classifies a rejected D1 call where it is made, so a slug collision arrives as `SlugTaken`, which the retry loop catches by tag and which never leaves the operation. Only the HTTP boundary maps failures to the public envelope and status: HttpApi error schemas encode them, and shared middleware translates decoding errors and sanitizes unexpected defects into `RequestRefusal`, which exists only there. The two transport refusals — a forbidden origin (403) and a non-JSON write (415) — carry their status explicitly. The browser still receives the existing JSON contract and converts it to `OperationResult`.

The Effect web handler and its layers are built once per isolate. Worker bindings, including the CORS origin, enter the handler's context on each request. Authentication supplies a fresh request context before payload decoding and operations. Better Auth receives the original web Request and its Response preserves cookies. Tests replace how a request scope is built (`createApp({ createScope })`) to check that nothing is constructed before authentication and to inject a clock.

This Effect v4 migration amends the original Promise/Hono decision. It keeps the one-round-trip storage rule, native D1 batch metadata, and framework-free domain rules. Effect's SQL adapter and generated frontend client are deferred because neither is required to replace the API runtime.

## No repository interfaces

There is deliberately no storage interface between operations and storage:

- There is one storage engine, and the integration tests run against real D1, so an interface would have one implementation and no test double.
- D1 has no interactive transactions, so an interface that stayed correct would have to expose atomic, operation-shaped writes rather than generic reads and writes. It would repeat the operations it serves — which is what `VitaStore` had become.

Add an interface when a second storage target exists — for example a local database behind a desktop host. Design it then from the operations both targets must support, not from the tables.

## Consequences

- Each operation lives in one place in the API. Feature `api.ts` modules declare endpoint schemas and `routes.ts` modules supply HttpApiBuilder handlers.
- Reviewing storage safety is local: a storage function cannot hide a read-then-write, and an operation's writes can be checked for their guards.
- Features read each other's storage where a workflow crosses records — a Thread move reads Areas, and Thread Notes and the Activity Log check the Thread they belong to. No file mixes features.
