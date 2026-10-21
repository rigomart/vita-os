# Vita OS

Personal life-awareness app. Holds open threads and standalone notes, lightly grouped by the part of life they concern, so the user's brain does not have to.

## Present tense

This file describes the vocabulary and rules as they are now. `docs/product-direction.md` says what the product is for and where it is going. `docs/adr/` holds decisions and their history. GitHub issues and PRs hold delivery status. History and pending work written here go stale and repeat the ADRs. One kind of history belongs here: a former name mapped to its current term, under "Former and rejected terms".

## Naming

Plain words first. A familiar thing gets its familiar word; a term is coined only when the familiar word would promise behaviour Vita OS does not have, such as a due date that nags or a project that needs a plan.

The _Avoid_ line under a term lists words not to use **as names for that concept** in the interface, the code, and the rules below, so one concept keeps one name. It does not ban the word. Everyday words are fine in conversation, explanations, issues and ADRs, and a familiar comparison often explains a term faster than its definition:

- a **Thread** is like a project that may never have a plan or a finish line;
- a **Note** is like a sticky note: no title, no type, kept where you will see it;
- a **Follow-up date** is like a due date that never nags;
- an **Area** is like a single tag.

When a new concept needs a name, try the plain word first and keep it unless it misleads.

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

**Task**:
One useful action that could move a **Thread** forward: text, with an optional date and an optional **Repeat**. A **Task** has no done state; completing it removes it unless it repeats, in which case it moves to its next occurrence. Completing a Task in **Thread** detail may carry a note, captured as a **Thread Note**. The date is a **Follow-up date**'s kind of value, a day with an optional time of day (ADR 0027), and it resurfaces the **Thread** without ever being a deadline.
_Avoid_: Move (former name), Next Move, step, subtask, todo.

**Tasks**:
The unordered set of peer **Tasks** a **Thread** holds. They are shown in the order they were captured, which is never a priority.
_Avoid_: Up Next, queue, next moves, action queue, checklist.

**Repeat**:
An optional rhythm on a dated **Task** or a **Standalone Note**'s **Follow-up date**: every N days, weekly on chosen weekdays, or monthly on the date's day of month. Completing a repeating Task or Note moves it to its next occurrence instead of removing or archiving it (ADR 0032, ADR 0041). It is set in the date picker; a repeating Task or Note wears a repeat glyph on its date.
_Avoid_: Recurrence, routine, habit.

**Skip**:
Moving a repeating **Task** to its next occurrence without completing it: the occurrence passes and nothing is recorded. Only a repeating Task can be skipped; a repeating **Standalone Note** has no Skip.
_Avoid_: Postpone, snooze, dismiss.


**Follow-up date**:
A soft resurfacing point on a **Standalone Note** that brings it back into awareness around a chosen time: a day, optionally with a time of day that orders it within that day (ADR 0027). It may carry a **Repeat** (ADR 0041). A **Thread** has none of its own: it comes back at each of its dated **Tasks** (ADR 0032, ADR 0044).
_Avoid_: Due date, deadline, reminder.

**Activity Log**:
The automatic, read-only changelog of meaningful changes to a **Thread**.
_Avoid_: Project log, activity feed, audit log, comments.

**Activity Log Entry**:
A meaningful automatic change recorded in an **Activity Log**.
_Avoid_: Audit event, comment.

**Note**:
A body-only capture that is valid as soon as it is saved: information, a thought, or an action. A Note is either a **Standalone Note** or a **Thread Note**. Its body is Markdown; single line breaks are kept.
_Avoid_: Task, item, todo, ticket.

**Note view**:
The dialog where a **Note** is written, read, edited, archived, unarchived, and deleted.

**Standalone Note**:
A **Note** that belongs to no **Area** or **Thread** and requires no classification. While open it appears on the **Dashboard**, and it may have a **Follow-up date**. A repeating one is completed rather than archived; Archive ends its **Repeat** (ADR 0041).
_Avoid_: Inbox item, task.

**Thread Note**:
A **Note** that belongs to exactly one **Thread**, appears only there, and has no **Follow-up date**.
_Avoid_: Manual Activity Log Entry, comment.

**Open Note**:
A **Note** that has not been archived.
_Avoid_: Pending item, unprocessed.

**Archived Note**:
A **Note** put away: it leaves the **Dashboard**, or its **Thread**'s open Notes, unchanged and still findable. An archived **Standalone Note** is found in **History**; an archived **Thread Note** stays in its **Thread**'s Archived notes. Unarchiving puts it back as it was. Stored as `done` (ADR 0031).
_Avoid_: Done, completed, resolved, processed.

