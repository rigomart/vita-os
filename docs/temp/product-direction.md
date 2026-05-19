# Vita OS — Updated Product Direction

## Core Idea

**Vita OS is a personal life-awareness dashboard for managing important life domains and slow-moving open loops.**

It is not primarily a productivity app, task manager, notes app, calendar, or project management tool. It can contain tasks, but tasks are not the center of the product.

Vita OS exists to answer:

> What important parts of my life need awareness, follow-up, or judgment now?

The main value is reducing mental load by externalizing the user’s life inventory: ongoing domains, open threads, follow-ups, and loose tasks.

---

## Product Thesis

Many important life responsibilities are not continuously actionable. They often follow this pattern:

```text
Notice issue → take one action → wait days/weeks/months → follow up → reassess → wait again
```

Examples:

* family health follow-ups
* personal health checkups
* taxes and admin obligations
* career moves
* financial decisions
* relationship maintenance
* household issues
* unresolved personal decisions
* long-term learning efforts

These are not well handled by pure task managers because the problem is not only execution. The problem is **continuity of awareness**.

Vita OS helps the user stop mentally tracking every open loop by keeping the system visible, structured, and easy to review.

---

## Positioning

A task manager asks:

> What do I need to do?

A calendar asks:

> When does this happen?

A notes app asks:

> Where do I store this?

A project manager asks:

> How do we execute this work?

Vita OS asks:

> What is open across my life, what condition is each area in, and what deserves attention next?

The dashboard is the product. Everything else exists to make the dashboard trustworthy.

---

# Core Model

Vita OS has three main objects:

```text
Area → Thread → Activity Log / Next Move / Follow-up
Inbox → Tasks
```

## 1. Area

An **Area** is a stable life domain with no natural end date.

Examples:

```text
Family Health
Personal Health
Career
Finances
Relationships
Home
Learning
Legal/Admin
```

Each Area has a manually set **Condition**:

```text
Healthy
Needs Attention
Critical
```

The condition is the user’s judgment. It is not automatically calculated from task count, overdue items, or activity volume.

A quiet Area may be critical. A busy Area may be healthy.

### Purpose

Areas answer:

> Is this part of my life okay?

---

## 2. Thread

A **Thread** is an ongoing effort, concern, decision, or situation that belongs to an Area and may need attention over time.

Examples:

```text
Mom’s medical follow-up
SUNAT/RHE cleanup
Job search strategy
Car vs motorcycle decision
Improve English speaking practice
Apartment search
Personal health checkup
```

A Thread is broader than a project. It does not need to be continuously actionable or have a clean execution plan. It may involve action, waiting, monitoring, reassessment, or eventual resolution.

### Purpose

Threads answer:

```text
What is this about?
Where does it belong?
What happened so far?
What might I do next?
When should I look at it again?
```

---

## 3. Task

A **Task** is a lightweight captured action or loose input in the Inbox.

Examples:

```text
Pay internet bill
Ask accountant about April income
Call clinic tomorrow
Buy medicine
Compare headphone prices
Check if recruiter replied
```

Tasks are practical and familiar. They can be done directly, discarded, dated, or moved into a Thread.

Tasks are not the core object of Vita OS. They are the capture/triage layer.

### Purpose

Tasks answer:

> What loose thing do I need to handle or process?

---

# Key Concepts

## Dashboard

The Dashboard is the main product surface.

It should show:

```text
Areas needing attention
Threads needing follow-up
Threads with next moves
Stale/open Threads
Inbox Tasks
Recently updated Threads
```

The dashboard should not become a generic task list. Its job is to restore awareness quickly.

Ideal use:

```text
Open dashboard
See Area conditions
Notice Threads needing follow-up
Review today’s Tasks
Update what changed
Close app
```

The goal is a 1–2 minute orientation loop.

---

## Condition

**Condition** belongs to an Area.

Values:

```text
Healthy
Needs Attention
Critical
```

Condition is manual because only the user can judge the real state of a life domain.

Example:

```text
Area: Finances
Condition: Needs Attention
```

A domain should not become critical automatically just because it has many Threads or Tasks.

---

## Next Move

A **Next Move** belongs to a Thread.

It is the next useful action that could move the Thread forward.

Examples:

```text
Ask accountant whether April needs monthly payment.
Follow up with recruiter if no answer this week.
Book a second medical appointment.
Review car ownership costs again.
```

Next Move is singular. It replaces the idea of an action queue.

This keeps Threads directional without turning them into checklist systems.

---

## Follow-up

A **Follow-up** belongs to a Thread.

It is a soft resurfacing point, not necessarily a hard due date.

It means:

> Bring this Thread back into awareness around this time.

A Follow-up can optionally include a note.

Examples:

```text
May 25 — Check if accountant confirmed April handling.
Next week — See if symptoms changed.
June 1 — Review whether this decision still matters.
```

Internally, this can be modeled as:

```ts
followUpAt?: Date
followUpNote?: string
```

But in the UI it should feel like one lightweight control:

```text
Follow up: May 25 — Check if accountant replied
```

Follow-up is one of the app’s strongest differentiators because it fits slow-moving life threads better than ordinary due dates.

---

## Activity Log

An **Activity Log** belongs to a Thread.

It records what happened so far:

