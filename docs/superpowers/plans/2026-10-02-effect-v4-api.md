# Effect v4 API migration

**Goal:** Replace Hono and Promise-based API operations with Effect v4 while preserving the browser's API contract.

**Architecture:** Effect HttpApi schemas describe the existing endpoints. HttpApiBuilder handlers call Effect operations, which obtain an authenticated RequestContext service and use native D1 storage through typed Effect boundaries. Better Auth receives the original web Request. One web handler serves the Cloudflare Worker with request-local bindings.

**Tech stack:** Bun, Effect 4, Cloudflare Workers/D1, Better Auth, existing Vitest integration tests and isolated browser verification.

**Spec:** The user approved a full Effect API replacing Hono, retaining native D1, Better Auth, and the handwritten frontend client. Implement one coherent migration without staged releases or a generic repository framework.

## Constraints and shared interfaces

- Keep SQL, migrations, native D1 batch metadata and rollback behavior intact.
- Preserve ownership, error envelopes/messages/statuses, aliases, strict body validation, CORS, request ordering, revision checks, retry limits, and missing-versus-null behavior.
- Leave shared contracts and framework-free domain rules unchanged.
- `RequestScope` stays the storage input; `RequestContext` is its Effect service.
- Operations return lazy `Effect<Value, RequestRefusal, RequestContext>`, without an explicit scope argument.
- Shared `attempt` catches domain exceptions; `database` catches rejected native D1 operations. `RequestRefusal` preserves the original cause so collision retries can remain selective.
- Each feature exports its HttpApi group from `api.ts` and its handler layer from `routes.ts`. Shared `platform/http/api.ts` combines groups. Authentication declarations live in `platform/auth/authenticated-scope.ts`.
- Root owns dependency changes, tests, documentation, integration, and final checks. Agents must not edit each other's files or run auto-fixing root commands concurrently.

## Tasks

- [x] Verify setup before implementation: dependencies, env files, local migrations and seed, fresh API tests, browser sign-in and persisted Note.
- [x] Agent 1: shared services/error/schema helpers, authentication and HTTP middleware, API composition, Worker adapter.
- [x] Agent 2: Notes and Areas schemas, Effect operations, HttpApi handlers.
- [x] Agent 3: Threads/Moves, Thread Notes and Activity Log schemas, Effect operations, handlers.
- [x] Root: adapt direct operation/app tests, add focused request-isolation/laziness coverage, update architecture documentation.
- [x] Review: inspect migration for contract regressions and incorrect v4 APIs; address findings.
- [x] Verify: lint, build, tests, then real isolated app workflows with server confirmation, reload, and D1 evidence.

## Review focus

Request-local services must not capture bindings or actors across requests. CORS wraps all response paths, preflight precedes authentication, and auth precedes decoding. Only slug collisions retry. D1 batch rollback, conditional revisions, ordering and response validation remain covered by the real Worker tests.

## Progress

Baseline: setup succeeded; fresh API suite 150/150 and Python migration suite 11/11 passed. Isolated `effect` instance signed in and persisted a Note before code changes.

Implementation: all three bounded agent workstreams integrated. Native storage and SQL remained unchanged. Full lint/build/test commands passed, including 166 API integration tests and 11 Python migration tests. Independent review found and verified fixes for router misses, default path matching, encoded-prefix guards, long slugs, literal semicolons, and unreadable request bodies. Scoped re-review is clean.

Browser proof: Notes and Areas verified in `effect-notes`; Threads/Moves, Thread Notes, and Activity verified in `effect`. Both used real UI actions, reloads, and read-only D1. Coverage and evidence limitations are recorded in `docs/migrations/effect-v4-api.md`. Keep `effect` running for the user's immediate testing request.