**Dashboard**:
The main awareness surface: one list of every dated **Task**'s **Thread** and every dated open **Standalone Note**, read from what is late out to what is months away, beside **No date**, which holds everything undated. An **Open Thread** stands once per dated **Task**, or once in **No date** (ADR 0044). A filter at the top of the list narrows it to one **Area** or to **Standalone Notes**.
_Avoid_: Task list, project board, backlog.

**History**:
The palette's mode for what is finished: every **Resolved Thread** and every archived **Standalone Note**, searchable, reached from its History chip. Choosing one opens it in place (ADR 0029, ADR 0031).
_Avoid_: Archive (as a place), trash, completed list.

## Relationships

- A **Thread** has zero or one **Area**; an **Area** labels zero or more **Threads**. Creating a Thread needs only a title.
- Users can rename, re-icon, reorder, and delete **Areas**. Deleting an Area removes its label from every Thread that carries it, open or resolved, and leaves the Threads otherwise unchanged.
- An **Area** has one **Area Icon**.
- An **Area** never changes a **Thread**'s derived attention state.
- A **Thread** has zero or one **Summary**, zero or more **Tasks**, zero or more **Thread Notes**, and one **Activity Log**.
- A **Task** may have a date and a **Repeat**; a Repeat requires a date, and clearing the date clears the Repeat. It has no done state, no nesting, and no manual order. "Look at this again in two weeks" is a dated **Task**. A **Thread** resurfaces at each of its dated **Tasks**, one copy on the **Dashboard** each, and it has no **Follow-up date** of its own.
- A monthly **Repeat** repeats on its date's day of month; a month without that day uses its last day, and the next month returns to the chosen day. Changing the date moves the Repeat to the new date's day.
- A weekly **Repeat** snaps a Task's date to the first chosen weekday on or after it. Repeats count calendar days in the caller's time zone and keep the local time of day, except that a time skipped by a daylight-saving change moves to the first valid time and stays there. Completing or skipping advances to the first occurrence after the current date that is not before today; missed occurrences collapse into one Task, shown once under Late until it is completed or skipped. Completing or skipping acts on the occurrence on screen, so a double activation moves it once.
- A **Resolved Thread** holds no **Tasks** and gains none.
- A **Thread** is either **Open** or **Resolved**.
- A **Thread**'s **Area** may be added, changed, or removed. A **Resolved Thread** keeps its Area.
- An **Activity Log** has zero or more automatically recorded **Activity Log Entries**.
- A **Standalone Note** belongs to no **Area** and no **Thread**.
- A **Thread Note** belongs to exactly one **Thread** and never appears on the **Dashboard** or in **History**.
- A visible **Note** is either **Open** or **Archived**.
- A **Standalone Note** has zero or one **Follow-up date**; a **Thread Note** has none, because a **Thread** comes back at its dated **Tasks**.
- Adding an Open **Standalone Note** to an Open **Thread** makes it a **Thread Note** there, with its body and creation time; it leaves the **Dashboard**. An **Archived Note**, a **Thread Note**, and a **Resolved Thread** take no part. Adding is one-way.
- When a dated **Standalone Note** is added to a **Thread**, or starts one, its first non-blank line, with any leading Markdown markers removed, becomes a dated **Task** carrying the Note's **Follow-up date**, time included. The **Task** joins the end of the list, and the whole Note joins the **Thread**'s Notes. A line with nothing left gives a **Task** named "Follow up". An undated Note adds no **Task**. A repeating Note's **Task** carries its **Repeat** too.
- Archiving a **Note** changes nothing about it but where it is shown; unarchiving returns a **Standalone Note** to the **Dashboard** where its **Follow-up date** puts it. Resolving a **Thread** does more (see Activity Rules), so the two actions keep their own words.
- **History** lists archived **Standalone Notes** most recently archived first, and searches every one of them by body.

## Thread Attention

