---
name: verify-vita-os
description: Drive the real Vita OS web app locally, the way a user does, and capture proof that a change works. Launches an isolated local stack (Hono HTTP API on wrangler dev with its own D1, Vite web app), signs in a throwaway user through the real /sign-in form, and drives features with agent-browser. Use to verify any user-visible change, reproduce a bug in the browser, or prove a feature before opening a PR.
---

# Verify Vita OS

Everything goes through one CLI, `bun run verify <command>`, run from the repo root. Every command prints one JSON object: `{"ok":true,...}` or `{"ok":false,"error":...,"hint":...}`. Follow the `hint` on failure. `bun run verify --help` lists every command.

The examples below drive the default instance, `main`. When more than one agent may run in this checkout, add `--instance <name>` after the command on every call (`bun run verify up --instance a`, `bun run verify run - --instance a`), before the `--` for `browser` (`bun run verify browser --instance a -- snapshot -i`), or prefix each command with `VITA_INSTANCE=a`.

Read [`features/README.md`](features/README.md) before driving. It maps each user-facing feature to its entry points, exact driving commands, and the end state that proves it.

## Launch

```bash
bun run verify up           # a few seconds warm, up to ~40s cold
bun run verify signin
```

`up` migrates a private local D1, starts the API (`wrangler dev`) and the web app (`vite --strictPort`), waits for both, then signs up a throwaway user. It prints the URLs, the credentials, and the evidence directory. Re-running `up` on a healthy instance reuses it. Vite serves the working tree with HMR, so code edits show up without restarting.

`signin` fills the real `/sign-in` form, pins a 1440×900 viewport, and confirms via `GET /api/auth/get-session` that the browser holds the throwaway user's session.

**Isolation.** Each instance has its own ports, its own D1 under `.verify/instances/<name>/d1`, and its own agent-browser session. Never drive a server or browser session this CLI did not start, including the developer's own `bun run dev`.

## Drive

Batch your steps. `bun run verify run -` reads steps from a heredoc, runs them in order, prints each step's output, and stops at the first failure:

```bash
bun run verify run - <<'EOF'
open /
browser -- find role button click --name "New note" --exact
see textbox "Note body"
browser -- keyboard type "Dentist on Friday ${STAMP}"
browser -- press Meta+Enter
see text "Note added"
gone dialog
browser -- reload
see button "Open note: Dentist on Friday ${STAMP}"
shot note-added
EOF
```

Each line is a `verify` subcommand, exactly as typed after `bun run verify`: `open <path>`, `browser -- <agent-browser args>`, `see`, `gone`, `settled`, `shot <label>`, `d1 "<SELECT>"`, `signin`, `doctor`. `expect <text>` fails unless the previous step's output contains `<text>`. `${STAMP}` becomes one timestamp per run, for unique text. `#` comments and blank lines are ignored. On failure it prints `failedLine`, the agent-browser error, the URL, and a `snapshot` file showing the page at that moment. Read that file before re-driving anything.

Single commands work too (`bun run verify browser -- snapshot -i`), but one call per step is slow and noisy. Never put a command in a shell variable (`V="bun run verify browser --"; $V ...`): zsh does not split it, so it fails with "command not found". Shell functions and variables do not persist between your calls either. Use `run -`.

**Acting.** Prefer accessible roles, labels, and visible text (`find role button click --name "Add" --exact`, `find label "Thread title" fill ...`) over CSS selectors. The app has no `data-testid` handles. `snapshot -i` lists interactive elements with `@e` refs. Scope it to what you are looking at with a CSS selector (`-s '[role=dialog]'`, `-s '[data-slot=thread-detail-pane]'`) instead of grepping the whole page. A scoped snapshot can list nested nodes twice; that is agent-browser, not the app. Take a fresh snapshot after anything changes the page.

**Checking and waiting.** Check what a person would see, in the words they would use, and wait for it rather than for time:

```
see button "Open note: Dentist on Friday"     # waits until the accessibility tree has it
see complementary "Dentist"                   # the side pane titled Dentist; the drawer is: see dialog "Dentist"
see text "3 tasks · none focused"             # visible text, even when it spans several elements
gone dialog                                   # waits until no dialog is left
gone button "Task A" --in '[data-slot=thread-detail-pane]'
see option "needle" --contains                # part of the name
```