```text
May 12 — Asked accountant about RHE monthly payment.
May 13 — Confirmed March has S/2 interest.
May 18 — Set follow-up for May 25.
```

The log provides continuity. When returning to a Thread after days or weeks, the user should not need to reconstruct context from memory.

The log can include:

```text
manual notes
actions taken
decisions made
important updates
meaningful automatic changes
```

Avoid noisy automatic logging.

---

## Task Date / “When”

Tasks can have a date in the database:

```ts
date?: Date
```

But the UI should label this as:

```text
When
```

Not necessarily “Due date.”

Why:

* “Due date” implies a hard deadline.
* “When” is broader and softer.
* Vita OS often needs resurfacing, not strict deadline enforcement.

Examples:

```text
Task: Call clinic
When: Tomorrow

Task: Pay credit card
When: May 30

Task: Compare vacuum options
When: Weekend
```

For MVP, “When” can mean:

> Show this task for attention around this date.

Hard deadlines can be added later if needed.

---

# Task Lifecycle

Tasks live in the Inbox.

A Task can be:

```text
Open
Done
Discarded
Moved to Thread
```

Recommended actions:

```text
Done
Discard
Move to Thread
Set When
```

Examples:

```text
Task: Buy toothpaste
→ Done

Task: Ask accountant about April income
→ Move to Thread: SUNAT/RHE cleanup

Task: Random idea no longer relevant
→ Discard

Task: Call clinic
→ Set When: Tomorrow
```

Tasks should be completable because forcing every small action into a Thread would be annoying.

But completed Tasks should not dominate the app. They should disappear from the main Inbox or move into a collapsed history.

---

# Thread Lifecycle

A Thread can be:

```text
Open
Resolved
```

Avoid adding manual status in the MVP.

Instead, derive dashboard status from existing fields.

## Derived Thread Status

```ts
function getThreadStatus(thread) {
  if (thread.resolvedAt) return "resolved";
  if (thread.followUpAt && thread.followUpAt <= today) return "follow_up_due";
  if (thread.followUpAt && thread.followUpAt > today) return "scheduled";
  if (thread.nextMove) return "ready";
  return "open";
}
```

Possible display groups:

```text
Follow-up Due
Scheduled
Ready
Open
Resolved
```

This avoids making the user manually maintain states like Active, Waiting, Monitoring, or Paused.

Manual status/mode can be added later if derived status is not enough.

---

# Recommended Data Model

```ts
type Area = {
  id: string;
  name: string;
  condition: "healthy" | "needs_attention" | "critical";
  createdAt: Date;
  updatedAt: Date;
};

type Thread = {
  id: string;
  areaId: string;
  title: string;
  summary?: string;
  nextMove?: string;
  followUpAt?: Date;
  followUpNote?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

type ActivityLogEntry = {
  id: string;
  threadId: string;
  content: string;
  createdAt: Date;
  type?: "note" | "decision" | "action" | "system";
};

type Task = {
  id: string;
  text: string;
  date?: Date;
  status: "open" | "done" | "discarded" | "moved_to_thread";
  createdAt: Date;
  updatedAt: Date;
};
```

Optional later:

```ts
manualThreadMode?: "active" | "waiting" | "monitoring" | "paused";
priority?: "low" | "medium" | "high";
deadline?: Date;
recurringFollowUp?: string;
references?: Reference[];
```

Do not add these until the simple model proves insufficient.

---

# Recommended Vocabulary

Use these terms consistently:

```text
Area
Condition
Thread
Next Move
Follow-up
Activity Log
Inbox
Task
When
Done
Discard
Move to Thread
Resolve Thread
Dashboard
```

Avoid or postpone:

```text
Project
Action queue
Subtask
Priority
Due date
Status
Backlog
Epic
Ticket
Goal
```

Not because those terms are always bad, but because they may pull the product toward task/project-management patterns too early.

---

# UX Principles

## 1. Minimize required fields

Creating a Thread should require only:

```text
Title
Area
```

Everything else is optional:

```text
Summary
Next Move
Follow-up
Activity Log entry
```

Creating a Task should require only:

```text
Text
```

Optional:

```text
When
```

## 2. Prefer derived structure over manual classification

Do not force the user to constantly set statuses.

Use fields like `followUpAt`, `nextMove`, and `resolvedAt` to infer what should appear on the dashboard.

## 3. Keep Tasks lightweight

Tasks are for capture and simple execution.

If something needs continuity, move it into a Thread.

## 4. Keep Threads alive but not noisy

A Thread should preserve enough context to resume later, but it should not require constant maintenance.

## 5. Make resurfacing central

Follow-up should be easy to set and visible on the dashboard.

This is core to the product’s value.

---

# MVP Scope

## Must-have

```text
Areas
Manual Area condition
Threads assigned to Areas
Thread summary
Thread Next Move
Thread Follow-up
Thread Activity Log
Inbox Tasks
Task When
Task Done / Discard / Move to Thread
Dashboard
Derived Thread status
```

## Should avoid for MVP

```text
manual Thread status
complex priorities
subtasks
kanban views
gamification
automatic Area condition scoring
collaboration
heavy tagging
AI planning
recurring task engine
```

---

# One-Sentence Product Definition

**Vita OS is a personal life-awareness dashboard that helps you track important life Areas, open Threads, and loose Tasks so you can stop carrying every unresolved loop in your head.**