- **Open Threads** and open **Standalone Notes** share one axis on the **Dashboard**: one list in the order they come due, beside **No date** for everything unscheduled. A dated **Task** and a **Standalone Note**'s **Follow-up date** are the same signal, so a dated Note sits beside a dated Task's **Thread**. The form is recorded in ADR 0037, which supersedes ADR 0017, and ADR 0044; the state language still comes from ADR 0005.
- **No date** reads in three labelled runs: **Ready to move** (**Threads** whose **Tasks** are all undated), **Open** (plain **Open Threads**), then **Notes** (**Standalone Notes** with no **Follow-up date**).
- **A date outranks undated Tasks.** Every dated **Task** places its **Thread**: a Thread with three dated **Tasks** stands three times, each copy in the group its **Task**'s date falls in. A repeating **Task** places one copy, at its next occurrence. A **Thread** whose **Tasks** are all undated is never on the list under Late or Today; it stands once, in **No date**, instead. This settles the ordering question ADR 0005 left open.
- The undated **Tasks** of a **Thread** that has a dated one are not on the board; **Thread** detail lists them.
- **Ready to move** **Threads** have at least one **Task** and none dated. Plain **Open Threads** have no **Tasks**.
- Dated items are ordered soonest-first; the user's **Thread** order breaks ties and orders the undated runs, and undated **Notes** read newest-first.
- **A time orders; it never places.** Within a day, a date alone comes first, then timed items in time order. A time never moves an item to another day or heading, never makes it late before its day ends, and never pings. A date alone is stored as local midnight, so midnight reads as no time (ADR 0027).
- The list groups its items under headings for when they come due, the grain widening with distance: Late, Today, Tomorrow (with its weekday), then each of the next six days with something due (its weekday and how many days out), then weeks out to four (`In 1 week` and its span), then calendar months (ADR 0026). A day with nothing due gets no heading.
- Every dated **Task** and dated **Standalone Note** appears in exactly one group, and every undated item in exactly one run. Nothing is capped. On the list every item is a line: a **Thread**'s copy reads "Task · Thread", its **Task** and then its title, muted, so two lines of one Thread read apart; a **Note** reads its first line. Below `lg`, **No date** starts folded to one line naming its first two items and how many more; folding hides its lines, never that they exist.
- An **Open Thread** with no **Tasks** is valid; it is not automatically overdue, stale, or broken.
- **Dated Tasks alone place a Thread**: the **Dashboard** derives from whether a **Thread** has **Tasks** and from their dates. The number of undated **Tasks** never moves a Thread between groups or changes its place; only dated **Tasks** place it, one copy each.
- Opening or reviewing a **Thread** does not clear or change any **Task**'s date; the user must clear, reschedule, complete, or resolve explicitly.

## Dashboard Structure

