# Task replaces Move

**Status:** Accepted
**Date:** 2026-10-04

The concept **Move** (one useful action on a **Thread**) is renamed **Task**. **Moves** becomes **Tasks** and **Focused Move** becomes **Focused Task**. The margin run **Ready to move** keeps its name: there "move" is a verb. Issue #397 raised the question; sub-issue #400 ships the rename.

"Move" was a coined word. The Naming rule in `CONTEXT.md` says to try the plain word first and keep it unless it misleads. "Task" misled once: it promised a checklist with priority, order, due dates, an overdue state and a done state. Moves had none of that, so the coined word earned its place (ADR 0010, ADR 0022).

That reason is gone. Tasks have no priority and no order. Dates are soft: they resurface, never nag, never notify (ADR 0032). A missed occurrence collapses into one. The plain word no longer misleads, and the coined one costs something every day. "Move" collides with the verb in "Ready to move" and in "Move a Note to a Thread" (ADR 0030). Once Tasks gain dates and repeats, the quickest explanation is the one everyone already reaches for: it is a task.

## Considered Options

- **Keep Move.** Rejected: it needs a gloss in every conversation, and it collides with the verb.
- **Task.** Chosen. The plain word, and it now matches the behavior.
- **To-do.** Rejected: it implies a checklist with done states.
- **Action.** Rejected: it reads as doing, and fails "Follow up", which is a thing to look at again.
- **Check.** Rejected: it fits a recurring look but not a one-off action such as "Compare two quotes".
- **Reminder.** Rejected: it promises notifications, which the app never sends.

## Decision

- **Terms.** Move becomes Task. Moves becomes Tasks. Focused Move becomes Focused Task. **Ready to move** is unchanged.
- **Stored names do not change.** The D1 columns `threads.moves_json` and `threads.focused_move_id`, the Activity Log types `move_completed` and `next_move_change`, and the text of existing Activity Log entries stay. ADR 0031 kept stored `done`; ADR 0028 kept `notes.attention_date`. Mapping at the edge preserves every row without a data migration.
- **API.** New routes `/v1/threads/:threadId/tasks...` sit beside the existing `/moves...` routes, which stay as aliases for one release. Thread responses carry both `tasks` and `focusedTaskId` and the old `moves` and `focusedMoveId`. Requests accept either name. Supplying both old and new names is rejected as ambiguous, as in ADR 0028. The API deploys before the web app, so older clients keep working until they reload. Removing the old names is a separate change (#402).
- **Order of delivery.** The rename ships first, with no behavior change, so every later iteration is written in Task terms.
- **Old ADRs stay as written.** ADR 0022 and ADR 0032 get a one-line terminology note at the top, as ADR 0027 carries "Terminology amended by ADR 0028".

## Glossary changes when the rename ships

- **Task** entry: _Avoid_ becomes "Move (former name), Next Move, step, subtask, todo".
- **Note** keeps "task" in its _Avoid_ line. A Note is never called a task.
- **Flagged Ambiguities** gains an entry: "Task" was the Inbox-era name for what became Notes (issue 313). It now names a Thread's actions (ADR 0033).
- The Naming section's comparison line "a **Move** is like a task, with no priority and no order" is rewritten. After the rename it has nothing left to compare.
- Every other rule that says Move, Moves or Focused Move switches to the new term. "Ready to move" stays.

## Consequences

- One plain word for the concept, with no gloss needed in conversation.
- "Task" has a history: it named what became Notes. The Flagged Ambiguities entry keeps the two apart, and a Note is never a task.
- Code and storage keep the old name in places. A reader of `moves_json` needs the mapping. The glossary and this ADR carry it.
- The compatibility window adds duplicate JSON fields and routes for one release.
