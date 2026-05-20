---
name: ship-changes
description: Packages current repository changes into a branch, commit or commits, push, and pull request using this project's conventions. Use when the user asks to ship changes, create a branch, commit, push, open a PR, or prepare work for review.
---

# Ship Changes

## Branch Naming

Branch names should be short, lowercase, hyphenated, and based on the actual change. If an issue number is central, include it after the topic, not as the whole name.

```text
items-inline-editing
fix-inbox-count-optimism
docs-agent-dev-server-rules
items-inline-editing-135
```

Never use:

```text
codex/*
codex-*
work
changes
issue-123
```

## Branch Creation

First inspect the current branch and worktree state:

```bash
git status --short
git branch --show-current
git rev-parse --show-toplevel
```

When working in a worktree, do not assume the branch should be based on `main`. Treat the checked-out worktree branch as the base unless the user explicitly asks to rebase, retarget, or start over from `main`.

If the current branch is already a descriptive, non-`codex` feature branch for the work being shipped, keep using it. If the current branch is `main`, `master`, a `codex/*` branch, a `codex-*` branch, or a generic branch name, create a new descriptive branch from the current `HEAD`:

```bash
git switch -c <descriptive-branch-name>
```

Do not move, reset, or recreate the worktree from `main` just to make a shipping branch. Only change the base when the user asks or when the current branch clearly cannot be pushed or used for a PR.

## Commit Strategy

Use one commit when the changes form one coherent feature or fix. Use multiple commits when changes are independently reviewable, such as production code plus a docs-only policy change, a refactor before a feature, or unrelated fixes discovered during the work.

Every commit must use the project's conventional commit style. Before committing, confirm the staged diff only contains intended files.

```text
feat(items): add inline item editing
fix(inbox): keep optimistic count in sync
docs(agents): document local dev server policy
refactor(items): extract date update hook
```

## Verification

Before pushing, run the verification required by `AGENTS.md` for meaningful code changes:

```bash
bun run lint
bun run build
```

If tests exist for affected code, also run:

```bash
bun run test:run
```

## PR Format

Use a conventional PR title matching the main commit or the overall change.

### Example

```text
feat(items): add inline item editing
```

Use this body:

```md
## Summary
- Add or change the main behavior
- Mention important supporting work
- Mention docs or agent-instruction changes, if included

## Verification
- `bun run lint`
- `bun run build`
- `bun run test:run`

Closes #123
```

The PR body must reference the issue it closes when the work is tied to an issue. Look for the issue number in the session context, the user's request, branch name, commit messages, recent issue discussion, or the diff itself.

Use GitHub closing syntax, such as `Closes #123`, so merging the PR closes the issue automatically. If an issue appears relevant but cannot be identified, ask the user before creating the PR instead of guessing. If the change is clearly not issue-backed, such as a small agent-instruction cleanup requested directly in chat, omit the closing line and continue creating the PR. If a command was not run, say why instead of listing it.

## Workflow

1. Check current branch and worktree state with `git status --short`, `git diff --stat`, and targeted diffs.
2. Summarize what will ship and whether it needs one commit or multiple commits.
3. Decide whether to keep the current branch or create a descriptive branch from the current worktree `HEAD`.
4. Stage only intended files, commit with conventional messages, and push the branch.
5. Create the PR with the standard title and body, including the inferred or confirmed closing issue reference when the work is issue-backed.
6. Final response includes branch, commit hash or hashes, PR link, and verification status.
