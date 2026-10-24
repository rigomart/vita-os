# @vita-os/e2e

Playwright fixtures, shared actions, and example specs that drive Vita OS in the real app, against an isolated local stack (private D1, `wrangler dev` API, Vite web). It is not a regression suite: no CI runs it. Run everything from the repo root.

- `bun run test:e2e [file or pattern]`: brings the stack up (or reuses it) and runs specs. Without a file it runs everything in `tests/` and `scratch/`.
- `bun run verify up|doctor|env|d1 "<SELECT>"|down [--purge]`: the stack alone, one JSON object per command (`src/verify.ts`).
- `VITA_INSTANCE=<name>` picks the instance (default `main`); each has its own ports, D1, logs, and results under `.verify/instances/<name>/`.
- `scratch/` (gitignored) is for the throwaway specs that prove a change: `bun run test:e2e scratch/try.spec.ts`.
- `bun run test:e2e:desktop [file]`: builds `apps/desktop` and drives it through Electron (`playwright.desktop.config.ts`, fixture in `src/desktop.ts`), each test on a throwaway user-data folder, with no web stack. Its specs live in `tests/desktop/` and `scratch/desktop/`; the web config ignores them.

Specs run in the installed Google Chrome (`channel: "chrome"` in `playwright.config.ts`). Without it, run `bunx playwright install chrome`.

Fixtures are in `src/fixtures.ts`, shared Vita OS actions in `src/app.ts`. Proving a web change no longer uses these specs: the `verify-vita-os` skill ([`.claude/skills/verify-vita-os/SKILL.md`](../../.claude/skills/verify-vita-os/SKILL.md)) drives the app with agent-browser on an instance from `bun run verify`, which also closes the instance's agent-browser session (`session` in its output) on `down`.
