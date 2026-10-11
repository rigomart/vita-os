# Dashboard board

A signed-in user with open Threads or Notes sees the Dashboard (ADR 0037): under the sky header, one list of every dated item, grouped by when it comes due (`Late`, `Today`, `Tomorrow`, each weekday, `In 1 week`, …, month names), each group on a file tab, and `No date` with its runs `Ready to move`, `Open`, and `Notes`. From `lg` No date is an aside beside the list; below `lg` it leads the list, folded to one line. Threads and Notes share one card: a title, then the Focused Task or a two-line plain-text Note preview, then a footer with the date token and, on a Thread, its Area tag on the left and the set-date and complete controls on the right, shown on hover or focus. Every card is a sheet with a border on its group's fill, and two cards in a row end together with their footers on one line. A Note has no tag; its sheet's top right corner is folded over (ADR 0038). From `In 1 week` on, items are one-line rows. With nothing open, the list is replaced by `Nothing is asking for you.`

Status: card sheets (ADR 0038) proven on the board-cards-as-sheets branch (base c8cc3f5) at 1440×900, dark and light, with `dated-tasks.flow` and `notes-dashboard.flow`; the rest proven on the ADR 0037 working tree (base c5dc437) at 1440×900, 1024×768 and 390×844, dark and light: list groups, two cards per row, one-line rows, Late fill without card tint, No date aside and folded tab, filter overflow with a folded Area selected, opening and closing a Thread, completing a Task from a card. `board-time` last proven on the ADR 0027 branch and re-driven by `dated-tasks.flow`.

## Sub-features

- `board-empty` shows `Nothing is asking for you.` when no Thread or Note is open, and no No date aside.
- `board-list` is `region "<group>"` per group, in order: `Late`, `Today`, `Tomorrow` (hint the weekday), each weekday (hint `in 3 days`), `In 1 week` (hint `Oct 16–22`), `In 2 weeks`, `In 3 weeks`, then month names. Each heading (level 2) reads label, hint, count. Late's tab is warm and its cards carry no tint of their own.
- `board-cards` puts cards two to a row once the list is 42rem wide (at 1440 and 1024, not at 390).
- `board-lines` turns each item from `In 1 week` on into one line: a Thread is `link "<title> <token>"`, a Note `button "Open note: <preview>"`; either opens like its card.
- `board-no-date` lists undated items in `complementary "No date"` (from `lg`) under `Ready to move`, `Open`, and `Notes` (level 3). With nothing undated it reads `Everything open has a date.`
- `board-no-date-folded`: below `lg`, `region "No date"` leads the list with one `button` (`expanded=false`) reading `<first>, <second> and <n> more`. Clicking it shows the runs in place and reads `Hide`. Not shown when nothing is undated.
- `board-card` renders Threads and Notes with the same three rows. A Thread card shows `link "<title>"`, the Task that leads it (the dated Task that placed it, else the Focused Task, else the only Task, else `N tasks · none focused`), `Set date` / `Change date`, and `Complete “<task>”`. A Note card shows `button "Open note: <plain-text preview>"`, `Set follow-up date`, and `Archive note`.
- `board-card-actions` completes a Task, dates a Note, and archives a Note from the card (`Note archived`).
- `board-filter`: see [Notes on the Dashboard](./notes-on-the-dashboard.md) and [Manage areas](./manage-areas.md). Chips that do not fit fold into `button "<n> more"`.
- `board-time` (ADR 0027): a dated Task or a Note's Follow-up date may carry a time, set from `button "Add time"` under every date picker's calendar. Within a day, untimed items come first, then timed ones in time order. A timed card under `Today`, `Tomorrow` or a weekday shows the time alone (`3 PM`); elsewhere it follows the date token (`−2d · 9:30 AM`).
- `board-chrome`: `banner "Vita OS"` holds the logo link `Vita OS home`, the weekday and date, and from `lg` `Search, Command K`, `New note`, `New thread` and the account button. Below `lg`, `navigation "Actions"` at the bottom holds `Search, Command K`, `New thread` and `New note` (shown as `Note`).

## How to get to it (user POV)

- Sign in. The Dashboard at `/` is the landing page.
- Create Threads per [Create a thread](./create-thread.md), give them Tasks per [Tasks](./tasks.md), and capture Notes per [Capture a note](./capture-note.md). Date a Thread by giving one of its Tasks a date and a Note with `Follow-up date` in the `New note` dialog. `flows/dated-tasks.flow` drives this end to end.

## Driving it with agent-browser

Preconditions: signed in at 1440×900, with Threads and Notes spread over Late, Today, the coming days, weeks out and undated.

- **List and No date.** Run `bun run verify open /`, `bun run verify browser -- wait --text "Late"`, then `bun run verify shot board-desktop`. The snapshot has `region "Late"`, `region "Today"` and the later groups, and `complementary "No date"` with its runs. `screenshot --full <evidence dir>/board-full.png` shows the one-line weeks and months at the foot.
- **Filter overflow.** With more Areas than fit (seven at 1440), the row ends `… <n> more`, `Notes <n>`, `Edit areas`. Run `find role button click --name "<n> more"`, then `find role menuitemradio click --name "<Area> <count>"`: the URL gets `?area=<slug>` and the chosen Area takes the last visible chip.
- **Thread from a card.** `find role link click --name "<title>" --exact` opens `complementary "<title>"` at 1440 (`dialog "<title>"` below 1280); `find role button click --name "Close thread"` closes it.
- **Card actions.** `find role button click --name "Complete “<task>”" --exact`, reload, and `bun run verify d1 "SELECT title, moves_json FROM threads"`: the completed one-off Task is gone and the Thread moves to `No date` → `Open`.
- **Phone.** `set viewport 390 844`, `reload`: the folded `No date` leads the list; `find role button click --name "<first>, <second> and <n> more"` opens it. The bottom `navigation "Actions"` opens the palette and the New note dialog. Run `set viewport 1440 900` afterwards.

## Gotchas

- The open Thread pane covers the header's right-hand actions and the right of the list at 1280px and up (ADR 0023, ADR 0037). Close it (`Close thread`) before clicking `New thread`, `New note`, or a card in the right column, or use the palette.
- Below `lg` the header's actions are hidden and the bottom bar's are shown; both share names (`New note`, `New thread`, `Search, Command K`), so `find role button --exact` matches whichever is on screen.
- The time field is Chrome's native time input. Click `Add time`, then `press` each key (`3`, `0`, `0`, `p`), and confirm with `get value 'input[type=time]'`.
- Card controls only show on hover or focus. They still exist in the accessibility snapshot, so `find role button` reaches them without a hover.
- `Archive note` with `--exact` matches the first note card on the board. Scope with XPath when several Notes are open: `click 'xpath=//li[.//button[starts-with(@aria-label,"Open note: <text>")]]//button[@aria-label="Archive note"]'`.
- The sky follows the browser's clock; there is no override to preview another hour in the product (the lab prototype takes `?hour=`).
