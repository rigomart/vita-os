---
name: verify-vita-os
description: Drive the real Vita OS web app locally, the way a user does, and capture proof that a change works. Launches an isolated local stack (Hono API on wrangler dev with its own D1, Vite web app), signs in a throwaway user through the real /sign-in form, and drives features with agent-browser. Use to verify any user-visible change, reproduce a bug in the browser, or prove a feature before opening a PR.
---

# Verify Vita OS

Everything goes through one CLI, `bun run verify <command>`, run from the repo root. Every command prints one JSON object: `{"ok":true,...}` or `{"ok":false,"error":...,"hint":...}`. Follow the `hint` on failure. `bun run verify --help` lists every command.

The examples below drive the default instance, `main`. When more than one agent may run in this checkout, add `--instance <name>` after the command on every call (`bun run verify up --instance a`) or prefix each command with `VITA_INSTANCE=a`.

Read [`features/README.md`](features/README.md) before driving. It maps each user-facing feature to its entry points, exact driving commands, and the end state that proves it.

## Launch

```bash
bun install                 # once per checkout
bun run verify up           # a few seconds warm, up to ~40s cold
```

`up` migrates a private local D1, starts the API (`wrangler dev`) and the web app (`vite --strictPort`), waits until the API answers `/api/auth/ok` and the web serves the app shell, then signs up a throwaway user through `POST /api/auth/sign-up/email`. It prints the web and API URLs, the user's credentials, the browser session name, and the evidence directory. It needs no `.dev.vars` or `VITE_API_BASE_URL`: it passes them per instance. Re-running `up` on a healthy instance reuses it.

Then sign in through the real form:

```bash
bun run verify signin
```

`signin` opens `/sign-in`, fills `Email` and `Password`, clicks `Sign In`, waits for the dock (`nav[aria-label="Primary"]`), and confirms via `GET /api/auth/get-session` that the browser holds the throwaway user's session. The browser stays signed in for later commands. Capture the landing state with `bun run verify shot signin-after`.

**Isolation.** Each instance (`--instance <name>` or `VITA_INSTANCE`, default `main`) has its own ports (auto-picked from 8787/5173 upward), its own D1 under `.verify/instances/<name>/d1`, and its own agent-browser session. Two agents in one checkout use two instance names. Never drive a server or browser session this CLI did not start, including the developer's own `bun run dev`.

## Doctor

```bash
bun run verify doctor
```

Read-only. Checks both processes are alive, the API answers `/api/auth/ok` and rejects anonymous `/v1/areas` with 401, the web serves the shell, and the running build matches `HEAD`. Run it first whenever anything looks off. `buildMatchesHead: false` means you committed or switched branches since `up`: run `down` then `up`.

## Drive

Drive the browser with `bun run verify browser -- <agent-browser args>`. It injects this instance's session. Useful forms:

```bash
bun run verify open /                                   # navigate and wait for the app shell
bun run verify browser -- snapshot -i                   # interactive elements with @refs
bun run verify browser -- find role button click --name "New note" --exact
bun run verify browser -- find label "Note body" fill "text"
bun run verify browser -- wait --text "Note added"
bun run verify browser -- press Escape
```

Prefer accessible roles, labels, and visible text over CSS selectors. The app has no `data-testid` handles outside loading skeletons. Take a fresh `snapshot -i` after anything changes the page.

Read persisted state without touching the UI:

```bash
bun run verify d1 "SELECT body, state FROM notes"      # SELECT only, this instance's D1
```

## Evidence

```bash
bun run verify shot <label>     # <label>.aria.txt (accessibility snapshot) + <label>.png
```

Files land in `.verify/evidence/<instance>/<run>/` (printed by `up` and `env`). Proof standards:

- Drive the real user path. Never call internal setters, test-only endpoints, or write to D1 to fake a state.
- Capture the action and the resulting state, not only the final screen: `shot` before and after.
- Toasts are transient and may not appear in the `.aria.txt` snapshot. The proof of a toast is the `wait --text "<toast>"` output. For an image, run `shot` immediately after that wait.
- Vita updates optimistically. A new note or thread appears before the server confirms it. Prove a mutation with the server confirmation toast plus a reload and a read-only second view: the UI after reload and `verify d1`.
- A check you could not run is `INCONCLUSIVE`, never a pass.

## Cleanup

```bash
bun run verify down --dry-run   # show what would stop
bun run verify down             # stop this instance's processes, close its browser session
bun run verify down --purge     # also delete its local D1
```

`down` kills only the process groups this instance started and closes only its own browser session. Evidence under `.verify/evidence/` and launch logs under `.verify/instances/<name>/logs/` are never deleted by the CLI, even with `--purge`.

## Helpers

- `scripts/vita.ts` is the CLI behind `bun run verify`. `bun run verify --help` documents it. Logs for a failed launch are in `.verify/instances/<name>/logs/` (`migrate.log`, `api.log`, `web.log`).
- `bun run verify env` prints the instance's URLs, credentials, session name, and evidence directory.

## Gotchas

- On a Mac whose display is asleep or locked, Chrome stops producing frames and screenshots hang. The CLI launches every browser session with `--disable-frame-rate-limit` (via `AGENT_BROWSER_ARGS`), which avoids it. Launch args only apply when a session starts, so a session opened with plain `agent-browser` still hangs: close it, or run `bun run verify down` then `up`. Snapshots, `eval`, and `pdf` never need a frame.
- Saved notes render as editable textboxes (`Edit note body`), so their text is a field value, not page text. `wait --text "<note>"` does not find a saved note. Use `wait --fn "[...document.querySelectorAll('[aria-label=\"Edit note body\"]')].some(el => el.value === '<note>')"`.
- Use `localhost`, never `127.0.0.1`. CORS allows exactly the instance's `http://localhost:<webPort>` origin.
- "Continue with GitHub" and "Continue with Google" render but have no local credentials. Do not click them.
- Keep a desktop viewport. Below 768px the Notes panel becomes a drawer and the "Later" and "No date" columns start collapsed.
- The TanStack Router devtools toggle floats in a corner in dev. If a corner control will not click, check whether the toggle covers it.
