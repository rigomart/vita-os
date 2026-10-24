---
name: verify-vita-os
description: Prove a user-visible Vita OS web change in the real app by driving it with agent-browser on an isolated local stack (own ports, own D1) as a throwaway user, checking exact values on screen and in D1. Use before a PR, to reproduce a web bug in the browser, or to re-verify a feature. Covers the web app only; the Electron desktop app is not covered.
---

# Verify Vita OS

Proof is driving the change in the real web app on an isolated instance, the way a person does, and checking exact values: what the screen shows right after each action, the API's answer to each write, and what D1 stored. [`features/`](features/README.md) says what to prove about each feature; nothing saves how. Work out the steps from the screen every time.

Three commands, all from the repo root:

- `bun run verify up --instance <name>` starts or reuses an instance and prints its `webUrl`, `session`, `evidenceDir` and `logsDir`. `bun run verify --help` lists the rest (`doctor`, `env`, `d1`, `down`). Every command prints one JSON object; on `{"ok":false}` follow its `hint`.
- `agent-browser --session <session> <command>` drives the instance's own browser, with `<session>` taken from the `session` field of `up` or `env`. Its usage guide: `agent-browser skills get core`. If `agent-browser --version` fails, stop and ask the user to install it.
- `bun run verify d1 "<SELECT>" --instance <name>` reads the instance's D1. One SELECT per call, one call at a time.

## Isolation

Pick an instance name for your task (lowercase, digits, dashes, such as `notes-repeat`) and pass `--instance <name>` to every `verify` command and `--session <session>` to every agent-browser command (or `export AGENT_BROWSER_SESSION="$(bun run verify env --instance <name> | jq -r .session)"` at the start of each shell call; it does not carry over between calls). Take `session` from `up` or `env`; do not build it from the instance name, because it also names the checkout. An instance owns its ports (web from 5180, API from 8790), its D1 and logs under `.verify/instances/<name>/`, its evidence under `.verify/evidence/<name>/<run>/`, and its browser session. Another agent in this checkout uses another name.

Drive only an instance you started with `verify up`. Never drive `bun run dev` (:5173), the design lab (:5174) or the owner's account (`dev@vita.test`).

Vite and wrangler serve the working tree, so code edits show up without restarting (Vite hot-reloads the page), and a commit changes nothing. Switching branches does: `up` refuses an instance from another branch and prints the `down --purge` and `up` to run.

## Users and test data

Sign up a throwaway user through the form at `<webUrl>/sign-up` (Name, Email, Password, then `Sign Up`; it lands on `/`). Pick a stamp once per verification, such as the last six digits of `date +%s`, and put it in the email (`verify-<stamp>@vita.test`), the password and every text you create, so no check matches another run's rows. A new user's Dashboard is empty ("Nothing is asking for you."); assume nothing else.

Other users share the instance's D1, so scope every query to yours. Product tables use `user_id`; the auth tables (`user`, `session`, `account`) use camelCase (`userId`). Table and column names are in `apps/api/migrations`.

```bash
bun run verify d1 "SELECT title, state FROM threads WHERE user_id = (SELECT id FROM user WHERE email = 'verify-807602@vita.test')" --instance gen
```

To start signed out, use a session you have not signed in on, or `cookies clear` and reload.

## Prove a change

1. `bun run verify up --instance <name>`, then `bun run verify doctor --instance <name>`.
2. Read the feature files the change touches in `features/`.
3. `open` the app, then `set viewport 1440 900` (the default, 1280×577, sits on a layout boundary), sign up, and drive the new behavior on every entry point and width it touched, checking right after each action.
4. Rerun the checks of each touched feature file.
5. If the behavior changed on purpose, update those feature files in the same change; a new feature gets a file and a row in `features/README.md`.
6. Report (see Proof standards), then tear down: `bun run verify down --purge --instance <name>`.

## Re-verify a feature

Run steps 1 and 3 of Prove a change (instance, doctor, viewport, a new user). Then drive every numbered check in the file, on each entry point and width it lists, proving each write as in Driving (request status, then reload), and report each check by number with the values you observed: pass, fail, or `INCONCLUSIVE` with the step that could not run. Name any listed entry point no check reached. Tear down as in step 6.

## Driving