- The palette's **History** chip switches to two groups: **Resolved threads**, newest resolution first, and **Archived notes**, most recently archived first, one bounded page until a search reaches every archived **Standalone Note** by body. Choosing a **Thread** opens its pane, where it can be reopened; choosing a **Note** opens the **Note view** over the current page, where it can be read, unarchived, or deleted (ADR 0029, ADR 0031).
- The Dashboard has one attention-first view and no view-switching tabs or secondary schedule. Each group of the list is a heading on a rule across the list, led by the date's number when it names one day, over its items' lines. The nearer a group, the larger, bolder and darker its heading and lines read, with more room around them: Late and Today lead, and the weeks and months are small and faint until hovered (ADR 0045). Late's heading is in the attention colour. **No date** draws the same lines at one size, between Today's and the far ones (ADR 0046). The page scrolls as one: the filter stays at the top of the list and, from `lg`, **No date** stays beside it and scrolls on its own. Below `lg` **No date** leads the list, folded.
- The page's header is the sky at the current hour, with the date, and from `lg` search, New note, New thread and the account menu; below `lg` those actions sit in a bar at the bottom and the header keeps only the account menu. The sky is ambient: it carries no items and no times, so on the board colour still belongs to time (ADR 0037).
- One pill group at the top of the list filters it: **All** with its total count of **Open Threads** and open **Standalone Notes**, each Area with its Open Thread count, then **No area**, in the user's Area order, then **Notes** with its open **Standalone Note** count, set apart from the Areas, then Edit areas, which opens **Manage areas**. Options with nothing open stay, muted; **No area** is left out while there are no Areas. The group never wraps or scrolls: options that do not fit fold, in order, into a More menu that also offers Edit areas, and the selected option and **Notes** always stay in view. Choosing an Area shows only its **Open Threads** across every group and run, and any Area filter hides **Standalone Notes**; **No area** shows only unlabeled Threads; **Notes** shows only open **Standalone Notes**, laid out by the same rules. The filter lives in the URL as one of two parameters, never both: `?area=<slug>` or `?area=none`, or `?show=notes`, which no Area slug can collide with. It survives the in-place Thread pane and the **Note view**, and falls back to All for an unknown value. `1..9` select the matching Area and `0` returns to All (ADR 0021, ADR 0031).
- On the list a line is one copy of its **Thread**, led by the dated **Task** that placed it: the repeat glyph when it repeats or a hollow dot when it does not, the **Task**, then the **Thread**'s title, muted, then its **Area** and date at the right. Two dated **Tasks** on the same day are two lines. A **Standalone Note**'s line is marked by a small dog-eared sheet. A **Thread**'s line in **No date** leads with its title, over its only **Task**, or "N tasks" when it has several, because the line must not invent a headline the user never chose. A **Thread** with no **Tasks** is its title alone. On a wide enough list a labeled Thread shows its **Area**, icon and name, neutral; an unlabeled Thread shows none. Colour on the board belongs to time: a late line's date and Late's heading are in the attention colour. Dates are compact tokens rather than phrases, and a line under a heading that names its day (Today, Tomorrow, or a weekday) leaves the date to the heading, showing only its time when it has one.
- When a **Thread** stands more than once, hovering or keyboard-focusing any of its copies rings all of them in the focus ring's accent, so a **Thread** spread across the week reads as one. The ring is an interaction state, never shown at rest, and a **Thread** that stands once never rings (ADR 0044).
- The Dashboard **can act on attention in place**: a line's controls — shown on hover or keyboard focus — complete the **Task** it names, and only that one, skip it when it repeats, or set, change, and clear that **Task**'s date and **Repeat**; on a **No date** line that names no single **Task**, setting a date adds a **Task** named "Follow up" with it. Completing one copy's **Task** leaves the **Thread**'s other copies where they are. A **Standalone Note** offers Archive and its **Follow-up date**, or Complete when it repeats. Removing **Tasks**, changing a **Thread**'s **Area**, editing its text, and resolving it still happen in **Thread** detail, where the Area is a chip in the header.
- **Thread** detail lists every **Task** in one list, in capture order, dated or not; a date never moves a **Task** (ADR 0039). Each row leads with Complete, one click. Its text shows up to two lines, and all of it while edited. Under the text, the date sits at the left and the row's commands at the right, each named by a tooltip: **Skip** when the **Task** repeats, the date, Complete with a note, and Remove. The date and the date command set, change, or clear that **Task**'s date and, once it has a day, its **Repeat**; capturing a **Task** never asks for either. Complete with a note opens a note line under the row, and completing from there also captures the text as a **Thread Note**. The Dashboard completes in one click and never asks for a note.
- Opening a line summons **Thread** detail in place; opening a **Note** opens the **Note view** over the current page.
- When nothing is open at all the board is replaced by a single line saying nothing is asking.
- Opening a **Thread** from any surface — the **Dashboard** or the palette — shows its detail pane in place over the current page; closing the pane returns the user to where they were. A Thread's own address is `/threads/$threadSlug`, which opens the pane over the Dashboard. The in-place behavior is recorded in ADR 0007.
- **Notes** have no surface of their own: they are on the **Dashboard**, and its **Notes** filter shows them alone. `/notes`, `/inbox`, and `?inbox=true` land on the Dashboard with that filter selected (ADR 0031, superseding ADR 0012).
- **Areas** are managed in one **Manage areas** dialog, opened from the palette or from Edit areas in the Dashboard's filter, which follows the Areas: rename, re-icon, reorder, delete, and add. The delete confirmation states how many open Threads will lose the label. A new Thread starts in the Area the Dashboard is filtered to, and the label can be cleared before saving; the **Notes** filter is not an Area, so a Thread captured under it starts with none.

## Note Handling

- A **Note** can be captured and edited with just a body; it has no title or type selector.
- Saved Note cards are read-only previews that open the **Note view**. **Thread Note** previews render Markdown in a bounded space; the Dashboard and **History** show its first line in plain text.
- The **Note view** renders the full body for reading and uses a Markdown textarea for writing and editing. Changed drafts ask for confirmation before being discarded.
- Markdown supports headings, lists, emphasis, code, links, quotes, dividers, and tables. Checkbox markers remain literal text for now.
- A **Standalone Note** can have its **Follow-up date** set, changed, or cleared.
- A **Thread Note** appears only on its parent **Thread** and has no **Follow-up date**.
- Any **Note** can be archived, unarchived, or permanently deleted, whether open or archived.
- Creation time is preserved; last-edited time is retained going forward. An unknown historical edit time remains unknown.
- An Open **Standalone Note** can be added to an Open **Thread**, or start a new **Thread**, from the ⋯ menu of its **Note view**: Add to thread… or New thread from note (ADR 0030). Both are optional and never prompted; nothing suggests a Thread or counts Notes that have none.
- Processing and conversion are outside this version.

## Activity Rules

