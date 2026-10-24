---
name: ship-changes
description: Packages current repository changes into a branch, commit or commits, push, and pull request using this project's conventions, splits work into a stack of PRs when it has natural seams, and lands PRs or stacks through GitHub auto-merge. Use when the user asks to ship changes, create a branch, commit, push, open a PR or a stack, merge or land a PR, or prepare work for review.
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

If the current branch is already a descriptive, non-`codex` feature branch for the work being shipped, keep using it. If the current branch is `main`, `master`, a `codex/*` branch, a `codex-*` branch, a `t3code/*` branch, or a generic branch name, create a new descriptive branch from the current `HEAD`:

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

## One PR or a Stack

Default to one PR. Split into a stack only when the work has a seam a reviewer would review separately, and each piece is useful on its own:

- a migration, then the API that uses it, then the UI
- a refactor, then the feature it makes room for
- a contract change, then its callers

Every PR in a stack must be safe to deploy alone. Merging to `main` deploys staging, and migrations run before the API deploys, so a migration goes in a lower PR than the code that needs it, and no PR may depend on one above it. Only one stack at a time adds a migration.

A stack is a chain of base branches. The bottom PR targets `main`; each PR above it is branched from the tip of the one below and targets it:

```bash
git switch -c <child-branch> <parent-branch>
# commit the child's work
git push -u origin <child-branch>
gh pr create --base <parent-branch> --title "..." --body-file <body.md>
```

Open the whole stack before landing any of it. In each PR body, name its place: `Part 2 of 3. Builds on #456.`

## Verification

Before pushing, run what CI runs (`.github/workflows/verify.yml`):

```bash
bun run lint
bun run lint:check
bun run typecheck
bun run build
bun apps/web/scripts/check-chunks.mjs apps/web/dist
```

Run `typecheck` separately: the application build excludes tests, but CI type-checks them. If tests exist for affected code, also run:

```bash
bun run test:run
```

A user-visible change also needs proof in the real app with the `verify-vita-os` skill: agent-browser drives every path the change touched on an isolated instance, with exact checks on the screen and in D1. Lint and unit tests don't substitute for it. In a stack, verify each PR at its own head.

## PR Format

Use a conventional PR title matching the main commit or the overall change.

```text
feat(items): add inline item editing
```

The body is a briefing for a reviewer who has the diff: why the change exists, what it leaves out, and how it was proven. Use these sections in order and drop any that has nothing to say:

```md
## Why
One or two short paragraphs: the problem and the approach.

## Scope
- Real symbols and paths that carry the change
- What is deliberately left out, when the boundary matters

## Tradeoffs
Alternatives a reviewer would ask about, and why not.

## Blast radius
One to three sentences: what this touches, what could go wrong, and how it would show up.

## Verification
- `bun run lint:check`, `bun run typecheck`, `bun run build`, chunk check, `bun run test:run`
- `verify-vita-os`: each check by number or by what it proved, the entry points and widths driven, the exact values observed, and the screenshots; none of it is in the diff, so this is the reviewer's only view of it

Closes #123
```

`Blast radius` and `Tradeoffs` are where the compromises AGENTS.md asks you to surface go. Don't write `## Summary` or `## Test plan` boilerplate, file-by-file lists, or SHAs. If a command was not run, say why instead of listing it. Attach screenshots or recordings when they prove a claim.

The PR body must reference the issue it closes when the work is tied to an issue. Look for the issue number in the session context, the user's request, branch name, commit messages, recent issue discussion, or the diff itself.

Use GitHub closing syntax, such as `Closes #123`, so merging the PR closes the issue automatically. If an issue appears relevant but cannot be identified, ask the user before creating the PR instead of guessing. If the change is clearly not issue-backed, such as a small agent-instruction cleanup requested directly in chat, omit the closing line and continue creating the PR.

Open every PR ready for review, never as a draft. When the `link_pull_request` tool is available, link every PR you open, each layer of a stack included.

## Landing

Opening a PR does not merge it. Land only when the user asks to merge, land, or ship it.

There is no babysitting loop. GitHub auto-merge waits for CI and merges, and squash-merging deletes the branch:

```bash
gh pr merge <pr> --squash --auto
```

Then do one background wait, so a failure in your own diff gets fixed while the context is fresh:

```bash
gh pr checks <pr> --watch --fail-fast
```

If it fails, read `gh run view <run-id> --log-failed`. Fix a failure in the diff's own code with one push; auto-merge stays armed. If the failure is in code the diff doesn't touch, check whether the branch is behind `main` before blaming flake, and rerun a flaky job at most once. Anything else, report and stop. A red PR stays open and visible on GitHub, so walking away is safe.

### Landing a stack

Arm auto-merge on the bottom PR only. A PR that targets another branch has no required checks, so arming it merges it into its parent at once, collapsing the stack.

When the bottom PR merges, GitHub deletes its branch and retargets the next PR to `main`. That PR still carries the parent's original commits, which `main` now holds as one squash commit, so replay only its own commits:

```bash
git fetch origin
git rebase --onto origin/main <old-parent-tip-sha> <child-branch>
git push --force-with-lease
gh pr merge <child-pr> --squash --auto
```

`<old-parent-tip-sha>` is the parent branch's last commit, which `gh pr view <parent-pr> --json headRefOid` still reports after the merge. If the rebase hit conflicts, re-run verification on the child before arming it. Repeat up the stack, one PR at a time.

## Workflow

1. Check current branch and worktree state with `git status --short`, `git diff --stat`, and targeted diffs.
2. Summarize what will ship: one commit or several, one PR or a stack.
3. Decide whether to keep the current branch or create a descriptive branch from the current worktree `HEAD`.
4. Run verification. Stage only intended files, commit with conventional messages, and push.
5. Create the PR or the stack with the standard title and body, including the closing issue reference when the work is issue-backed, and link each PR.
6. If the user asked to land, arm auto-merge as described in Landing.
7. Final response includes branch, commit hash or hashes, PR link or links, verification status, and whether auto-merge is armed.
