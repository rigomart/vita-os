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
One useful action that could move a **Thread** forward: text, with an optional date and an optional **Repeat**. A **Task** has no done state; completing it removes it unless it repeats, in which case it moves to its next occurrence. The date is a **Follow-up date**'s kind of value, a day with an optional time of day (ADR 0027), and it resurfaces the **Thread** without ever being a deadline.
_Avoid_: Move (former name), Next Move, step, subtask, todo.

**Tasks**:
The unordered set of peer **Tasks** a **Thread** holds. They are shown in the order they were captured, which is never a priority.
_Avoid_: Up Next, queue, next moves, action queue, checklist.

**Repeat**:
An optional rhythm on a dated **Task**: every N days or weekly on chosen weekdays. Completing a repeating Task moves it to its next occurrence instead of removing it (ADR 0032).
_Avoid_: Recurrence, routine, habit.

**Focused Task**:
The one **Task** the user has singled out on a **Thread**, when they have. Focus is emphasis only.
_Avoid_: Focused Move (former name), Next Move, priority.

**Follow-up date**:
A soft resurfacing point on a **Standalone Note** that brings it back into awareness around a chosen time: a day, optionally with a time of day that orders it within that day (ADR 0027). A **Thread** has none of its own: it comes back at its soonest dated **Task** (ADR 0032).
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
A **Note** that belongs to no **Area** or **Thread** and requires no classification. While open it appears on the **Dashboard**, and it may have a **Follow-up date**.
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
The main awareness surface: three time columns — **Now**, **This week**, **Later** — beside a margin of everything unscheduled, holding every **Open Thread** and open **Standalone Note**, under a row that filters the board by **Area** or to **Standalone Notes**.
_Avoid_: Task list, project board, backlog.

**History**:
The palette's mode for what is finished: every **Resolved Thread** and every archived **Standalone Note**, searchable, reached from its History chip. Choosing one opens it in place (ADR 0029, ADR 0031).
_Avoid_: Archive (as a place), trash, completed list.

## Relationships

- A **Thread** has zero or one **Area**; an **Area** labels zero or more **Threads**. Creating a Thread needs only a title.
- Users can rename, re-icon, reorder, and delete **Areas**. Deleting an Area removes its label from every Thread that carries it, open or resolved, and leaves the Threads otherwise unchanged.
- An **Area** has one **Area Icon**.
- An **Area** never changes a **Thread**'s derived attention state.
- A **Thread** has zero or one **Summary**, zero or more **Tasks**, zero or one **Focused Task**, zero or more **Thread Notes**, and one **Activity Log**.
- A **Focused Task** is always one of its **Thread**'s **Tasks**. Capturing a **Task** never focuses it; focusing is a separate choice, and every **Task** may stay unfocused.
- A **Task** may have a date and a **Repeat**; a Repeat requires a date, and clearing the date clears the Repeat. It has no done state, no nesting, and no manual order. "Look at this again in two weeks" is a dated **Task**. A **Thread**'s resurfacing is its soonest dated **Task**, and it has no **Follow-up date** of its own.
- A weekly **Repeat** snaps a Task's date to the first chosen weekday on or after it. Repeats count calendar days in the caller's time zone and keep the local time of day across daylight-saving changes. Completing or skipping advances to the first occurrence after the current date that is not before today; missed occurrences collapse into one Task.
- A **Resolved Thread** holds no **Tasks** and gains none.
- A **Thread** is either **Open** or **Resolved**.
- A **Thread**'s **Area** may be added, changed, or removed. A **Resolved Thread** keeps its Area.
- An **Activity Log** has zero or more automatically recorded **Activity Log Entries**.
- A **Standalone Note** belongs to no **Area** and no **Thread**.
- A **Thread Note** belongs to exactly one **Thread** and never appears on the **Dashboard** or in **History**.
- A visible **Note** is either **Open** or **Archived**.
- A **Standalone Note** has zero or one **Follow-up date**; a **Thread Note** has none, because a **Thread** comes back at its dated **Tasks**.
- Adding an Open **Standalone Note** to an Open **Thread** makes it a **Thread Note** there, with its body and creation time; it leaves the **Dashboard**. An **Archived Note**, a **Thread Note**, and a **Resolved Thread** take no part. Adding is one-way.
- When a dated **Standalone Note** is added to a **Thread**, or starts one, its first non-blank line, with any leading Markdown markers removed, becomes a dated **Task** carrying the Note's **Follow-up date**, time included. The **Task** joins the end of the list, unfocused, and the whole Note joins the **Thread**'s Notes. A line with nothing left gives a **Task** named "Follow up". An undated Note adds no **Task**.
- Archiving a **Note** changes nothing about it but where it is shown; unarchiving returns a **Standalone Note** to the **Dashboard** where its **Follow-up date** puts it. Resolving a **Thread** does more (see Activity Rules), so the two actions keep their own words.
- **History** lists archived **Standalone Notes** most recently archived first, and searches every one of them by body.

