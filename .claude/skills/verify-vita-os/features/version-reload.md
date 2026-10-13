# Reload an outdated tab

An open tab observes the API version on application and authentication responses. When it differs from the bundled web version, the tab waits for pending saves and the matching web build, then reloads.

Status: proven on cb47fdc (local API/web version change, pending deletion, persisted result, and usable application after reload).

## Sub-features

- Equal or absent versions leave a tab alone.
- An API deployed before its matching web build does not immediately reload the tab.
- The five-second Undo window and saved commands finish before reload.
- Reload preserves saved data and the browser session. Unsaved drafts may be lost.

## How to get to it (user POV)

Keep Vita OS open while a new version is deployed, then use any action that reads or writes the API. There is no separate user control.

## Driving it

No spec: the proof edits the local version settings while a test runs. Use an isolated checkout and restore all temporary settings afterward. Set local API top-level Wrangler vars APP_VERSION=proof-a and apps/web/.env.local VITE_APP_VERSION=proof-a. Start the instance with the browser HMR connection disabled, so Vite updates cannot imitate the product reload, then run a scratch spec against it:

```bash
VITA_VERIFY_DISABLE_HMR=1 bun run verify up --instance reload-proof
VITA_INSTANCE=reload-proof bun run test:e2e scratch/version-reload.spec.ts
```

The spec changes the versions itself between steps (`writeFileSync`) and restores them in a `finally`. Steps:

- Record the document: `const origin = await page.evaluate(() => performance.timeOrigin)`.
- Capture a Note `Reload proof saved note <stamp>` through New note and wait for `Note added`. `SELECT COUNT(*) AS matching FROM notes WHERE user_id = '${account.id}' AND body = '<body>'` reads 1. `shot("version-equal-before")`.
- Change only the API version to proof-b and wait for Wrangler to restart. Trigger a real History read (`ControlOrMeta+k`, `button "History"`, expect `No resolved threads or archived notes yet.`), check that `performance.timeOrigin` still equals `origin`, and `shot("version-api-ahead")`.
- Escape, open the saved Note, choose More actions → Delete note, and wait for `Note deleted`. At once change the web version to proof-b. Once `/version.json` serves proof-b, `performance.timeOrigin` still equals `origin` and `button "Undo"` is visible: `shot("version-save-pending")`.
- Wait for the real reload: `expect.poll(() => page.evaluate(() => performance.timeOrigin)).not.toBe(origin)`. Then `banner "Vita OS"` is visible, the D1 count reads 0, and `shot("version-reloaded-after-save")`.
- Capture a second Note through the real form and confirm its saved row, to prove the application and session remain usable. Afterwards run `bun run verify down --purge --instance reload-proof` and restore the Wrangler and environment settings.

## Gotchas

- VITE_APP_VERSION and APP_VERSION must match. Production workflows use the same GitHub SHA.
- Use VITA_VERIFY_DISABLE_HMR=1 only for this proof. It suppresses the browser HMR connection while retaining Vite environment-file restarts.
- An explicit `page.goto` or `page.reload()` also changes `performance.timeOrigin`; do not count that as an automatic reload.
- A first incompatible old-tab command may fail visibly before reload; it is not replayed.
- The tab waits while a save stays pending or the matching web build is unavailable.
