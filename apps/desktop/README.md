# @vita-os/desktop

Vita OS as an Electron app with its data in a SQLite file on the computer: no account, no network (ADR 0042). It renders the same product as the web app, over the local client from `@vita-os/local`.

- `src/main/`: the main process. It opens and migrates `vita.db` in the user-data folder, then serves the local `ApplicationClient` over one IPC channel (`vita:call`) and the built renderer from `app://vita/`. A migration or open failure shows an error dialog, then the app quits.
- `src/preload/`: exposes `window.vita.call(method, input)` and nothing else.
- `src/renderer/`: the product's route tree with a gate that lets everyone through, a `Viewer` with no sign-in, and no Sign out.

## Commands

Run from the repo root.

- `bun run dev:desktop`: Vite serves the renderer with hot reload and Electron opens on it. Changes to main or the preload need a restart. Dev data lives in `apps/desktop/.dev-user-data` (gitignored), never in the installed app's folder. It is not part of `bun run dev`, so that still opens no window.
- `bunx turbo run build --filter=@vita-os/desktop`: builds the renderer (Vite) into `dist/renderer`, main and the preload (`bun build`) into `dist/main` and `dist/preload`, and copies `apps/api/migrations` to `dist/migrations`. `bun run --cwd apps/desktop start` then runs the built app.
- `bun run test:e2e:desktop [file]`: builds the app and drives it with Playwright (`apps/e2e/playwright.desktop.config.ts`), each test on a throwaway user-data folder. Examples are in `apps/e2e/tests/desktop/`.

`VITA_DESKTOP_USER_DATA` points the app at another user-data folder. If your shell sets `ELECTRON_RUN_AS_NODE` (some Electron-based editors do), unset it before running `electron` yourself; the dev script and the Playwright fixture already do.

Packaging is not here yet (#474).
