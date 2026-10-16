# @vita-os/desktop

Vita OS as an Electron app with its data in a SQLite file on the computer: no account, no network (ADR 0042). It renders the same product as the web app, over the local client from `@vita-os/local`.

- `src/main/`: the main process. It opens and migrates `vita.db` in the user-data folder, then serves the local `ApplicationClient` over one IPC channel (`vita:call`) and the built renderer from `app://vita/`. A migration or open failure shows an error dialog, then the app quits.
- `src/preload/`: exposes `window.vita.call(method, input)` and nothing else.
- `src/renderer/`: the product's route tree with a gate that lets everyone through, a `Viewer` with no sign-in, and no Sign out.

## Commands

Run from the repo root.

- `bun run dev:desktop`: Vite serves the renderer with hot reload and Electron opens on it. Changes to main or the preload need a restart. Dev data lives in `apps/desktop/.dev-user-data` (gitignored), never in the installed app's folder. It is not part of `bun run dev`, so that still opens no window.
- `bunx turbo run build --filter=@vita-os/desktop`: builds the renderer (Vite) into `dist/renderer`, main and the preload (`bun build`) into `dist/main` and `dist/preload`, and copies `apps/api/migrations` to `dist/migrations`. `bun run --cwd apps/desktop start` then runs the built app.
- `bun run package:desktop`: builds the app and packages it for this Mac's architecture (`scripts/package.ts`, with `@electron/packager` and macOS's `hdiutil`) into `apps/desktop/out/`: `Vita OS-darwin-<arch>/Vita OS.app` and `Vita OS-<version>-<arch>.dmg`. The app carries only `dist/` and the `@libsql/client` tree, including the native binding bun installed for this Mac. It is ad-hoc signed, not notarized.
- `bun run test:e2e:desktop [file]`: builds the app and drives it with Playwright (`apps/e2e/playwright.desktop.config.ts`), each test on a throwaway user-data folder. Examples are in `apps/e2e/tests/desktop/`; `packaged-app.spec.ts` packages the app and launches the `.app` itself.

`VITA_DESKTOP_USER_DATA` points the app at another user-data folder. If your shell sets `ELECTRON_RUN_AS_NODE` (some Electron-based editors do), unset it before running `electron` yourself; the dev script and the Playwright fixture already do.

## Install on macOS

Open the `.dmg` and drag Vita OS into Applications. Later builds install the same way, replacing the app.

The app is ad-hoc signed and not notarized. A copy you built and installed yourself opens normally. A copy that came from somewhere else (downloaded, AirDropped) is quarantined, and macOS refuses to open it the first time. Either:

- open it once, then go to System Settings → Privacy & Security, choose **Open Anyway** next to the message about Vita OS, and confirm; or
- clear the quarantine flag: `xattr -dr com.apple.quarantine "/Applications/Vita OS.app"`.

The data stays in `~/Library/Application Support/Vita OS/vita.db`, outside the app, so reinstalling or upgrading keeps it. A newer build applies its pending migrations on first launch and copies the file next to itself first. The folder is named after `productName` in `package.json`; renaming it would start the app on an empty database.
