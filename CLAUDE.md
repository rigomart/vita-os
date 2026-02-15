# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Verification (MUST RUN)

After implementing any feature or making any meaningful code change, **always** run these checks before considering the work done:

```bash
bun run lint         # Lint + format + organize imports with auto-fix
bun run build        # Type-check (tsc) then build for production
```

If tests exist for the affected code, also run `bun run test:run`.

## Commands

All commands use **bun** (not npm/yarn/pnpm):

```bash
bun run dev          # Start Vite dev server
bun run build        # Type-check then build for production
bun run lint         # Lint + format + organize imports with auto-fix
bun run format       # Format only with auto-fix
bun run test         # Run tests in watch mode
bun run test:run     # Run tests once
bunx vitest run src/path/to/file.test.tsx  # Run a single test file
```

Add shadcn components: `bunx shadcn@latest add <component>`

Convex: `bunx convex dev` to start the Convex dev server (syncs functions and schema).

## Architecture

**Frontend** (Vite 7 + React 19 + TypeScript 5.9):
- `src/main.tsx` — Entry point. `ConvexBetterAuthProvider` wraps `RouterProvider`.
- `src/routes/` — TanStack Router file-based routing with layout-based route groups:
  - `__root.tsx` — Root layout with devtools.
  - `_authenticated/` — Protected routes (redirects to `/sign-in` if not authenticated). Contains `route.tsx` (layout with header) and `index.tsx` (Inbox/tasks page).
  - `_unauthenticated/` — Public routes. Contains `route.tsx` (layout), `sign-in.tsx`, `sign-up.tsx`.
  - Route tree auto-generated at `src/routeTree.gen.ts` (gitignored).
- `src/components/ui/` — shadcn/ui components (added via CLI, not hand-written).
- `src/components/auth/` — Auth-related components (e.g. loading spinner).
- `src/lib/utils.ts` — `cn()` helper for Tailwind class merging.
- `src/lib/auth-client.ts` — Better Auth client (signIn, signUp, signOut, useSession).
- `src/index.css` — Tailwind v4 imports + shadcn CSS variables (light/dark themes).
- React Compiler enabled via `babel-plugin-react-compiler` in `vite.config.ts`.

**Backend** (Convex):
- `convex/schema.ts` — Database schema. Currently defines `tasks` table (title, description, isCompleted, dueDate, order, createdAt, userId).
- `convex/tasks.ts` — Task CRUD: `list` query, `create`/`update`/`remove` mutations with auth checks and optimistic update support on the frontend.
- `convex/auth.ts` — Better Auth server config. Exports `authComponent`, `createAuth`, `getCurrentUser`.
- `convex/http.ts` — HTTP router with auth routes.
- `convex/convex.config.ts` — Convex app config registering the Better Auth component.
- `convex/_generated/` — Auto-generated types and API. Never edit these.
- `.env.local` — Contains `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`.

## Code Style

Biome handles all linting and formatting. Key settings:
- **Spaces** for indentation, **double quotes**, line width **80**
- Organize imports enabled
- `routeTree.gen.ts` and `convex/_generated` are excluded from linting

## Vite Plugin Order

In `vite.config.ts`, the TanStack Router plugin **must** come before the React plugin.

## Path Aliases

- `@` maps to `./src` — use `@/components/...`, `@/lib/...`, etc.
- `@convex` maps to `./convex` — use `@convex/_generated/...`, etc.
