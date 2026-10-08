# Hono, Valibot and better-result API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task by task with isolated agent ownership after the owner reviews it. This document is a proposal; it authorizes no implementation.

**Goal:** Remove Effect from the API and define shared data shapes once, while preserving authentication, ownership, atomic D1 writes, and the current public HTTP contract.

**Architecture:** Hono owns routing and middleware; Valibot schemas in contracts own wire shapes and inferred model types. Feature operations accept an authenticated RequestScope explicitly and return Promise<Result<Value, OperationFailure>>. Existing storage and core rules remain unchanged.

**Tech Stack:** Bun, Cloudflare Worker/D1, Better Auth 1.6.25 (unchanged), Hono 4.13.13, Valibot 1.5.0, @hono/standard-validator 0.4.0, better-result 3.0.1. Verify package releases again at implementation start and pin the chosen versions.

**Spec:** [#423](https://github.com/rigomart/vita-os/issues/423), parent [#419](https://github.com/rigomart/vita-os/issues/419), ADR 0020. Read the landed #421 API before executing; planning source was `/Users/rigos/.codex/worktrees/plain-mutations-421/vita-os` on October 7, 2026.

## Global constraints

- Start only after #421's API change lands. No public Thread revision, Task revision basis, or revision request body returns. Keep internal D1 conditional-write revisions.
- `storage.ts`, row conversions, migrations, `packages/core`, Better Auth config, and browser decode/client behavior remain unchanged. #424 owns the browser decoder. No migration is needed.
- One D1 statement or one `db.batch` per storage function; guarded read-then-write stays in operations. Retain current retry limits, slug retry classification, completion occurrence checks, and atomic Note/log/activity writes.
- Run every command from repo root with Bun. Required finish: `bun run lint`, `bun run build`, `bun run test:run`, every verify flow on the landed base and branch, and before/after line and Worker bundle measurements. Also run bun run lint:check, bun run typecheck, and bun apps/web/scripts/check-chunks.mjs apps/web/dist before shipping.
- HTTP tests stay actual Worker requests through SELF.fetch; retain Cloudflare Vitest, D1 setup, and sessions. Never substitute in-process Hono request tests for HTTP parity.
- No new client framework, operation registry, storage interface, generic route factory, result codec, or automatic retries of D1 failures.

## Review focus

1. Middleware and route path interpretation must agree, including encoded prefixes and record IDs; no spelling may bypass auth/origin/media-type guards.
2. Missing vs null fields must remain distinct; clearing a date/Area/summary must work, and omitted fields must leave stored data alone.
3. Complete/Skip must reject stale occurrences, including after conditional-write retries; a lost response must not duplicate Notes/logs or advance twice.
4. Failed D1 batches must leave Tasks, Notes, Activity Log, and activity stamps unchanged.
5. Malformed/unreadable JSON and private database/defect messages must reach the existing public error envelope without disclosure; auth precedes body parsing.

## Library check and exact interfaces

As of October 7, better-result is not archived, last pushed August 23, and latest release is v3.0.1 (August 11). It has five open issues plus three open PRs; open issues include match inference (#111), partial-match widening (#110), and unbound static `.is` (#112). This is sufficient recent activity to adopt the requested library, with moderate small-library maintenance risk. Recheck at execution; use the issue's thrown-class/onError fallback only if new evidence shows abandonment, and explain it in the PR. Sources: [release](https://github.com/dmmulroy/better-result/releases/tag/v3.0.1), [repository](https://github.com/dmmulroy/better-result), [issues](https://github.com/dmmulroy/better-result/issues).

The [pinned v3 README/source](https://github.com/dmmulroy/better-result/tree/v3.0.1) confirms:

```ts
class InvalidInput extends TaggedError("InvalidInput")<{ message: string }> {}
// v3 has no trailing () after <Props>.
type Operation<T> = Promise<Result<T, OperationFailure>>;
function createNote(scope: RequestScope, input: { body: string; followUp?: number }): Operation<Note>;
// Every existing exported operation gains scope as its first parameter.
function attempt<T>(evaluate: () => T): Result<T, InvalidInput | RefusedByState | Unexpected>;
function database<T>(evaluate: () => Promise<T>): Promise<Result<T, InvalidInput | Unexpected>>;
function database<T>(evaluate: () => Promise<T>, isSlugTaken: (cause: unknown) => boolean): Promise<Result<T, SlugTaken | InvalidInput | Unexpected>>;
```

Multi-step operations use `Result.gen(async function* () { ... })`, `yield* attempt(...)` for sync rules, `yield* Result.await(database(...))` for asynchronous calls, and `return Result.ok(value)` / `return Result.err(failure)`. Preserve sequential writes and use `Result.allAsync` only where current Effect.all already runs independent reads concurrently. SlugTaken is caught inside the existing bounded loop; do not export it as OperationFailure.

HTTP mapping stays one small file, not a framework. `publicError(failure: OperationFailure): ApplicationError` uses switch(failure._tag) and a `never` exhaustiveness check. Mapping: NotFound→404/not_found/false; InvalidInput→400/validation/false; RefusedByState→409/conflict/false; ChangeConflict→409/conflict/true; Unexpected→500/unexpected/false with `Unexpected error.`. Preserve unauthorized→401, unavailable→503, foreign-origin→403, non-JSON POST/PUT/PATCH→415. Keep `{ error: { code, message, retryable } }` envelopes and existing message strings. Do not use better-result match inference or pass ErrorClass.is unbound.

`respond<T>(result: Result<T, OperationFailure>, status: 200 | 201 = 200): Response` returns the typed success using Response.json or maps the typed failure. Do not revalidate successful output on the server. Keep one sanitized app.onError for transport refusals and escaped exceptions; delete recursive Panic inspection and direct core/cursor exception fallbacks. Real core refusals remain classified inside attempt. An escaped dependency defect becomes sanitized 500. Never serialize private causes.

## Task 1: Shared Valibot shapes without browser changes

**Files:** create `packages/contracts/src/schemas.ts` and `packages/contracts/src/requests.ts`; modify `models.ts`, `errors.ts`, `index.ts`, `package.json`; add `packages/contracts/src/schemas.test.ts`; update `bun.lock` only when execution starts.

**Interfaces:** export schemas named `AreaSummarySchema`, `AreaIconSchema`, `ThreadSchema`, `TaskSchema`, `RepeatSchema`, `ThreadDetailSchema`, `NoteSchema`, `ThreadNoteSchema`, `NoteAddedToThreadSchema`, `ActivityLogEntrySchema`, `ActivityLogPageSchema`, `NotePageSchema`, `ThreadNotePageSchema`, `CommandAckSchema`, `ApplicationErrorSchema`, and existing named request bodies currently in feature requests.ts. `models.ts` becomes type aliases from v.InferOutput; preserve `Page<TEntry>` as the small generic shape. Preserve ID brands in `ids.ts`; each ID schema uses v.custom<ExistingId> with the existing nonempty-string check, avoiding changed brands across core/application.

- [ ] Red: add schema tests: a legacy opaque ID such as `opaque;note` parses; absent optional keys stay absent; null is rejected on stored optional values; unknown response fields are stripped; stored legacy dates parse; invalid icon/state/shape fails. Tests initially fail because exports do not exist.
- [ ] Add Valibot to contracts and declare the same pinned version in API where domain refinements use it; use v.object for responses, v.strictObject for JSON request bodies, v.optional without defaults for absence, and v.nullable only for clearable inputs. Infer model types and ApplicationError/CommandAcknowledgement from these schemas; retain the existing public OperationResult envelope.
- [ ] Move request *shapes* into contracts: Thread/Task, Area, Note, Thread Note, add-to-thread, and PageQuery. Keep schema shapes independent of core (core already imports contracts). Request shape timestamp is integer; Complete/Skip expectedOccurrence additionally uses Number.isSafeInteger, nullable only for Complete. New-write Task dates remain bounded 0..253402300799999 through the API's existing core-backed refinement; legacy stored Task dates/expectedOccurrence are not restricted to that new-write range.
- [ ] Keep API request files only where domain refinement/normalization is needed: `threads/requests.ts` retains requireRepeat, requireTimeZone, completion Note ID checking, normalizeThreadChange, normalizeSetTaskRepeat; `areas/requests.ts` retains normalizeAreaChange. Compose these checks over imported shared shapes with v.pipe/v.check. Never import core into contracts or copy its algorithms. Shared RepeatSchema owns the union shape; core continues deciding valid/canonical repeat values.
- [ ] Green: `bunx turbo run test:run --filter=@vita-os/contracts` and `bunx turbo run build --filter=@vita-os/contracts`; existing contracts fixture/client conformance test must still compile. Browser decode.ts stays unchanged.

## Task 2: Runtime port (operations and HTTP are one reviewable change)

The two sections below form one task/commit because the old Effect router cannot execute Promise<Result> operations. The red/green gate is the complete API HTTP suite after both sections migrate.

### 2a: Explicit request scope and Result operations

**Files:** modify `platform/request-scope.ts`, `platform/operation.ts`, `platform/failures.ts`, and operations.ts in exactly `areas`, `threads`, `notes`, `thread-notes`, `activity-log`, `add-to-thread`; update `apps/api/test/operations.integration.test.ts` to call the new signature; preserve each feature errors.ts unless TaggedError construction requires adjustment.

**Interfaces:** RequestScope/Clock/CreateScope unchanged; remove only Effect RequestContext. All exported operations keep current input/output types plus first argument RequestScope. Helpers attempt/database have the signatures above. Existing found/changeThread/changeTasks helpers become Result-based and receive scope explicitly.

- [ ] Red: adapt the direct operation test harness to `await operation(scope, input)` and Result.isOk/Result.isError; run API tests to see the missing/new signature failure. Preserve current-state edit race, Complete-vs-Skip race, retry after a lost completion response, and failed Note insertion rollback assertions.
- [ ] Replace Data.TaggedError and Effect boundaries using v3 syntax. Preserve messages, private causes, 3-attempt conditional-write loops and existing slug loops exactly. Every generator finishes with a Result; TaggedError itself is not yielded as an Err.
- [ ] Replace Effect-specific laziness test with explicit-scope isolation: two calls through one operation implementation store under their own actorId and clock. Name the deliberate compromise in the PR: operations now start when called, and cannot be constructed once then executed with a different owner; authenticated routes still create scopes before invocation. Keep domain-refusal-no-write assertions.
- [ ] Keep direct operation tests as the safety checks while porting; run the full green gate in 2b. No SQL/storage/core changes to make this port pass.

### 2b: Hono HTTP boundary and feature routes

**Files:** modify `apps/api/src/app.ts`, `worker.ts`, `platform/auth/authenticated-scope.ts`, `platform/http/guards.ts`, `platform/http/errors.ts`, `platform/http/schemas.ts` (retain only pageRequest or move to decode.ts), `platform/http/decode.ts`, feature routes.ts in the same six features, `apps/api/package.json`, `apps/api/test/app.ts`; delete `platform/http/api.ts`, `platform/http/context.ts`, all six feature `api.ts`, and request files with no remaining domain normalization.

**Interfaces:** `ApiEnv = { Bindings: WorkerEnv; Variables: { scope: RequestScope; validationMessage?: string } }` in `platform/env.ts`; `createApp({createScope?}: AppDependencies = {}): Hono<ApiEnv>`; no dispose method. Feature routers `areasRoutes`, `threadsRoutes`, `notesRoutes`, `threadNotesRoutes`, `activityLogRoutes`, `addToThreadRoutes` are Hono<ApiEnv> mounted under `/v1`. Each directly calls its operation with `c.get("scope")` and passes its typed Result to respond. Keep static routes before parameter routes, every current method/path, create statuses 201, and count wire shape `{count}`.

- [ ] Red: run existing auth, request-context, HTTP compatibility, task contract, retired API name, ownership and feature HTTP tests unchanged after switching app assembly; resolve actual failures from the port. Retain SELF.fetch. `test/app.ts` drops only obsolete app.dispose; direct operations tests are the sole necessary framework-shape adaptation.
- [ ] Build one `new Hono<ApiEnv>({ strict: true })` per isolate. Use default Hono path handling, not a custom getPath or local decoder. Use one mounted `/v1` router with `use("*", ...)` for CORS/guards/auth, and one mounted `/api/auth` router for CORS/Better Auth. Prove exact prefixes and descendants are covered in HTTP tests; avoid separately registering exact+wildcard handlers that might both match and construct the scope twice. CORS runs outermost, with current request env.BROWSER_ORIGIN normalized through new URL(...).origin, credentials true, and current preflight behavior. Guards run before auth: foreign mutation Origin 403, POST/PUT/PATCH media type must normalize to exactly application/json 415. OPTIONS needs no auth/scope.
- [ ] Auth middleware calls existing createAuth(c.env), getSession using original request headers, refuses absent session, then invokes injected createScope once and sets scope. Apply through that single mounted router to `/v1` and descendants, including router misses. Unknown authenticated routes remain plain-text 404. Better Auth receives original c.req.raw; preserve all Set-Cookie headers and mutable-response copying for redirects/CORS. Do not use /v1* or /api/auth* patterns that protect unrelated prefixes.
- [ ] Use sValidator for JSON/params/query, with hook failure → the endpoint's existing validation message. Set validationMessage before parsing so app.onError can turn Hono HTTPException(400) for malformed/unreadable JSON into the same envelope/message. The validator hook alone cannot catch JSON parse failures (official source below). No Hono default error body escapes.
- [ ] Page queries accept repeated keys by choosing the first, ignore unrelated keys, and retain decodeLimit's Number conversion, fallback 20 and maximum 50. Define shared QueryValue as v.union([v.string(), v.array(v.string())]) transformed to the first string, because sValidator query extraction can supply arrays. Use v.object for query/param schemas, not strictObject on unrelated query keys. Keep normalization of absent/null Thread patches and Repeat weekdays.
- [ ] Confirm Task DELETE no longer has a body after #421; retain its no-media-type-required behavior without installing a fake JSON header. Use HEAD through Hono's GET fallback with no response body. Keep sanitized failures; return typed successes directly without output revalidation.
- [ ] Green: `bunx turbo run test:run --filter=@vita-os/api` and `bunx turbo run build --filter=@vita-os/api`. All existing non-framework HTTP assertions pass before test reduction.

## Task 3: Delete routing parity duplication, document, and prove the whole port

**Files:** `apps/api/test/guard-paths.integration.test.ts` only after parity is green; keep `http-compatibility.integration.test.ts`, auth/ownership tests and all feature workflow tests; new `docs/adr/0035-hono-valibot-result-api.md` (reserve next free number at execution); mark ADR 0020 amended; update `docs/migrations/cloudflare-application.md`, AGENTS.md's API framework description, `.claude/skills/verify-vita-os/SKILL.md` and feature map wording where Effect-specific. Do not edit verify flow steps unless explicitly documenting a deliberate behavior change.

- [ ] Reuse existing focused HTTP compatibility/auth tests rather than building another broad matrix. Keep one encoded Note ownership case, one encoded Thread/Task ownership case, double-encoded ID isolation, malformed escape after encoded prefix, and encoded auth-prefix CORS/cookies. Keep a mount-boundary/scope-once check only if coverage is missing. Delete runtime URL/method normalization cases and spelling × owner × method cross-products whose two-decoder implementation is gone.
- [ ] Retire only redundant large spelling tables that tested agreement between two decoders now replaced by Hono alone. No routing compromise is preapproved. If selected Hono differs, document exact request, previous/new status or outcome, what could go wrong (e.g. a manually encoded bookmark fails), and visible symptom; auth/ownership/writes may never weaken. Keep corresponding regression test of the chosen behavior.
- [ ] ADR amends Effect/Layers/lazy-operation decisions only; explicitly retain one-round-trip storage, ownership, guarded operations, atomic D1 batches, and core rules. Record immediate operation execution and any path compromise in the PR. State failure causes remain private.
- [ ] Run every `.claude/skills/verify-vita-os/flows/*.flow` on the landed base and branch, each in its isolated stack/user; save pass/failure/evidence locations. Include Notes, Areas, History, Thread Notes and sign-in from #426, not just Tasks. Use `bun run verify up --instance api423`, `signin`, `run <flow>`, `down --purge`; read verify skill before executing. Enumerate any changed/deleted flow steps with reasons; expected changes: none.
- [ ] Run `bun run lint`, `bun run build`, `bun run test:run`. Confirm `rg 'from "effect|effect/' apps/api` finds no source/tests import and effect disappears from API package dependencies. Keep dependencies elsewhere if needed.
- [ ] Report `git diff --numstat` sums for added/deleted lines and same-scope source line totals before/after. `bunx turbo run build --filter=@vita-os/api` includes wrangler deploy --dry-run; save Total Upload and gzip before/after. Root measured pre-#421 main 2958.03 KiB / 537.59 KiB gzip; capture landed #421 separately as the #423 base, rather than claiming the old figure is its base. Never deploy.

## Primary API references

- [Hono validation and Valibot sValidator example](https://hono.dev/docs/guides/validation#standard-schema-validator-middleware)
- [Standard validator source: hook replaces schema-refusal output](https://github.com/honojs/middleware/blob/main/packages/standard-validator/src/index.ts)
- [Hono validator source: malformed JSON throws before hook](https://github.com/honojs/hono/blob/main/src/validator/validator.ts)
- [Hono 4.13.13 path handling](https://github.com/honojs/hono/blob/v4.13.13/src/utils/url.ts): default getPath decodes URI once, preserves %25, and partially decodes malformed escapes. Pinned source was checked with GitHub API; real Worker tests still must prove behavior. The local guard decoder repeats this logic.
- [Valibot inference and safeParse](https://valibot.dev/guides/introduction/), [optional keys stay omitted](https://valibot.dev/api/optional/)
- [better-result pinned generator and boundary source](https://github.com/dmmulroy/better-result/blob/v3.0.1/src/result.ts), [TaggedError source](https://github.com/dmmulroy/better-result/blob/v3.0.1/src/error.ts)

## Remaining execution checks

- Re-read landed #421 and #422 before implementation, including final Task DELETE and request scope/tests; API/contracts were still a worktree snapshot when planned.
- Registry availability of standard-validator 0.4.0 must match official source package version; verify peer dependency @standard-schema/spec (official peer range ^1.0.0) and install/pin if Bun requires it.
- Shrinking the spelling matrix is conditional on real Worker parity; current Hono source suggests encoded-prefix protection can be preserved without local guards, but this is a source inference until tested.
- Typed success responses are serialized directly. A malformed JSON-serializable success may return 200 and be rejected by the existing browser decoder. Explicit row converters and owner scoping remain; do not add a replacement projection framework. Escaped dependency defects become sanitized 500; ordinary core refusals retain their typed status. Remove the artificial db-getter core-error classification test.

## Execution ownership

Preserve the owner-requested agent coordination. Task 1 has one contracts/schema owner. Task 2 uses one foundation owner for Result helpers, auth, guards, and app composition, then bounded feature owners for disjoint operations/routes files after those interfaces are fixed. The complete Task 2 HTTP suite is the integration gate; do not add temporary transport aliases merely to make partial work compile. Independent reviewers check each completed change and the whole port. The controller owns integration, real-app proof, measurements, and shipping; use separate native worktrees for separate PRs.

## Self-review

All #423 requirements map to Tasks 1–3. Request strictness matches existing PayloadParseOptions onExcessProperty=error; query/params retain permissive object semantics. Scope is created once, validation messages survive malformed JSON, typed success serialization replaces response revalidation, and #422 version headers/cookies must pass the existing real Worker tests after the port. No routing compromise is approved in advance. This plan changes no data migration or browser decoder.

## Simplification adjustment after user steering

The owner explicitly asked reviews to favor removing nonessential concurrency and error machinery. The source assessment in `/tmp/vita423-simplification-assessment.md` found no API test requiring success revalidation as an auth/data boundary. Adopt the deletions above within the approved library direction. Preserve meaningful input, ownership, stored-data, core-rule and atomic-write tests; do not preserve Effect defect semantics or duplicate path permutations just for parity. Record these deliberate compromises in the PR and ADR. #421 must still land before implementation.
