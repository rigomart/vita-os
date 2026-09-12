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

The Vite application uses Cloudflare's Vite plugin and is configured for
deployment as static assets on Cloudflare Workers. Its input configuration lives
in `apps/web/wrangler.jsonc`; unmatched navigation requests fall back to
`index.html` so client-side routes also work when loaded directly. The plugin
creates the deployable Worker configuration as part of `vite build`.

For a manual preview or deployment, first provide the two `VITE_CONVEX_*`
variables in your shell, then run from `apps/web`:

```bash
bun run build
bun run preview
bun run deploy
```

For Cloudflare Workers Builds, use the repository root so Bun installs the root
lockfile and resolves workspace packages consistently:

- Root directory: `/`
- Build command: `bunx turbo run build --filter=@vita-os/web`
- Production deploy command: `bun run --cwd apps/web deploy:built`
- Non-production deploy command: `bun run --cwd apps/web deploy:preview:built`
- Build variables: `BUN_VERSION=1.3.14`, `VITE_CONVEX_URL`, and
  `VITE_CONVEX_SITE_URL`

The Vite variables are build-time settings, not Worker runtime variables.
Cloudflare preview URLs use a different browser origin and are not included in
Better Auth's production `SITE_URL`; use them for unauthenticated deployment
checks unless that preview origin is deliberately trusted.

Keep the Vercel project and `apps/web/vercel.json` active while validating the
Worker. Before production cutover, attach the final hostname to the Worker. If
that changes the browser origin, update Convex's `SITE_URL` to the exact new
origin; OAuth callback URLs remain on the Convex site. Verify sign-in, social
authentication, sign-out, and direct loading of an authenticated deep link,
then switch traffic. Remove the Vercel project and configuration only after the
rollback window has passed.

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
