# AGENTS.md

This file provides guidance to AI Agents when working with code in this repository.

## Verification (MUST RUN)

After implementing any feature or making any meaningful code change, **always** run these checks from the **repo root** before considering the work done:

```bash
bun run lint         # Lint + format + organize imports with auto-fix
bun run build        # Type-check (tsc) then build for production
```

If tests exist for the affected code, also run `bun run test:run`.

## Commands

All commands use **bun** (not npm/yarn/pnpm). Run from the **repo root**:

Do **not** run the dev server, Convex dev, or Convex generation unless the user explicitly asks. Assume the user is already running Vite and Convex locally. If those are needed, remind the user to run them: Vite dev generates the route tree, and Convex dev uploads functions and schema to Convex.

```bash
bun run dev          # Start all dev servers via turbo
bun run build        # Type-check + build all apps via turbo
bun run lint         # Lint with Oxlint fixes, then format + organize imports with Oxfmt
bun run lint:check   # Check linting, formatting, and import ordering without writing files
bun run format       # Format + organize imports with Oxfmt
bun run format:check # Check formatting and import ordering without writing files
bun run test         # Run tests in watch mode via turbo
bun run test:run     # Run tests once via turbo
```

To run commands for a **specific app**, use `--filter`:

```bash
bunx turbo run build --filter=@vita-os/web
bunx turbo run dev --filter=@vita-os/web
```

Add **new** shadcn components from `apps/web/`: `bunx shadcn@latest add <component>`. **Do NOT use `--overwrite`** — existing components in `src/components/ui/` may have custom modifications.

## Path Aliases

In `apps/web/`:
- `@` maps to `./src` — use `@/components/...`, `@/lib/...`, etc.
- `@convex` maps to `./convex` — use `@convex/_generated/...`, etc.

## Commits

Use conventional commits for all commits with the type and scope.

```bash
git commit -m "<type>(<scope>): <description>"
```

## Parallel work in worktrees

Sessions and subagents can run in isolated git worktrees under `.claude/worktrees/`. Setup is already committed:

- `.worktreeinclude` copies `apps/web/.env.local` into every new worktree.
- `.claude/settings.json` symlinks the `node_modules` directories back to the main checkout, so no `bun install` is needed per worktree.

Two rules when splitting work across worktrees:

- **Serialize Convex changes.** There is a single Convex deployment. Never run two agents that both touch `apps/web/convex/schema.ts` or push functions — they overwrite each other's deployment. Parallelize UI and client-side logic only.
- **One dependency change at a time.** `node_modules` is symlinked and therefore shared across worktrees, so a `bun add` in one worktree mutates all of them. Keep dependency changes to a single agent per batch.

## Agent skills

### Issue tracker

GitHub Issues for this repository (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary; GitHub label strings match the role names in `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