`see` and `gone` read the accessibility tree, so hidden elements do not count. The role is the one `snapshot` prints (`button`, `link`, `textbox`, `dialog`, `alertdialog`, `complementary`, `region`, `list`, `group`, `option`, `menuitem`, `tab`, `heading`, `image`), and the name is exact unless you add `--contains`. `--in '<css>'` limits the check to part of the page. On failure, `see` lists the names that role has on the page. Put a `see` before a `gone` after a reload, so `gone` cannot pass on a page that has not loaded.

Use `browser -- wait --fn "<js>"` only for facts the tree does not hold: an input's value, which element has focus, a count, an order, the URL, a date computed from today. It must return a boolean (`!!document.querySelector(...)`, not the element).

**Animations.** Panes, drawers, dialogs, and pickers slide, and their content is on the page before they stop moving. A click during the slide lands on whatever is under that spot, or outside the drawer, which closes it. Before clicking inside a pane or drawer that just opened, run `settled '[data-slot=thread-detail-pane]'` (side pane) or `settled '[data-vaul-drawer]'` (drawer). After confirming a dialog, `gone alertdialog` or `gone dialog` before the next click. `fill` focuses instead of clicking at a position, so it is safe sooner.

**Reading storage.** `d1 "SELECT ..."` reads this instance's D1. Use it only for what the screen cannot show (see Evidence). Table and column names are in `apps/api/migrations`. A query is also a pause of about a second: removing one can expose a click that only worked because of it, which `settled` or `gone` fixes. `browser -- eval "<js>"` reads layout facts a snapshot cannot show (computed styles, sizes). Never use `eval` to click, set values, or call the API in place of the user.

## Flows

A flow is the same step syntax saved as `flows/<name>.flow`. It runs against the current instance with no model in the loop and takes seconds. Each flow's header comment says what it proves.

```bash
bun run verify run .claude/skills/verify-vita-os/flows/tasks.flow
bun run verify run .claude/skills/verify-vita-os/flows/*.flow    # the whole suite, about 3 minutes
```

A flow whose header says `Needs a fresh` instance (it counts rows in D1) gets `down --purge`, `up`, and `signin` before it runs, so flows can run in any order and in one call. With several files, `run` prints one line per flow and a summary listing each failure with its line, error, and page snapshot. Each step times out after 30 s (`--step-timeout <seconds>`).

When a change touches a feature that has a flow, run that flow. When you drive a new path by hand with `run -`, save the steps that worked as a flow. A flow proves what its lines assert. Mutations follow the rule below: a reload, then `see` or `gone`, not the optimistic UI alone. If a flow fails because the feature changed on purpose, fix the flow in the same change.

## Evidence

```bash
bun run verify shot <label>     # <label>.aria.txt (accessibility snapshot) + <label>.png
```

`shot` prints the PNG path. Read the PNG to look at it. Files land in `.verify/evidence/<instance>/<run>/`. Proof standards:

- Drive the real user path. Never call internal setters, test-only endpoints, or write to D1 to fake a state.
- Capture the action and the resulting state, not only the final screen: `shot` before and after.
- Drive every path your change touched. The Thread pane is a side pane at 1280px wide and up, and a drawer below that, built from different components. A change to Thread pane, layout, or navigation code gets a second run in the drawer: `browser -- set viewport 1024 768`, drive it, then `browser -- set viewport 1440 900`. The snapshot tells you which one you are in: the side pane is `complementary "<title>"` (`aside[data-slot=thread-detail-pane]`), the drawer is `dialog "<title>"`. Below 768px the dashboard columns and the filter row (a dropdown) change too. Name any path you changed but did not drive in your report.
- Toasts are transient and may not appear in the `.aria.txt` snapshot. The proof of a toast is the `wait --text "<toast>"` output. For an image, run `shot` right after that wait.
- Vita updates optimistically. A new note or thread appears before the server confirms it. Prove a mutation with the server confirmation toast, then `browser -- reload` and `see` or `gone`: after a reload the page shows what the server stored.
- Add a `d1` SELECT only for what the screen cannot show: no duplicate rows (`COUNT(*)` is exactly 1), an exact stored value (a time, Markdown source), a row really deleted rather than hidden, an Activity Log entry's stored content or count, sign-in sessions. Do not restate in SQL what the reloaded page already shows: it ties the check to the storage layout, which changes more often than the screen.
- A check you could not run is `INCONCLUSIVE`, never a pass.
- Time-limit verification. If the same step fails twice, stop that item, report it `INCONCLUSIVE` with the failing command and its output, and move on. Do not retry in a loop.