## Thread Attention

- **Open Threads** and open **Standalone Notes** share one axis on the **Dashboard**: three time columns — **Now**, **This week**, **Later** — beside a margin for everything unscheduled. A **Thread**'s soonest dated **Task** and a **Standalone Note**'s **Follow-up date** are the same signal, so a dated Note sits beside a dated Thread. The form is recorded in ADR 0017, which supersedes ADR 0014; the state language still comes from ADR 0005.
- **Now** holds a date today or earlier — overdue and due-today together. **This week** is the next six days. **Later** is day seven onward.
- The unscheduled margin reads in three labelled runs: **Ready to move** (**Threads** whose **Tasks** are all undated), **Open** (plain **Open Threads**), then **Notes** (**Standalone Notes** with no **Follow-up date**).
- **A date outranks undated Tasks.** A **Thread** is placed by its soonest dated **Task**. A **Thread** whose **Tasks** are all undated never appears in **Now**; it leads the unscheduled margin instead. This settles the ordering question ADR 0005 left open.
- A **Thread** with undated **Tasks** beside a dated one sits where the dated one puts it.
- **Ready to move** **Threads** have at least one **Task** and none dated, whether or not a Task is focused. Plain **Open Threads** have no **Tasks**.
- Dated items are ordered soonest-first within a column; the user's **Thread** order breaks ties and orders the undated runs, and undated **Notes** read newest-first.
- **A time orders; it never places.** Within a day, a date alone comes first, then timed items in time order. A time never moves an item to another day, column, or heading, never makes it late before its day ends, and never pings. A date alone is stored as local midnight, so midnight reads as no time (ADR 0027).
- Each dated column groups its items under headings for when they come due, the grain widening with distance: **Now** reads Late then Today; **This week** gives each day with something due its own heading (Tomorrow, then the weekday and how many days out); **Later** reads in weeks, then calendar months (ADR 0026).
- Every **Open Thread** and open **Standalone Note** appears in exactly one column or run. Nothing is capped; each column scrolls itself. **Later** starts folded on every visit, showing how many items it holds, when the next arrives, and, on a wide screen, a horizon marking when each comes due; folding hides its cards, never that they exist, and each walks into **This week** on its own once it is six days out (ADR 0026).
- An **Open Thread** with no **Tasks** is valid; it is not automatically overdue, stale, or broken.
- **Focus never affects attention**: the **Dashboard** derives from whether a **Thread** has **Tasks** and from their dates. Neither the **Focused Task** nor the number of **Tasks** moves a Thread between columns or changes its place.
- Opening or reviewing a **Thread** does not clear or change any **Task**'s date; the user must clear, reschedule, complete, or resolve explicitly.

## Dashboard Structure

- The palette's **History** chip switches to two groups: **Resolved threads**, newest resolution first, and **Archived notes**, most recently archived first, one bounded page until a search reaches every archived **Standalone Note** by body. Choosing a **Thread** opens its pane, where it can be reopened; choosing a **Note** opens the **Note view** over the current page, where it can be read, unarchived, or deleted (ADR 0029, ADR 0031).
- The Dashboard has one attention-first view and no tabs or secondary schedule. It fills the viewport: the columns are full height and scroll independently, so a busy column never pushes the others down and a quiet one never leaves a hole.
- One row above the board filters it: `All · each Area with its Open Thread count · No area`, in the user's Area order, then **Notes** with its open **Standalone Note** count, set apart from the Areas. Options with nothing open stay in the row, muted; **No area** is left out while there are no Areas. Choosing an Area shows only its **Open Threads** across every column and run, and any Area filter hides **Standalone Notes**; **No area** shows only unlabeled Threads; **Notes** shows only open **Standalone Notes**, laid out by the same rules. The filter lives in the URL as one of two parameters, never both: `?area=<slug>` or `?area=none`, or `?show=notes`, which no Area slug can collide with. It survives the in-place Thread pane and the **Note view**, and falls back to All for an unknown value. `1..9` select the matching Area and `0` returns to All; on a phone the row folds into one dropdown (ADR 0021, ADR 0031).
- A **Thread** card has two fixed rows that never trade places. The first is always the **Thread** title. The second is the task slot. In a time column the dated **Task** that placed the **Thread** leads, even when another **Task** is focused, and two dated **Tasks** on the same day read "2 tasks today" and never pick one. In the No date margin it is the **Focused Task**, else the only **Task**, else — with several **Tasks** and none focused — "N tasks · none focused", because the card must not invent a headline the user never chose. Beside a **Focused Task**, a quiet count of pips, the focused one filled, says how many **Tasks** there are. A **Thread** with no **Tasks** is its title alone. A labeled Thread shows its **Area** as a small neutral tag, icon and name; an unlabeled Thread shows none. Colour on the board belongs to time. Dates are compact tokens rather than phrases, and a card under a heading that names its day (Today, or a day of **This week**) leaves the date to the heading, showing only its time when it has one.
- The Dashboard **can act on attention in place**: a card's rail — shown on hover or keyboard focus — completes the **Task** the card shows, and only that one, or sets, changes, and clears that **Task**'s date; on a card that shows no single **Task**, setting a date adds a **Task** named "Follow up" with it. A **Standalone Note** offers Archive and its **Follow-up date**. Focusing, removing, and choosing among **Tasks**, changing a **Thread**'s **Area**, editing its text, and resolving it still happen in **Thread** detail, where the Area is a chip in the header.
- **Thread** detail lists dated **Tasks** first, soonest first, then a quiet "No date" divider, then undated **Tasks** in capture order; the divider shows only when both groups exist. Each row's calendar button sets, changes, or clears that **Task**'s date, and capturing a **Task** never asks for one. Focus is a radio beside each Task: pressing it focuses that Task, and pressing the filled one unfocuses it. The **Focused Task** is tinted where it sits.
- Opening a card summons **Thread** detail in place; opening a **Note** opens the **Note view** over the current page.
- When nothing is open at all the board is replaced by a single line saying nothing is asking.
- Opening a **Thread** from any surface — the **Dashboard** or the palette — shows its detail pane in place over the current page; closing the pane returns the user to where they were. A Thread's own address is `/threads/$threadSlug`, which opens the pane over the Dashboard. The in-place behavior is recorded in ADR 0007.
- **Notes** have no surface of their own: they are on the **Dashboard**, and its **Notes** filter shows them alone. `/notes`, `/inbox`, and `?inbox=true` land on the Dashboard with that filter selected (ADR 0031, superseding ADR 0012).
- **Areas** are managed in one **Manage areas** dialog, opened from the palette or from the Dashboard's filter row, where it follows the Areas: rename, re-icon, reorder, delete, and add. The delete confirmation states how many open Threads will lose the label. A new Thread starts in the Area the Dashboard is filtered to, and the label can be cleared before saving; the **Notes** filter is not an Area, so a Thread captured under it starts with none.

