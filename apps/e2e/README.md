# @vita-os/e2e

The `bun run verify` CLI that starts an isolated local stack (private D1, `wrangler dev` API, Vite web), and the Playwright specs that drive the desktop app. No CI runs either. Run everything from the repo root.

- `bun run verify up|doctor|env|d1 "<SELECT>"|down [--purge]`: the stack alone, one JSON object per command (`src/verify.ts`).
- `VITA_INSTANCE=<name>` picks the instance (default `main`); each has its own ports, D1, and logs under `.verify/instances/<name>/`.
- `bun run test:e2e:desktop [file]`: builds `apps/desktop` and drives it through Electron (`playwright.desktop.config.ts`, fixture in `src/desktop.ts`, shared locators in `src/app.ts`), each test on a throwaway user-data folder, with no web stack. Its specs live in `tests/desktop/`; a throwaway spec that proves a desktop change goes in `scratch/desktop/` (gitignored).

Proving a web change uses no specs: the `verify-vita-os` skill ([`.claude/skills/verify-vita-os/SKILL.md`](../../.claude/skills/verify-vita-os/SKILL.md)) drives the app with agent-browser on an instance from `bun run verify`, which also closes the instance's agent-browser session (`session` in its output) on `down`. Write a new web Playwright spec only when a developer asks for one.
