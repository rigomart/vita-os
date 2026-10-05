---
name: validate-idea
description: Validate a raw product idea for Vita OS before anything is built. Separates the problem from the proposed fix, checks whether the app already solves it, simulates real-life cases and walkthroughs, fits candidate designs into the domain model and product principles, and converges with the owner on a direction, then files a spec issue and an ADR. Use when the user shares a thought, a pain point, a "what if", or a feature idea, even a vague one ("thought right now…", "how should we deal with X", "what about adding Y").
---

# Validate an idea

The owner brings ideas from their own life, from a guess about other users, or from nowhere in particular. Your job is to find out whether there is a real problem, whether Vita OS should hold it, and what the smallest fitting shape is. This is a conversation, not a document dump: work in rounds, show your thinking compactly, and let the owner's reactions steer.

No code in this skill. Its outputs are a verdict and, when the idea goes ahead, a spec issue and doc changes.

**Keep the owner's life out of anything written down.** The repository and its issues are public. Ideas often start from something personal (a relative's health, money, relationships). Use it in the conversation, but in issues, ADRs, docs and commit messages write only generic cases ("a relative's chronic condition", "an evening check-in"): no family members, conditions, names, places or anything that points at the owner. Before filing or committing, reread the text for personal details. If a personal case seems necessary, ask first.

## 1. Ground yourself first

Read before forming an opinion:

- `CONTEXT.md`: the vocabulary and exact rules. Use its terms for its concepts. Its _Avoid_ lists keep one name per concept; they do not ban everyday words (see Naming).
- `docs/product-direction.md`: the thesis, Principles, the Thesis as a Filter, Open Directions and Not Now. An idea may already be parked there, with the evidence that would unpark it.
- The ADRs the idea touches (`docs/adr/`). Note each one the idea would contradict.
- GitHub issues, open and closed, for prior attempts at the same problem.

## 2. Separate the problem from the proposal

Restate in one or two sentences:

- **The situation:** what happened in a real life, in the owner's words (in the conversation only; see the rule above).
- **The problem:** what fails, and for whom: the owner, a plausible other user, or a thought experiment. Say which; it changes how much evidence there is.
- **The proposal**, if the owner brought one. Keep it apart from the problem; the problem is what gets validated.

Keep the owner's own phrasing. Words like "the same move every day" often name the right model before any analysis does.

## 3. Check it against the thesis

Vita OS keeps what matters in view; it does not try to get things done. Run the problem through the filter in `docs/product-direction.md` (The Thesis as a Filter) and say which test it serves: bringing things back, restoring context, or making carrying cheaper. If it serves none, or it mainly pressures doing, needs upkeep to stay true, or plans execution, say so now: the likely verdict is Not a problem or Park it, and the owner decides whether to go on.

Never reject an idea because another tool has it. Ask whether it serves remembering or doing.

## 4. Try it with the app as it is

Before inventing anything, walk the situation through today's app step by step: which Thread, Tasks, Follow-up date, Notes. Then list where it rubs, concretely ("five date picks a week", "sits in Now all morning"). Often the honest answer is "this works today", or "do it by hand for a while and see if the friction repeats". That is a valid verdict.

Ask how the owner handles it now. If they stopped using, or never started using, the app for it, that is strong evidence.

## 5. Generate real cases

Write 6 to 10 situations from different parts of life (health, family, money, home, work, relationships, pets), with different durations (days, weeks, forever, fading out) and intensities. Put them in a table: situation, what the idea would hold, how long. Include at least one case that stresses the idea and one where it should not apply.

Then pull out what the cases show, as short bullets: plurality ("a Thread has more than one of these"), grain ("track the user's attention, not the event"), failure modes ("missing one must not pile up"), unknowns ("the end is usually unknown"). These findings drive the design; the cases are evidence, not decoration.

## 6. Shape candidates, smallest first

Propose 2 or 3 shapes, starting with the smallest change that could work (a shortcut on an existing control) and ending with a model change. For each:

- Show it with a small text mockup of Thread detail or a Dashboard card.
- Walk one case through it: setup once, a normal day, a missed day, the end.
- Check it against the filter and the Principles in `docs/product-direction.md`, one by one. The ones that usually bite: capture asks nothing; derive, never ask; the app never invents a priority; dates are soft; one board.
- Name every ADR or glossary rule it contradicts. Contradicting one is allowed, but only on purpose and recorded in a new ADR.
- Say what it costs: new concepts, migrations, surfaces.
- Name any new concept with the plainest familiar word that does not mislead (see Naming in `CONTEXT.md`). Propose a coined term only with the reason the plain word fails.

Recommend one. Prefer reusing a concept the user already knows over adding a new one, and prefer one concept with optional parts over two concepts. Watch complexity: if a shape makes every existing item heavier to serve a few, say so.

## 7. Converge with the owner

Expect several rounds. Pushback like "too complex", "doesn't feel right" or "what if it were like X" is the most useful signal you get: take it seriously, find what it is reacting to, and reshape rather than defend. Be honest when a new suggestion is close to something already rejected, and explain what actually differs.

Ask only questions the owner alone can answer (taste, naming, what they would do), at most two or three per round, each with your default. Do not decide the look of the UI or the Dashboard placement details unless the owner wants to; list them as open questions.

When asked for a summary, give the shape in one line, a mockup, the rules, what changes in the repo, and the remaining decisions.

## 8. Close with a verdict

One of:

- **Not a problem / solved today:** explain how to do it with the current app. Nothing to file.
- **Park it:** add or update an entry in Open Directions in `docs/product-direction.md`, naming the evidence that would justify building it.
- **Go ahead**, once the owner agrees with the direction:
  1. **File a spec issue** in the style of closed spec issues such as #366: Problem Statement (with the cases table), Solution, Open Questions, User Stories, Implementation Decisions (core, attention, contract, storage, application, documentation), Testing Decisions, Out of Scope, Further Notes (rejected shapes and why). Search for duplicates first.
  2. **Write an ADR** in `docs/adr/` with the next number, status Proposed, linking the issue, naming what it amends or supersedes, the considered options, the decision, what is left open, and the exact glossary changes to apply when it ships.
  3. **Keep the docs honest without writing the future into them.** `CONTEXT.md` and `docs/product-direction.md` describe the present, so leave the glossary and its rules alone until the code ships: the ADR lists the glossary changes, and the implementing agent applies them. Product direction gets at most a one-line Open Directions item linking the spec issue. Pending entries, delivery plans, and issue numbers beyond that link stay in the issue and the ADR.
  4. Commit with a conventional commit (`docs(<scope>): …`) and ship the docs with the `ship-changes` skill if the owner wants a PR.
