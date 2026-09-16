# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Environment

Client variables live in `apps/web/.env.local`. Copy `apps/web/.env.example` to start; `bunx convex dev` writes `VITE_CONVEX_URL` (and `CONVEX_DEPLOYMENT`) for you, while `VITE_CONVEX_SITE_URL` is set by hand — the same host with a `.site` TLD:

- `VITE_CONVEX_URL` — Convex deployment URL (`…convex.cloud`), used by the Convex React client.
- `VITE_CONVEX_SITE_URL` — Convex site URL (`…convex.site`), used as the Better Auth client `baseURL`.

Backend variables live in the Convex deployment, not in any file. Set each with `npx convex env set <NAME> <value>`:

- `SITE_URL` — the web app's origin; used for Better Auth trusted origins and cross-domain cookies.
- `CONVEX_SITE_URL` — the Convex site URL (`…convex.site`); Better Auth's server `baseURL`. Convex provides this automatically; you only set it manually if you override it.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth app credentials.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth client credentials.

Missing variables throw at startup naming the variable, on both the client and the Convex backend.

## Web deployment

The Vite application deploys as static assets on Cloudflare Workers, through
GitHub Actions. Unmatched navigation requests fall back to `index.html` so
client-side routes work when loaded directly.

`apps/web/wrangler.jsonc` defines three environments. The Cloudflare Vite plugin
flattens the one named by `CLOUDFLARE_ENV` into `dist/wrangler.json` during
`vite build`, and wrangler deploys that file — `wrangler deploy --env` has no
effect. Only `production` carries the `vita.rigos.dev` custom domain.

| Environment | Worker | Serves |
| --- | --- | --- |
| `staging` | `vita-os-web-staging` | workers.dev, deployed on every push to `main` |
| `preview` | `vita-os-web-preview` | workers.dev, for pre-cutover qualification |
| `production` | `vita-os-web` | `vita.rigos.dev`, deployed only on demand |

### Pipelines

- **CI** (`ci.yml`) verifies pull requests.
- **Deploy staging** (`deploy-staging.yml`) verifies and deploys staging on every
  push to `main`.
- **Deploy production** (`deploy-production.yml`) is `workflow_dispatch` only.
  Its `deployment_target` input chooses `worker-origin` (deploys the `preview`
  Worker on workers.dev) or `public-domain` (deploys `production` on
  `vita.rigos.dev`). Qualify on `worker-origin` first.

All three run the same checks through the reusable `verify.yml`. Each deploy
asserts the built Worker name and custom domain before uploading, then smoke
tests the origin and uploads the log as a run artifact.

Required repository secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
Required variables: `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`,
`WORKERS_DEV_SUBDOMAIN`. Set `VITE_CONVEX_URL_NONPROD` and
`VITE_CONVEX_SITE_URL_NONPROD` to point staging at a non-production Convex
deployment; without them staging reads production data and the run warns.

Add required reviewers to the `production` GitHub environment to gate the public
domain behind an approval.

### Deploying by hand

Only for emergencies — the pipelines are the supported path. Provide the two
`VITE_CONVEX_*` variables, then from `apps/web`:

```bash
bun run deploy:staging
bun run deploy:production
bun run smoke https://vita.rigos.dev
```

### Rollback

`bunx wrangler rollback --name vita-os-web` returns the Worker to its previous
version. The Vercel project and `apps/web/vercel.json` stay active as a second
rollback path; remove them only after the Worker deployment has been trusted for
a full rollback window.

The `VITE_CONVEX_*` values are build-time settings, not Worker runtime
variables. workers.dev origins are not in Better Auth's `SITE_URL`, so staging
and preview are for unauthenticated checks unless that origin is deliberately
trusted. If the production hostname ever changes, update Convex's `SITE_URL` to
the exact new origin; OAuth callback URLs remain on the Convex site.

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
