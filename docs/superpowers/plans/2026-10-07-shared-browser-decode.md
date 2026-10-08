# Shared browser response schemas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development after owner review. This draft authorizes no implementation.

**Goal:** Replace the browser's hand-written response guards with shared Valibot schemas and delete `decode.ts`.

**Architecture:** The existing HTTP client uses one small `safeParse` helper and shared response schemas. Request paths, request bodies, status handling and `OperationResult` remain unchanged; local schemas cover only list, count and error envelopes absent from contracts.

**Tech Stack:** Bun, TypeScript, existing Valibot 1.5.0, Vitest, isolated `bun run verify` stack.

**Spec:** [#424](https://github.com/rigomart/vita-os/issues/424), parent [#419](https://github.com/rigomart/vita-os/issues/419). Planning source: the #423 worktree on October 7; reread landed #423 before execution.

## Global constraints

- Start only after #423 lands and the owner reviews this plan and its named compromise below. Use an isolated native worktree from that landed base.
- Keep `ApplicationClient`, `packages/application`, its fake client, authentication, request encoding, cookies, fetch binding, status mapping, error copy and retry flags unchanged. No recovery, automatic retries, codec framework, migration or server change.
- Shared contracts/core stay unchanged. Delete all of `apps/web/src/application/http/decode.ts`; do not move its guards elsewhere.
- Run commands from repo root with Bun. Required finish: lint, build, tests, all 15 verify flows on base and branch, before/after web bundle sizes, lint:check, typecheck and existing chunk check.

## Proposed compromise: shared-shape validation

Use the frozen shared schemas as the browser's response definition. They reject wrong types, missing required keys, unknown Repeat kinds, null optional fields and empty IDs; unknown object keys are stripped. They do not enforce valid Repeat ranges/unique weekdays, require a date beside Repeat, sort weekdays, or reject unsafe integer timestamps/order. Thus `{kind:"days",every:0}`, duplicate weekdays, and Repeat without date change from `unexpected` to accepted, valid unsorted weekdays remain unsorted, and integer timestamps above `Number.MAX_SAFE_INTEGER` become accepted; empty IDs change from accepted to `unexpected`. These are deliberate behavior changes to review, not parity claims. Count stays a safe integer because its envelope has no shared schema. Document the decision and its malformed-server-data risk in the PR. Core still validates writes; no core algorithm is copied into contracts or the browser.

## Review focus

1. One malformed entry must reject an entire list/page as `unexpected`.
2. Omitted optional fields stay omitted; null stays rejected; unknown private/legacy fields are stripped.
3. Malformed JSON/error envelopes must remain `unexpected`; network rejection remains retryable `unavailable`.
4. Count must return a number and delete acknowledgements must require literal `true`.
5. The named validation compromise must be pinned by explicit tests, including stricter empty IDs, rather than silently weakening existing assertions.

## Task 1: Replace decoders and prove the client

**Files:** modify `apps/web/src/application/http/http-application-client.ts`, its existing `.test.ts`, `apps/web/package.json`, `bun.lock`; delete `apps/web/src/application/http/decode.ts`. No other product files.

**Interfaces:** Keep `createHttpApplicationClient(options: HttpApplicationClientOptions): ApplicationClient`. In the same file, use `parseResponse<T>(schema: v.GenericSchema<unknown, T>, value: unknown): T | undefined`; return `safeParse` output on success and `undefined` on failure. Replace request/read/send `decodeSuccess` callbacks with `successSchema: v.GenericSchema<unknown, T>`; request keeps its existing `undefined` → `unexpected` handling.

**Exact schema imports from `@vita-os/contracts`:** `AreaSummarySchema`, `ThreadSchema`, `ThreadDetailSchema`, `NoteSchema`, `ThreadNoteSchema`, `NoteAddedToThreadSchema`, `ActivityLogPageSchema`, `NotePageSchema`, `ThreadNotePageSchema`, `CommandAckSchema`, `ApplicationErrorSchema`. Import `* as v` from `valibot`; declare direct web dependency `"valibot": "1.5.0"` rather than relying on contracts' dependency.

**Response mapping:** Areas create/update → `AreaSummarySchema`; list/reorder → `v.array(AreaSummarySchema)`. Open/resolved Threads → `v.array(ThreadSchema)`; detail → `ThreadDetailSchema`; every Thread mutation and Task command → `ThreadSchema`. Activity → `ActivityLogPageSchema`. Open Notes → `v.array(NoteSchema)`; done Notes → `NotePageSchema`; Note create/body/follow-up/state → `NoteSchema`; both add-to-thread commands → `NoteAddedToThreadSchema`. Open Thread Notes → `v.array(ThreadNoteSchema)`; done → `ThreadNotePageSchema`; create/body/state → `ThreadNoteSchema`. All four resource deletes → `CommandAckSchema`. Define count as `v.pipe(v.object({ count: v.pipe(v.number(), v.safeInteger()) }), v.transform(({ count }) => count))`; all non-2xx error bodies use `v.object({ error: ApplicationErrorSchema })` and take its parsed `.error`. Declare local envelopes/list schemas once beside the helper.

- [ ] **Baseline:** Before editing, build with `bunx turbo run build --filter=@vita-os/web --force` and save its output. Record raw/gzip browser JS chunk sizes and totals from `apps/web/dist/assets` (Bun script using `readFileSync` and `gzipSync`), excluding the Worker. Save dependency state, exact SHA and build mode. Run all 15 current flows on this landed base; retain per-flow outcomes and evidence paths.
- [ ] **Red:** Extend existing HTTP-client tests with rejected empty ID; explicit accepted invalid Repeat values (`every:0`, duplicate weekdays), Repeat without date, unsorted weekdays preserved and unsafe integer timestamp. Keep null/unknown-kind/wrong-member-type Repeat rejection. The newly accepted cases and empty ID must fail on the old decoder; keep existing valid Repeat command assertions intact.
- [ ] **Boundary tests:** Add only missing HTTP boundary coverage: malformed list entry and page cursor; count valid/unsafe/non-number; acknowledgement true/false; omitted optional keys/null/unknown keys; unreadable JSON on success and error; valid error at an unmapped status preserves its fields. Use compact parameterized fixtures for response families not currently covered (Notes and Thread Notes lists/pages). Assert `unexpected` code, not merely `{ok:false}`, for malformed responses. Retain existing fetch binding, status table, network failure, paths/query/body/cookie assertions unchanged.
- [ ] **Red check:** Run `bun run --cwd apps/web test:run src/application/http/http-application-client.test.ts`; verify failures are the intended schema adoption changes.
- [ ] **Implement:** Add the pinned direct dependency with Bun, wire the mappings above through the plain helper, replace `decodeApplicationError` with shared error-envelope parsing, and delete `decode.ts`. Leave `readJson`, request/status error handling and request construction behavior intact. No response type assertions or extra shape guards.
- [ ] **Green:** Run the focused command above, then `bun run lint`, `bun run build`, `bun run test:run`, `bun run lint:check`, `bun run typecheck`, and `bun apps/web/scripts/check-chunks.mjs apps/web/dist`; all pass. Confirm no `./decode` import remains and the file is deleted.
- [ ] **Proof:** Read `verify-vita-os` and its feature index. Run every `.claude/skills/verify-vita-os/flows/*.flow` (15: add-to-thread, areas, complete-with-note, dashboard-tasks, dated-tasks, history, notes, notes-dashboard, repeating-tasks, resolve-reopen, sign-in, tasks, thread-drawer, thread-edit-tasks, thread-notes) against the branch. Each flow starts with an isolated fresh user/D1: `bun run verify up --instance browser424`, `signin`, `run <flow-file>`, `down --purge`, using that instance on every command. Preserve original flow steps; report failures/inconclusive evidence accurately. If the same step fails twice, stop that item and continue the others as the skill requires.
- [ ] **Measure/review:** Repeat the identical web build/measurement command; report before/after raw/gzip browser JS totals and per-chunk changes plus added/deleted source lines. No assumed size reduction. Request independent review of schema mappings, the named compromise, unchanged transport behavior and evidence; address actionable findings and rerun affected checks.
- [ ] **Commit/handoff:** Commit reviewed code and tests as `refactor(web): decode responses with shared schemas`; controller handles push/PR under `ship-changes`. PR cites #424, states the compromise, reports all base/branch flow outcomes and bundle numbers, and ends with `Closes #424`.

## Self-review

#424's deletion, shared decoding, unchanged interface, malformed-shape failures, size report and full verification map to this single task. The shared schemas and client mappings agree with the inspected #423 source. Local list/count/error envelopes compose shared schemas and do not duplicate model shapes. The focused command uses the actual package script rather than forwarding a path to unrelated Turbo tasks. The proposed compromise is the only unresolved owner decision; it does not promise semantic validation parity. No project files have been edited by drafting this plan.

API references: [GenericSchema](https://valibot.dev/api/GenericSchema/), [safeInteger](https://valibot.dev/api/safeInteger/), [safeParse](https://valibot.dev/api/safeParse/). Confirm the pinned installed types during execution.
