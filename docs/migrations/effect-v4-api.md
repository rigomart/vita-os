# Effect v4 API

The API now uses pinned Effect 4.0.0 in place of Hono. Better Auth, native D1 storage, shared contracts, domain rules, and the browser's HTTP client keep their existing roles. This amends [ADR 0020](../adr/0020-api-layering-operations-and-one-round-trip-storage.md).

## Request flow

`worker.ts` builds one web handler per isolate. Each `fetch` supplies its own Worker bindings. CORS and mutation guards run first; authentication supplies `RequestContext`; HttpApi decodes the endpoint's input; the handler runs its Effect operation; HttpApi validates and encodes the response.

Each feature's `api.ts` declares endpoint schemas and `routes.ts` supplies handlers. Operations return lazy `Effect<Value, RequestRefusal, RequestContext>` values. `attempt` converts throwing domain decisions, and `database` converts rejected native D1 calls, into typed failures. The original database cause remains available for selective slug retries, while HTTP responses expose only the existing public error envelope.

Storage still performs one D1 statement or batch per method. No SQL or migration changed. Conditional revisions, batch rollback, affected-row metadata, and three-attempt retry limits remain intact.

## Compatibility details

- Payload schemas reject extra keys. Query schemas retain the first repeated value and ignore unrelated keys.
- Optional fields retain the distinction between omitted and explicitly cleared values. IDs remain opaque strings; timestamps remain safe integers.
- Existing paths, creation statuses, error messages, Note date aliases, and acknowledgements remain available.
- Better Auth receives the original web Request; a native Response copy preserves cookies and permits outer CORS headers.
- Router configuration preserves case-sensitive paths, strict slashes, and unbounded Thread slugs. Middleware classifies decoded prefixes consistently with routing and preserves semicolons in opaque IDs.
- Only endpoint input failures become validation responses. Invalid responses and unexpected defects become sanitized 500 responses.

Effect 4.0.0's HttpApiBuilder types list middleware requirements as layer requirements. The composition contains one narrow type adaptation marking Worker bindings as a per-request router requirement. It supplies no global bindings. Real concurrent requests with distinct actors and origins verify that the handler does not capture request state.

Native D1 was retained because its batch results and original database errors are needed by existing atomic writes and selective retries. A generated frontend client and Effect SQL adapter can be evaluated independently later.

## Documentation and verification

The implementation was checked against official v4 documentation and the installed 4.0.0 source: [HttpApiBuilder](https://effect.website/docs/v4/api/effect/http-api/HttpApiBuilder/), [HttpRouter](https://effect.website/docs/v4/api/effect/http/HttpRouter/), [Schema](https://effect.website/docs/v4/api/effect/Schema/), and [the Effect repository](https://github.com/Effect-TS/effect).

`bun run lint`, `bun run build`, and `bun run test:run` passed. The API suite includes 166 integration tests against the real local Worker/D1 runtime, plus 11 importer migration tests. Added coverage proves lazy operations, typed domain failures, per-request actor/binding isolation, native sign-out cookies, strict and encoded routes, long slugs, semicolon IDs, repeated query keys, legacy DELETE payload handling, malformed/unreadable bodies, and HEAD fallback.

The app was set up and proved before migration: fresh baseline tests, real sign-in, and a Note confirmed after reload and in D1. Post-migration browser verification uses isolated `effect` and `effect-notes` instances with throwaway users, screenshots, reloads, and read-only D1 checks. Runtime evidence stays under `.verify/evidence/`.

| Workflow | Browser and D1 proof |
| --- | --- |
| Authentication | Real email sign-in and healthy session in both instances |
| Standalone Notes | Dated capture, body edit, date reschedule/clear, complete, history read, reopen, persisted delete |
| Areas | Two creates, rename, keyboard reorder, filter-row read, confirmed delete |
| Threads | Create, dated update, resolve, resolved-history read, reopen with cleared attention, delete with empty dependent Activity Log |
| Moves | Add, focus, edit, unfocus, remove, completion and its persisted Activity Log entry |
| Thread Notes | Create, edit, complete, completed-page read, reopen, delete after Undo expiry |

The `effect` evidence run is `2026-10-02T23-44-52-650Z`; `effect-notes` is `2026-10-02T23-57-27-394Z`. Standalone completion/reopen toast capture was inconclusive, but each state was confirmed after reload and in D1. Thread Note lifecycle toasts were captured. Undo, alternate capture entry points, Area icon changes, and phone/drawer layouts were not re-driven; existing automated coverage remains in place. API error/alias and concurrency cases are covered by the real Worker tests rather than simulated through the UI.
