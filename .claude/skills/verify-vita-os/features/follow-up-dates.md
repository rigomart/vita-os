# Follow-up dates

Standalone Notes have one optional Follow-up date, with the calendar-and-clock icon and the date picker. The date places a Note on the Dashboard; an optional time orders it within its day. A Thread has no Follow-up date of its own: it comes back at its soonest dated Task (ADR 0032), covered in [Tasks](./tasks.md). Thread Notes have no date. A saved Standalone Note's date can carry a Repeat (ADR 0041), set from the same picker's `Repeat, <rhythm>` row as a Task's; see `follow-up-repeat` below.

Status: repeating Notes (monthly Repeat, Complete, Late, Archive and Unarchive keeping the Repeat, Clear, Add to thread) proven in #462 by `repeating-notes.spec.ts` at 1440×900 and 1024×768; a Thread's dated Tasks by `dated-tasks.spec.ts` and `resolve-reopen.spec.ts` (see [Tasks](./tasks.md)). The rest of the Notes recipe was proven on 32224ed (#388). Not driven: optional time entry on a Note, a repeating Note on the phone (390×844), Custom… repeats on a Note.

## Sub-features

- `follow-up-note-capture` saves a standalone Note with a date.
- `follow-up-note-edit` reschedules in the Note view and clears from the Dashboard card or phone Note view.
- `follow-up-board` sets a Note's date from its Dashboard card and places it under the matching day.
- `follow-up-activity` keeps `follow_up_change` entries already written (a Thread's old Follow-up changes) rendering with the label `Follow-up date` and their recorded wording and timestamps. No new one is written.
- `follow-up-thread-note` omits the date picker from Thread Note compose.
- `follow-up-repeat` gives a saved dated Standalone Note a Repeat from its card's or Note view's picker: `Repeat, Never`, then the Task presets including `Every month on the <day>`; it reads `Repeat, Monthly on the 5th`. Compose (New note) has no Repeat row. A repeating Note's date control (`Change follow-up date`) holds `img "Repeats monthly on the 5th"` (`data-slot=repeat-glyph`) under any heading (under `Today` the token is the glyph alone; under `Late` it reads `-6d`), and the card offers `Complete · back <Mmm d>` in place of `Archive note`. Complete moves the Note to its next occurrence (missed ones collapse to the first not before today), writes no Activity Log entry, and shows no toast. Clearing the date clears the Repeat (`notes.repeat` null) and the card offers `Archive note` again. Stored as canonical JSON in `notes.repeat` (`{"kind":"monthly","day":5}`).

## How to get to it (user POV)

- Choose New note, then Follow-up date before Add; open a saved Note for Set/Change follow-up date.
- Use a Note card's Set/Change follow-up date control on hover or keyboard focus.

## Driving it

Spec: `apps/e2e/tests/repeating-notes.spec.ts` covers Repeating Note below. The other steps have no spec of their own; drive them in a scratch spec.

The date picker (ADR 0040) opens on a menu: quick picks named with the day they land on (`button "Tomorrow, Mon, Oct 12"`; a pick that lands on an earlier one's day is left out), `Pick a date…` (the calendar, with `Back`), the `group "Time"` of chips (`9 AM`, `12 PM`, `3 PM`, `6 PM`, `Other time`), `Repeat, <rhythm>` on a Task, and Clear. Every choice saves as it is made. Match a quick pick by its prefix (`getByRole("button", { name: /^Tomorrow, / })`). Calendar day buttons are named like `Friday, October 2nd, 2026`; for a day computed from today use `page.locator("td[data-day='<YYYY-MM-DD>'] button")` (see `dated-tasks.spec.ts`).

- **Capture.** Click `button "New note"` (`exact: true`), fill `Note body` with `Verify follow-up note <stamp>`, then click `button "Follow-up date"` (`exact: true`). `shot("follow-up-note-before")`. Click a quick pick (or `Pick a date…` and a day), click `Add`, and expect `Note added`. Reload, then `shot("follow-up-note-saved")`. The card under its day's heading (`getByRole("region", { name: "Tomorrow" })`) proves the saved day; `SELECT body, attention_date, state FROM notes WHERE user_id = '${account.id}'` shows the exact stored timestamp when the time matters.
- **Note view.** Open `Open note: Verify follow-up note <stamp>`, click `Change follow-up date`, and choose another day from the quick picks or `Pick a date…`. Wait for the date button to be enabled, close the view, reload, and expect the card under the new day's heading.
- **Dashboard card.** Click the Note card's `Change follow-up date`, click `Clear follow-up date`, reload, and `shot("follow-up-note-cleared")`. The card is back under `No date`. Click `Set follow-up date` on the card and choose today: the Note enters Now → Today.
- **Phone Note view.** `page.setViewportSize({ width: 390, height: 844 })`, choose `Notes` in the `Filter the board` row and unfold the folded `No date` above the list, open the saved Note, then `Change follow-up date`. `shot("follow-up-note-phone-before")`, click `Clear follow-up date`, reload, and expect the Note back under the folded `No date`.
- **Repeating Note.** `repeating-notes.spec.ts` checks compose has no Repeat row, sets the monthly preset on a Today card (glyph, `Complete · back <date>`, no `Archive note`), completes it (gone from Today, the same day next month, no Activity Log entry naming it), dates a Note six days back (one `Late` card) and completes it, checks the Note view's glyph and `Complete · back` beside `Archive`, archives and finds it in History, unarchives it (date and Repeat kept), clears its date (back under `No date` with `Archive note`, `repeat` null), adds a repeating Note to a Thread (a dated Task with the glyph), and sets and completes a card at 1024×768.
- **Thread Note.** Open a Thread and click `Write a note…`: the nested Thread Note composer has no Follow-up date control. Close the blank composer with Escape.
- **Old entries.** `SELECT type, content FROM activity_log_entries WHERE user_id = '${account.id}'` lists any `follow_up_change` rows an older build wrote; the Activity tab still renders them. A new user has none.

## Gotchas

- A Note card's picker closes after a Repeat choice, and so does the Note view's; a Task row's stays open. Wait for `page.locator("[data-slot=popover-content]")` to be hidden, then reload.
- Notes a week or more out are one-line rows (`button "Open note: <preview>"` beside a `25d` or `Nov 11` token) with no card controls and no glyph. Open the Note view to Complete or Clear them.
- Date edits save quietly. Wait for enabled controls and use a reload as confirmation; no date-change toast exists.
- Shared names mean multiple date buttons can exist at once, and a Thread card's date button is now `Set date` / `Change date` (a Task's date). Scope by the current surface (the card, the Note view's dialog).
- The physical Note column is `attention_date`; the app model and HTTP requests use `followUp`.
- A time needs a day first: the `Time` chips are disabled on an undated item. A chip saves in one click; the chosen chip again removes the time. For any other time click `Other time`, type `330p` (it offers `3:30 PM`; a bare `7` offers `7 AM` and `7 PM`), and press Enter. See `dated-tasks.spec.ts`.
