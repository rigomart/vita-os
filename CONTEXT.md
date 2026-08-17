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

**Area Icon**:
A user-chosen visual marker that helps identify an **Area**.
_Avoid_: Status icon, condition icon.

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

**Up Next**:
The ordered list of already-known upcoming moves a **Thread** holds behind its **Next Move**.
_Avoid_: Action queue, step list, checklist, subtasks, todo list.

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
The single view for all visible **Tasks**, with **Open Tasks** first in a flat attention-ordered list and **Done Tasks** in collapsed history.
_Avoid_: Backlog.

**Dashboard**:
The main awareness surface that starts with **Life Areas**, then offers an **Overview** of **Open Threads** and a **Plan** that lays them out on the days their **Follow-ups** fall on. It also lightly surfaces **Open Tasks** and recent **Activity Log Entries**.
_Avoid_: Task list, project board, backlog.

## Relationships

- An **Area** has zero or more **Threads**; a **Thread** belongs to exactly one **Area**.
- The app may suggest minimal **Starter Areas**, but users can edit, delete, and reorder **Areas**.
- An **Area** has one **Area Icon**.
- An **Area** **Condition** affects the Area's visual prominence, but it does not change a **Thread**'s derived attention state.
- A **Thread** has zero or one **Summary**, zero or one **Next Move**, zero or more upcoming moves in its **Up Next** list, zero or one **Follow-up**, and one **Activity Log**.
- While **Up Next** is non-empty, the **Thread** always has a **Next Move** — the **Next Move** is the front of the line.
- **Up Next** moves are plain ordered text with no dates and no done states. A step that needs a date is a **Follow-up** or its own **Thread**.
- A **Thread** is either **Open** or **Resolved**.
- A **Thread** may move from one **Area** to another.
- An **Activity Log** has zero or more **Activity Log Entries**.
- A **Task** belongs to no **Area** and no **Thread**.
- **Tasks** are not created inside **Threads**.
- A visible **Task** is either **Open** or **Done**.
- A **Task** has zero or one **When**.
- **Done Tasks** remain available as collapsed **Inbox** history in the MVP.
- The **Inbox** shows all visible **Tasks**; **When** affects emphasis, not whether the **Task** exists in the Inbox.
- The **Inbox** orders **Open Tasks** in one flat run: **Past due**, **Today**, **Coming up**, then **No date**, then collapsed **Done Tasks**. Past and future **Tasks** follow **When** order, Today and No date are newest-first, and Done Tasks are most-recently-completed first.
- The navigation badge (top bar on desktop, tab bar on mobile) counts every **Open Task**, whether or not it has a **When**.

## Thread Attention

- **Open Threads** on the small-screen **Dashboard** sit in one flat attention-ordered list with no visible group headings. Attention groups survive as ordering only; a state signal on each row's date rail replaces the headings. The rail's visual states are recorded in ADR 0005.
- The **Area** inventory groups the same attention order into visible, collapsible **attention lanes** — **Due now**, **Upcoming**, **Next moves**, **Open** — introduced by a census line that states each lane's count and hosts the **New Thread** action (ADR 0009). Every lane starts expanded; collapsing is session-local, a collapsed lane keeps its count, and empty lanes are omitted.
- The flat order is **Overdue Follow-ups**, **Upcoming Follow-ups**, **Threads with Next Moves**, then plain **Open Threads**. On the **Dashboard**, dated upcoming **Follow-ups** come before undated **Threads with Next Moves**.
- **Overdue Follow-ups** have a **Follow-up** before today. **Upcoming Follow-ups** have a **Follow-up** today or later.
- **Due now** (the Area lane) covers **Threads** whose **Follow-up** is today or earlier — **Overdue Follow-ups** plus due-today ones. In the lane vocabulary, **Upcoming** narrows to a **Follow-up** strictly after today.
- A **Follow-up** takes precedence when a **Thread** also has a **Next Move**.
- **Threads with Next Moves** have a **Next Move** and no **Follow-up**.
- Plain **Open Threads** have neither field and appear inline at the end of the flat run.
- The small-screen **Dashboard** shows at most five plain **Open Threads** inline; the rest sit behind a **Show all** control that extends the same flat run in place. Attention-bearing **Threads** are never capped, and the **Area** inventory always lists every **Thread**.
- **Follow-ups** are ordered oldest-first when overdue and soonest-first when upcoming. The user's **Thread** order breaks ties and orders undated attention groups.
- An **Open Thread** with no **Next Move** and no **Follow-up** is valid; it is not automatically overdue, stale, or broken.
- **Up Next** never affects attention: the **Dashboard**, attention lanes, and **Plan** derive from **Next Move** and **Follow-up** only. Only the **Next Move** surfaces outside its **Thread**; **Up Next** is visible only in **Thread** detail.
- Opening or reviewing a **Thread** does not clear its **Follow-up**; the user must clear, reschedule, or resolve it explicitly.

## Dashboard Structure

