# Area, Thread, and Task awareness model

Status: Amended by ADR 0010 — the Next Move stays singular and remains the only surfaced move, but a Thread may now hold known upcoming moves in an **Up Next** queue behind it.

Vita OS is shifting from a project/task-management model to a personal life-awareness model. We will use **Area**, **Thread**, and **Task** as the core product language because many important life situations need continuity, follow-up, and judgment rather than a defined project plan or task checklist.

## Considered Options

- **Keep Project / Item / Action queue**: familiar to the existing app and code, but pulls the product toward project management and makes slow-moving life situations feel like execution plans.
- **Use Thread / Task / Next Move**: better fits open loops, waiting, monitoring, and unresolved decisions while still allowing lightweight capture and concrete next action.

## Consequences

- **Thread** replaces Project as the canonical ongoing situation.
- **Task** replaces Item as the Inbox capture layer.
- **Next Move** is singular and replaces Action queue.
- **Follow-up** belongs to a Thread and is the core resurfacing mechanism.
- **Condition** replaces Health status as the manual judgment on an Area.
- Threads have an Open / Resolved lifecycle; manual states like active, waiting, paused, and monitoring are postponed.
- Tasks remain outside Threads. Moving a Task into a Thread consumes the Task and copies its text into the Thread as an Activity Log entry or Next Move.
