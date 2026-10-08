# Hono, Valibot, and Result operations in the API

**Status:** Accepted. Amends the Effect runtime, layers, and lazy-operation decisions in [ADR 0020](./0020-api-layering-operations-and-one-round-trip-storage.md).
**Date:** 2026-10-07

Issue [#423](https://github.com/rigomart/vita-os/issues/423) replaces the API's Effect runtime with Hono routing, Valibot request schemas, and better-result operations. During the fast-iteration phase, explicit request scopes and ordinary asynchronous functions make this small API easier to change and delete. The application contract, authenticated ownership, domain rules, and stored-data guarantees remain.

## Decision

Build one strict Hono app per Worker isolate. The `/v1` mount applies CORS and mutation guards, resolves the Better Auth session, and creates one `RequestScope` containing the database, clock, and authenticated actor. Each feature's routes receive that scope and call its operations. Bindings belong to the request; nothing captures an owner or database globally. The separate `/api/auth` mount passes the original Request to Better Auth and preserves native Response cookies. The deployment version header remains on every response.

Valibot validates JSON input through Hono's Standard Schema validator. JSON objects reject excess properties; query and path objects keep their existing permissive behavior. Missing optional keys remain omitted. Malformed JSON and unreadable bodies use the endpoint's existing public validation message. The browser contract remains plain TypeScript values and the same JSON error envelope.

An operation takes its authenticated scope explicitly and returns `Promise<Result<Value, OperationFailure>>`. Calling it starts execution immediately; it is no longer a lazy value that can be created now and supplied with another scope later. `Result.gen` sequences existing decisions and database calls. Shared `attempt` and `database` functions classify errors at their actual call sites. Feature operations continue owning their existing slug and conditional-write retries; this change adds no retry, recovery, or concurrency layer.

Only failures need HTTP translation. Core validation and state refusals keep their public messages and 400/409 status. Missing records and another owner's records both remain 404. Unexpected failures return the sanitized 500 envelope; their causes remain private.

Successful typed values are serialized directly with `Response.json`, without a second schema validation or response projection. Existing explicit row converters and owner-scoped reads remain. If an implementation produces a malformed but JSON-serializable success, the API may send it with 200; the existing browser decoder rejects it visibly. Type checking and focused contract tests cover ordinary output shapes. We accept this narrower server boundary instead of replacing Effect's response encoding with another projection framework.

A dependency defect that escapes the explicit classification boundaries is now a private 500. In particular, an artificial database getter throwing a core `ValidationError` or `ConflictError` previously acquired a 400/409 through Effect's defect classification; it now receives the sanitized unexpected response. Genuine core refusals evaluated through `attempt` retain 400/409. No cause traversal is added to recover the old defect behavior.

## Retained rules

- A storage function makes exactly one D1 round trip: one statement or one batch. It is built from the authenticated scope and every statement remains scoped by `user_id`.
- Operations contain multi-round-trip workflows and their later writes remain guarded by the state they read.
- Thread changes and their Activity Log entries, completion with an optional Thread Note, conversion, and related deletions retain their existing atomic D1 batches.
- Framework-free core rules, occurrence checks, internal Thread revisions, and the existing three-attempt policy remain as defined by [ADR 0034](./0034-plain-application-writes.md).
- Better Auth configuration, database schema, migrations, storage functions, and browser decoding are unchanged. There is still no repository interface.

## Routing and tests

Hono now owns application path matching and middleware selection; the separate guard decoder is gone. The complete pre-trim real Worker path suite passed on the selected Hono version. No routing compromise was observed or adopted.

Keep focused regressions for encoded Note and Thread/Task ownership, refused writes preserving stored state, double-encoded ID isolation, a malformed escape after an encoded application prefix, and credentialed CORS on an encoded auth prefix. Better Auth still receives the original Request: an encoded auth base path receives CORS but is not accepted as its literal base path. Ordinary auth and version tests continue proving session cookies. Existing HTTP compatibility, authentication, ownership, atomic-write, and feature workflow tests remain. Runtime URL normalization tables and spelling/owner/method combinations no longer test two competing decoders and are removed.

## Consequences

The API has fewer framework abstractions and no Effect dependency. Routes and operations can be read directly, and each dependency is visible in the supplied scope. Immediate execution, direct typed success serialization, and sanitized escaped defects are deliberate differences from the previous runtime. The storage and ownership guarantees are unchanged; no new migration or browser compatibility alias is needed.

The pinned API libraries are Hono 4.13.13, `@hono/standard-validator` 0.4.0, Valibot 1.5.0, and better-result 3.0.1.
