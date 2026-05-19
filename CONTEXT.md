# Vita OS

Personal life-awareness app. Holds the inventory of life domains, open threads, and loose tasks so the user's brain does not have to.

## Language

**Area**:
A stable life domain with no end date, such as Family Health, Career, Finances, or Home.
_Avoid_: Category, tag, label.

**Starter Area**:
A minimal suggested **Area** offered to help a user begin their life inventory.
_Avoid_: Template, default category, fixed category.

**Condition**:
The user's manual judgment on an **Area**: `healthy | needs_attention | critical`.
_Avoid_: Health status, score, rating, traffic light.

**Thread**:
An ongoing effort, concern, decision, or situation that belongs to exactly one **Area** and may need attention over time.
_Avoid_: Project, goal, initiative, epic.

**Open Thread**:
A **Thread** that still matters and may need attention, waiting, judgment, or future review.
_Avoid_: Active, paused, waiting, monitoring.

**Resolved Thread**:
A **Thread** that no longer needs attention.
_Avoid_: Completed, dropped, closed.

**Summary**:
An optional current-orientation note that explains what a **Thread** is about.
_Avoid_: Definition of Done, description, brief.

**Next Move**:
The single next useful action that could move a **Thread** forward.
_Avoid_: Action queue, subtask list, todo list, checklist.

**Follow-up**:
A soft resurfacing point on a **Thread** that brings the situation back into awareness around a chosen time.
_Avoid_: Due date, deadline, reminder.

**Activity Log**:
The continuity record for a **Thread**, mixing manual notes with meaningful actions, decisions, updates, and automatic changes.
_Avoid_: Project log, activity feed, audit log, comments.

**Activity Log Entry**:
A user-facing note, decision, action, reference, or meaningful automatic update in an **Activity Log**.
_Avoid_: Audit event, comment.

**Task**:
A lightweight tactical entry in the **Inbox** that can be handled directly or moved into a **Thread**.
_Avoid_: Item, todo, ticket.

**Open Task**:
A **Task** that has not been completed.
_Avoid_: Pending item.

**Done Task**:
A **Task** that was completed directly from the **Inbox**.
_Avoid_: Completed item.

**When**:
A soft attention date on a **Task**.
_Avoid_: Due date, deadline.

**Inbox**:
The single view for all visible **Tasks**, with **Open Tasks** first and **Done Tasks** in collapsed history.
_Avoid_: Backlog.

**Dashboard**:
The main awareness surface that groups **Open Threads** by derived attention state and lightly surfaces attention-worthy **Tasks**.
_Avoid_: Task list, project board, backlog.

## Relationships

- An **Area** has zero or more **Threads**; a **Thread** belongs to exactly one **Area**.
- The app may suggest minimal **Starter Areas**, but users can edit, delete, and reorder **Areas**.
- An **Area** **Condition** affects the Area's visual prominence, but it does not change a **Thread**'s derived attention state.
- A **Thread** has zero or one **Summary**, zero or one **Next Move**, zero or one **Follow-up**, and one **Activity Log**.
- A **Thread** is either **Open** or **Resolved**.
- A **Thread** may move from one **Area** to another.
- An **Activity Log** has zero or more **Activity Log Entries**.
- A **Task** belongs to no **Area** and no **Thread**.
- **Tasks** are not created inside **Threads**.
- A visible **Task** is either **Open** or **Done**.
- A **Task** has zero or one **When**.
- **Done Tasks** remain available as collapsed **Inbox** history in the MVP.
- The **Inbox** shows all visible **Tasks**; **When** affects emphasis, not whether the **Task** exists in the Inbox.

## Thread Attention

- The **Dashboard** groups **Open Threads** by derived attention state: follow-up due, scheduled, ready, or open.
- **Follow-up Due** includes **Open Threads** whose **Follow-up** is today or earlier.
- If an **Open Thread** has both a due **Follow-up** and a **Next Move**, it appears as **Follow-up Due**.
- If an **Open Thread** has a future **Follow-up**, it appears as **Scheduled**, even when it also has a **Next Move**.
- An **Open Thread** with no **Next Move** and no **Follow-up** is valid; it is not automatically overdue, stale, or broken.
- Opening or reviewing a **Thread** does not clear its **Follow-up**; the user must clear, reschedule, or resolve it explicitly.

## Task Handling

- **Processing** a **Task** means assigning it to a **Thread**: as an **Activity Log** entry, as the **Next Move**, or by promoting it into a new **Thread**.
- Adding a date, editing text, completing, and discarding are inline actions on a **Task**, not processing.
- A processed **Task** is consumed; its text lives on inside the **Thread** it was assigned to.
- Moving a **Task** into a **Thread** requires choosing whether it becomes an **Activity Log** entry or the **Next Move**.
- Creating a new **Thread** from a **Task** uses a user-provided **Thread** title; the original **Task** text becomes the first **Activity Log** entry by default.
- Discarding a **Task** consumes it.

## Activity Rules

- Setting, changing, or intentionally clearing a saved **Next Move** adds an **Activity Log** entry.
- Setting, changing, or intentionally clearing a saved **Follow-up** adds an **Activity Log** entry.
- Completing a **Next Move** clears it and adds an **Activity Log** entry.
- Moving a **Thread** between **Areas** adds an **Activity Log** entry.
- Resolving a **Thread** adds an **Activity Log** entry.
- Resolving a **Thread** may include an optional resolution note; when present, it becomes an **Activity Log** entry.
- Resolving a **Thread** clears its current **Next Move** and **Follow-up**.
- Reopening a **Resolved Thread** makes it an **Open Thread** and adds an **Activity Log** entry.
- Reopening a **Thread** does not restore old **Follow-ups** automatically.
- Changing an **Area** **Condition** does not add entries to **Thread** **Activity Logs**.

## Example Dialogue

> **Dev:** "If I move a **Task** into a **Thread**, does the **Task** become part of that **Thread**?"
> **Builder:** "No. **Tasks** never belong to **Threads**. Moving it means its text becomes either an **Activity Log** entry or the **Next Move**, then the original **Task** is consumed."

> **Dev:** "If a **Thread** has no **Next Move** and no **Follow-up**, is it broken?"
> **Builder:** "No. A plain **Open Thread** is valid. It means the situation still matters, but there is no clear move or resurfacing date right now."

> **Dev:** "Does a **Follow-up** clear when I open the **Thread**?"
> **Builder:** "No. Reading the **Thread** is not the same as handling it. The user must clear, reschedule, or resolve it explicitly."

## Flagged Ambiguities

- "Project" was the old term for a multi-step effort with a defined end state. Resolved: **Thread** is canonical because these life situations may not have a clean execution plan or defined finish line.
- "Item" was the old neutral term for a lightweight Inbox entry. Resolved: **Task** is canonical, but only for the Inbox capture layer.
- "Action queue" was the old term for ordered tentative next steps. Resolved: **Next Move** is singular so a **Thread** stays directional without becoming a checklist.
- "Project log" was the old term for the timeline on a **Thread**. Resolved: **Activity Log** is canonical and should capture continuity, not every small edit.
- "Health status" was the old term for the manual judgment on an **Area**. Resolved: **Condition** is canonical.
- "Definition of Done" belongs to project-management language and is not a **Thread** concept. Resolved: use **Summary** or the **Activity Log** when context is needed.
- "Stale Thread" is not part of the MVP domain language. Resolved: use the plain **Open Thread** group until there is a stronger rule.
