# Dashboard board

A signed-in user with open Threads or Notes sees the Dashboard board: three dated lanes (`Now`, `This week`, `Later`) and a wider, recessed `No date` tray that groups undated items under `Ready to move`, `Open`, and `Notes`. Threads and Notes share one card: a title, then the Focused Move or a two-line plain-text Note preview at full width, then a footer with the date token and, on a Thread, its Area tag on the left and the set-date and complete controls on the right, shown on hover or focus. A Note has no tag; a short margin rule at its left edge marks it. A late item gets a tint and a negative day token such as `-3d`. With nothing open, the board is replaced by `Nothing is asking for you.` Each dated lane groups its cards under level-3 headings for when they come due (ADR 0026), and `Later` starts folded.

Status: proven on ba85712 (lanes, tray groups, card rows and footer, late tint, empty lane placeholder, hover controls, `board-card-actions` at 1440×900; `board-stack` at 1024×768 and 390×844 with the tray folded and unfolded). `board-groups` and `board-later-fold` proven on the ADR 0026 branch at 1440×900, 1024×768, and 390×844. `board-time` proven on the ADR 0027 branch at 1440×900 (thread pane picker, Note card picker, Today ordering, Activity tab) and 1024×768 (thread drawer label); the Note view's picker and the Notes page card are not yet driven.

## Sub-features

- `board-empty` shows `Nothing is asking for you.` when no Thread or Note is open.
- `board-lanes` sorts dated items into `Now` (late or due today), `This week` (the next six days), and `Later`, each with a count and a hint. An empty lane shows a dashed `Nothing here.` placeholder.
- `board-tray` groups undated items in the `No date` tray under `Ready to move` (Threads with Moves), `Open` (Threads without), and `Notes`.
- `board-card` renders Threads and Notes with the same three rows. A Thread card shows `link "<title>"`, the Focused Move, `Set Follow-up`, and `Complete “<move>”`. A Note card shows `button "Open note: <plain-text preview>"`, `Set attention date`, and `Mark note done`.
- `board-card-actions` completes a Move, dates a Note, and marks a Note done from the card.
- `board-groups` heads each dated lane's runs: `Late` and `Today` in `Now`; `Tomorrow` (hint the weekday) and then each weekday (hint `3d`) in `This week`; `In 1 week` (hint `Oct 8–14`), `In 2 weeks`, `In 3 weeks`, then month names in `Later`. Cards under `Today` or a weekday show no date token; their date is `button "Change Follow-up"` or `button "Change attention date"`, revealed on hover. Cards under `Late` and Later's groups keep their token.
- `board-time` (ADR 0027): a Follow-up or Attention Date may carry a time, set from the time field (`InputTime "Time"`) under every date picker's calendar. Within a day, untimed items come first, then timed ones in time order. A timed card under `Today` or a weekday shows the time alone (`3 PM`, `9:30 AM`); elsewhere it follows the date token (`−2d · 9:30 AM`). The thread pane's button reads `Follow up Oct 1 · 3 PM`, and the Activity tab reads `Oct 1, 2026 → Oct 1, 2026 · 3 PM`.
- `board-later-fold` starts `Later` folded at every size: at 1440 a narrow rail between `This week` and `No date`, below `xl` one ruled heading spanning the row. Its trigger is `button "Later <n> next <token>"` with `expanded=false`. At 1440 the rail draws a horizon under `next`: bands `1w`, `2w`, `3w`, then month abbreviations, one mark per item (outlined for a Note, the soonest in the accent), and `+<n> later` at the foot for items past the end of the month nine weeks out. The horizon is `aria-hidden`; each mark carries `data-label="<title> · <token>"`, shown as a tooltip on hover (`hover 'xpath=//span[starts-with(@data-label,"<title>")]'`). Clicking it unfolds the lane; clicking its heading again folds it. A card dated into a folded Later bumps the count.
- `board-stack` stacks the lanes two per row at `md` and in one column on a phone. `Later` and the `No date` tray span the row at `md`; on a phone both start folded.

## How to get to it (user POV)

- Sign in. The Dashboard at `/` is the landing page.
- Create Threads per [Create a thread](./create-thread.md), give them Moves per [Moves](./moves.md), and capture Notes per [Capture a note](./capture-note.md). Set a date with `Add a follow-up…` in the thread pane or `Attention date` in the `New note` dialog.

