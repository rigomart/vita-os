# VitaOS

Personal life-management app. Holds the inventory of life-domains, multi-step efforts, and daily tactical items so the user's brain doesn't have to.

## Language

**Area**:
A stable life-domain with no end date (e.g. Family Health, Career). Has a manually-set health status.
_Avoid_: Category, tag, label.

**Project**:
A multi-step effort with a defined end state. Belongs to exactly one **Area**.
_Avoid_: Goal, initiative, epic.

**Item**:
A lightweight tactical entry — text + optional date + completed flag. Does **not** belong to an **Area**.
_Avoid_: Task, todo, ticket. (The product is deliberately not a "task manager".)

**Inbox**:
The single view for all **Items**, regardless of date or completion status. Unprocessed items appear first; completed items appear in a collapsible section below.
_Avoid_: Backlog.

**Action queue**:
The ordered list of tentative next steps on a **Project**. The first entry is effectively the next action; entries are suggestions, not commitments.
_Avoid_: Subtask list, todo list, checklist.

**Project log**:
The append-only timeline on a **Project**. Mixes auto-entries (field changes) with manual entries (note / decision / reference).
_Avoid_: Activity feed, audit log, comments.

**Health status**:
The user's manual judgment on an **Area**: `healthy | needs_attention | critical`. Never derived from project counts or activity.
_Avoid_: Score, rating, traffic light (informally fine; not a domain term).

## Relationships

- An **Area** has zero or more **Projects**; a **Project** belongs to exactly one **Area**.
- An **Item** belongs to no **Area** and no **Project**. (If it deserves an **Area**, it should be a **Project**.)
- A **Project** has one **Action queue** and one **Project log**.
- **Processing** an **Item** means assigning it to a **Project**: as a log note, as the new head of the **Action queue**, or by promoting it into a new **Project**. The **Item** is consumed (deleted) in all cases. Adding a date, editing text, completing, and discarding are *not* processing — they are inline actions on the row.
- An **Item** that has been processed no longer exists; its text lives on inside the **Project** it was assigned to.

## Example dialogue

> **Dev:** "If I drag an **Item** onto a **Project**, does the **Item** end up belonging to the **Project**?"
> **Builder:** "No. **Items** never belong to **Projects**. Processing it means we copy its text into the **Project log** as a `note` entry, or into the **Action queue** as the new first step — and then the **Item** itself is deleted. The data lives in the **Project**, not the **Item**."

> **Dev:** "What about adding a date to an **Item** — is that processing?"
> **Builder:** "No. Adding a date, editing text, completing, and discarding are all inline actions on the row. Processing specifically means consuming the **Item** into a **Project**."
