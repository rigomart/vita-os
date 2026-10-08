# Final comments, tests and compatibility sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan as one coherent cleanup slice; combine its task and final review because they cover the same diff. Steps use checkbox (`- [ ]`) syntax for tracking. Parent owns scope, review and the handoff; this draft authorizes no implementation.

**Goal:** Remove residual tests and wording for behavior eliminated by #421–#424, while retaining current visible behavior, data, authentication and ownership protection.

**Architecture:** Make a deletion-led docs/comments/tests change after #424 lands. Public contracts, browser/runtime behavior, domain rules, internal D1 guards and write semantics stay unchanged. Use current main to prove each deletion is still applicable; #424’s deleted decoder work is not counted again.

**Tech Stack:** Bun, Vitest, Hono, Valibot, TanStack Query, isolated `bun run verify` flows.

**Spec:** [#425](https://github.com/rigomart/vita-os/issues/425), parent [#419](https://github.com/rigomart/vita-os/issues/419); scout `/tmp/vita425-cleanup-scout.md` based on `85adf959`.

## Global Constraints

- Start after #424 is merged and the owner has reviewed this concrete plan. No implementation is authorized by this draft.
- Run commands from the repository root with `bun`. Use an isolated worktree; never use the shared dev server or the owner’s account.
- “stored data is never lost or corrupted (migrations, writes), auth and ownership checks hold, and failures are visible, never silent.”
- “Remove comments that explain interleavings or guards that no longer exist. Keep short "why" comments where the reason isn't obvious from the code.”
- “Delete tests that pin incidental or removed behavior ... Keep tests of behavior a person sees, and of data, auth and ownership.” Parent has also selected three specific implementation-count/configuration assertions for removal, with their behavioral coverage retained below. Other current incidental suspects are excluded.
- All 15 verify flows pass on post-#424 main and the branch; lint, build and tests pass. Report net lines deleted by package and name any compromise.
- No new concurrency, error, recovery or output layers; no migrations, dependencies, APIs, flow-command changes or wholesale test-file deletion.

## Review Focus

No new runtime inputs are introduced. Preserve existing checks for refused writes leaving data unchanged, current response values, missing required Task IDs, repeating occurrences advancing once, account isolation, atomic D1 writes, conversion Undo and visible failures. Do not add tests mirroring this reversible deletion-only change.

---

### Task 1: One coherent removal of retired promises

**Files to modify:**
- `apps/api/test/retired-api-names.integration.test.ts`: remove retired alias routes/permutations only; retain every current-value/no-write/missing-required-key assertion.
- `apps/api/test/task-dates.integration.test.ts`: remove obsolete caller-revision header.
- `packages/application/src/cache/patch.test.ts`: remove one assertion naming the retired Area `standard` field.
- `apps/api/test/guard-paths.integration.test.ts`: remove only scope construction count/injection-shape test; retain encoded auth and ownership tests.
- `packages/application/src/cache/use-application-mutation.test.tsx`: remove only exact refetch-count / pending mutation count test; retain all rollback tests.
- `packages/application/src/application-client-provider.test.tsx`: remove only exact default-options object equality; retain cache identity/lifetime tests.
- `docs/migrations/cloudflare-application.md`: remove public revision/replay descriptions contradicted by ADR 0034.
- `docs/migrations/effect-v4-api.md`: label the retired implementation historical and link ADR 0035; retain unique historic proof.
- `.claude/skills/verify-vita-os/features/follow-up-dates.md`: remove the former field/route removal clause while retaining the physical-column mapping.
- `.claude/skills/verify-vita-os/features/thread-notes.md`: trim stale Effect migration qualifiers, retaining proof and omissions.
- `.claude/skills/verify-vita-os/flows/dashboard-tasks.flow`: remove the comment describing queued Task commands.

**Interfaces:** None changed. Existing `ApplicationClient`, schemas, operations, runtime sources and flow commands are unchanged.

- [ ] **Establish post-#424 baseline:** inspect clean landed main and its #424 diff; validate the scout’s candidates against current files. Create the execution worktree using the project/native worktree workflow. Record its base SHA.
- [ ] **Confirm baseline proof:** record successful root lint/build/test results and all 15 flows on that base. Reuse current parent-owned proof only when its SHA and complete flow list match this base; otherwise run the missing baseline checks in an isolated instance. Flows are `tasks`, `dashboard-tasks`, `dated-tasks`, `repeating-tasks`, `complete-with-note`, `resolve-reopen`, `thread-drawer`, `thread-edit-tasks`, `notes`, `notes-dashboard`, `thread-notes`, `add-to-thread`, `areas`, `history`, `sign-in`. Use the verify skill and record evidence directories; never drive another session’s instance.
- [ ] **Delete removed-alias test branches:** in `retired-api-names.integration.test.ts`, delete the seven-method `/moves` 404 matrix (scout lines 8–42) and old `attention-date` route 404 test (147–163). Remove Thread `followUp` legacy extras (52–53), `moveId` legacy cases (82–85), the old `attentionDate`-only loop (132–141), and negative response-alias assertions (189–190, 206). Reduce the mixed Note extra-key array to generic `unknown`. Keep current positive response values, generic unknown-key cases, missing Task/focus IDs and unchanged Thread/Note reads. Remove only newly unused imports.
- [ ] **Remove obsolete header/field assertion:** delete `task-dates.integration.test.ts`’s header claiming caller revisions (10–14); delete `cache/patch.test.ts`’s `standard` absence assertion (109). Keep all surrounding behavior tests.
- [ ] **Remove selected implementation-count/configuration assertions:** delete `guard-paths.integration.test.ts`’s “builds the authenticated scope once” test (133–148), its sole `createRequestScope` / `createTestApp` imports and now-unused `vi` specifier. Keep `request-context.integration.test.ts:10–43` and `operations.integration.test.ts:21–60` proving actual actor isolation and all encoded ownership tests. Delete `use-application-mutation.test.tsx`’s “refetches a settled command while an unrelated command remains pending” test (78–100) and sole `QueryObserver` import; keep adjacent rollback tests (101–128) and Thread rollback tests. Delete only the default-options equality assertion in `application-client-provider.test.tsx:49–52`; keep provider identity/lifetime checks (45–48, 54–55) and signed-in account cache replacement coverage. Change no retry/refetch/cache runtime behavior and add no replacement tests.
- [ ] **Correct current documentation:** delete `cloudflare-application.md`’s public Thread revision paragraph (55–58). Replace its replay/base-snapshot/refetch-waits prose (110–114) with: “Each command cancels affected reads, applies its optimistic change once, reconciles the service’s answer, rolls back its own failed change, and refetches when it settles.” Keep internal D1 revisions/atomic batches and account-change cache replacement. Remove the former HTTP field/route clause from `follow-up-dates.md:35`, retaining “The physical Note column is `attention_date`; the app model and HTTP requests use `followUp`.” Delete only the stale queue comment at `dashboard-tasks.flow:46`; no flow commands change.
- [ ] **Clarify historical proof:** add “Historical migration record. [ADR 0035](../adr/0035-hono-valibot-result-api.md) replaces the Effect runtime described below.” immediately under `effect-v4-api.md`’s title, change its opening “now uses” to “used”, and remove the obsolete “Note date aliases” clause at line 17. Keep the unique verification record (26–43). In `thread-notes.md`, trim only “plus the Effect v4 API working-tree migration” from its older Status clause and “for this API-only migration” from its phone/drawer omission. Keep historical SHA/proof, sample/evidence names, repeatable flow proof and all undriven-path omissions; do not relabel historical evidence as current.
- [ ] **Inspect #424 residue:** remove a stale manual-decoder comment/reference only if it demonstrably survives #424 and references a deleted file/function. If none remain, record none. Do not remove shared schema tests, compatibility with stored dates, meaningful decoder rejection tests or count #424 deletions under #425.
- [ ] **Review the diff:** confirm all data/auth/ownership assertions above remain, no runtime source changed, no test deletion relies on its filename, and only one flow comment changed. Retain pagination cache-size and HTTP transport tests, historical ADRs/plans, migration safety comments and unique historical verification evidence. Stop scope growth if a candidate requires changing behavior to justify deletion.
- [ ] **Run root checks:** `bun run lint`, `bun run build`, `bun run test:run`; each exits 0. Inspect auto-fix changes and discard only unrelated formatting edits introduced by these commands.
- [ ] **Prove the branch:** run the same 15 flows through `bun run verify run .claude/skills/verify-vita-os/flows/<name>.flow` with the verify skill’s isolated instances/preconditions. Record all passing outputs and evidence directories. No flow steps are changed to satisfy the cleanup.
- [ ] **Report measurement and compromise:** use the actual Git diff to report additions/deletions/net reduction for `apps/api`, `packages/application`, docs and verify, explicitly report 0 for untouched packages. Expected narrow reduction is about 126–129 lines before final formatting: API about 93–94, application 29, docs about 4–5, verify 0–1. Name the compromises: specific assertions that retired API aliases remain unavailable, scope construction counts, exact refetch/pending timing counts and an exact default-options object are dropped. Stored writes, actor isolation, rollback, cache identity and current workflow coverage remain; no runtime retry/refetch behavior changes. List the sole flow change as removal of its obsolete queue comment, with zero executable steps changed.
- [ ] **Finalize reviewable result:** parent reviews the complete diff and evidence before shipping through `ship-changes`. Suggested conventional commit: `chore(cleanup): remove retired behavior tests and notes`; PR closes #425 and refers to #419. No deployment by hand.

## Self-review

Spec coverage: removed guards/revision/replay wording, retired compatibility tests/notes, parent-selected implementation assertions, retained why/data/auth/visible behavior, baseline/branch flows, root checks and per-package deletion report all have steps. Other current incidental tests are explicitly excluded. Type consistency: no interfaces change. Proportion: one small coherent slice, no replacement test framework or behavior expansion. Remaining dependency: actual #424 landed diff and owner plan review.
