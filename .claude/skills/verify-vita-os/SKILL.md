---
name: verify-vita-os
description: Prove a user-visible Vita OS change in the real app with Playwright e2e specs (apps/e2e), run against an isolated local stack with its own D1 as a throwaway user per spec file. Use to verify a change before a PR, run or add the spec for a feature you touched, reproduce a bug in the browser, or explore a feature with a throwaway spec.
---

# Verify Vita OS

Proof that a change works is a Playwright spec in `apps/e2e` that drives the real app the way a person does. Two commands, run from the repo root:

- `bun run test:e2e [file] [-g "<title>"] [--repeat-each N]` runs specs. It starts the instance first, or reuses a healthy one, and leaves it up. If it reports that `up` failed, `bun run verify doctor` names the check that failed.
- `bun run verify <command>` manages the stack alone: `up`, `doctor`, `env`, `d1 "<SELECT>"`, `down [--purge] [--dry-run]`. Each prints one JSON object, `{"ok":true,...}` or `{"ok":false,"error":...,"hint":...}`. Follow the `hint`. `bun run verify --help` lists them.

Specs run in the installed Google Chrome (`channel: "chrome"` in `apps/e2e/playwright.config.ts`). Without it, install it with `bunx playwright install chrome`.

Read [`features/README.md`](features/README.md) first. It maps each feature to its entry points, locators, covering spec, and the end state that proves it.

## Isolation

An instance has its own ports, D1, logs, and Playwright output under `.verify/instances/<name>/`. The default is `main`. When another agent may run in this checkout, name yours on every call: `VITA_INSTANCE=a bun run test:e2e …`, `bun run verify doctor --instance a`. Never drive a server this CLI did not start or the developer's account, including `bun run dev`.

Vite and the API serve the working tree, so code edits show up without restarting, and committing does not affect a running instance. Nothing needs a fresh instance.

## Users and test data

Each spec file runs as one throwaway user (`account`), and each `--repeat-each` repeat as another. The tests in a file share that user and run in order, so a later test sees what earlier tests created. When a test fails, Playwright restarts the worker and the rest of the file runs as a new user. So a test must not rely on data an earlier test created, nor on an empty board or History unless it is the file's first test.

Every test gets its own session, so signing out in one test leaves the next signed in. Other users share the instance's D1: scope every query to `account.id`.

## Run specs

```bash
bun run test:e2e tests/tasks.spec.ts                  # one feature
bun run test:e2e tests/tasks.spec.ts -g "complete"    # tests whose title matches
bun run test:e2e tests/tasks.spec.ts --repeat-each 5  # is it flaky?
bun run test:e2e                                      # every spec in apps/e2e/tests
```

When a change touches a feature, run its spec (the table in `features/README.md`). When it adds or changes a path, add or update a test in that spec, or write `tests/<feature>.spec.ts`. If a spec fails because the feature changed on purpose, fix the spec in the same change.

A failure prints the failing line, the locator it waited for, and `Error Context: …/error-context.md`: the page's ARIA snapshot at that moment, with the roles and names actually on screen. Read it before changing anything. The screenshot and trace sit beside it under `.verify/instances/<name>/playwright/results/`, the HTML report under `…/playwright/report/`.

## Explore with a scratch spec

To explore a feature, reproduce a bug, or prove a new path, write a throwaway spec in `apps/e2e/scratch/` (gitignored, not type-checked), run it, read the failure's `error-context.md`, and iterate. Once it proves something worth keeping, move it to `apps/e2e/tests/`.

```ts
// apps/e2e/scratch/try.spec.ts — run: bun run test:e2e scratch/try.spec.ts
import { expect, sent, test } from "../src/fixtures.ts";

test("a captured Note survives a reload", async ({ page, account, stamp, d1, shot }) => {
  const body = `Dentist on Friday ${stamp}`;
  await page.goto("/");
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page.getByRole("textbox", { name: "Note body" }).fill(body); // waits for the lazy editor
  await shot("note-before");
  await sent(page, /\/notes$/, () =>
    page.getByRole("dialog").getByRole("button", { name: "Add", exact: true }).click(),
  );
  await expect(page.getByText("Note added")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: `Open note: ${body}` })).toBeVisible();
  expect(await d1(`SELECT state FROM notes WHERE user_id = '${account.id}'`)).toEqual([{ state: "open" }]);
  await shot("note-after");
});
```

To see what a surface offers, print its ARIA snapshot: `console.log(await page.getByRole("dialog").ariaSnapshot())`.

The fixtures (`src/fixtures.ts`): `page` is signed in as the spec file's user at 1440×900 and blank until you call `page.goto("/")`; `account` is `{ id, email, password }`; `stamp` is unique text per test; `d1` runs one read-only SELECT; `shot` saves a PNG; `instance` holds the URLs (`webUrl`, `apiUrl`). `sent` and `settled` come from `src/fixtures.ts`. To start signed out, `test.use({ storageState: { cookies: [], origins: [] } })`.

`src/app.ts` holds the actions specs share, for Threads, Tasks, the date picker, Notes, the palette, and D1 subqueries. Read it before writing your own. For example, `createThread(page, title)` creates a Thread through the New thread dialog, waits for the server write and the `Thread created` toast, and returns the Thread's side pane or drawer once it has stopped sliding; `addTask(pane, text)` and `taskRow(pane, text)` add and find a Task in it.

## Driving

