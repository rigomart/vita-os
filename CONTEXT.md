# Vita OS

Personal life-awareness app. Holds open threads and standalone notes, lightly grouped by the part of life they concern, so the user's brain does not have to.

## Language

**Area**:
An optional label naming the part of life a **Thread** concerns, such as Family Health, Career, Finances, or Home. An Area is a name and an **Area Icon**; it has no state and no page of its own (ADR 0021).
_Avoid_: Category, tag, folder, life domain inventory.

**Area Icon**:
A user-chosen visual marker that helps identify an **Area**.
_Avoid_: Status icon.

**Thread**:
An ongoing effort, concern, decision, or situation that may need attention over time. A Thread may carry one **Area**.
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
The automatic, read-only changelog of meaningful changes to a **Thread**.
_Avoid_: Project log, activity feed, audit log, comments.

**Activity Log Entry**:
A meaningful automatic change recorded in an **Activity Log**.
_Avoid_: Audit event, comment.

**Note**:
A body-only capture that is valid as soon as it is saved: information, a thought, or an action. A Note is either a **Standalone Note** or a **Thread Note**.
_Avoid_: Task, item, todo, ticket.

**Standalone Note**:
A **Note** that belongs to no **Area** or **Thread** and requires no classification. It appears in the global **Notes** collection and may have an **Attention Date**.
_Avoid_: Inbox item, task.

**Thread Note**:
A **Note** that belongs to exactly one **Thread**, appears only there, and has no **Attention Date**.
_Avoid_: Manual Activity Log Entry, comment.

**Open Note**:
A **Note** that has not been marked Done.
_Avoid_: Pending item, unprocessed.

**Done Note**:
A **Note** marked Done and retained in completed history.
_Avoid_: Resolved, processed.

**Attention Date**:
An optional date on a **Note** meaning “bring this back into attention.”
_Avoid_: Due date, deadline.

**Notes**:
The global collection of standalone **Notes**, with **Open Notes** in attention order and **Done Notes** in collapsed history. Thread notes do not belong to this collection.
_Avoid_: Inbox, backlog.

**Dashboard**:
The main awareness surface: three time columns — **Now**, **This week**, **Later** — beside a margin of everything unscheduled, holding every **Open Thread** and open **Standalone Note**, under a row that filters the board by **Area**.
_Avoid_: Task list, project board, backlog.

## Relationships

- A **Thread** has zero or one **Area**; an **Area** labels zero or more **Threads**. Creating a Thread needs only a title.
- Users can rename, re-icon, reorder, and delete **Areas**. Deleting an Area removes its label from every Thread that carries it, open or resolved, and leaves the Threads otherwise unchanged.
- An **Area** has one **Area Icon**.
- An **Area** never changes a **Thread**'s derived attention state.
- A **Thread** has zero or one **Summary**, zero or one **Next Move**, zero or more upcoming moves in its **Up Next** list, zero or one **Follow-up**, zero or more **Thread Notes**, and one **Activity Log**.
- While **Up Next** is non-empty, the **Thread** always has a **Next Move** — the **Next Move** is the front of the line.
- **Up Next** moves are plain ordered text with no dates and no done states. A step that needs a date is a **Follow-up** or its own **Thread**.
- A **Thread** is either **Open** or **Resolved**.
- A **Thread**'s **Area** may be added, changed, or removed. A **Resolved Thread** keeps its Area.
- An **Activity Log** has zero or more automatically recorded **Activity Log Entries**.
- A **Standalone Note** belongs to no **Area** and no **Thread**.
- A **Thread Note** belongs to exactly one **Thread** and never appears in the global **Notes** collection.
- A visible **Note** is either **Open** or **Done**.
- A **Standalone Note** has zero or one **Attention Date**; a **Thread Note** has none because its **Thread** already has a **Follow-up**.
- **Done Notes** remain available as collapsed **Notes** history in the MVP.
- The **Notes** collection shows all visible **Notes**; **Attention Date** affects emphasis, not whether the **Note** exists in Notes.
- The **Notes** collection orders **Open Notes** in one flat run: past attention date, today, no date, then coming up. Past and future Notes follow attention-date order; today and undated Notes are newest-first. Done Notes are separate, most-recently-completed first.
- The navigation badge (top bar on desktop, tab bar on mobile) counts every **Open Note**, whether or not it has an **Attention Date**.

