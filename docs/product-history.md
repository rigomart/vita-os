# Vita OS: Product History

This page records how the product direction changed from the first one. `docs/adr/` remains the record of each decision.

The first direction (2025/12/01) described a life-domain dashboard: Areas with a manual Condition, Threads under Areas, a single Next Move, and an Inbox of Tasks to process. Daily use pushed the product narrower. Each change below removed a structure the user was maintaining for the app's sake.

| Then | Now | Why | Decision |
| --- | --- | --- | --- |
| Every Thread belongs to an Area; each Area has a Condition | An Area is an optional label with no state | Capture always asked "which part of life?" first. Condition was a judgment nothing prompted, so it was stale or a chore. The Dashboard took its urgency from dates anyway. | ADR 0021 |
| Inbox Tasks: Done, Discard, Move to Thread, When | Standalone Notes that need no processing; Thread Notes on Threads | A saved body is already useful, whether information, a thought, or an action. Classifying and processing it added work before capture counted. | ADR 0015, 0016 |
| One Next Move, then an Up Next queue | Peer Moves with an optional Focus | Most situations have no known order. The queue turned capture order into a priority the user never chose. | ADR 0022 |
| A read-only list of status groups | Time columns with an unscheduled margin, actionable in place | One column wasted a desktop screen, and a board that cannot fix what it shows is always slightly wrong. | ADR 0017 |
| Manual Activity Log entries | An automatic Activity Log plus Thread Notes | Prose and change history were mixed. Separating them keeps Notes editable and the changelog trustworthy. | ADR 0016 |
| A Notes panel beside the board; Notes marked done | Notes on the Dashboard with a Notes filter; Notes archived and found in History | The panel listed the same Notes the board already showed. "Done" claimed a fact or a thought was a finished task. | ADR 0031 |
