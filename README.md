# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Environment

The replacement runs on its own API Worker; Convex still runs production until
cutover, so both sets of variables are described here. See
`docs/migrations/cloudflare-application.md`.

### The API Worker and the browser host

The browser needs one variable, in `apps/web/.env.local` (copy
`apps/web/.env.example`):

- `VITE_API_BASE_URL` — where `apps/api` is served. It answers Better Auth's
  browser routes at `/api/auth/*` and the application operations at `/v1/*`.

The Worker's own secrets live in `apps/api/.dev.vars` locally (copy
`apps/api/.dev.vars.example`) and in the Worker's secrets when deployed:

- `BETTER_AUTH_SECRET` — signs sessions.
- `BETTER_AUTH_URL` — the Worker's own public address.
- `BROWSER_ORIGIN` — the single origin allowed to make credentialed requests.

Run it locally with local D1:

```bash
bun run --filter=@vita-os/api migrate:local
bunx turbo run dev --filter=@vita-os/api
```

### Convex, while it still runs production

The browser no longer reads any Convex variable: `apps/web/convex` is kept as the
behavioral reference and as the deployment that serves production until cutover.
Its own variables live in the Convex deployment, not in any file. Set each with
`npx convex env set <NAME> <value>`:

- `SITE_URL` — the web app's origin; used for Better Auth trusted origins and cross-domain cookies.
- `CONVEX_SITE_URL` — the Convex site URL (`…convex.site`); Better Auth's server `baseURL`. Convex provides this automatically; you only set it manually if you override it.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth app credentials.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth client credentials.

Missing variables throw at startup naming the variable, on the client and on both backends.

## Web deployment

The Vite application deploys as static assets on Cloudflare Workers through
GitHub Actions. Unmatched navigation falls back to `index.html`.

`apps/web/wrangler.jsonc` defines three environments. The Vite plugin flattens
the one named by `CLOUDFLARE_ENV` into `dist/wrangler.json` at build time and
wrangler deploys that file, so `wrangler deploy --env` has no effect.

| Environment | Worker | Deployed by |
| --- | --- | --- |
| `staging` | `vita-os-web-staging` | `deploy-staging.yml`, on every push to `main` |
| `preview` | `vita-os-web-preview` | `deploy-production.yml` with `worker-origin` |
| `production` | `vita-os-web` | `deploy-production.yml` with `public-domain`, serving `vita.rigos.dev` |

Only `production` carries the custom domain, and it is `workflow_dispatch` only
— qualify on `worker-origin` first. Pull requests run `ci.yml`, and every
pipeline shares the checks in `verify.yml`. Each deploy asserts the built Worker
name and domain, smoke tests the origin, and uploads the log as a run artifact.

Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Variables:
`VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`, `WORKERS_DEV_SUBDOMAIN`, and
optionally `VITE_CONVEX_URL_NONPROD` / `VITE_CONVEX_SITE_URL_NONPROD` to point
staging at a non-production Convex deployment — without them staging reads
production data. Add required reviewers to the `production` GitHub environment
to gate the domain behind an approval.

For an emergency manual deploy, run `bun run deploy:staging`,
`deploy:production`, or `smoke <origin>` from `apps/web`. To roll back,
`bunx wrangler rollback --name vita-os-web`, which restores the previous Worker
version without touching DNS.

The `VITE_CONVEX_*` values are build-time, not Worker runtime, variables.
workers.dev origins are not in Better Auth's `SITE_URL`, so staging and preview
only support unauthenticated checks. If the production hostname changes, set
Convex's `SITE_URL` to the exact new origin; OAuth callbacks stay on the Convex
site.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Browser support

Production builds support Safari 16.4+, Chrome and Edge 111+, and Firefox 114+.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