- Locate by role and accessible name, label, or visible text: `getByRole("button", { name: "Add", exact: true })`, `getByLabel("Thread title")`. Use `exact: true` whenever another control's name contains this one. The app has no `data-testid`.
- Narrow by chaining from a container (`pane.getByRole(…)`, `taskRow(pane, text)`, `page.getByRole("listitem").filter({ has: … })`), not with XPath. Use CSS only for `data-slot` hooks no role reaches (`[data-slot=thread-detail-pane]`, `[data-vaul-drawer]`, `[data-slot=popover-content]`).
- Wait with web-first assertions (`toBeVisible`, `toBeHidden`, `toHaveCount`, `toHaveValue`, `toHaveURL`). For a fact no locator holds (an order, a URL query, a date computed from today, a computed style, focus across a reload), use `expect.poll`. `waitForTimeout` is never proof.
- After a reload, assert something visible before asserting something hidden, so `toBeHidden` cannot pass on a page that has not rendered yet.
- Put `stamp` in every text you create, so a check cannot match another test's rows.

## Proof standards

- Drive the real user path. Never call internal setters, test-only endpoints, or the API in place of the user (a `page.request` write, a `page.evaluate` that clicks or sets values), and never write to D1 to fake a state.
- Capture the action and the result, not only the final screen: `shot("<feature>-before")` and `shot("<feature>-after")`. `shot` saves `<label>.png` to `.verify/evidence/<instance>/<started>/<spec>/`, attaches it to the HTML report, and returns the path. Read the PNG to look at it. `<started>` is fixed when the instance comes up, not per run, so a later run or `--repeat-each` repeat overwrites the same `<label>.png`; the copy attached to the HTML report belongs to its own run.
- Vita updates optimistically: a new Note or Thread appears before the server confirms it. Prove a mutation by wrapping its action in `sent(page, /<path>$/, action)`, which waits for the write's response and asserts it succeeded, then `page.reload()` and assert what the server stored.
- Query D1 only for what the screen cannot show: no duplicate rows (`COUNT(*)` is exactly 1), an exact stored value (a time, Markdown source), a row really deleted rather than hidden, an Activity Log entry's stored content or count, sessions. Scope every query to `account.id` and assert exact typed rows (`toEqual([{ n: 1 }])`). Do not restate in SQL what the reloaded page shows: that ties the spec to the storage layout, which changes more often than the screen. Table and column names are in `apps/api/migrations`.
- Drive every path your change touched. The Thread pane is a side pane from 1280px (`complementary "<title>"`) and a drawer below (`dialog "<title>"`), built from different components. A change to Thread pane, layout, or navigation code gets a test at `page.setViewportSize({ width: 1024, height: 768 })` too. A change to the Dashboard or the chrome gets one below 768px (`390×844`). Name any path you changed but did not drive in your report.
- Report the feature ID and entry point with every artifact. Report an unreachable entry point with the step you attempted and the unmet precondition; do not report it as verified through a different path.
- A check you could not run is `INCONCLUSIVE`, never a pass.
- Time-limit verification. If the same step fails twice, stop that item, report it `INCONCLUSIVE` with the failing step and its error context, and move on. Do not retry in a loop.

After driving, update the feature map as [Keeping the map current](features/README.md#keeping-the-map-current) says.

## Doctor and cleanup

```bash
bun run verify doctor          # read-only health check; run it first whenever anything looks off
bun run verify down --purge    # stop this instance and delete its D1 (do this when your task is done)
```

`down` stops only the processes this instance started. Evidence under `.verify/evidence/` and logs under `.verify/instances/<name>/logs/` (`migrate.log`, `api.log`, `web.log`) are kept. `branchMatches: false` from `doctor` means you switched branches since `up`, and the other branch may need other migrations: run `down --purge`, then `up`.

## Gotchas

- **Animations.** Panes, drawers, dialogs, and pickers slide, and their content is on the page before they stop moving. A click during the slide lands on whatever is under that spot, or outside the drawer, which closes it. Before clicking inside one that just opened, `await settled(page.locator("[data-slot=thread-detail-pane]"))` (side pane) or `settled(page.locator("[data-vaul-drawer]"))` (drawer); `createThread` already does this for the surface it returns. After confirming a dialog, wait for it to be hidden before the next click. `fill` focuses rather than clicking at a position, so it is safe sooner.
- **"… intercepts pointer events".** An open pane, drawer, dialog, or toast sits over the target, and the click retries until it times out. From 1280px an open Thread pane covers the header's actions: close it (`Close thread`) or use the palette (`ControlOrMeta+k`). A toast can cover a picker's bottom edge: wait for the toast to be hidden. The TanStack Router devtools toggle floats in a corner in dev.
- The Note editor (`Note body`) is CodeMirror and loads lazily. `fill` waits for it and replaces the whole body. To type at the caret (to watch the live preview), click into it and use `page.keyboard.type`. Saved Notes are preview buttons named `Open note: <plain-text preview>`.
- A time no chip offers is typed under `Other time` into `textbox "Time"`, which is not a native time input: type `330p`, press Enter, and assert `button "Other time: 3:30 PM"`.
- Use `localhost`, never `127.0.0.1`. CORS allows exactly the instance's `http://localhost:<webPort>` origin; the fixtures' `baseURL` already uses it.
- "Continue with GitHub" and "Continue with Google" render but have no local credentials. Do not click them.
- Keep the desktop viewport unless you are testing another width. Below 1024px (`lg`) the header's actions move to the bottom `navigation "Actions"` bar and `No date` leads the list folded to one line. Below 768px the Dashboard's columns and filter row change too (see [Dashboard board](features/dashboard-board.md)).
- Toasts are transient. Assert a toast right after the action that raises it, and do not use one as the only proof of a write. An earlier action's toast with the same text may still be up: match with `.first()`.
