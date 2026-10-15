# @vita-os/e2e

Playwright fixtures, shared actions, and worked example specs that agents use to prove a Vita OS change in the real app, against an isolated local stack (private D1, `wrangler dev` API, Vite web). It is not a regression suite: no CI runs it. Run everything from the repo root.

- `bun run test:e2e [file or pattern]`: brings the stack up (or reuses it) and runs specs. Without a file it runs everything in `tests/` and `scratch/`.
- `bun run verify up|doctor|env|d1 "<SELECT>"|down [--purge]`: the stack alone, one JSON object per command (`src/verify.ts`).
- `VITA_INSTANCE=<name>` picks the instance (default `main`); each has its own ports, D1, logs, and results under `.verify/instances/<name>/`.
- `scratch/` (gitignored) is for the throwaway specs that prove a change: `bun run test:e2e scratch/try.spec.ts`.

Specs run in the installed Google Chrome (`channel: "chrome"` in `playwright.config.ts`). Without it, run `bunx playwright install chrome`.

Fixtures are in `src/fixtures.ts`, shared Vita OS actions in `src/app.ts`. How to write, run, and read specs, and what counts as proof, is in the `verify-vita-os` skill: [`.claude/skills/verify-vita-os/SKILL.md`](../../.claude/skills/verify-vita-os/SKILL.md).
