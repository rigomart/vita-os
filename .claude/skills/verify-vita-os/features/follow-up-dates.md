# Follow-up dates

Threads and standalone Notes use one optional Follow-up date, with the same calendar-and-clock icon, picker, and explanation. The date places content on the Dashboard; optional time orders it within its day. Thread Notes have no independent date. Resolving a Thread clears its date, and reopening keeps it unset.

Status: proven on 32224ed plus the unified Follow-up date working-tree change (Note compose, saved Note view, Notes card, both Dashboard card actions, Thread pane at 1440×900, Thread drawer at 1024×768, nested phone Note view at 390×844, Thread Note compose without a date, resolve/reopen). Optional time entry was not re-driven; automated tests cover it.

## Sub-features

- `follow-up-note-capture` saves a standalone Note with a date.
- `follow-up-note-edit` reschedules in the Note view and clears from the Dashboard card or phone Note view.
- `follow-up-board` sets dates from both kinds of Dashboard card and places them under the matching day.
- `follow-up-thread` sets a date in the desktop pane and clears it in the smaller-screen drawer.
- `follow-up-lifecycle` clears a Thread's date on resolve and does not restore it on reopen.
- `follow-up-activity` uses Follow-up date as the Activity Log's accessible change label while retaining recorded wording and timestamps.
- `follow-up-thread-note` omits the date picker from Thread Note compose.

## How to get to it (user POV)

- Choose New note, then Follow-up date before Add; open a saved Note for Set/Change follow-up date.
- Open Notes and use Set/Change follow-up date on a Note card.
- Open a Thread and use Set follow-up date beside Tasks, or Change follow-up date beside its saved date.
- Use a Dashboard card's Set/Change follow-up date control on hover or keyboard focus.
- Use Thread actions → Resolve; reopen the resolved Thread at its own address and choose Thread actions → Reopen.

## Driving it with agent-browser

Preconditions: `bun run verify up --instance follow-up-date`, `bun run verify signin --instance follow-up-date`, and `bun run verify doctor --instance follow-up-date` succeed. Every command below uses that isolated instance. Calendar labels below are the exact dates driven on October 1, 2026; choose a current date from a fresh snapshot on later runs.

- **Capture.** Run `bun run verify browser --instance follow-up-date -- find role button click --name "New note" --exact`, then `find label "Note body" fill "Verify unified follow-up note 32224ed"`, then `find role button click --name "Follow-up date" --exact`. Capture `bun run verify shot follow-up-note-before --instance follow-up-date`. Click `Friday, October 2nd, 2026`, click Add, and `wait --text "Note added"`. Reload, then capture `follow-up-note-saved`. The card is in This week → Tomorrow. `bun run verify d1 "SELECT body, attention_date, state FROM notes" --instance follow-up-date` confirms the saved date.
- **Note view and Notes card.** Open `Open note: Verify unified follow-up note 32224ed`, click `Change follow-up date`, and choose `Saturday, October 3rd, 2026`. Wait for the date button to be enabled, close the view, and choose the `Notes` filter link (the one after `Manage areas`). Capture `follow-up-notes-before-clear`. Take `snapshot -i` and click the Note card's date button by its fresh ref. (Mapped from source: this step drove the since-removed Notes panel and is not re-driven.) Click `Clear follow-up date`, reload, and capture `follow-up-note-cleared`. D1 shows `attention_date: null`.
- **Dashboard actions.** Close Notes, click the sole `Set follow-up date`, and choose `Today, Thursday, October 1st, 2026`; the Note enters Now → Today. Create `Verify unified follow-up thread 32224ed` through New thread, fill Thread title, click Create, and `wait --text "Thread created"`. After the Thread's date is cleared below, close its pane, click the sole `Set follow-up date`, and choose October 3. Reload and capture `follow-up-board-after`. `SELECT title, follow_up FROM threads` confirms the date; the Thread is in This week → Saturday.
- **Thread pane and drawer.** At 1440×900 take `snapshot -i` and click the Thread attention region's `Set follow-up date` by ref. Capture `follow-up-thread-before`, choose October 2, reload, and capture `follow-up-thread-saved`. Set viewport to `1024 768`, capture `follow-up-thread-drawer-before`, click `Clear follow-up date`, reload, and capture `follow-up-thread-drawer-cleared`. D1 confirms `follow_up: null`. Choose `Write a note…` and take a snapshot: the nested Thread Note composer has no Follow-up date control. Close the blank composer with Escape, then return to `1440 900`.
- **Phone Note view.** Set viewport to `390 844`, choose `Notes` in the `Filter the board` dropdown and unfold `No date`, then open the saved Note, then Change follow-up date. Capture `follow-up-note-phone-before`, click `Clear follow-up date`, reload, and confirm the null timestamp in D1. Use a fresh snapshot before reopening the Note, then capture its unset date. Return to `1440 900` afterwards.
- **Resolve/reopen.** Open the dated Thread, choose Thread actions → Resolve, capture `follow-up-resolve-before`, and click Resolve thread. The server confirms `Thread resolved`. Open the Thread's observed `/threads/<slug>` address, capture `follow-up-thread-resolved`, and read `SELECT title, state, follow_up FROM threads`: resolved with a null date. Choose Thread actions → Reopen, `wait --text "Thread reopened"`, reload, capture `follow-up-thread-reopened`, and confirm open with a null date.
- **Activity.** In the Thread pane choose Activity, take a fresh snapshot, and wait for `Set to Oct 3, 2026` before capturing `follow-up-thread-activity`. The wait confirms the saved date event renders; automated tests check the accessible Follow-up date label. `bun run verify d1 "SELECT type, content FROM activity_log_entries" --instance follow-up-date` confirms the original recorded wording.

## Gotchas

- Date edits save quietly. Wait for enabled controls and use a reload plus D1 as confirmation; no date-change toast exists.
- Shared names mean multiple date buttons can exist at once. Scope by the current surface or use refs from a fresh snapshot.
- Drawer transitions can cover a Close button. Escape closes a blank Thread Note composer reliably; wait for the containing drawer before the next action.
- The physical Note column remains `attention_date` for saved-data compatibility. The app model and current HTTP requests use `followUp`; the API also accepts the old field and route for already-open clients.