- Capturing a **Thread Note** updates its **Thread**'s last-activity date without adding an **Activity Log Entry**.
- Adding a **Standalone Note** to a **Thread**, or starting a **Thread** from one, counts as capturing a **Thread Note**. It adds no **Activity Log** entry, even when the Note's date adds a dated **Task**.
- Editing, archiving, unarchiving, or deleting an existing **Thread Note** changes only the Note and does not update Thread activity.
- Setting, changing, or clearing a **Task**'s date adds no **Activity Log** entry. Entries an earlier **Follow-up date** change wrote keep their wording.
- Completing any **Task** adds one **Activity Log** entry. Completing it with a note also captures one **Thread Note**, which updates the **Thread**'s last-activity date as any captured Thread Note does, so the Note, not the completion, is the Thread's last activity. The **Task** change, the Note, and the entry are written together or not at all. A repeating Task keeps its identity and text and moves to its next occurrence; a one-off Task is removed. Completing every one-off **Task** leaves the **Thread** open.
- Skipping a repeating **Task** moves it to its next occurrence without an **Activity Log** entry. Setting or clearing a **Repeat** also adds none.
- Adding, editing, dating, and removing **Tasks** add no **Activity Log** entries.
- **Activity Log** entries written under a former name (**Next Move**, **Move**) keep their wording and label.
- Adding, changing, or removing a **Thread**'s **Area** adds an **Activity Log** entry. Deleting an **Area** adds none: the label disappearing is not a change the user made to each Thread.
- Resolving a **Thread** adds an **Activity Log** entry.
- Resolving a **Thread** may include an optional resolution note; when present, it becomes an **Activity Log** entry.
- Resolving a **Thread** clears its **Tasks**, dated ones included; when **Tasks** are discarded this way, the resolution entry names them in capture order.
- Reopening a **Resolved Thread** makes it an **Open Thread** and adds an **Activity Log** entry.
- Reopening a **Thread** does not restore discarded **Tasks** or their dates.

## Example Dialogue

> **Dev:** "Does a captured **Note** need to become an action?"
> **Builder:** "No. Information and thoughts are valid Notes as soon as they are saved. No classification or processing is required."

> **Dev:** "If a **Thread** has no **Tasks**, is it broken?"
> **Builder:** "No. A plain **Open Thread** is valid. It means the situation still matters, but there is no clear task or resurfacing date right now."

> **Dev:** "Does a **Task**'s date clear when I open the **Thread**?"
> **Builder:** "No. Reading the **Thread** is not the same as handling it. The user must clear, reschedule, complete, or resolve explicitly."

## Former and rejected terms

Old names survive in stored data, code, and older ADRs. Each line maps one to the current term.

- "Project": former name for a **Thread**. A Thread may have no plan or finish line.
- "Inbox": former capture name for a **Note** (issue 313). The **Notes** collection that replaced the Inbox was retired by ADR 0031: Notes live on the **Dashboard**.
- "Task": named Inbox items before issue 313. It now names a **Thread**'s actions (ADR 0033), and a **Note** is never called a task.
- "Move", "Moves": former names; use **Task**, **Tasks** (ADR 0033). "Focused Move" became "Focused Task", since retired. Stored names keep "move": `moves_json`, `focused_move_id`, `move_completed`, `next_move_change`.
- "Focused Task", "Focus": retired by ADR 0044. A **Thread**'s **Tasks** are peers and none is singled out; the **Dashboard** names every dated **Task**. Stored `focused_move_id` values are no longer read, and a later migration drops the column.
- "Next Move", "Up Next", "action queue", "next moves": former names; use **Tasks** (ADR 0022, ADR 0033). The group of **Threads** that was "Next moves" is **Ready to move**. **Activity Log** entries written under the old names keep their wording.
- "Project log": former name for a **Thread**'s timeline; use **Activity Log**. Manual continuity belongs in **Thread Notes**.
- "Health status", "Condition", "Standard": removed from **Area** (issue 371, ADR 0021). A part of life that needs a periodic look gets a **Thread** with a dated **Task**.
- "Definition of Done": project-management language, not a **Thread** concept; use **Summary** or the **Activity Log**.
- "Move a Note to a Thread": former action name; use **Add to thread** (ADR 0030). "Convert", "process", and "attach" stay out of the interface.
- "Done", "completed" for a **Note**: former words; use **archived** (ADR 0031). Completing names only what a repeating **Standalone Note** does. **Threads** keep **Resolve**. Stored values keep `done`.
- "Stale Thread": not part of the domain language; use the plain **Open Thread** group.
- "Now", "This week", "Later", "the margin": former **Dashboard** columns and the unscheduled margin beside them (ADR 0017). The list's groups (Late, Today, each day, weeks, months) and **No date** replace them (ADR 0037). The code's attention board still sorts dated items into `now`, `week` and `later` buckets before grouping them.
