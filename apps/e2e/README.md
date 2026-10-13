# @vita-os/e2e

Playwright end-to-end specs for Vita OS, run against an isolated local stack (private D1, `wrangler dev` API, Vite web). Run everything from the repo root.

- `bun run test:e2e [file or pattern]`: brings the stack up (or reuses it) and runs the specs in `tests/`.
- `bun run verify up|doctor|env|d1 "<SELECT>"|down [--purge]`: the stack alone, one JSON object per command (`src/verify.ts`).
- `VITA_INSTANCE=<name>` picks the instance (default `main`); each has its own ports, D1, logs, and results under `.verify/instances/<name>/`.
- `scratch/` (gitignored) is for throwaway specs: `bun run test:e2e scratch/try.spec.ts`.

Specs run in the installed Google Chrome (`channel: "chrome"` in `playwright.config.ts`). Without it, run `bunx playwright install chrome`.

Fixtures are in `src/fixtures.ts`, shared Vita OS actions in `src/app.ts`. How to write, run, and read specs, and what counts as proof, is in the `verify-vita-os` skill: [`.claude/skills/verify-vita-os/SKILL.md`](../../.claude/skills/verify-vita-os/SKILL.md).