## Note Handling

- A **Note** can be captured and edited with just a body; it has no title or type selector.
- Saved Note cards are read-only previews that open the **Note view**. **Thread Note** previews render Markdown in a bounded space; the Dashboard uses a two-line plain-text preview, and **History** one line.
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
- Completing any **Task**, focused or not, adds one **Activity Log** entry. A repeating Task keeps its identity, text, and focus and moves to its next occurrence; a one-off Task is removed. Completing a one-off **Focused Task** leaves the **Thread** unfocused: nothing is promoted. Completing every one-off **Task** leaves the **Thread** open.
- Skipping a repeating **Task** moves it to its next occurrence without an **Activity Log** entry. Setting or clearing a **Repeat** also adds none.
- Adding, editing, dating, removing, focusing, and unfocusing **Tasks** add no **Activity Log** entries. Removing the **Focused Task** leaves the **Thread** unfocused.
- **Activity Log** entries written under a former name (**Next Move**, **Move**) keep their wording and label.
- Adding, changing, or removing a **Thread**'s **Area** adds an **Activity Log** entry. Deleting an **Area** adds none: the label disappearing is not a change the user made to each Thread.
- Resolving a **Thread** adds an **Activity Log** entry.
- Resolving a **Thread** may include an optional resolution note; when present, it becomes an **Activity Log** entry.
- Resolving a **Thread** clears its **Tasks**, dated ones included, and its **Focused Task**; when **Tasks** are discarded this way, the resolution entry names them in capture order.
- Reopening a **Resolved Thread** makes it an **Open Thread** and adds an **Activity Log** entry.
- Reopening a **Thread** does not restore discarded **Tasks**, their dates, or a focus automatically.

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
- "Move", "Moves", "Focused Move": former names; use **Task**, **Tasks**, **Focused Task** (ADR 0033). Stored names keep "move": `moves_json`, `focused_move_id`, `move_completed`, `next_move_change`.
- "Next Move", "Up Next", "action queue", "next moves": former names; use **Tasks** (ADR 0022, ADR 0033). The group of **Threads** that was "Next moves" is **Ready to move**. **Activity Log** entries written under the old names keep their wording.
- "Project log": former name for a **Thread**'s timeline; use **Activity Log**. Manual continuity belongs in **Thread Notes**.
- "Health status", "Condition", "Standard": removed from **Area** (issue 371, ADR 0021). A part of life that needs a periodic look gets a **Thread** with a dated **Task**.
- "Definition of Done": project-management language, not a **Thread** concept; use **Summary** or the **Activity Log**.
- "Move a Note to a Thread": former action name; use **Add to thread** (ADR 0030). "Convert", "process", and "attach" stay out of the interface.
- "Done", "completed" for a **Note**: former words; use **archived** (ADR 0031). **Threads** keep **Resolve**. Stored values keep `done`.
- "Stale Thread": not part of the domain language; use the plain **Open Thread** group.
