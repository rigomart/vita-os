# Follow-up dates

Standalone Notes have one optional Follow-up date, with the calendar-and-clock icon, picker, and explanation. The date places a Note on the Dashboard; an optional time orders it within its day. A Thread has no Follow-up date of its own: it comes back at its soonest dated Task (ADR 0032), covered in [Tasks](./tasks.md). Thread Notes have no date.

Status: Notes proven on 32224ed (Note compose, saved Note view, Notes card, Dashboard card actions, nested phone Note view at 390×844, Thread Note compose without a date). The Thread pane, drawer, resolve/reopen and Thread card steps this file once held moved to dated Tasks: proven on 3815ae6 by `flows/dated-tasks.flow` and `flows/resolve-reopen.flow`. Optional time entry on a Note was not re-driven.

## Sub-features

- `follow-up-note-capture` saves a standalone Note with a date.
- `follow-up-note-edit` reschedules in the Note view and clears from the Dashboard card or phone Note view.
- `follow-up-board` sets a Note's date from its Dashboard card and places it under the matching day.
- `follow-up-activity` keeps `follow_up_change` entries already written (a Thread's old Follow-up changes) rendering with the label `Follow-up date` and their recorded wording and timestamps. No new one is written.
- `follow-up-thread-note` omits the date picker from Thread Note compose.

## How to get to it (user POV)

- Choose New note, then Follow-up date before Add; open a saved Note for Set/Change follow-up date.
- Use a Note card's Set/Change follow-up date control on hover or keyboard focus.

## Driving it with agent-browser

Preconditions: `bun run verify up --instance follow-up-date`, `bun run verify signin --instance follow-up-date`, and `bun run verify doctor --instance follow-up-date` succeed. Every command below uses that isolated instance. Calendar day buttons are named like `Friday, October 2nd, 2026`; choose a current date from a fresh snapshot, or by `td[data-day='<YYYY-MM-DD>'] button` (see `flows/dated-tasks.flow`).

- **Capture.** Run `bun run verify browser --instance follow-up-date -- find role button click --name "New note" --exact`, then `find label "Note body" fill "Verify follow-up note"`, then `find role button click --name "Follow-up date" --exact`. Capture `follow-up-note-before`. Click a day, click Add, and `wait --text "Note added"`. Reload, then capture `follow-up-note-saved`. The card is under its day's heading on the list. `bun run verify d1 "SELECT body, attention_date, state FROM notes" --instance follow-up-date` confirms the saved date.
- **Note view.** Open `Open note: Verify follow-up note`, click `Change follow-up date`, and choose another day. Wait for the date button to be enabled, close the view, and confirm the new date with D1.
- **Dashboard card.** Click the Note card's `Change follow-up date`, click `Clear follow-up date`, reload, and capture `follow-up-note-cleared`. D1 shows `attention_date: null`. Click `Set follow-up date` on the card and choose today: the Note enters Now → Today.
- **Phone Note view.** Set viewport to `390 844`, choose `Notes` in the `Filter the board` row and unfold the folded `No date` above the list, then open the saved Note, then Change follow-up date. Capture `follow-up-note-phone-before`, click `Clear follow-up date`, reload, and confirm the null timestamp in D1. Return to `1440 900` afterwards.
- **Thread Note.** Open a Thread and choose `Write a note…`: the nested Thread Note composer has no Follow-up date control. Close the blank composer with Escape.
- **Old entries.** `bun run verify d1 "SELECT type, content FROM activity_log_entries" --instance follow-up-date` lists any `follow_up_change` rows an older build wrote; the Activity tab still renders them. A fresh instance has none.

## Gotchas

- Date edits save quietly. Wait for enabled controls and use a reload plus D1 as confirmation; no date-change toast exists.
- Shared names mean multiple date buttons can exist at once, and a Thread card's date button is now `Set date` / `Change date` (a Task's date). Scope by the current surface or use refs from a fresh snapshot.
- The physical Note column is `attention_date`; the app model and HTTP requests use `followUp`.
- Chrome's time input ignores `fill` and `keyboard type`. Click `Add time`, `press` each key (`3`, `3`, `0`, `p` for 3:30 PM), then click a day or press Enter. See `flows/dated-tasks.flow`.
