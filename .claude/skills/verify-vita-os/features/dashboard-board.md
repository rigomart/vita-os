# Dashboard board

A signed-in user with open Threads or Notes sees the Dashboard board: three dated lanes (`Now`, `This week`, `Later`) and a wider, recessed `No date` tray that groups undated items under `Ready to move`, `Open`, and `Notes`. Threads and Notes share one card: a title, then the Focused Task or a two-line plain-text Note preview at full width, then a footer with the date token and, on a Thread, its Area tag on the left and the set-date and complete controls on the right, shown on hover or focus. A Note has no tag; a short margin rule at its left edge marks it. A late item gets a tint and a negative day token such as `-3d`. With nothing open, the board is replaced by `Nothing is asking for you.` Each dated lane groups its cards under level-3 headings for when they come due (ADR 0026), and `Later` starts folded.

Status: proven on ba85712 (lanes, tray groups, card rows and footer, late tint, empty lane placeholder, hover controls, `board-card-actions` at 1440×900; `board-stack` at 1024×768 and 390×844 with the tray folded and unfolded). `board-groups` and `board-later-fold` proven on the ADR 0026 branch at 1440×900, 1024×768, and 390×844. `board-time` proven on the ADR 0027 branch at 1440×900 (thread pane picker, Note card picker, Today ordering, Activity tab) and 1024×768 (thread drawer label); the Note view's picker is not yet driven. The Note card's `Archive note` proven on 446055e at 1440×900.

## Sub-features

- `board-empty` shows `Nothing is asking for you.` when no Thread or Note is open.
- `board-lanes` sorts dated items into `Now` (late or due today), `This week` (the next six days), and `Later`, each with a count and a hint. An empty lane shows a dashed `Nothing here.` placeholder.
- `board-tray` groups undated items in the `No date` tray under `Ready to move` (Threads whose Tasks are all undated), `Open` (Threads with no Tasks), and `Notes`.
- `board-card` renders Threads and Notes with the same three rows. A Thread card shows `link "<title>"`, the Task that leads it (the dated Task that placed it, else the Focused Task, else the only Task, else `N tasks · none focused`), `Set date` / `Change date`, and `Complete “<task>”`. A Note card shows `button "Open note: <plain-text preview>"`, `Set follow-up date`, and `Archive note`.
- `board-card-actions` completes a Task, dates a Note, and archives a Note from the card (`Note archived`).
- `board-filter-notes` filters the board to Notes alone; see [Notes on the Dashboard](./notes-on-the-dashboard.md).
- `board-groups` heads each dated lane's runs: `Late` and `Today` in `Now`; `Tomorrow` (hint the weekday) and then each weekday (hint `3d`) in `This week`; `In 1 week` (hint `Oct 8–14`), `In 2 weeks`, `In 3 weeks`, then month names in `Later`. Cards under `Today` or a weekday show no date token; a Thread card's date is `button "Change date"` and a Note card's `button "Change follow-up date"`, revealed on hover. Cards under `Late` and Later's groups keep their token.
- `board-time` (ADR 0027): a dated Task or a Note's Follow-up date may carry a time, set from `button "Add time"` under every date picker's calendar, which opens a focused, type-only `InputTime "Time"` with `button "Remove time"` beside it. A date that already has a time opens with the field showing. Within a day, untimed items come first, then timed ones in time order. A timed card under `Today` or a weekday shows the time alone (`3 PM`, `9:30 AM`); elsewhere it follows the date token (`−2d · 9:30 AM`). A dated Task's time shows in its row and on the Thread's card the same way; changing a Task's date or time writes no Activity Log entry (ADR 0032). Not re-driven since Follow-up dates moved to Tasks.
- `board-later-fold` starts `Later` folded at every size: at 1440 a narrow rail between `This week` and `No date`, below `xl` one ruled heading spanning the row. Its trigger is `button "Later <n> next <token>"` with `expanded=false`. At 1440 the rail draws a horizon under `next`: bands `1w`, `2w`, `3w`, then month abbreviations, one mark per item (outlined for a Note, the soonest in the accent), and `+<n> later` at the foot for items past the end of the month nine weeks out. The horizon is `aria-hidden`; each mark carries `data-label="<title> · <token>"`, shown as a tooltip on hover (`hover 'xpath=//span[starts-with(@data-label,"<title>")]'`). Clicking it unfolds the lane; clicking its heading again folds it. A card dated into a folded Later bumps the count.
- `board-stack` stacks the lanes two per row at `md` and in one column on a phone. `Later` and the `No date` tray span the row at `md`; on a phone both start folded.

## How to get to it (user POV)

