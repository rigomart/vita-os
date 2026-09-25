# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Environment

The API Worker and the browser host are described here. See
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

Missing variables throw at startup naming the variable, on the client and on the API.

## Deployment

Each environment is a web Worker and an API Worker with its own D1 database, on
sibling `rigos.dev` hostnames so Better Auth's session cookie reaches the API.
`apps/web/wrangler.jsonc` and `apps/api/wrangler.jsonc` define them.

| Environment | Web | API and D1 | Deployed by |
| --- | --- | --- | --- |
| `staging` | `vita-os-web-staging` at `vita-staging.rigos.dev` | `vita-os-api-staging` at `vita-api-staging.rigos.dev`, D1 `vita-os-staging` | `deploy-staging.yml`, on every push to `main` or by hand |
| `production` | `vita-os-web` at `vita.rigos.dev` | `vita-os-api` at `vita-api.rigos.dev`, D1 `vita-os-production` | `deploy-production.yml`, by hand only |

The Vite plugin flattens the web environment named by `CLOUDFLARE_ENV` into
`dist/wrangler.json` at build time and wrangler deploys that file, so
`wrangler deploy --env` has no effect on the web Worker. `build:staging` and
`build:production` pin `VITE_API_BASE_URL` to their API. The API Worker deploys
with `wrangler deploy --env <name>`.

Each deploy asserts both Workers' names, hostnames, D1 binding, and auth
origins, applies D1 migrations, deploys the API, smoke tests it, and only then
deploys and smoke tests the web. Production also records the web version it
replaces in the run summary. Pull requests run `ci.yml`, and every pipeline
shares the checks in `verify.yml`. Add required reviewers to the `production`
GitHub environment to gate production behind an approval.

Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. The API Workers'
secrets are set with `wrangler secret put --env <name>`.

To roll back, find a version with `bunx wrangler versions list --name
vita-os-web` and run `bunx wrangler rollback <version-id> --name vita-os-web`.
Routes are not part of a version, so the hostname stays attached. The cutover,
its rollback, and retirement follow
[`docs/migrations/production-cutover.md`](docs/migrations/production-cutover.md).

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
