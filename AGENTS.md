# AGENTS.md

Vita OS is a personal life-awareness app: open Threads and standalone Notes, optionally labeled by Area, on one Dashboard. Bun + Turbo monorepo. Run every command from the repo root with `bun` (never npm, yarn, or pnpm).

## Phase: iterating fast

Vita OS is still finding its shape, and its model changes often. Write code that is cheap to change
and cheap to delete: the simplest thing that works for what exists today, not machinery for cases
that haven't happened.

Compromises are fine when they're surfaced. Say in your report or PR what you left out, what could
go wrong, and how it would show up; the developer decides whether it's acceptable. Don't silently
harden against it, and don't silently ignore it.

Not up for compromise: stored data is never lost or corrupted (migrations, writes), auth and
ownership checks hold, and failures are visible, never silent.

## Done means

1. `bun run lint` (auto-fixes lint, format, import order) and `bun run build` (type-check + build) pass.
2. `bun run test:run` passes when the touched code has tests.
3. A user-visible change is proven in the real app with the `verify-vita-os` skill (`.claude/skills/verify-vita-os/SKILL.md`, run as `bun run verify <command>`). Lint and tests don't substitute for it.

## Where things live

- `packages/application` is the product: routes, every authenticated screen, the reads and commands behind them, the TanStack Query cache, optimistic updates. Its modules import each other by relative path, never by the package name.
- `apps/web` is only the host: Better Auth in the browser, configuration of the shared HTTP application client (`@vita-os/contracts/http`), session gating, auth routes. `@` maps to `apps/web/src`.
- `apps/api` is the Hono HTTP API Worker over Cloudflare D1. Migrations are in `apps/api/migrations`. Background: `docs/migrations/cloudflare-application.md`.
- `packages/contracts` (shared types and the application contract), `packages/core` (domain rules, no framework code), `packages/ui` (shadcn components).
- `apps/design` is the lab (`bunx turbo run dev --filter=@vita-os/design`, :5174): the real product on an in-memory `ApplicationClient` with switchable scenarios, latency, and date and time, prototypes in `apps/design/src/prototypes/<name>/index.tsx` (served at `/lab/<name>`; `variants` are stepped with `[`/`]`; `shell: true` renders inside the product's chrome, `shell: "without-chrome"` keeps the Thread pane, palette, dialogs and shortcuts but draws no chrome), and the `packages/ui` preview at `/lab/system`. The lab composes the product through its public entries (`@vita-os/application`, `@vita-os/application/shell`); prototypes may also reach any product module through `@vita-os/application/internal/*`; the product never imports the lab. Scenarios seed through the same commands a person runs, so a rule change that breaks one fails its test. The in-memory client and the HTTP API run one contract suite (`@vita-os/contracts/testing`), so the two can't drift apart unnoticed.
- Domain language is in `CONTEXT.md`, decisions in `docs/adr/`. Use the glossary's terms for its concepts; plain words are fine around them (see Naming in `CONTEXT.md`). Say so when a change contradicts an ADR.
- `CONTEXT.md` and `docs/product-direction.md` describe the present. History goes in `docs/adr/`, delivery status in GitHub issues and PRs.

## Rules

- After two review rounds with new findings in the same area, stop patching and propose a simpler design.
- Add shadcn components from `apps/web/` with `bunx shadcn@latest add <component>`. Never `--overwrite`: components in `packages/ui/src/components/` carry local changes.
- Scope a command to one package with `bunx turbo run <task> --filter=@vita-os/<name>`.
- Don't use the shared dev server (`bun run dev`, Vite on :5173) or the owner's account for verification. `bun run verify` starts an isolated stack with a throwaway user.
- API changes ship without compatibility aliases for old browser tabs. The host reloads an old tab after pending writes settle and the matching web build is available.
- Data migrations must support the API still serving during deployment: migrations run before the new API deploys. Never remove or change storage that the serving API still needs.
- Never deploy by hand. Deploys go through `.github/workflows/deploy-*.yml`, which migrate D1 and deploy the API before the web app. The `deploy:*` scripts in `apps/web` ship the web Worker alone.
- Conventional commits with a scope: `<type>(<scope>): <description>`.
- Issues live in GitHub. Use the `gh` CLI.

## Worktrees

- Parallel sessions work in git worktrees under `.claude/worktrees/`. A new worktree sets itself up: `bun run setup` runs from `.githooks/post-checkout` after `git worktree add`, and from `.claude/hooks/setup-worktree.ts` when Claude Code creates the worktree, since Claude Code runs `git worktree add` with git hooks off. Setup installs dependencies, copies `apps/api/.dev.vars` and `apps/web/.env.local` from the main checkout, migrates the local D1, and seeds `dev@vita.test` / `vita-dev-password` with sample data.
- If a worktree is missing any of that, run `bun run setup`. It is idempotent. `bun run setup --reset` wipes and reseeds the local D1. Without `BROWSER_ORIGIN` in `.dev.vars` every browser request fails CORS.
- Never symlink `node_modules` between worktrees: bun's workspace links would resolve `@vita-os/*` to another checkout's source.
- Only one agent at a time adds a migration. Migrations apply in order, so parallel ones produce a conflicting history.

## Skills

Project skills live in `.claude/skills/<name>/`. Each is symlinked into `.agents/skills/` for agents that read that directory. Add new skills the same way.

- `verify-vita-os` drives the real app locally and captures proof.
- `ship-changes` packages work into a branch, commits, and a PR using this repo's conventions.
- `validate-idea` tests a raw product idea against real cases and the app's model and principles, then files a spec issue and a proposed ADR.
