#!/usr/bin/env bun
/**
 * Sets up a git worktree (scripts/dev-setup.ts) the first time a Claude Code
 * session or subagent works in it.
 *
 * Claude Code creates its worktrees with git hooks switched off, so
 * .githooks/post-checkout never runs for them. .claude/settings.json runs this
 * instead, with the worktree as the working directory: on SessionStart
 * (`claude --worktree`), on SubagentStart (`isolation: "worktree"`), and after
 * EnterWorktree.
 *
 * dev-setup.ts leaves a marker in the worktree's git dir when it succeeds, so
 * every later run returns at once. The main checkout is left alone.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Written by scripts/dev-setup.ts.
const SETUP_MARKER = "vita-setup-done";

const input = JSON.parse(readFileSync(0, "utf8")) as {
  hook_event_name: string;
  cwd: string;
};

function report(context: string): void {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: input.hook_event_name,
        additionalContext: context,
      },
    }),
  );
}

const [root, gitDir, commonDir] = spawnSync(
  "git",
  [
    "rev-parse",
    "--path-format=absolute",
    "--show-toplevel",
    "--git-dir",
    "--git-common-dir",
  ],
  { cwd: input.cwd, encoding: "utf8" },
)
  .stdout.trim()
  .split("\n");

const isLinkedWorktree =
  root !== undefined && commonDir !== undefined && gitDir !== commonDir;
if (
  !isLinkedWorktree ||
  process.env.VITA_SKIP_SETUP ||
  existsSync(join(gitDir, SETUP_MARKER)) ||
  // A branch from before dev-setup.ts existed.
  !existsSync(join(root, "scripts/dev-setup.ts"))
) {
  process.exit(0);
}

const setup = spawnSync("bun", ["scripts/dev-setup.ts"], {
  cwd: root,
  encoding: "utf8",
});
const output = `${setup.stdout ?? ""}${setup.stderr ?? ""}`.trim();
if (setup.status === 0) {
  report(`This worktree was just set up for development:\n${output}`);
} else {
  report(
    `Setting up this worktree failed; run \`bun run setup\` to retry.\n${output.split("\n").slice(-20).join("\n")}`,
  );
}