- **One action, then look.** After each action take a fresh `snapshot -i` and use refs only from it. Do not send long `batch` runs and rerun them from the top; fix and retry the step that failed.
- **Locate by role and name**: refs from the snapshot, `find role button click --name "New thread"`, `find label "Email" fill "…"`. The app has no `data-testid`. Use CSS only for these hooks: `[data-slot=thread-detail-pane]` (the side pane), `[data-vaul-drawer]` (the drawer), `[data-when-picker]` (the date picker), `nav[aria-label=Actions]` (the bottom bar), `[aria-label='…']` to wait for a control, and `main section[aria-label='<group>']` for a Dashboard group.
- **Wait on conditions**: `wait "<css>"`, `wait --fn "<expression>"`, `wait --text "<visible text>"`. `wait <ms>` is never proof, and neither is `wait --text`, which is a case-sensitive substring. A wait for something to go passes at once if it was never there: confirm it is present first (`get count "<css>"`), then act, then wait for it to go.
- **Check exact values**: `get text`, `get value`, `is enabled`, `is visible`, and `eval` returning JSON, compared in full. Read focus straight after the action: `eval "document.activeElement.getAttribute('aria-label')"`.
- **Prove a write**: `network requests --clear` before the action, `network requests --filter <path>` after it, and check the method and the status. Each write also prints a CORS preflight line (`OPTIONS … (Other) 204`) before it; read the `POST`/`PUT`/`PATCH`/`DELETE` line. A line with no status is still pending: look again before reloading. Then `reload`, wait for something visible, and check the screen.
- **Evidence**: `screenshot <evidenceDir>/<feature>-<step>.png`, one right after the action and one after the reload. `evidenceDir` comes from `up` or `env`; its run folder is named in UTC, so it can carry tomorrow's date in the evening. For a sequence (focus moving, a drawer sliding), `record start <evidenceDir>/<name>.webm` and `record stop`, but only after its checks have passed without recording, then relaunch the session (see the `record start` trap).

Worked example, run as written (a Task added in the Thread pane keeps the box focused and empty, and is stored once):

```bash
bun run verify up --instance gen
export AGENT_BROWSER_SESSION="$(bun run verify env --instance gen | jq -r .session)"
WEB=$(bun run verify env --instance gen | jq -r .webUrl)
EVIDENCE=$(bun run verify env --instance gen | jq -r .evidenceDir)
agent-browser open "$WEB/sign-up"
agent-browser set viewport 1440 900
agent-browser eval "innerWidth"                         # 1440
agent-browser wait --text "Create a new account"
agent-browser find label "Name" fill "Verify 807602"
agent-browser find label "Email" fill "verify-807602@vita.test"
agent-browser find label "Password" fill "verify-pass-807602"
agent-browser find role button click --name "Sign Up"
agent-browser wait "[aria-label='New thread']"
agent-browser find role button click --name "New thread"
agent-browser wait "[aria-label='Thread title']"
agent-browser find label "Thread title" fill "Renew passport 807602"
agent-browser find role button click --name "Create"
agent-browser wait "[data-slot=thread-detail-pane] [aria-label='Add a task']"
agent-browser network requests --clear
agent-browser find label "Add a task" fill "Book photo appointment 807602"
agent-browser press Enter
agent-browser eval "JSON.stringify({focus: document.activeElement.getAttribute('aria-label'), value: document.activeElement.value})"
#   {"focus":"Add a task","value":""}
agent-browser network requests --filter /tasks          # POST …/v1/threads/<id>/tasks (Fetch) 200
agent-browser screenshot "$EVIDENCE/tasks-added.png"
bun run verify d1 "SELECT moves_json FROM threads WHERE user_id = (SELECT id FROM user WHERE email = 'verify-807602@vita.test')" --instance gen
#   [{"moves_json":"[{\"id\":\"…\",\"text\":\"Book photo appointment 807602\"}]"}]
```

Use your own stamp in place of `807602`: an email can sign up only once per instance.

### Layouts

Each of these swaps components, not only styles, so each is its own path:

| Width | Thread pane | Header actions | Tell it from |
| --- | --- | --- | --- |
| 1280 and wider | side pane (`aside`) | in the header | `[data-slot=thread-detail-pane]` exists |
| 1024 to 1279 | drawer (`role=dialog`) | in the header | `[data-vaul-drawer]` exists, no `thread-detail-pane` |
| below 1024 (`lg`) | drawer | bottom `nav[aria-label=Actions]`; `No date` leads the list, folded | `is visible "nav[aria-label=Actions]"` is `true` |

The bottom bar is in the page at every width, hidden from 1024px: check `is visible`, never whether it exists. `snapshot -i` does not print the `complementary` or `dialog` role, so read the layout with `eval "JSON.stringify({pane: !!document.querySelector('[data-slot=thread-detail-pane]'), drawer: !!document.querySelector('[data-vaul-drawer]')})"`. Drive a Thread pane change at 1440×900 and 1024×768; a Dashboard or chrome change also at 390×844.

