# Activity Log

A Thread's `Activity` tab is its read-only changelog, written by the product. One rail runs behind every day, and each entry is a full sentence on it with its kind's icon as the node: `Completed <Task text>`, `Moved to <Area>, from <Area>`, `Added to <Area>`, `Removed from <Area>`, `Reopened the Thread`, `Resolved the Thread`. Nothing is cut off: long text wraps. A resolution quotes its resolution note under it and lists the open Tasks it dropped (`Dropped 2 open Tasks`). Entries are grouped under `Today`, `Yesterday`, a weekday and date this year, or a full date for older years, newest first, twenty at a time with `Show earlier`.

Status: proven on 5847ec3 plus the uncommitted Sentences working tree, by `resolve-reopen.flow`, `tasks.flow`, `thread-drawer.flow`, and by hand at 1440×900 (side pane) and 1024×768 (drawer). Not driven: `Show earlier` (unit-tested), Area entries, legacy Next move and Follow-up date entries, the phone width.

## Sub-features

- `log-sentence`: each entry reads as one sentence, the action muted and what it happened to in full; a screen reader hears its kind first (`Task done: Completed …`).
- `log-wrap`: long Task text and URLs wrap within the pane; nothing truncates.
- `log-resolution`: a resolution shows its note quoted and the Tasks it dropped.
- `log-days`: day headings sit beside one unbroken rail.
- `log-more`: `Show earlier` loads the next twenty.

## How to get to it (user POV)

Open a Thread (Dashboard card, or `Meta+k` → History for a resolved one) and choose the `Activity` tab beside `Notes`. Entries appear when a Task is completed, the Area changes, or the Thread is resolved or reopened.

## Driving it with agent-browser

Preconditions: signed in; a Thread with a long Task completed and then resolved with a note. Build it through the real UI:

```
open /
browser -- find role button click --name "New thread" --exact
browser -- find label "Thread title" fill "Long log ${STAMP}"
browser -- find role button click --name Create --exact
see text "Thread created"
browser -- find label "Add a task" fill "Email the letting agent with the move-in inventory and the photos of the carpet in the second bedroom ${STAMP}"
browser -- press Enter
browser -- wait 1500
browser -- click 'xpath=//ul[@aria-label="Tasks"]/li[1]//button[@aria-label="Complete task"]'
browser -- wait 1500
browser -- find role button click --name "Thread actions" --exact
browser -- find role menuitem click --name Resolve --exact
browser -- find label "Resolution note" fill "Keys handed back ${STAMP}"
browser -- find role button click --name "Resolve thread" --exact
see text "Thread resolved"
```

Then reload, reopen it from `Meta+k` → `History` → `option "Long log ${STAMP}"`, `settled '[data-slot=thread-detail-pane]'`, and click `tab "Activity"`. Check `see text "Keys handed back ${STAMP}"` and `see text "Completed Email the letting agent …"`. Wrapping is a layout fact: `browser -- wait --fn "[...document.querySelectorAll('[aria-label=\"Activity log\"] li p')].some(p => p.textContent.includes('Email the letting agent') && p.getBoundingClientRect().height > 30 && p.scrollWidth <= p.clientWidth)"`. For the drawer, `set viewport 1024 768`, reopen through `Search, Command K`, `settled '[data-vaul-drawer]'`, then the same checks.

## Gotchas

- The log's items are plain text, so `snapshot` and `see listitem` don't find them; check with `see text`.
- In the drawer, click `Activity` only after `settled '[data-vaul-drawer]'`: a click during the slide lands outside and closes it.
- A resolution's note and dropped Tasks are read back from the entry's stored `content` (`Resolved thread: <note> — discarded tasks: "a", "b"`); a note containing ` — discarded tasks: ` splits in the wrong place.
- While resolved, a Thread shows no Tasks, so a dropped Task's text on screen can only come from the log.