## Thread Attention

- **Open Threads** and open **Standalone Notes** share one axis on the **Dashboard**: three time columns — **Now**, **This week**, **Later** — beside a margin for everything unscheduled. A **Follow-up** and an **Attention Date** are the same kind of signal there, so a dated Note sits beside a dated Thread. The form is recorded in ADR 0017, which supersedes ADR 0014; the state language still comes from ADR 0005.
- **Now** holds a **Follow-up** or **Attention Date** today or earlier — overdue and due-today together. **This week** is the next six days. **Later** is day seven onward.
- The unscheduled margin reads in three labelled runs: **Ready to move** (**Threads with Next Moves**), **Open** (plain **Open Threads**), then **Notes** (**Standalone Notes** with no **Attention Date**).
- **A date outranks an undated Next Move.** A **Thread with a Next Move** and no **Follow-up** never appears in **Now**; it leads the unscheduled margin instead. This settles the ordering question ADR 0005 left open.
- A **Follow-up** takes precedence when a **Thread** also has a **Next Move**.
- **Threads with Next Moves** have a **Next Move** and no **Follow-up**. Plain **Open Threads** have neither field.
- Dated items are ordered soonest-first within a column; the user's **Thread** order breaks ties and orders the undated runs, and undated **Notes** read newest-first.
- Every **Open Thread** and open **Standalone Note** appears in exactly one column or run. Nothing is capped or hidden; each column scrolls itself.
- An **Open Thread** with no **Next Move** and no **Follow-up** is valid; it is not automatically overdue, stale, or broken.
- **Up Next** never affects attention: the **Dashboard** derives from **Next Move** and **Follow-up** only. Only the **Next Move** surfaces outside its **Thread**; **Up Next** is visible only in **Thread** detail.
- Opening or reviewing a **Thread** does not clear its **Follow-up**; the user must clear, reschedule, or resolve it explicitly.

## Dashboard Structure

- The Dashboard has one attention-first view and no tabs or secondary schedule. It fills the viewport: the columns are full height and scroll independently, so a busy column never pushes the others down and a quiet one never leaves a hole.
- One row above the board filters it by **Area**: `All · each Area with its Open Thread count · No area`, in the user's Area order. Areas with nothing open stay in the row, muted. Choosing an Area shows only its **Open Threads** across every column and run, and any filter hides **Standalone Notes**; **No area** shows only unlabeled Threads. The filter lives in the URL (`?area=<slug>` or `?area=none`), survives the in-place Thread pane and Notes surface, and falls back to All for an unknown Area. `1..9` select the matching Area and `0` returns to All; on a phone the row folds into one dropdown (ADR 0021).
- A **Thread** card leads with its **Next Move**, with the **Thread** title quiet underneath; where no **Next Move** is captured the title leads and there is no second line. A labeled Thread shows its **Area** as a small neutral tag, icon and name; an unlabeled Thread shows none. Colour on the board belongs to time. Dates are compact tokens rather than phrases.
- The Dashboard **can act on attention in place**: a card's rail — shown on hover or keyboard focus — completes the **Next Move** or sets, changes, and clears the **Follow-up**; a **Standalone Note** offers done and its **Attention Date**. Changing a **Thread**'s **Area**, editing its text, and resolving it still happen in **Thread** detail, where the Area is a chip in the header.
- Opening a card summons **Thread** detail in place; opening a **Note** summons **Notes** in place.
- When nothing is open at all the board is replaced by a single line saying nothing is asking.
- Opening a **Thread** from any surface — **Dashboard**, **Notes**, or the palette — shows its detail pane in place over the current page; closing the pane returns the user to where they were. A Thread's own address is `/threads/$threadSlug`, which opens the pane over the Dashboard. The in-place behavior is recorded in ADR 0007.
- Opening the **Notes** from any surface — the top bar, the palette, a Dashboard Note, or the mobile tab — summons it in place over the current page rather than navigating; closing returns the user exactly where they were. `/notes` opens Notes over the Dashboard; `/inbox` remains a compatibility deep link. The in-place behavior and chosen form are recorded in ADR 0012.
- **Areas** are managed in one **Manage areas** dialog, opened from the palette or the user menu: rename, re-icon, reorder, delete, and add. The delete confirmation states how many open Threads will lose the label. A new Thread starts in the Area the Dashboard is filtered to, and the label can be cleared before saving.

