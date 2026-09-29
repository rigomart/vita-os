# Vita OS

A personal life-awareness app. It holds open threads and standalone notes, lightly grouped by the part of life they concern, so you don't have to keep them in your head. `CONTEXT.md` defines the product vocabulary (Area, Thread, Move, and so on).

The app is a React web client talking to a Hono API on Cloudflare Workers, with Better Auth for sign-in and D1 for storage.

## Repo layout

A bun workspace driven by turbo.

| Path | What it is |
| --- | --- |
| `apps/web` | Browser host (Vite + React). Sign-in, config, HTTP client. Mounts the product from `packages/application`. |
| `apps/api` | API Worker (Hono, Better Auth, D1). Schema lives in `apps/api/migrations`. |
| `apps/design` | Design system preview for `packages/ui`, on port 5174. |
| `packages/application` | The product itself: routes, screens, data fetching and caching. |
| `packages/contracts` | Shared models, inputs, outputs, errors, and the `ApplicationClient` interface. |
| `packages/core` | Domain rules, with no framework code. |
| `packages/ui` | Shared UI components and styles (shadcn based). |

`docs/adr` records design decisions. `docs/migrations/cloudflare-application.md` explains the architecture in depth.

## Run it locally

You need bun 1.3.14, Node (the deploy and smoke scripts use it), and python3 (the API test suite runs a few Python tests).

```bash
bun run setup
bun run dev
```

`bun run setup` installs dependencies, writes the env files, migrates the local D1, and seeds a dev user with sample Areas, Threads, and Notes. It is safe to re-run: each step skips what is already done. `bun run setup --reset` wipes the local D1 and reseeds it, and `--no-seed` skips the sample data.

The env files start from the example files, which hold working local values. In a worktree they are copied from the main checkout instead. Either way, any key the example has and the file lacks is added:

- `apps/api/.dev.vars`: `BETTER_AUTH_SECRET` (any string of 32+ characters), `BETTER_AUTH_URL=http://localhost:8787`, `BROWSER_ORIGIN=http://localhost:5173`.
- `apps/web/.env.local`: `VITE_API_BASE_URL=http://localhost:8787`.

`bun run dev` starts the API on http://localhost:8787, the web app on http://localhost:5173, and the design preview on http://localhost:5174. Sign in as `dev@vita.test` with the password `vita-dev-password`. A missing variable fails at startup with its name.

Run `bun run setup` again whenever a new file lands in `apps/api/migrations`.

The first `bun run setup` also sets `core.hooksPath` to `.githooks`, so `.githooks/post-checkout` runs the same setup in every new git worktree. Set `VITA_SKIP_SETUP=1` to skip it for one `git worktree add`.

## Checks

```bash
bun run lint        # oxlint fixes, then oxfmt formatting
bun run typecheck
bun run build
bun run test:run    # all tests once (bun run test for watch mode)
```

CI (`.github/workflows/verify.yml`) runs `lint:check`, `typecheck`, `build`, a check that the sign-in page doesn't load the signed-in app, and `test:run` on every pull request and before every deploy.

## Check a change in the real app

`bun run verify up` starts an isolated local stack (its own ports and D1) and signs up a throwaway user. It needs no `.dev.vars` or `.env.local`. `bun run verify --help` lists the other commands, and `.claude/skills/verify-vita-os/SKILL.md` documents them.

## Deploy

Each environment is a web Worker and an API Worker with its own D1 database. The two hostnames share `rigos.dev` so the session cookie reaches the API. Both are defined in `apps/web/wrangler.jsonc` and `apps/api/wrangler.jsonc`.

| Environment | Web | API | D1 | Deployed by |
| --- | --- | --- | --- | --- |
| staging | vita-staging.rigos.dev | vita-api-staging.rigos.dev | `vita-os-staging` | `deploy-staging.yml`, on every push to `main` or by hand |
| production | vita.rigos.dev | vita-api.rigos.dev | `vita-os-production` | `deploy-production.yml`, by hand only |

Each workflow runs the CI checks, applies D1 migrations, deploys and smoke tests the API, then deploys and smoke tests the web app. It needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets. Deploy through the workflows rather than by hand.

`apps/web` also has `deploy:staging` and `deploy:production` scripts (`bun run --cwd apps/web deploy:staging`). They build with the right `VITE_API_BASE_URL`, check the target Worker name and domain, and deploy the web Worker only. They do not migrate D1 or deploy the API.

API secrets are set per environment from `apps/api`:

```bash
bunx wrangler secret put BETTER_AUTH_SECRET --env staging
```

To roll back the web app, the production run summary records the version it replaced:

```bash
bunx wrangler rollback <version-id> --name vita-os-web
```