## Driving it with agent-browser

Preconditions:

- Signed in at 1440×900 with an empty D1. `bun run verify shot board-empty` shows `Nothing is asking for you.`
- Seed through the UI so every lane and tray group has an item. The date pickers list days as buttons named like `Today, Monday, September 28th, 2026`, and past days are allowed, which gives a late item:
  - A Thread with an Area, a long Focused Move, and a past follow-up lands in `Now` with the tint and `-3d`.
  - A Thread with a follow-up two to six days out lands in `This week`.
  - A Thread with a Move and no date lands in `No date` → `Ready to move`. One with no Moves lands in `Open`.
  - A Note with an `Attention date` lands in its dated lane with a margin rule and no tag. A Note without one lands in `No date` → `Notes`.

- **Lanes and tray.** Run `bun run verify open /`, `bun run verify browser -- wait --text "Ready to move"`, then `bun run verify shot board-desktop`. The snapshot has headings `Now <n> Late or due today`, `This week <n> The next six days`, a folded `Later <n> next <token>`, `No date <n> Not on the calendar` (level 2), the date groups (`Late <n>`, `Today <n>`, `Tomorrow <n> <weekday>`, `<weekday> <n> <d>d`), and the tray groups `Ready to move <n>`, `Open <n>`, `Notes <n>` (level 3).
- **Later fold.** Run `bun run verify browser -- find role button click --name "Later"`, then `wait --text "<a Later item>"` and `shot board-later-open`: Later is a full column with `In 1 week`-style groups, and the trigger reads `Later <n> Dated beyond this week` with `expanded=true`. Click it again to fold. To see an arrival, open a This week card's revealed `Change attention date` (scope with XPath on the card's `li`), pick a day 7+ days out, and `snapshot -s 'section[aria-label="Later"]'`: the count is one higher.
- **Hover controls.** Run `bun run verify browser -- hover 'xpath=//a[normalize-space()="<title>"]'`, then `bun run verify shot board-hover`. The PNG shows the set-date and complete controls at the right of that card's footer.
- **Card actions.** Run `bun run verify browser -- snapshot -i -s 'aside'` to list the tray controls. Run `bun run verify browser -- find role button click --name "Complete “<move>”" --exact`. For a Note, run `find role button click --name "Set attention date" --exact`, click a day button, `press Escape`, then `find role button click --name "Mark note done" --exact`. Run `bun run verify browser -- reload`, then `bun run verify shot board-after-actions`. The Thread moves from `Ready to move` to `Open`, and the done Note leaves the board. Run `bun run verify d1 "SELECT title, moves_json FROM threads"` and `bun run verify d1 "SELECT body, state, attention_date FROM notes"`: the Thread's `moves_json` is null, and the Note has `state` `done` and the chosen `attention_date`.
- **Stacked.** Run `bun run verify browser -- set viewport 1024 768`, `reload`, and `screenshot --full <evidence dir>/board-1024.png`: `Now` and `This week` side by side, then a folded `Later` heading and the tray, each spanning the row. Run `set viewport 390 844`, `reload`, and `screenshot --full <evidence dir>/board-390.png`: one column, with `Later` and `No date` folded. Run `find role button click --name "No date"` and `wait --text "Ready to move"` to unfold the tray. Run `set viewport 1440 900` afterwards.

## Gotchas

- The time field is Chrome's native time input. `find label "Time" fill "15:00"` and `keyboard type` leave it empty. Click its first segment with `find role spinbutton click --name "Hours"`, then `press` each key (`3`, `0`, `0`, `p`), and confirm with `get value 'input[type=time]'` (`15:00`). Then click a day (saves the day at that time) or `press Enter` (saves the time on the day already set). One time edit writes one `follow_up_change` entry.
- Card controls only show on hover or focus. They still exist in the accessibility snapshot, so `find role button` reaches them without a hover.
- A card whose footer has no date and no Area keeps an empty footer row at rest, which holds space for the hover controls.
- `Mark note done` with `--exact` matches the first note card on the board, not necessarily the one you just dated. Scope with XPath when several Notes are open.
- A full-page screenshot on a phone viewport draws the fixed dock over the middle of the page.
- Seeding Threads in a tight script loop can hang the agent-browser daemon (`Resource temporarily unavailable`). `bun run verify down` then `up` recovers, but `up` signs up a new throwaway user, so seed again.