## Proof standards

- Drive the real user path. Never call the API in place of the user (no `fetch` in `eval`, no `curl` to the API), never click or set values through `eval`, never write to D1. Arranging a precondition through the UI, such as signing up or creating a Thread, is fine; producing the behavior under test another way is not.
- Check right after each action, not only at the end: focus, a disabled control, a cleared box can be lost and restored before the final screen.
- Vita updates optimistically: the screen changes before the API answers. Prove a write by its request's status, then reload and check what the server returned.
- Query D1 only for what the screen cannot show: no duplicates (`COUNT(*)` is exactly 1), an exact stored value (a date's epoch milliseconds, Markdown source), a real deletion, a session row. Scope each query to your user and compare whole rows, never a substring. Do not restate in SQL what the reloaded screen shows.
- Drive every path the change touched: each entry point (header button, palette, Dashboard line, Thread pane) and each layout above. Name any path you changed but did not drive.
- The report carries what was driven, since none of it is in the diff: each check by number or by what it proved, the entry points and widths, the exact values observed, and the screenshot paths.
- An entry point you could not reach is reported with the step you attempted and the unmet precondition, never as verified through another path.
- A check that could not run is `INCONCLUSIVE`, never a pass. If the same step fails twice, stop that item, report it `INCONCLUSIVE` with the step and its output, and move on.
- Before calling something an app bug or writing a rule about the app, reproduce it a second way: another input method (click instead of Enter), or the stored rows. A tool's bug is not app behavior.

## Doctor and cleanup

```bash
bun run verify doctor --instance <name>        # read-only; run it first whenever anything looks off
bun run verify down --purge --instance <name>  # stop the instance, close its browser session, delete its D1
```

`down` signals only the process groups this instance started and closes the instance's browser session (its `session`). Evidence under `.verify/evidence/<name>/` and logs under `.verify/instances/<name>/logs/` (`migrate.log`, `api.log`, `web.log`) survive `down` and `--purge`. `branchMatches: false` from `doctor` means you switched branches since `up`: `down --purge`, then `up`. Run `down --purge` after a failed attempt too, so nothing strands ports.

## Gotchas

App traps:

- **The date picker** (`[data-when-picker]`, in the page only while open) is a calendar with, beside it, the When (`No date`, or `Sat, Oct 24` and `Clear date`), a `Time` field (three spinbuttons in a snapshot) over `9 AM` `12 PM` `3 PM` `6 PM`, and the Repeat as one word each, `Daily` to `Custom`, named in full (`Every day`, `Every Saturday`, `Every month on the 24th`, `Custom repeat`). Time and Repeat are disabled until there is a date. Day buttons are named in full (`Saturday, October 24th, 2026`; today reads `Today, Friday, October 23rd, 2026`; the picked day adds `, selected`). Pick days relative to today, in the browser's time zone. On a Task row it stays open after a day is picked; on a Dashboard line and in New note it closes by itself. Below 768px it is a drawer of its own, a second `[data-vaul-drawer]`. To close it, confirm `get count "[data-when-picker]"` is `1`, `press Escape`, then `wait --fn "!document.querySelector('[data-when-picker]')"`; Escape closes only the picker and focus returns to its button.
- **Stored dates** are epoch milliseconds of local midnight when there is no time: tomorrow is `new Date(y, m, d + 1).getTime()` in the browser. A Thread's Tasks are JSON in `threads.moves_json` (`null` once the last one is completed); a Note's Follow-up date is `notes.attention_date`; Archived is `state = 'done'`.
- **Hidden duplicates.** Below 1024px the header's `New note` and `New thread` stay in the page, hidden, so `wait "[aria-label='New note']"` times out on a phone. Wait on `nav[aria-label=Actions]` there and act on refs from `snapshot -i`.
- **Drawers and the pane slide.** Their content is on the page before they stop, and a click during the slide can land outside and close them. Wait first: `wait --fn "document.querySelector('[data-vaul-drawer]')?.getAnimations().length === 0"`. On a phone the New thread form is a drawer too. The side pane slides in for about 0.2 s and a click inside it meanwhile lands on the board; wait with `wait --fn "(p => p && p.getAnimations().length === 0 && Math.round(p.getBoundingClientRect().right) === innerWidth)(document.querySelector('[data-slot=thread-detail-pane]'))"`.
- **Overlays.** From 1280px an open Thread pane covers the header's actions: close it (`Close thread`) or use the palette (`Search, Command K`). The `Open TanStack Router Devtools` button floats in a corner in dev; leave it alone.
- **Wait for the control, not the address.** After Sign Up or Sign In the path is `/` before the Dashboard renders, and a `find` then sees only the devtools button: wait on `[aria-label='New thread']`. The sign-in and sign-up boxes are named by a `<label>`, not `aria-label`, so `wait "[aria-label=Email]"` never matches; wait on `--text "Create a new account"` or `--text "Sign in to your account"`.
- **The Note editor** (`textbox "Note body"`) is CodeMirror and loads after the dialog: `wait "[aria-label='Note body']"` before `fill`. Saved Notes are buttons named `Open note: <first line>`.
- **Toasts** (`Note added`) are transient and an earlier one may still be up; never the only proof of a write. Task, date and Repeat commands raise none.
- **Undo offers.** Delete note and Add to thread write only after a five-second `Undo` offer: wait for `Undo` to be gone before a reload or a D1 check.
- **Dashboard lines.** A Thread line's link holds only the title; read the whole line from its `li` (`Task: | Pay the fee 807602 · Renew passport 807602` after joining lines, where `Task:` is screen-reader text).
- **Origins.** Use `localhost`, never `127.0.0.1`: CORS allows exactly `http://localhost:<webPort>`.
- **Auth.** `Continue with GitHub` and `Continue with Google` have no local credentials; do not click them. Opening a product route signed out lands on `/sign-in` without the original address.
- **D1 reads** run one at a time per instance; concurrent `verify d1` calls fail with "internal error".

agent-browser traps:

- **`wait --url "<url>"` without a glob matches any URL that starts with it**: `wait --url "http://localhost:5180/"` returns at once on `/sign-up`. Use `wait --fn "location.pathname === '/'"`.
- **`wait --text` reads visible text only**, not labels or placeholders: `wait --text "Add a task"` times out beside the `Add a task` box. Use `wait "[aria-label='Add a task']"`.
- **`snapshot -s <selector>` can print a subtree several times**, for any selector (it did for `[data-when-picker]`, `[data-slot=thread-detail-pane]` and `[aria-label='Thread attention']`). Read order and counts from `eval` or D1.
- **`keyboard type` moves focus back into the last-used input** when focus is on the page body, hiding lost focus. Check `document.activeElement` before typing the next input.
- **`press <letter>` or `keyboard type` with focus on the page body can get stuck repeating keys**; `reload` stops it. Where focus may be lost, use `keyboard inserttext`.
- **`close` on a session that is not running starts it first**, and `session list` still shows a closed session for a moment. `verify down` closes the instance's `session` only when it is listed; do not close it again by hand. To confirm it is gone, run `agent-browser session list` a second time a few seconds after `down`.
- **The session can reset to `about:blank` and lose its sign-in**, sometimes printing `[agent-browser] relaunched browser`, mostly in fast loops. When a step surprises you, `get url`; if it is `about:blank`, open the app, sign in again and set the viewport.
- **`set viewport` right after the browser launches may not stick.** Set it after `open` and confirm with `eval "innerWidth"`.
- **`mouse wheel` fires at (0,0) whatever `mouse move` set** (agent-browser 0.38.1), so nothing under the pointer scrolls, and `scroll` only sets `scrollTop` without a wheel or touch event. To scroll the way a person does, use CDP from a short script outside the repo: connect to `agent-browser get cdp-url`, `Target.getTargets`, `Target.attachToTarget` the page with `flatten: true`, then send with its `sessionId` `Input.dispatchMouseEvent` (`type: "mouseWheel"`, `x`, `y`, `deltaY`) or `Input.synthesizeScrollGesture` (`x`, `y`, `yDistance` negative to scroll down, `gestureSourceType: "touch"`) at a point inside the container (check it with `document.elementFromPoint(x, y)`).
- **A local save answers in milliseconds**, so behavior while a write is in flight needs a slow network: through the same CDP connection, `Network.enable` and `Network.emulateNetworkConditions` (`latency: 3000`, throughputs `-1`). It stays on after the script disconnects; send it again with `latency: 0` before a reload.
- **`record start` can leave `document.visibilityState` `"hidden"`**, even after `record stop`, and slide transitions then stall. Do not record timing-sensitive steps, and relaunch the session (`close`, then `open`) after recording.
- **Enter does commit a Task edit.** It once looked broken under agent-browser and became a "never press Enter" rule; the app sends exactly one write. Reproduce a second way before writing such a rule.
