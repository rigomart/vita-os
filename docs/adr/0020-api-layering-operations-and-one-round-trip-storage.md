# API layering: operations and one-round-trip storage

**Status:** Accepted  
**Date:** 2026-09-26

Issue #367 reorganizes `apps/api` around features instead of technologies. The Cloudflare migration (#349) proved D1's safety guarantees but left each operation written out four times — `ApplicationClient`, a `VitaStore` interface, a Hono route, the web HTTP client — and let "stores" absorb input checks, core decisions, retry loops, and SQL at once. Failures reached the response by four routes.

## Decision

`packages/core` is the domain. Each feature under `apps/api/src/features/<feature>/` has operations, which are its use cases, and storage, which is its adapter to D1. HTTP is the adapter that calls operations. Code shared by every feature lives under `apps/api/src/platform/`.

**A storage function makes exactly one D1 round trip: one statement or one `db.batch`.** It is built from the request scope (`threadStorage(scope)`), so the owner is never passed by a caller, and every statement still names `user_id`. It returns domain values or `null` and never decides an error. Atomic multi-record writes stay inside a single batch — a Thread change and the Activity Log it earns, a Thread Note and its Thread's activity stamp, a Thread and everything that belongs to it.

**Anything that needs more than one round trip is an operation**, a plain function `(scope, input) => Promise<OperationResult<T>>`. ADR 0019 records that D1 has no interactive transactions, so a read followed by a write is not safe by default. The rule makes every such sequence visible: it can only be written in an operation, and the operation's later writes must be guarded by a condition on what it read. A Thread change is conditional on its revision, Next Move completion on the expected move and revision, an Area rename on the name it was decided against, and a Thread create or move on the destination Area still existing. Operations also hold core decisions, slug and revision retries, and each specific `ApplicationError`.

**Failures take one path.** Core keeps throwing `ValidationError` and `ConflictError`. Those, a failed operation result, an unreadable request, an edited page cursor, and anything unexpected all reach one Hono error handler. It returns the error body, and the status comes from `error.code` through one table. The two transport refusals whose status predates that table — a forbidden origin (403) and a non-JSON write (415) — carry their status explicitly.

The Hono app is built once per isolate. Bindings, the CORS origin included, are read from `context.env` on each request. Tests replace how a request scope is built (`createApp({ createScope })`) to check that nothing is constructed before authentication and to inject a clock.

## No repository interfaces

There is deliberately no storage interface between operations and storage:

- There is one storage engine, and the integration tests run against real D1, so an interface would have one implementation and no test double.
- D1 has no interactive transactions, so an interface that stayed correct would have to expose atomic, operation-shaped writes rather than generic reads and writes. It would repeat the operations it serves — which is what `VitaStore` had become.

Add an interface when a second storage target exists — for example a local database behind a desktop host. Design it then from the operations both targets must support, not from the tables.

## Consequences

- Each operation lives in one place in the API. Routes are one-line calls into operations until #368 replaces them with a single endpoint table.
- Reviewing storage safety is local: a storage function cannot hide a read-then-write, and an operation's writes can be checked for their guards.
- Features read each other's storage where a workflow crosses records — a Thread move reads Areas, and Thread Notes and the Activity Log check the Thread they belong to. No file mixes features.
