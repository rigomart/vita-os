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

## Driving it with agent-browser

Use an isolated checkout and restore all temporary settings afterward. Set local API top-level Wrangler vars APP_VERSION=proof-a and apps/web/.env.local VITE_APP_VERSION=proof-a. Start with the browser HMR connection disabled so Vite updates cannot imitate the product reload:

```bash
VITA_VERIFY_DISABLE_HMR=1 bun run verify up --instance reload-proof
bun run verify signin --instance reload-proof
bun run verify browser --instance reload-proof -- eval 'sessionStorage.setItem("versionProofOrigin",String(performance.timeOrigin));performance.timeOrigin'
```

Capture a Note named Reload proof saved note through New note and wait for Note added. Confirm storage with:

```bash
bun run verify d1 --instance reload-proof "SELECT COUNT(*) AS matching FROM notes WHERE body = 'Reload proof saved note'"
bun run verify shot --instance reload-proof version-equal-before
```

Change only the API version to proof-b and wait for Wrangler to restart. Trigger a real History read and verify the document is still the original:

```bash
bun run verify browser --instance reload-proof -- press Meta+k
bun run verify browser --instance reload-proof -- find role button click --name History --exact
bun run verify browser --instance reload-proof -- wait --text "No resolved threads or archived notes yet."
bun run verify browser --instance reload-proof -- eval 'performance.timeOrigin === Number(sessionStorage.getItem("versionProofOrigin"))'
bun run verify shot --instance reload-proof version-api-ahead
```

Escape, open the saved Note, choose More actions and Delete note, and wait for Note deleted. Immediately change the web environment version to proof-b. Once /version.json serves proof-b, verify that the original document and Undo remain visible, then wait for the actual reload:

```bash
bun run verify browser --instance reload-proof -- wait --fn 'performance.timeOrigin === Number(sessionStorage.getItem("versionProofOrigin")) && [...document.querySelectorAll("button")].some(x => x.textContent.trim() === "Undo")'
bun run verify shot --instance reload-proof version-save-pending
bun run verify browser --instance reload-proof -- wait --fn 'performance.timeOrigin !== Number(sessionStorage.getItem("versionProofOrigin"))'
bun run verify browser --instance reload-proof -- wait 'nav[aria-label="Primary"]'
bun run verify d1 --instance reload-proof "SELECT COUNT(*) AS remaining FROM notes WHERE body = 'Reload proof saved note'"
bun run verify shot --instance reload-proof version-reloaded-after-save
```

Expect remaining: 0. Capture a second Note through the real form and confirm its saved row to prove the application and session remain usable. Stop the instance with down --purge and restore Wrangler/environment settings.

## Gotchas

- VITE_APP_VERSION and APP_VERSION must match. Production workflows use the same GitHub SHA.
- Use VITA_VERIFY_DISABLE_HMR=1 only for this proof. It suppresses the browser HMR connection while retaining Vite environment-file restarts.
- An explicit verify open or browser reload also changes performance.timeOrigin; do not count that as an automatic reload.
- A first incompatible old-tab command may fail visibly before reload; it is not replayed.
- The tab waits while a save stays pending or the matching web build is unavailable.
