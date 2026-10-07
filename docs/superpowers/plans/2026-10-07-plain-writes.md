# Plain Writes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver #421 by replacing application-wide write coordination with ordinary optimistic mutations while retaining data integrity and visible failures.

**Architecture:** API commands apply to the current Thread. Storage keeps its internal revision comparison to protect whole-JSON Task writes; browser commands and public Threads lose revisions. Complete and Skip carry the displayed occurrence date so competing commands cannot advance the same occurrence twice. Client mutations apply once, reconcile or roll back their own changes, and refetch independently.

**Tech Stack:** Bun, TypeScript, TanStack Query, existing Effect HTTP API, Cloudflare D1, Vitest.

**Spec:** https://github.com/rigomart/vita-os/issues/421 and parent https://github.com/rigomart/vita-os/issues/419.

## Global Constraints

- Preserve stored data, authentication, ownership checks, atomic completion, and visible failures.
- No global write batches, replay, stale-client basis, duplicate-command signatures, or conversion locks.
- Last write wins for conflicting edits; optimistic results may briefly flash before refetch settles them.
- Keep existing local-calendar `now` inputs and client-minted completion Note IDs.
- No migrations or compatibility aliases. Existing tabs need refresh after the contract changes.
- Conversion hides its source immediately. Destination appears only after the five-second Undo window and successful save; Undo restores the source without issuing conversion.
- Run commands from the worktree root with Bun. Do not merge or deploy.

## Review Focus

- Concurrent changes to different Tasks must both survive a storage race (Task 1).
- A failed mutation must preserve a successful edit to another Thread or another field (Task 2).
- A lost completion response must not duplicate the next occurrence, Note, or Activity Log entry (Task 1).
- A double click must issue one accepted action while its control is pending (Task 3).
- Conversion Undo and an unrelated Task command must work without locking the destination Thread (Task 3).

---

### Task 1: Current-state API commands and occurrence protection

**Files:** Modify `packages/contracts/src/models.ts`, `packages/contracts/src/application-client.ts`, `apps/api/src/platform/http/schemas.ts`, `apps/api/src/features/threads/{api,operations,storage,requests,routes,rows}.ts`, `apps/api/src/features/add-to-thread/operations.ts`, `apps/web/src/application/http/{http-application-client,decode}.ts`, and `packages/application/src/test/fake-application-client.ts`. Adapt affected fixtures and schema tests; preserve migration revision assertions in `apps/api/test/migrations.integration.test.ts` through direct D1 reads.

**Interfaces:** `TaskCommand` retains `threadId` without `expectedRevision`. `CompleteTaskInput.expectedOccurrence: number | null`; `SkipTaskInput.expectedOccurrence: number`. Other Task commands carry no expectation. Public `Thread` has no revision. Internal storage `findForChange` returns `{ thread: Thread; revision: number } | null`.

- [ ] Add failing outcomes in `apps/api/test/operations.integration.test.ts`: unrelated Thread edit followed by Task edit succeeds; simultaneous edits to different Tasks both survive; competing Complete/Skip advances once; a lost-response retry adds no second Note or log; insertion failure rolls back the whole completion.
- [ ] Add conversion/Task race coverage in `apps/api/test/add-to-thread.integration.test.ts`, preserving both results. Retain ownership, missing Task, invalid input, resolved state, and reused Note-ID assertions.
- [ ] Run `bunx turbo run test:run --filter=@vita-os/api` and confirm the new behavior tests fail for stale-revision refusal or duplicate advancement.
- [ ] Implement contract/storage boundaries above. Re-read and recompute after a failed conditional write, reusing `changeThread`'s existing three-attempt limit for Task writes. Check occurrence on every attempt; missing Task or changed occurrence refuses with 409. Retain the existing atomic D1 completion batch.
- [ ] Adapt HTTP and fake tests in `apps/api/test/http-client.integration.test.ts`, `apps/web/src/application/http/http-application-client.test.ts`, and `packages/application/src/test/fake-application-client.test.ts`; assert wire fields and unknown/missing input refusal.
- [ ] Run focused API, web, and application suites; confirm these behavior tests pass. Commit `refactor(tasks): apply commands to current thread state` after Task 2 consumers compile.

### Task 2: Independent optimistic mutations and targeted rollback