- The Dashboard has a single view: **Plan**. There are no Dashboard tabs.
- **Life Areas** appear as one dense **Condition** strip above the canvas, grouped Critical, Needs Attention, then Healthy with the user's Area order preserved inside each group. Critical and Needs Attention Areas are labeled links to their Area page; Healthy Areas are icon-only links behind a steady tally. When nothing needs attention the strip says all areas are steady.
- **Plan** lays every **Area** out as a lane over one continuous day axis, worst **Condition** first, with a pinned **Inbox** lane for **Tasks**. A lane's chips sit on the exact day of their **Follow-up** or **When**; days nothing is planned on compress to ticks. Items already past dock in a waiting bay at the lane's left edge, and undated items in a No Date bay pinned right.
- A lane's header links to its **Area** page, and a lane whose **Area** is not Healthy always shows its **Condition**, even when empty. The pinned **Inbox** lane is the Inbox's only embedded Dashboard surface; its open count is visible in the canvas summary without scrolling.
- On small screens the Dashboard shows **Plan** as a vertical schedule instead of the canvas; the **Inbox** is reached by summoning it, not through a Dashboard preview.
- Dragging on **Plan** writes directly: along a lane or onto the day ruler sets that item's **Follow-up** (**Thread**) or **When** (**Task**) to the exact day, the No Date bay clears it, and across lanes moves the **Thread** to that **Area**. The past is never a drop target, **Tasks** stay in the **Inbox**, and **Threads** stay in **Areas**.
- **Plan** does not introduce a separate schedule or priority model. Rescheduling continues to mean changing the Thread's existing **Follow-up**, so every change is an ordinary edit with the usual **Activity Log** entries and is reversible by dragging back.
- Opening a **Thread** from any surface — **Dashboard**, **Inbox**, the palette, or an **Area** inventory — shows its detail pane in place over the current page rather than navigating to the **Area** page; closing the pane returns the user to where they were. The in-place behavior is recorded in ADR 0007.
- Opening the **Inbox** from any surface — the top bar, the palette, a **Plan** Task chip, or the mobile tab — summons it in place over the current page rather than navigating; closing returns the user exactly where they were. `/inbox` survives as a deep link that lands on the **Dashboard** with the Inbox open over it. The in-place behavior and the chosen form are recorded in ADR 0011.

## Task Handling

- **Processing** a **Task** means assigning it to a **Thread**: as an **Activity Log** entry, as the **Next Move**, appended to **Up Next**, or by promoting it into a new **Thread**.
- Adding a date, editing text, completing, and discarding are inline actions on a **Task**, not processing.
- A processed **Task** is consumed; its text lives on inside the **Thread** it was assigned to.
- Moving a **Task** into a **Thread** requires choosing whether it becomes an **Activity Log** entry, the **Next Move**, or an **Up Next** move appended to the end of the list.
- Creating a new **Thread** from a **Task** uses a user-provided **Thread** title; the original **Task** text becomes the first **Activity Log** entry by default.
- Discarding a **Task** consumes it.

## Activity Rules

- Setting, changing, or intentionally clearing a saved **Next Move** adds an **Activity Log** entry.
- Setting, changing, or intentionally clearing a saved **Follow-up** adds an **Activity Log** entry.
- Completing a **Next Move** clears it and adds an **Activity Log** entry.
- Completing or clearing a **Next Move** while **Up Next** is non-empty promotes the front move into the **Next Move** slot; the promotion rides the existing entry rather than adding its own.
- Adding, editing, reordering, or removing **Up Next** moves does not add **Activity Log** entries.
- Moving a **Thread** between **Areas** adds an **Activity Log** entry.
- Resolving a **Thread** adds an **Activity Log** entry.
- Resolving a **Thread** may include an optional resolution note; when present, it becomes an **Activity Log** entry.
- Resolving a **Thread** clears its current **Next Move**, **Follow-up**, and **Up Next**; when **Up Next** moves are discarded this way, the resolution entry names them.
- Reopening a **Resolved Thread** makes it an **Open Thread** and adds an **Activity Log** entry.
- Reopening a **Thread** does not restore old **Follow-ups** or discarded **Up Next** moves automatically.
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
- "Action queue" was the old term for ordered tentative next steps. Resolved: **Next Move** stays singular and is the only move surfaced outside the **Thread**; **Up Next** holds a known sequence behind it with queue semantics — no done states, no dates — so a **Thread** stays directional without becoming a checklist (ADR 0010).
- "Project log" was the old term for the timeline on a **Thread**. Resolved: **Activity Log** is canonical and should capture continuity, not every small edit.
- "Health status" was the old term for the manual judgment on an **Area**. Resolved: **Condition** is canonical.
- "Definition of Done" belongs to project-management language and is not a **Thread** concept. Resolved: use **Summary** or the **Activity Log** when context is needed.
- "Stale Thread" is not part of the MVP domain language. Resolved: use the plain **Open Thread** group until there is a stronger rule.