- Sign in. The Dashboard at `/` is the landing page.
- Create Threads per [Create a thread](./create-thread.md), give them Tasks per [Tasks](./tasks.md), and capture Notes per [Capture a note](./capture-note.md). Date a Thread by giving one of its Tasks a date (`Set date` on the Task row in the thread pane, or on the card) and a Note with `Follow-up date` in the `New note` dialog. `flows/dated-tasks.flow` drives this end to end.

## Driving it with agent-browser

Preconditions:

- Signed in at 1440×900 with an empty D1. `bun run verify shot board-empty` shows `Nothing is asking for you.`
- Seed through the UI so every lane and tray group has an item. The date pickers list days as buttons named like `Today, Monday, September 28th, 2026`, and past days are allowed, which gives a late item:
  - A Thread with an Area, a long Task, and a past Task date lands in `Now` with the tint and `-3d`.
  - A Thread with a Task dated two to six days out lands in `This week`.
  - A Thread with only undated Tasks lands in `No date` → `Ready to move`. One with no Tasks lands in `Open`.
  - A Note with an `Follow-up date` lands in its dated lane with a margin rule and no tag. A Note without one lands in `No date` → `Notes`.

- **Lanes and tray.** Run `bun run verify open /`, `bun run verify browser -- wait --text "Ready to move"`, then `bun run verify shot board-desktop`. The snapshot has headings `Now <n> Late or due today`, `This week <n> The next six days`, a folded `Later <n> next <token>`, `No date <n> Not on the calendar` (level 2), the date groups (`Late <n>`, `Today <n>`, `Tomorrow <n> <weekday>`, `<weekday> <n> <d>d`), and the tray groups `Ready to move <n>`, `Open <n>`, `Notes <n>` (level 3).
- **Later fold.** Run `bun run verify browser -- find role button click --name "Later"`, then `wait --text "<a Later item>"` and `shot board-later-open`: Later is a full column with `In 1 week`-style groups, and the trigger reads `Later <n> Dated beyond this week` with `expanded=true`. Click it again to fold. To see an arrival, open a This week card's revealed `Change follow-up date` (scope with XPath on the card's `li`), pick a day 7+ days out, and `snapshot -s 'section[aria-label="Later"]'`: the count is one higher.
- **Hover controls.** Run `bun run verify browser -- hover 'xpath=//a[normalize-space()="<title>"]'`, then `bun run verify shot board-hover`. The PNG shows the set-date and complete controls at the right of that card's footer.
- **Card actions.** Run `bun run verify browser -- snapshot -i -s 'aside'` to list the tray controls. Run `bun run verify browser -- find role button click --name "Complete “<task>”" --exact`. For a Note, run `find role button click --name "Set follow-up date" --exact`, click a day button, `press Escape`, then `find role button click --name "Archive note" --exact` and `wait --text "Note archived"`. Run `bun run verify browser -- reload`, then `bun run verify shot board-after-actions`. The Thread moves from `Ready to move` to `Open`, and the archived Note leaves the board. Run `bun run verify d1 "SELECT title, moves_json FROM threads"` and `bun run verify d1 "SELECT body, state, attention_date FROM notes"`: the Thread's `moves_json` is null, and the Note has `state` `done` and the chosen `attention_date`.
- **Stacked.** Run `bun run verify browser -- set viewport 1024 768`, `reload`, and `screenshot --full <evidence dir>/board-1024.png`: `Now` and `This week` side by side, then a folded `Later` heading and the tray, each spanning the row. Run `set viewport 390 844`, `reload`, and `screenshot --full <evidence dir>/board-390.png`: one column, with `Later` and `No date` folded. Run `find role button click --name "No date"` and `wait --text "Ready to move"` to unfold the tray. Run `set viewport 1440 900` afterwards.

## Gotchas

- The time field is Chrome's native time input. `find label "Time" fill "15:00"` and `keyboard type` leave it empty. Click `Add time` (the field takes focus on its hours), then `press` each key (`3`, `0`, `0`, `p`), and confirm with `get value 'input[type=time]'` (`15:00`). Then click a day (saves the day at that time) or `press Enter` (saves the time on the day already set). A Task date edit writes no Activity Log entry.
- Card controls only show on hover or focus. They still exist in the accessibility snapshot, so `find role button` reaches them without a hover.
- A card whose footer has no date and no Area keeps an empty footer row at rest, which holds space for the hover controls.
- `Archive note` with `--exact` matches the first note card on the board, not necessarily the one you just dated. Scope with XPath when several Notes are open: `click 'xpath=//li[.//button[starts-with(@aria-label,"Open note: <text>")]]//button[@aria-label="Archive note"]'`.
- A full-page screenshot on a phone viewport draws the fixed dock over the middle of the page.
- Seeding Threads in a tight script loop can hang the agent-browser daemon (`Resource temporarily unavailable`). `bun run verify down` then `up` recovers, but `up` signs up a new throwaway user, so seed again.