## Doctor and cleanup

```bash
bun run verify doctor           # read-only health check; run it first whenever anything looks off
bun run verify down --purge     # stop this instance, close its browser, delete its D1 (do this when your task is done)
```

`down` kills only the processes this instance started and closes only its own browser session. Evidence under `.verify/evidence/` and launch logs under `.verify/instances/<name>/logs/` (`migrate.log`, `api.log`, `web.log`) are never deleted. `buildMatchesHead: false` from `doctor` means you committed or switched branches since `up`. Vite still serves the working tree, so this only matters if you switched branches: then run `down` and `up`.

## Keeping the map current

The feature map is only as good as its last update, and you are the one who updates it. After driving the app, before you report:

- **The feature has no file in `features/`.** Explore its entry points with `snapshot -i`, find the table it writes in `apps/api/migrations`, and prove it once by the standards in [`features/README.md`](features/README.md). Then write `features/<feature>.md` in the entry contract (H1, one paragraph, `Status: proven on <short sha>`, the four H2s), using the exact commands that just worked, and add a line to the index in `features/README.md`. Commit it with the change that introduced or altered the feature.
- **A documented step no longer matches the app.** Decide which side is wrong. If the app regressed, report the regression and leave the file alone. If the feature changed on purpose, fix the file in the same change and say so in your report.
- **The file says `mapped from source, not yet driven`.** Correct every handle against a fresh snapshot while you drive it, then set `Status: proven on <short sha>`.
- **Never mark a step proven that you did not run.** A sub-feature you skipped stays listed, and your report says it was skipped.

## Gotchas

- **Landed on `/sign-in`.** The browser lost its cookies: agent-browser stops a session idle for an hour, and relaunches it whenever its environment changes. `open` fails fast with this message. Run `bun run verify signin` (same user, data kept) and carry on. Drive the browser only through `bun run verify`. A raw `agent-browser --session ...` call with different `AGENT_BROWSER_*` variables relaunches the browser and signs it out.
- **"Element is covered by …".** An open pane, drawer, dialog, or toast sits over the target. From 1280px an open Thread pane covers the header's actions. Close it (`find role button click --name "Close thread" --exact`, then `gone complementary "<title>"`) or use the palette (`press Meta+k`). The TanStack Router devtools toggle floats in a corner in dev and can cover a corner control.
- Never `press Enter` to commit an edit of an existing Task's text (an EditableField). On agent-browser 0.38.1 it starts a nonstop stream of keydown events, so whatever button has focus is activated over and over and floods the API. Commit the edit with `press Tab` or a click. `press Enter` in `Add a task` is fine: it is the capture path, and flows keep proving it.
- The Note editor (`Note body`) is CodeMirror and loads lazily. Wait for it with `see textbox "Note body"` before typing. `fill` inserts at the caret instead of replacing the text: to replace, click it, `press Meta+a`, then `keyboard type`. Saved Notes are preview buttons named `Open note: <plain-text preview>`.
- Native time inputs ignore `fill`. Focus the field and type it key by key (`press 3`, `press 3`, `press 0`, `press p` for 3:30 PM), then check its value with `wait --fn`.
- On a Mac whose display is asleep or locked, Chrome stops producing frames and screenshots hang. The CLI launches every browser session with `--disable-frame-rate-limit`, which avoids it. Snapshots, `eval`, and `pdf` never need a frame.
- Use `localhost`, never `127.0.0.1`. CORS allows exactly the instance's `http://localhost:<webPort>` origin.
- "Continue with GitHub" and "Continue with Google" render but have no local credentials. Do not click them.
- Keep a desktop viewport unless you are testing another width. Below 1024px (`lg`) the header's actions move to the bottom `navigation "Actions"` bar and `No date` leads the list folded to one line.