**Files:** Modify `packages/application/src/cache/{use-application-mutation,patch}.ts`, `areas/{hooks,optimistic}.ts`, `notes/{hooks,optimistic}.ts`, `threads/{hooks,optimistic}.ts`, and `thread-notes/hooks.ts`.

**Interfaces:** `optimistic(cache, variables)` returns `{ local?: TLocal; rollback(): void }`. The helper retains affected queries, optional extra invalidation, reconciliation, mutation keys, and `retry: false`. No scopes, queues, replay, refusal callback, or command signatures.

- [ ] In `packages/application/src/cache/use-application-mutation.test.tsx`, add failing assertions that A refetches when settled while unrelated B remains pending, and failed A preserves successful B in the shared list. Add a failed Task rollback that preserves a concurrent title edit.
- [ ] Run `bunx turbo run test:run --filter=@vita-os/application`; confirm new assertions fail against global settlement or whole-record restoration.
- [ ] Implement standard `onMutate`, `onError`, `onSuccess`, and `onSettled` behavior. Roll back only the affected IDs and changed fields, preserve paging metadata, and remove only the minted placeholder on creation failure. Area label rollback must preserve other Thread fields.
- [ ] Adapt callers to the Task 1 contracts; mint IDs once per accepted UI action. Remove old global-batch, replay, and revision-basis assertions.
- [ ] Run application tests and confirm independent settlement and rollback outcomes pass. Commit `refactor(cache): settle optimistic writes independently`.

### Task 3: Pending controls and conversion Undo

**Files:** Modify `packages/application/src/threads/use-tasks.ts`, `threads/components/thread-attention{,-card,-section}.tsx`, `notes/add-to-thread/{hooks,use-add-note-to-thread-with-undo}.ts`; delete `threads/task-queue.ts`.

**Interfaces:** Complete captures `task.date ?? null` and Skip captures `task.date` before optimistic advancement. Controls use ordinary mutation pending state and the existing `useGuardedAsyncAction`. Conversion optimism touches the source only; confirmed server results supply destination records.

- [ ] Add failing rendered-control assertions in `threads/components/thread-attention.test.tsx` and `threads/use-tasks-duplicate.test.tsx`: pending control is disabled, double click submits once, repeating Task advances once.
- [ ] Replace queue/lock assertions in `notes/add-to-thread/{conversion-queue,convert-then-act,add-to-thread}.test.tsx` with source hidden/destination unchanged during Undo, Undo restores/no command, successful conversion adds exactly one destination, and unrelated Task command remains usable.
- [ ] Run application tests and confirm new assertions fail for lock or provisional-destination behavior.
- [ ] Remove conversion locks, `Adding…`, lock-driven remounts, dropped-command signatures, and queue memory. Keep completion-note recovery and calendar logic. Publish destination only after confirmation and refetch on failures.
- [ ] Run application tests; retain completion-note success/refusal/lost-response and repeating-calendar coverage. Commit `refactor(tasks): use ordinary pending controls`.

### Task 4: Decision, full proof, and PR

**Files:** Add the next available ADR amending `docs/adr/0022-*`; amend the conversion-lock decision. Update `.claude/skills/verify-vita-os/flows/{dated-tasks,thread-edit-tasks,resolve-reopen}.flow` only for deliberate removed-lock/queue behavior, and affected feature recipes.

- [ ] Record conversion destination delay, two-device last-write-wins, brief optimistic flashes, old-tab refresh requirement, and visible failure after a lost response despite landed write. Do not add receipt/generation machinery for deliberate reuse of an old date.
- [ ] Run all 15 verify flows on current main and branch with separate isolated users/stacks; retain screenshots and logs. List every flow adjustment and its behavior reason in the PR.
- [ ] Run `bun run lint`, `bun run lint:check`, `bun run typecheck`, `bun run build`, `bun apps/web/scripts/check-chunks.mjs apps/web/dist`, and `bun run test:run`; all must pass.
- [ ] Obtain independent behavior/spec review and code review. After two rounds still finding new problems in the same area, simplify that area before continuing.
- [ ] Commit `docs(tasks): record simpler write tradeoffs`, push the isolated branch, create and attach a PR. Include added/deleted lines, proof, remaining compromises, and `Closes #421` at the end.

## Self-review

All #421 requirements map to Tasks 1–4. The occurrence field is consistent across transport, fake, and real client. Public revisions are removed while storage comparisons remain internal. Conversion delay is an explicit design choice awaiting owner approval. #422 can proceed independently; #423 waits until this API change lands.