## Note Handling

- A **Note** can be captured and edited with just a body; it has no title or type selector.
- A **Standalone Note** can have its **Attention Date** set, changed, or cleared.
- A **Thread Note** appears only on its parent **Thread** and has no **Attention Date**.
- Any **Note** can be marked **Done**, reopened, or permanently deleted from active Notes or completed history.
- Creation time is preserved; last-edited time is retained going forward. An unknown historical edit time remains unknown.
- Processing, conversion, and attaching an existing **Standalone Note** to a **Thread** are outside this version.

## Activity Rules

- Capturing a **Thread Note** updates its **Thread**'s last-activity date without adding an **Activity Log Entry**.
- Editing, completing, reopening, or deleting an existing **Thread Note** changes only the Note and does not update Thread activity.
- Setting, changing, or intentionally clearing a saved **Next Move** adds an **Activity Log** entry.
- Setting, changing, or intentionally clearing a saved **Follow-up** adds an **Activity Log** entry.
- Completing a **Next Move** clears it and adds an **Activity Log** entry.
- Completing or clearing a **Next Move** while **Up Next** is non-empty promotes the front move into the **Next Move** slot; the promotion rides the existing entry rather than adding its own.
- Adding, editing, reordering, or removing **Up Next** moves does not add **Activity Log** entries.
- Adding, changing, or removing a **Thread**'s **Area** adds an **Activity Log** entry. Deleting an **Area** adds none: the label disappearing is not a change the user made to each Thread.
- Resolving a **Thread** adds an **Activity Log** entry.
- Resolving a **Thread** may include an optional resolution note; when present, it becomes an **Activity Log** entry.
- Resolving a **Thread** clears its current **Next Move**, **Follow-up**, and **Up Next**; when **Up Next** moves are discarded this way, the resolution entry names them.
- Reopening a **Resolved Thread** makes it an **Open Thread** and adds an **Activity Log** entry.
- Reopening a **Thread** does not restore old **Follow-ups** or discarded **Up Next** moves automatically.

## Example Dialogue

> **Dev:** "Does a captured **Note** need to become an action?"
> **Builder:** "No. Information and thoughts are valid Notes as soon as they are saved. No classification or processing is required."

> **Dev:** "If a **Thread** has no **Next Move** and no **Follow-up**, is it broken?"
> **Builder:** "No. A plain **Open Thread** is valid. It means the situation still matters, but there is no clear move or resurfacing date right now."

> **Dev:** "Does a **Follow-up** clear when I open the **Thread**?"
> **Builder:** "No. Reading the **Thread** is not the same as handling it. The user must clear, reschedule, or resolve it explicitly."

## Flagged Ambiguities

- "Project" was the old term for a multi-step effort with a defined end state. Resolved: **Thread** is canonical because these life situations may not have a clean execution plan or defined finish line.
- "Task" and "Inbox" were the old capture vocabulary. Resolved by issue 313: **Note** and **Notes** are canonical; standalone Notes need no classification or processing.
- "Action queue" was the old term for ordered tentative next steps. Resolved: **Next Move** stays singular and is the only move surfaced outside the **Thread**; **Up Next** holds a known sequence behind it with queue semantics — no done states, no dates — so a **Thread** stays directional without becoming a checklist (ADR 0010).
- "Project log" was the old term for the timeline on a **Thread**. Resolved: **Activity Log** is the automatic changelog; body-only manual continuity belongs in **Thread Notes**.
- "Health status", later **Condition**, was the manual judgment on an **Area**, with a **Standard** to judge it against. Resolved by issue 371: both are removed. An Area is an optional label; a part of life that needs a periodic look gets a **Thread** with a **Follow-up** (ADR 0021).
- "Definition of Done" belongs to project-management language and is not a **Thread** concept. Resolved: use **Summary** or the **Activity Log** when context is needed.
- "Stale Thread" is not part of the MVP domain language. Resolved: use the plain **Open Thread** group until there is a stronger rule.
